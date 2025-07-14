# Headless-Build Enablement Plan

> Goal: keep full Editor workflow **and** allow the project to build & run in headless/server mode  
> Target CLI: `Unity.exe -batchmode -nographics` (or *Enable Headless Mode* build flag)

---

## 1. What Currently Breaks a Player/Headless Build

| Category | Typical APIs Seen | Files (non-Editor paths) that call them |
| -------- | ---------------- | --------------------------------------- |
| **Editor-only namespaces** | `using UnityEditor;`, `UnityEditor.*` | Effects/ObjectDropAndDisappearOnCollision.cs; Utilities/AudioGenerationEventLogger.cs; Utilities/ScreenshotManager.cs; Utilities/ShowRecorder.cs; Utilities/YouTubeTranscriptGenerator.cs; ShowRunner/* (multiple); APIs/* (multiple); ShowrunnerPort/ShowrunnerSpeakerElevenLabs.cs |
| **AssetDatabase calls** | `AssetDatabase.*` | same as above |
| **EditorApplication / EditorUtility** | `EditorApplication.delayCall`, `EditorUtility.SetDirty` | CommercialManagerSetup.cs, ApiCaller.cs, etc. |
| **Recorder package** | `UnityEditor.Recorder.*` | Utilities/ShowRecorder.cs |
| **Render-dependent features** (fail in `-nographics`) | `VideoPlayer`, `ScreenCapture`, UI cameras | CommercialManager.cs, OutroCaller.cs, IntroSequenceManager.cs, etc. |

Any script outside an **Editor** folder that references these APIs will stop the build.

---

## 2. Architectural Changes

### 2.1 Split Assemblies

1. **Aishow.Runtime.asmdef** – located at `Assets/Scripts/`; no `UnityEditor` reference.  
2. **Aishow.Editor.asmdef** – located at `Assets/Scripts/Editor/`; *allow unsafe code*, reference `UnityEditor` and optional packages (Recorder, Addressables Editor, etc.).

### 2.2 Move Pure Editor Code

Relocate all custom inspectors, windows, menu items, build scripts into `Assets/Scripts/Editor/**`.

### 2.3 Patch "Hybrid" Scripts

For each runtime script that still needs an Editor call:

```csharp
#if UNITY_EDITOR
using UnityEditor;
#endif

...

#if UNITY_EDITOR
EditorUtility.SetDirty(asset);
#endif
```

*or* split into two files:

- `Foo.Runtime.cs`   // no UnityEditor reference  
- `Foo.Editor.cs`    // lives under *Editor/*, contains editor-only helpers

### 2.4 Runtime Replacements

| Current Use | Runtime-safe Alternative |
| ----------- | ----------------------- |
| `AssetDatabase.LoadAssetAtPath` | `Resources.Load`, **Addressables**, or StreamingAssets |
| `AssetDatabase.Refresh / SetDirty` | **Skip** in builds (`#if UNITY_EDITOR`) |
| Unity Recorder | Move to Editor only; add a **stub** class in runtime that throws `NotSupportedException` if referenced |
| `VideoPlayer`, UI rendering, ScreenCapture | Wrap with `if (!Application.isBatchMode)` or `#if !HEADLESS_RUN` |

### 2.5 Unity Recorder & Capture Strategy

Unity Recorder (package `com.unity.recorder`) is **Editor-only** – its namespaces live under `UnityEditor.Recorder` and the code is stripped from player builds. Any calls will fail to compile.

1. **Relocate** all Recorder scripts (e.g. `Utilities/ShowRecorder.cs`) into `Assets/Scripts/Editor/` **or** an Editor-only assembly.
2. **Stub** the API for runtime builds so references still link:

```csharp
// Assets/Scripts/Stubs/ShowRecorderStub.cs
#if !UNITY_EDITOR
using UnityEngine;

public static class ShowRecorder
{
    public static bool IsRecording => false;
    public static void StartRecording() =>
        Debug.LogWarning("ShowRecorder.StartRecording() called in build – Recorder is Editor-only.");
    public static void StopRecording()  { }
}
#endif
```
3. **If headless capture is required** you need an external pipeline:
   * Render off-screen in a *graphics* build (omit `-nographics`) and pipe frames to **FFmpeg**.
   * Or export raw data (PNG sequences, JSON telemetry) and encode with FFmpeg as a post-step.

> FFmpeg itself is a standalone CLI tool – you *can* launch it from a headless Unity process via `System.Diagnostics.Process`. What you *cannot* do in `-nographics` mode is rely on Unity's GPU back-end to produce colour buffers; there is simply no render surface. Therefore: either skip capture in true headless, or run with a GPU/virtual-GPU present.

---

## 3. Headless Guards & Symbols

1. Add scripting define symbol **HEADLESS_RUN** in *Build Settings → Player → Other Settings → Scripting Define Symbols* for the headless configuration.  
2. Detect headless mode at runtime:

```csharp
bool isHeadless =
    Application.isBatchMode ||
    SystemInfo.graphicsDeviceType == GraphicsDeviceType.Null ||
    (Application.isPlaying && (System.Environment.GetCommandLineArgs().Contains("-nographics")));
```

Use this flag to bypass video/UI/recorder paths.

---

## 4. Build Automation

### 4.1 Editor Build Script

`Assets/Scripts/Editor/Build/HeadlessBuild.cs`

```csharp
using UnityEditor;
using UnityEditor.Build.Reporting;

public static class HeadlessBuild
{
    [MenuItem("Build/Headless/Windows64")]
    public static void BuildWin64() =>
        Build("Builds/Win64Headless", BuildTarget.StandaloneWindows64);

    private static void Build(string path, BuildTarget target)
    {
        var opts = BuildOptions.EnableHeadlessMode |
                   BuildOptions.StrictMode        |
                   BuildOptions.CompressWithLz4HC;

        BuildReport report = BuildPipeline.BuildPlayer(
            EditorBuildSettings.scenes, path, target, opts);

        if (report.summary.result != BuildResult.Succeeded)
            throw new System.Exception("Headless build failed");
    }
}
```

### 4.2 CI Command Example

```bash
Unity.exe -quit -batchmode -nographics \
         -projectPath %WORKSPACE% \
         -executeMethod HeadlessBuild.BuildWin64
```

---

## 5. Implementation Timeline

| Step | Est. Time | Responsible |
| ---- | --------- | ----------- |
| Add asmdefs & move pure Editor scripts | 30 min | — |
| Patch 16 hybrid files (wrap/split) | 1–2 h | — |
| Provide runtime alternatives (Asset loading, Recorder stub) | 1 h | — |
| Add `HEADLESS_RUN` guards for video/UI paths | 30 min | — |
| Build script + first headless build test | 30 min | — |
| Manual smoke-test & CI integration | 1 h | — |

---

## 6. "Definition of Done" Checklist

- [ ] No `using UnityEditor` outside **Editor** assembly or `#if UNITY_EDITOR`
- [ ] Player build succeeds with *Enable Headless Mode* checked
- [ ] Executable runs via CLI with no missing-DLL or NullReference spam
- [ ] `Application.isBatchMode` logs **true**
- [ ] Core show-runner logic executes without rendering errors
- [ ] CI pipeline produces an artifact `Win64Headless/Aishow.exe`

---

### Next Action

1. Confirm the plan (or suggest tweaks).  
2. Select whether each hybrid script will be **wrapped** or **split**.  
3. Begin issuing code patches file-by-file. 