# CommercialManager Component

## Overview
The CommercialManager handles the playback of commercials during scene transitions in the show. It coordinates with the ShowRunner to pause and resume the show appropriately, manages commercial breaks, and handles transitions between commercials and show content.

## Data Structures

### Commercial
```csharp
[Serializable]
public class Commercial
{
    public string name;
    public VideoClip videoClip;
}
```
- Represents a single commercial
- Contains name and video clip reference

### CommercialBreak
```csharp
[Serializable]
public class CommercialBreak
{
    public string breakName;
    public List<Commercial> commercials = new List<Commercial>();
    public bool skipThisBreak = false;
}
```
- Represents a break containing multiple commercials
- Can be configured to be skipped
- Contains a list of commercials to play

## Configuration

### Component References
```csharp
[Header("Component References")]
[SerializeField] private RawImage videoDisplay;
[SerializeField] private VideoPlayer videoPlayer;
[SerializeField] private Canvas commercialCanvas;
[SerializeField] private CanvasGroup blackFadePanel;
private BackgroundMusicManager backgroundMusicManager;
```
- Video display and player components
- Canvas for commercial display
- Fade panel for transitions
- Background music manager reference

### Settings
```csharp
[Header("Configuration")]
public List<CommercialBreak> commercialBreaks = new List<CommercialBreak>();
public bool skipAllCommercials = false;
public int skipFirstNSceneChanges = 0;
```
- List of commercial breaks
- Global skip option
- Early scene change skip count

### Fade Settings
```csharp
[Header("Fade Settings")]
[SerializeField] private float fadeInDuration = 0.5f;
[SerializeField] private float holdDuration = 1.0f;
[SerializeField] private float fadeOutDuration = 0.5f;
```
- Fade in duration
- Hold duration
- Fade out duration

## Core Functionality

### Commercial Break Trigger
```csharp
public void TriggerCommercialBreak()
```
- Called on scene changes
- Checks skip conditions
- Manages break cycling
- Coordinates with ShowRunner

### Commercial Playback
```csharp
private IEnumerator PlayCommercialBreakCoroutine(CommercialBreak commercialBreak)
```
- Plays commercials in sequence
- Handles transitions
- Manages video player
- Coordinates with background music

### Fade Management
```csharp
private IEnumerator FadeCanvasGroup(CanvasGroup cg, float targetAlpha, float duration)
```
- Handles fade transitions
- Smooth alpha transitions
- Configurable duration

### Skip Functionality
```csharp
public void SkipCurrentCommercials()
```
- Allows skipping current break
- Handles cleanup
- Resumes show

## Best Practices
1. Configure commercial breaks in the Unity Inspector
2. Set appropriate fade durations for smooth transitions
3. Use skipFirstNSceneChanges for testing
4. Ensure video clips are properly formatted
5. Test commercial breaks with different configurations

## Error Handling
- Validates component references
- Handles missing ShowRunner instance
- Manages video player errors
- Provides fallback for missing components
- Logs important events and errors

## Integration Points
- ShowRunner: For show pause/resume
- VideoPlayer: For commercial playback
- BackgroundMusicManager: For music transitions
- Canvas System: For display management
- Scene System: For transition coordination

## Performance Considerations
- Video playback memory usage
- Transition effect performance
- Canvas group updates
- Memory management for video clips
- Scene transition timing

## Setup Requirements
1. Video display RawImage
2. VideoPlayer component
3. Commercial canvas
4. Black fade panel
5. Commercial video clips
6. Background music manager

## Debugging
- Logs commercial break triggers
- Tracks scene change count
- Monitors skip conditions
- Reports missing components
- Tracks playback state 