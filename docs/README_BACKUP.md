# ShowRunner System Documentation

## Overview
The ShowRunner system is a Unity-based framework for managing interactive shows, episodes, and scenes. It provides a robust architecture for loading, playing, and controlling show content with a user-friendly interface.

News source = https://gm3.github.io/news-browser/

## Core Components

### 1. ShowRunner
The central controller class that orchestrates the entire show experience.

**Key Responsibilities:**
- Loading and managing show data
- Controlling episode playback
- Handling scene transitions
- Processing events
- Managing show state

**Main Methods:**
- `LoadShowData()`: Loads show content from JSON files
- `SelectEpisode(int index)`: Handles episode selection
- `PrepareScene(string sceneName)`: Manages scene preparation
- `SendSpeakEvent(string actor, string line, string action)`: Controls dialogue

### 2. ShowData
Data structures for managing show content.

**Classes:**
- `ShowData`: Root container for show information
- `Episode`: Represents a single episode
- `Scene`: Contains scene-specific data
- `Dialogue`: Manages character dialogue

### 3. ShowRunnerUI
Manages the user interface and user interactions.

**Features:**
- Episode selection dropdown
- Play/Pause controls
- Next scene/dialogue navigation
- Status updates
- Manual/Auto mode switching

### 4. ShowRunnerUIContainer
Container class for UI elements and state management.

**Responsibilities:**
- Managing UI element references
- Handling UI state
- Coordinating UI updates
- Managing UI visibility

### 5. CommercialManager (New)
Handles the playback of video commercials during scene transitions.

**Key Responsibilities:**
- Detecting scene changes via ShowRunner.
- Pausing ShowRunner's internal state during playback.
- Playing sequences of video clips (commercials).
- Managing configurable commercial breaks (order, skipping).
- Implementing a fade-to-black transition between commercials and the next scene.

**Main Methods:**
- `TriggerCommercialBreak()`: Called by ShowRunner to initiate a commercial check.
- `SkipCurrentCommercials()`: Allows manually stopping the current break.

## Recent Changes (Changelog)

**2024-05-15:**
*   **EventManager Enhancements:** Updated `EventManager.cs` to support translated transcript generation events:
    *   Added `TranslatedTranscriptData` struct to carry information about the translated transcript, including language details.
    *   Introduced a new static event `OnTranslatedTranscriptGenerated` that fires when a translated transcript file is successfully generated and saved.
    *   Implemented the `RaiseTranslatedTranscriptGenerated` static method to invoke the `OnTranslatedTranscriptGenerated` event, providing details such as episode ID, language, and file path.

**2024-05-01:**
*   **YouTube Transcript Generator:** Added a new system (`YouTubeTranscriptGenerator` + Editor script) to automatically generate a formatted text transcript (`.txt`) upon episode completion. This includes:
    *   Parsing the show's JSON data.
    *   Formatting output with actor names and lines (scene headers removed for clarity, 'tv' actor commands skipped).
    *   Saving the transcript to `Assets/Resources/Transcripts/`.
    *   Integrated event handling (`EventManager.OnEpisodeComplete`, `ShowRunner.OnLastDialogueComplete` modified) to trigger generation automatically.
*   **Bug Fix (CameraStateMachine):** Resolved `CS0123` errors by explicitly qualifying namespaces (`UnityEngine.SceneManagement`) for `SceneManager`, `Scene`, and `LoadSceneMode` to prevent ambiguity during compilation.
*   **TV Media Display:** Noted that the transcript generator skips dialogue lines from the 'tv' actor, which are used for displaying images/media during the show.

## Data Flow

1. **Show Loading:**
   ```
   JSON Files -> ShowData -> ShowRunner -> UI Display
   ```

2. **Episode Playback:**
   ```
   User Selection -> ShowRunner -> [Commercial Check] -> Scene Preparation -> Dialogue Processing
   ```

3. **Event Processing:**
   ```
   ShowRunner -> EventProcessor -> ScenePreparationManager -> Scene Loading
   ```

## Scene Preparation

1. **Process:**
   - User selects episode
   - Scene preparation event created
   - Scene loaded asynchronously
   - Intro sequence played
   - Scene activated

2. **Components:**
   - `ScenePreparationManager`: Handles scene loading
   - `EventProcessor`: Processes scene events
   - `IntroSequenceManager`: Manages transitions

## UI System

1. **Components:**
   - Episode dropdown
   - Control buttons (Load, Next, Play/Pause)
   - Status display
   - Scene information

2. **States:**
   - Manual mode: User-controlled progression
   - Auto mode: Automatic playback
   - Loading state
   - Playing state
   - Paused state

## Event System

1. **Event Types:**
   - `prepareScene`: Scene preparation
   - `speak`: Character dialogue
   - `episodeGenerated`: Episode loading

2. **Processing:**
   - Events created by ShowRunner
   - Processed by EventProcessor
   - Handled by appropriate managers

## Setup and Configuration

1. **Required Components:**
   - ShowRunner GameObject
   - UI Container
   - Event Processor
   - Scene Preparation Manager

2. **JSON Structure:**
   ```json
   {
     "config": {
       "name": "Show Name",
       "actors": { ... }
     },
     "episodes": [
       {
         "id": "episode1",
         "name": "Episode 1",
         "scenes": [ ... ]
       }
     ]
   }
   ```

## Best Practices

1. **Scene Setup:**
   - Include all required components
   - Set up UI references
   - Configure event processors

2. **Content Creation:**
   - Follow JSON schema
   - Include all required fields
   - Validate content before loading

3. **Performance:**
   - Use async loading
   - Manage memory efficiently
   - Handle errors gracefully

## Future Improvements

1. **Potential Enhancements:**
   - Additional UI features
   - More event types
   - Enhanced error handling
   - Performance optimizations

2. **Considerations:**
   - Scalability
   - Maintainability
   - User experience
   - Performance impact

# AISHOW - Unity Showrunner

## Overview
A virtual production project in Unity, powered by dynamic scripts generated by AI.

Behind The Scenes https://www.youtube.com/watch?v=fIGoyaEd0Hw

![image](https://github.com/user-attachments/assets/7adcc2b0-9957-4467-811b-0861fff04158)

## Project Overview

Example Video 
https://www.youtube.com/watch?v=eLJt2i02mkI&t=2s

## References
- **Software Dependencies**:
  - Unity - `Unity 2022.3.53f1` https://unity.com/download
  - uniVRM VRM 1.0 - https://github.com/vrm-c/UniVRM/releases/tag/v0.128.0
  - Sithlords Showrunner Framework for generating JSON https://hackmd.io/@smsithlord/Hk7NOUrmke

## Framework 
- The 3D visualization framework uses **Unity** for rendering.
- Sithlords AI showrunner generats a show and handles TTS currently
     
## Implementation

### ShowRunner System

The ShowRunner system is a Unity-based framework that manages interactive shows, episodes, and scenes with a user-friendly interface. Key components include:

- **ShowRunner**: Central controller that orchestrates the entire show experience
- **ShowData**: Data structures for managing show content
- **ShowRunnerUI**: Manages user interface and interactions
- **ShowRunnerUIContainer**: Container class for UI elements and state management

For detailed technical documentation on the ShowRunner system, see [ShowRunner.md](ShowRunner.md).

### Event Processing

The system now uses a direct event-driven approach

```csharp
public void ProcessEvent(EventData eventData)
{
    switch (eventData.type)
    {
        case "prepareScene":
            HandlePrepareScene(eventData);
            break;

        case "speak":
            HandleSpeak(eventData);
            break;

        default:
            Debug.LogWarning($"Unknown event type: {eventData.type}");
            break;
    }
}
```

## WIki
- Started a WIKI https://github.com/elizaOS/aishow/wiki to go over the details of the system, and give examples of how things work.

## Screenshots

![image](https://github.com/user-attachments/assets/342849c1-fbeb-4d72-b4bf-d2a7c537033b)


![image](https://github.com/user-attachments/assets/9e63f3d1-c45a-4efc-acfa-46abedf8e2d9)

      
## Overview  
The **AI Show** is an interactive experience designed to engage DAO members through immersive AI-driven content. This project leverages Unity to create 3d video content that enhances community engagement and provides real value to participants in the form of automated and streamlined production. SO far the MVP works well, and here is a breakdown of current and future goals:  

## Purpose  
The purpose of this project is to:  
- Provide engaging content for DAO members.
- Creative ways to update the DAO and community with news, and content to grow awareness of the projects we are working on and contributions.  
- Showcase AI capabilities for 3d show production techniques.  
- Encourage community participation and discussion around AI technologies.  
- Foster collaboration and innovation within the DAO ecosystem.

![image](https://github.com/user-attachments/assets/8e5d01fc-18b5-466b-8c9c-0da2925d6b7b)

## Value Proposition  
The AI Show benefits the DAO by:  
- Enhancing member engagement through interactive storytelling and video content.  
- Showcasing cutting-edge AI applications within a virtual environment instead of just chatbots and 2d interfaces.  
- Creating opportunities for user-generated content and contributions.
- Automation of gathering summaries and updates from the ElizaOS and bringing them to the wider audience through the news show.  
- Strengthening community bonds through shared interactive experiences.
- Build social media with rich 3d content and video.

![image](https://github.com/user-attachments/assets/e460b3b3-4cef-4488-8bd2-364dea51fc70)

## Changelog
*   **YouTube Transcript Generator:** Added a new system (`YouTubeTranscriptGenerator` + Editor script) to automatically generate a formatted text transcript (`.txt`) upon episode completion. This includes:
    *   Parsing the show's JSON data.
    *   Formatting output with actor names and lines (scene headers removed for clarity, 'tv' actor commands skipped).
    *   Saving the transcript to `Assets/Resources/Transcripts/`.
    *   Integrated event handling (`EventManager.OnEpisodeComplete`, `ShowRunner.OnLastDialogueComplete` modified) to trigger generation automatically.
*   **Bug Fix (CameraStateMachine):** Resolved `CS0123` errors by explicitly qualifying namespaces (`UnityEngine.SceneManagement`) for `SceneManager`, `Scene`, and `LoadSceneMode` to prevent ambiguity during compilation.
*   **TV Media Display:** Noted that the transcript generator skips dialogue lines from the 'tv' actor, which are used for displaying images/media during the show.

Active development for the last two months, but In the last 2 weeks, we hit some milestones:
- Been producing an episode per day for almost a month, missing only a few days when aggregator was down (devs are working on update to aggrogator)
- Added happy, sad, emotions to visemes 
- Added lazer eyes and props that can spawn based on actions 
- Added rigs and animations to all characters, and mapped them to actions
- Added IK to all characters so that feet stay on ground, and hands can be placed
- Added IK override to disable IK for animations that don't need it 
- Added mediaTV, which takes an image URL and loads it onto the TV when the actor is labeled "tv"
- Added Oculus Lip Sync package and tested the mic to map visemes (works), awaiting to do TTS inside Unity using an Audio Source to feed the Lip Sync
- **Major Architecture Update**: Refactored the system to use a more efficient ShowRunner architecture, replacing the polling-based approach with a direct event-driven system for better performance and maintainability

**Commercial & Transition System**: 
  - Added `CommercialManager` to handle playing video commercials between scenes.
  - Implemented pausing/resuming of `ShowRunner` state (not `Time.timeScale`) during breaks.
  - Added configurable commercial breaks with looping and skipping options.
  - Included a configurable fade-to-black screen (`CanvasGroup` based) with hold time between commercials and the next scene.
  - Implemented cross-fade logic: Fade-to-black overlaps the end of the last commercial, `ShowRunner` resumes immediately after video ends to allow scene prep during fade/hold.

**Background Music & Commercial Integration**:
  - Added `BackgroundMusicManager` to handle scene-specific music.
  - Integrated `BackgroundMusicManager` with `CommercialManager` to fade music out during commercial breaks.
  - Ensured background music resumes correctly for the *current* scene after commercials finish, fixing an issue where it previously reverted to the pre-commercial scene's music.

**Outro Manager"
  - Added a way to pick a video for the outro

## Things we can improve
- Perhaps we can have the prompts updated to deliver more of the updates or longer episodes that can be edited down. As of now the ShowRunner scripts use AI to pick, and summarize these updates. Not all of them are considered. 
- Can improve the approach to "curated" updates, where we have media, and certain specific topics to discuss, and how to update the showrunner to accomplish that.
- Get feedback from DAO for more feature requests
- Can integrate Eliza into the show writing AI pipeline.
- Reach the core audience better by defining the audience and where to publish to. Currently we publish to youtube, but the community and DAO are not seeing the videos unless we tweet them.

## Conclusion  
The AIShow blends AI innovation with community-driven engagement via video content. By leveraging Automation of github updates to a Unity pipeline, it aims to create video production that strengthens the DAO ecosystem while demonstrating the power of interactive AI.  

## Links  
- [Project Repository](https://github.com/elizaOS/aishow)  

![image](https://hackmd.io/_uploads/By0Ounc71x.png)

`Unity 2022.3.53f1`

## Headless Build (Server Mode)

> For full details see `docs/HEADLESS_BUILD.md` – the outline below is a quick reference.

1. **Why it breaks now**  
   Editor-only APIs (`UnityEditor.*`, Recorder, AssetDatabase) are referenced in runtime folders; headless builds also have no GPU surface.
2. **Fix strategy**  
   • Separate assemblies (`Aishow.Runtime.asmdef` vs `Aishow.Editor.asmdef`).  
   • Move/guard all Editor code (`#if UNITY_EDITOR`).  
   • Provide runtime-safe replacements or stubs for Recorder & AssetDatabase calls.  
3. **Unity Recorder**  
   Recorder is Editor-only – relocate its scripts to *Editor/* and add a stub in builds:

   ```csharp
   #if !UNITY_EDITOR
   public static class ShowRecorder {
       public static void StartRecording() => UnityEngine.Debug.LogWarning("Recorder is Editor-only");
       public static void StopRecording()  { }
   }
   #endif
   ```
4. **FFmpeg Capture in Headless**  
   You can *spawn* FFmpeg from a headless player using `System.Diagnostics.Process` – FFmpeg is a standalone CLI tool.  
   What you *cannot* do in `-nographics` is rely on Unity's GPU to give you a framebuffer; no colour buffer exists. Options:
   * Skip capture when `Application.isBatchMode` is true.
   * Run a **graphics-enabled** build on hardware/virtual GPU and pipe frames to FFmpeg.
   * Output raw data (PNG sequence, JSON telemetry) and encode to video as a post-step.
5. **Build menu command**  
   A sample `HeadlessBuild.cs` (Editor folder) adds *Build → Headless* menu and can be called from CI:

   ```bash
   Unity.exe -quit -batchmode -nographics \
            -projectPath <path> \
            -executeMethod HeadlessBuild.BuildWin64
   ```
6. **Definition of Done**  
   - No `UnityEditor` refs in runtime assemblies  
   - Player builds with *Enable Headless Mode*  
   - `Application.isBatchMode` reports **true**  
   - Optional capture pipeline works or is safely skipped.



