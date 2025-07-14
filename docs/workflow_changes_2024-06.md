# AI Show – Workflow Updates (June 2024)

## 1. Centralised Paths
* **`PathUtility.cs`** (Assets/Scripts/Utilities)
  * `GetEpisodeFolder(episodeId)`
  * `GetAudioFolder(episodeId, lang)`
  * `GetRecordingFolder(episodeId)`
  * `EnsureDirectory(path)`
* All generators/recorders now use these helpers.  No more duplicated `Application.dataPath` strings.

## 2. New Episode-ID format
* `ShowrunnerManager.GetNextEpisodeId()` now returns `YYYY-MM-DD` (UTC) instead of `S#E#`.
  * Easier to read and lines up with folder naming.

## 3. CLI improvements
* `-outputDir` flag is **optional**.
  * If omitted, recordings land in `Assets/Resources/Episodes/<episodeId>/recordings` automatically.
* Other flags unchanged (`-episodePath`, `-generate`, `-record`, etc.).

## 4. Archiving / Deliverables
* **`EpisodeArchiver.cs`** copies a full episode folder into `Exports/<episodeId>` (project-root).  It then rewrites every `*_metadata*.json` so:
  * `video_file` → `recordings/<file>.mp4`
  * `thumbnail_file` → `media/thumbnails/<file>.jpg`
* Call from Console:
  ```csharp
  ShowRunner.Utility.EpisodeArchiver.Archive("2024-06-16");
  ```

## 5. Recording tweaks
* `ShowRecorder` now writes directly to the PathUtility recording folder.

## 6. Audio generation tweaks
* `ShowrunnerSpeakerElevenLabs` saves MP3s using PathUtility, matching the new folder layout.

## 7. Where files live now
```
Assets/Resources/Episodes/<episodeId>/
├─ <showId>_<episodeId>_en.json
├─ audio/<lang>/<episodeId>_<scene>_<line>.mp3
└─ recordings/<episodeId>_<timestamp>.mp4 (+ .json side-car)

Exports/<episodeId>/  (when archived)
└─ … identical structure, but metadata paths fixed.
```

## 8. Centralised API-Key assignment
* **`ShowGeneratorApiKeysBroadcaster.cs`**
  * Add this component to a single GameObject in the startup scene and drag your `ShowGeneratorApiKeys.asset` onto it.
  * On Awake it walks all MonoBehaviours and auto-fills any field of type `ShowGeneratorApiKeys` that is still null.
  * Eliminates the need to assign the asset manually in every inspector.

## 9. Default template episode
* `TemplateEpisodeBootstrapper` (Editor-only)
  * Looks for `Assets/Resources/Episodes/**/*.json`.
  * If none found, copies entire sub-directories from `Assets/ExampleEpisode/` (e.g. `S1E85/`) into `Assets/Resources/Episodes/` and also any loose JSON into `TEMPLATE/`.
  * Runs automatically on script reload/import; build players are unaffected.

## 10. Inspector cleanup – single-source API keys
* All runtime scripts already had the field hidden via `[HideInInspector]`.  Today we also removed the old slot from every **custom Editor** so you can no longer drag the ScriptableObject by mistake.
  * `JsonTranslationServiceInspector.cs`
  * `TranscriptTranslatorInspector.cs`
  * `ElevenLabsOneLineHelperEditor.cs`
* The only visible reference is now on the `ShowGeneratorApiKeysBroadcaster` GameObject.
* At runtime the broadcaster injects the asset everywhere, avoiding human error and prefab churn.

## 11. Automatic numeric suffix
* If you generate more than one episode on the same day the system now appends `_1`, `_2`, … to the date so nothing is overwritten.
  * Example: first run → `2024-06-18`  · second run → `2024-06-18_1`.

* Recording filenames are now `<episode>_<lang>_<timestamp>.mp4` (e.g. `2024-06-18_en_154501.mp4`).

## 12. Batch-mode & CLI stability fixes (June 2025)
* **Intro sequence in headless runs**
  * `IntroSequenceManager` now detects `-batchmode` and uses real-time waits.
  * Animator steps are capped to **max 2 s** to avoid multi-second camera moves freezing CI jobs.
  * `VideoPlayer` steps fall back to *clip-length + 1 s* (default 5 s) when no GPU is available.
* **Safe headline parsing**
  * `HeadlineLoader` switched to token-safe access, eliminating *InvalidCastException* spam.
* **Recorder robustness**
  * `ShowRecorder` performs without `-nographics`; ensure your CLI **omits** that flag.
* **Recommended CLI pattern**
  ```powershell
  & "C:\Program Files\Unity\Hub\Editor\2022.3.53f1\Editor\Unity.exe" `
     -batchmode -logFile - `
     -projectPath "<path-to-project>" `
     -executeMethod ShowRunner.CLI.EpisodeProcessorCLI.ProcessFlexibleBatchFromCommandLine `
     -generate -record `
  | Tee-Object -FilePath "C:\temp\cli_live.log"
  ```
  The back-tick continues the command; *do not* include `-nographics`.

Additions made by commit June-16-2025. Refer to this file when updating CI scripts or documentation.

## 13. EpisodeProcessorCLI – full flag reference
The **EpisodeProcessorCLI** script exposes four entry-points that you can call from a headless Unity instance:

| Entry-point | Purpose |
|-------------|---------|
| `ShowRunner.CLI.EpisodeProcessorCLI.ProcessEpisodeFromCommandLine` | Render **one** language episode JSON straight to MP4. |
| `ShowRunner.CLI.EpisodeProcessorCLI.ProcessBatchFromCommandLine` | Record every language variant found under `Assets/Resources/Episodes/<episodeId>/…`. |
| `ShowRunner.CLI.EpisodeProcessorCLI.GenerateAndRecordBatchFromCommandLine` | Generate *and then* record a full batch in one run. |
| `ShowRunner.CLI.EpisodeProcessorCLI.ProcessFlexibleBatchFromCommandLine` | Unified entry – combine **-generate** and **-record** flags in a single call. |

### Command-line flags
| Flag | Type / Default | Applies to | Notes |
|------|----------------|-----------|-------|
| `-episodePath <file>` | string · **required** | ProcessEpisode | Path to a single `*_en.json` episode file. |
| `-outputDir <dir>` | string · *auto* | ProcessEpisode | Folder for MP4 output. Defaults to `…/recordings/` alongside the JSON. |
| `-episodeIndex <n>` | int · 0 | ProcessEpisode | When the JSON contains multiple episodes pick which index to play. |
| `-width <px>` | int · 1920 | all recorders | Horizontal resolution of the recording. |
| `-height <px>` | int · 1080 | all recorders | Vertical resolution. |
| `-frameRate <fps>` | float · 30.0 | all recorders | Recording frame-rate. |
| `-batchEpisodeId <id>` | string · none | BatchProcess / Flexible | Folder name inside `Episodes/` to record (e.g. `2024-06-18`). |
| `-configPath <file>` | string · none | Generate* | Explicit `ShowConfig` JSON to drive **Generate** pipelines. |
| `-generate` | switch | Flexible | Create a fresh episode (incl. translations & audio). |
| `-record` | switch | Flexible | Record existing episode(s) with `BatchRecorder`. |

### Examples
• **Render a single JSON to MP4:**
```powershell
& "<Unity>/Unity.exe" -batchmode -logFile - `
   -projectPath "<project>" `
   -executeMethod ShowRunner.CLI.EpisodeProcessorCLI.ProcessEpisodeFromCommandLine `
   -episodePath "Assets/Resources/Episodes/2024-06-18/2024-06-18_en.json" `
   -outputDir "C:\exports" `
| Tee-Object -FilePath cli.log
```

• **Record all language variants for an existing episode folder:**
```powershell
& "<Unity>/Unity.exe" -batchmode -logFile - `
   -projectPath "<project>" `
   -executeMethod ShowRunner.CLI.EpisodeProcessorCLI.ProcessBatchFromCommandLine `
   -batchEpisodeId "2024-06-18" `
| Tee-Object -FilePath cli.log
```

• **Generate + record in one go (preferred for CI):**
```powershell
& "<Unity>/Unity.exe" -batchmode -logFile - `
   -projectPath "<project>" `
   -executeMethod ShowRunner.CLI.EpisodeProcessorCLI.ProcessFlexibleBatchFromCommandLine `
   -generate -record `
| Tee-Object -FilePath cli.log
```

> Tip: **Do not** add `-nographics`; the Recorder and VideoPlayer need a virtual GPU context even in CI.

Additions made by commit June-17-2025. Refer to this file when updating CI scripts or documentation. 