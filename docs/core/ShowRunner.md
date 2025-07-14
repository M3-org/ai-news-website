# ShowRunner Core Component

**File:** `Assets/Scripts/ShowRunner/ShowRunner.cs`

## Overview
The ShowRunner is the central controller class that orchestrates the entire show experience in the AISHOW system. It manages show playback, scene preparation, event processing, and coordinates between various subsystems.

## Key Responsibilities
- Loading and managing show data from JSON files
- Controlling episode playback and scene transitions
- Processing events and managing show state
- Coordinating audio playback and actor interactions
- Managing manual/auto playback modes
- Handling scene preparation and transitions

## Configuration
```csharp
[Header("Configuration")]
[SerializeField] private string episodesRootPath = "Episodes";
[SerializeField] private float dialogueDelay = 0.5f;
[SerializeField] private bool playAudioFromActors = true;
```

## Dependencies
- `EventProcessor` (`Assets/Scripts/ShowRunner/EventProcessor.cs`): Handles event processing
- `ScenePreparationManager` (`Assets/Scripts/ShowRunner/ScenePreparationManager.cs`): Manages scene loading and preparation
- `SceneTransitionManager` (`Assets/Scripts/ShowRunner/SceneTransitionManager.cs`): Handles scene transitions
- `AudioSource`: Default audio source for playback
- `ShowRunnerUI` (`Assets/Scripts/ShowRunner/ShowRunnerUI.cs`): User interface integration

## Public API Reference

### Static Properties
- **`static ShowRunner Instance { get; private set; }`**
  - Singleton instance for accessing ShowRunner from other components

### Public Events
- **`event Action<EpisodeCompletionData> OnLastDialogueComplete`**
  - Fired after the last dialogue line of the last scene completes
  - **Parameters**: `EpisodeCompletionData` (JsonFilePath, EpisodeId)

- **`event Action<string, string> OnEpisodeSelectedForDisplay`**
  - Fired when an episode is selected
  - **Parameters**: Episode name, Episode premise

- **`event Action OnEpisodeActualStart`**
  - Fired when an episode starts playback

- **`event Action<string> OnSceneChangedForDisplay`**
  - Fired when the current scene changes
  - **Parameters**: Scene name/location

### Show Loading and Management
- **`List<string> DiscoverShowFiles()`**
  - **Returns**: `List<string>` - Available show files
  - Finds all .json show files in Resources/Episodes

- **`void LoadShowData(string showDisplayName)`**
  - **Parameters**: `showDisplayName` (string) - Name of show file to load
  - Loads show data from JSON, clears previous data

- **`void ResetShowState()`**
  - Resets show-related state including episode, scene, and dialogue indices

### Episode Control
- **`void SelectEpisode(int index)`**
  - **Parameters**: `index` (int) - Episode index in dropdown
  - Handles episode selection, updates UI state and prepares for playback

- **`void NextStep()`**
  - Advances show playback to the next step (scene or dialogue)

- **`string GetCurrentEpisodeTitle()`**
  - **Returns**: `string` - Title of currently selected episode

- **`int GetTotalEpisodeCount()`**
  - **Returns**: `int` - Total number of episodes in loaded show

- **`List<string> GetEpisodeTitles()`**
  - **Returns**: `List<string>` - Episode titles in "ID: Name" format

- **`string GetCurrentEpisodeId()`**
  - **Returns**: `string` - ID of currently selected episode

### Scene Management
- **`string GetCurrentSceneLocation()`**
  - **Returns**: `string` - Location name from JSON for current scene

- **`int GetCurrentSceneIndex()`**
  - **Returns**: `int` - Current scene index (0-based), -1 if not applicable

- **`int GetCurrentDialogueIndex()`**
  - **Returns**: `int` - Current dialogue index within scene (0-based), -1 if not applicable

### Playback Control
- **`void SetManualMode(bool manual)`**
  - **Parameters**: `manual` (bool) - Enable manual stepping mode
  - Toggle between manual stepping and full auto-play

- **`void PauseShow()`**
  - Pauses ShowRunner's internal state progression (not Time.timeScale)

- **`void ResumeShow()`**
  - Resumes ShowRunner's internal state progression

### Data Access
- **`ShowData GetShowData()`**
  - **Returns**: `ShowData` - Complete loaded show data structure

- **`string GetLoadedShowFileName()`**
  - **Returns**: `string` - Name of currently loaded show file (without extension)

### Data Structures
- **`EpisodeCompletionData` (struct)**
  - `string JsonFilePath` - Path to episode JSON file
  - `string EpisodeId` - ID of completed episode

- **`ActorAudioMapping` (struct)**
  - `string actorName` - Name of the actor
  - `AudioSource audioSource` - Associated audio source component

## Events
- `OnLastDialogueComplete`: Fired when episode completes
- `OnEpisodeSelectedForDisplay`: Fired when episode is selected
- `OnSceneChangedForDisplay`: Fired when scene changes

## State Management
- Tracks current episode, scene, and dialogue indices
- Manages playback state and scene preparation status
- Handles internal pause state for commercial breaks

## Best Practices
1. Always initialize required components in Awake()
2. Use manual mode for testing and debugging
3. Handle scene preparation asynchronously
4. Cache audio sources for better performance
5. Validate show data before playback

## Error Handling
- Validates required components on startup
- Handles missing scene preparation manager
- Manages audio source assignment fallbacks
- Provides graceful degradation for missing components

## Integration Points
- CommercialManager: For commercial break integration
- UXAnimationManager: For episode end animations
- ShowRunnerUI: For user interface control
- EventProcessor: For event handling
- ScenePreparationManager: For scene management 