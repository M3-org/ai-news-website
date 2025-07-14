# AI-Show – *Draft* Additional CLI Flags

> **Status ⚠️ ** These flags are *not* in the code-base yet – they are **design ideas**.  The syntax, names and defaults below are open for discussion and may change before implementation.

These draft flags would expose existing inspector variables to the head-less tools (`EpisodeProcessorCLI`, `BatchRecorder`, …).  All would be **optional** – omitting them keeps the current default behaviour.

## Global Syntax
```powershell
-flagName <value>      # omit <value> for simple switches
```
Example of mixing several flags:
```powershell
-generate -languages "en,ko" -videoQuality Medium -autoAudio
```

---
## 1  ScreenshotManager
| Flag | Type / Default | Variable | Purpose | Example |
|------|----------------|----------|---------|---------|
| `-autoScreenshots` | switch (false) | isAutoScreenshottingEnabled | Enable automatic screenshots every *autoScreenshotInterval* seconds. | `-autoScreenshots` |
| `-screenshotInterval <sec>` | float · 30 | autoScreenshotInterval | Seconds between automatic captures. | `-screenshotInterval 10` |
| `-screenshotOnSpeak` | switch (false) | enableSpeakEventScreenshots | Capture a frame 1.5 s after every *speak* event. | `-screenshotOnSpeak` |
| `-screenshotJpgQuality <1-100>` | int · 75 | jpgQuality | JPEG compression quality. | `-screenshotJpgQuality 90` |

**Details**
• `-autoScreenshots` starts a coroutine that captures a frame every *autoScreenshotInterval* seconds — handy for timeline thumbnails.<br/>
• `-screenshotOnSpeak` piggybacks on *EventProcessor.OnSpeakEventProcessed* so it works in headless Play-Mode runs.<br/>

---
## 2  ShowRecorder
| Flag | Type / Default | Variable | Purpose | Example |
|------|----------------|----------|---------|---------|
| `-videoQuality High\|Medium\|Low` | enum · High | videoQuality | Encoder quality preset. | `-videoQuality Low` |
| `-noExitOnDone` | switch (false) | exitUnityWhenRecordingStops | Keep Unity running after recording (useful for chained editor scripts). | `-noExitOnDone` |

---
## 3  EpisodeArchiver
| Flag | Type / Default | Variable | Purpose | Example |
|------|----------------|----------|---------|---------|
| `-exportDir <path>` | path · "Exports" | (const ExportRoot) | Override destination root for archived episode folders. | `-exportDir "D:/DeliveredEpisodes"` |

---
## 4  ShowrunnerManager – Workflow Toggles
| Flag | Type / Default | Variable | Purpose | Example |
|------|----------------|----------|---------|---------|
| `-autoAudio` | switch | autoGenerateAudioAfterEpisode | Call ElevenLabs right after generation. | `-autoAudio` |
| `-autoTranscript` | switch | autoGenerateTranscriptAfterGeneration | Produce YouTube-style transcript `.txt`. | `-autoTranscript` |
| `-autoMetadata` | switch | autoGenerateMetadataAfterTranscript | Create YouTube metadata JSON after transcript. | `-autoMetadata` |
| `-translateMeta` | switch | autoTranslateMetadataAfterGeneration | Translate episode-level metadata as well. | `-translateMeta` |

### Generation / Translation
| Flag | Type / Default | Variable | Purpose | Example |
|------|----------------|----------|---------|---------|
| `-languages "en,ko,ch"` | csv · Inspector list | targetLanguages | Comma-separated ISO codes to generate. | `-languages "en,ko"` |
| `-translationInjection Prefix\|Suffix\|Both` | enum · Prefix | injectionLocation | Where to insert the translation prompt. | `-translationInjection Both` |
| `-customPrompt` | switch | useCustomPromptAffixes | Enable custom LLM prefix/suffix. | `-customPrompt` |
| `-promptPrefix "<text>"` | string | customPromptPrefix | Text inserted at top of prompt. | `-promptPrefix "You are an AI…"` |
| `-promptSuffix "<text>"` | string | customPromptSuffix | Text appended to prompt. | `-promptSuffix "End of prompt"` |

### API Routing / x23
*(examples omitted for brevity – will be filled after design review)*

---
## 5  ShowRunner (playback)
| Flag | Type / Default | Variable | Purpose | Example |
|------|----------------|----------|---------|---------|
| `-spatialAudio` | switch | playAudioFromActors | Play dialogue from actor positions. | `-spatialAudio` |

---
## 6  CommercialManager
| Flag | Type / Default | Variable | Purpose | Example |
|------|----------------|----------|---------|---------|
| `-skipAds` | switch | skipAllCommercials | Disable commercials globally. | `-skipAds` |
| `-skipAdsFirst <n>` | int · 0 | skipFirstNSceneChanges | Skip first *n* breaks. | `-skipAdsFirst 2` |

---
## 7  TranscriptTranslator (stand-alone)
| Flag | Type / Default | Variable | Purpose | Example |
|------|----------------|----------|---------|---------|
| `-ttProvider OpenRouter\|AnthropicDirect\|Wrapper` | enum · OpenRouter | currentApiProvider | Choose translation backend. | `-ttProvider AnthropicDirect` |
| `-ttModel "<model>"` | string | openRouterModelName | Explicit model name. | `-ttModel "anthropic/claude-3-haiku-20240307"` |

---
### Implementation Notes
1. Add matching fields to `CLIArguments` (nullable where appropriate).
2. Extend `ParseCommandLineArguments()` with `case` branches for each flag.
3. After locating components (ShowrunnerManager, ShowRecorder, etc.) apply the values:
   ```csharp
   if (cliArgs.autoAudio) mgr.autoGenerateAudioAfterEpisode = true;
   if (cliArgs.videoQuality.HasValue) recorder.videoQuality = cliArgs.videoQuality.Value;
   ```
4. Update `docs/README_CLI.md` once implemented.

*Last updated: 2025-06-16  — draft proposal* 