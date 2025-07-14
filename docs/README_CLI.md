# AI-Show – End-to-End Episode Automation

This document gathers **all** command-line switches and important Inspector toggles that drive the fully automated pipeline (generation → translation → audio → recording) that now runs through a single Unity batch-mode call.

---
## 1  Unity one-liner

```powershell
& "C:\Program Files\Unity\Hub\Editor\2022.3.53f1\Editor\Unity.exe" -batchmode -logFile - `
  -projectPath "C:\Users\dev\Documents\GitHub\aishow" `
  -executeMethod ShowRunner.CLI.EpisodeProcessorCLI.ProcessFlexibleBatchFromCommandLine `
  -generate -record | Tee-Object -FilePath "C:\temp\cli_live.log"
```
* Keep **`-batchmode`** but drop **`-nographics`** when `-record` is used so the Game-View has a real GPU surface.

---
## 2  EpisodeProcessorCLI flags

| Flag (=parameter)                 | Type / Example                 | Purpose & Behaviour |
|----------------------------------|--------------------------------|---------------------|
| `-generate`                      | _switch_                       | Create a new English episode, translate to selected languages, generate ElevenLabs audio + optional transcript/metadata. |
| `-record`                        | _switch_                       | Record all language variants of the chosen episode with `ShowRecorder`/`BatchRecorder`. |
| `-batchEpisodeId "S1E87"`       | string                         | Base ID whose *_en.json / *_ko.json / … files will be recorded. Optional when `-generate` is present (auto-filled). |
| `-configPath "path\file.json"`  | path                           | Explicit ShowConfig to load before generation. If omitted the tool auto-picks the latest `*_en.json` in `Resources/Episodes/`. |
| `-width 2560` `-height 1440`     | int                            | Override recording resolution (default 1920×1080). |
| `-frameRate 60`                  | float                          | Override recording FPS (default 30). |
| *legacy* `-episodePath`, `-outputDir`, `-episodeIndex` | — | Kept for the old single-file flow; harmless if unused. |

**Default logic:** if neither `-generate` nor `-record` is passed the script assumes both.

---
## 3  ShowrunnerManager – Inspector toggles that affect generation

| Field | Meaning |
|-------|---------|
| **`targetLanguages`** | Languages that will be produced in addition to English. The list controls the translation tasks. |
| **`useCustomPromptAffixes`** + `customPromptPrefix`/`Suffix` | If ON, the text is inserted at the very top / bottom of the LLM prompt. |
| **`autoGenerateAudioAfterEpisode`** | Generate ElevenLabs speech immediately after each language variant. |
| **`autoGenerateTranscriptAfterGeneration`** | Produce YouTube transcript `.txt` files. |
| **`autoGenerateMetadataAfterTranscript`** | Produce YouTube title/description/keywords JSON after the transcript. |
| **`useWrapperEndpoints`** | Send LLM requests to your own wrapper URL instead of Anthropic direct. |
| **`useX23ApiData`** (+ options) | Pull JSON from x23.ai and inject into the episode prompt. |

These are saved in the scene. If you need them to be controllable from the CLI pass the scene with the desired defaults or create a variant scene.

---
## 4  Audio / Video reliability tweaks (already in code)

1. **Intro / Outro video audio** is now routed through an `AudioSource` at runtime → avoids `AudioSampleProvider buffer overflow`.
2. When running in batch-mode the DSP buffer size is bumped to **2048 samples** for extra head-room.

---
## 5  Troubleshooting quick-refs

• **Unity exits early** → ensure you did **not** pass `-quit`. `ShowRecorder` will exit when the last MP4 is closed.
• **Blank video** → make sure `-nographics` is NOT present when recording. 
• **Payload debug** → every LLM request is saved to `Assets/Resources/LLMRequests/LLMPayload_<timestamp>.json`.
• **Reset run** → `Stop-Process -Name Unity*; Remove-Item "$env:LOCALAPPDATA\Unity\Editor\UnityLockfile"`.

---
## 6  Handy PowerShell snippets

```powershell
# 6.1 Clear stray Unity instances (processes + lockfiles)
Stop-Process -Name Unity*,UnityCrashHandler64,UnityShaderCompiler,\
              UnityPackageManager,UnityAutoQuitter,Unity.ILPP.Runner,\
              Unity.Licensing.Client -Force -ErrorAction SilentlyContinue;
Remove-Item -Force .\Library\UnityLockfile, .\Temp\UnityLockfile -ErrorAction SilentlyContinue

# 6.2 End-to-end generation + recording (live log tee)
& "C:\Program Files\Unity\Hub\Editor\2022.3.53f1\Editor\Unity.exe" -batchmode -logFile - `
  -projectPath "C:\Users\dev\Documents\GitHub\aishow" `
  -executeMethod ShowRunner.CLI.EpisodeProcessorCLI.ProcessFlexibleBatchFromCommandLine `
  -generate -record | Tee-Object -FilePath "C:\temp\cli_live.log"
```

---
Created 2025-06-14 – Automation pipeline v1.0 