# SceneTransitionManager Component

## Overview
The SceneTransitionManager handles scene transition animations and effects between scene changes in the show. It provides location-specific transitions, sound effects, and timing control for smooth scene changes.

## Data Structures

### LocationTransitionMapping
```csharp
[System.Serializable]
public struct LocationTransitionMapping 
{
    public string locationName;
    public Animator transitionAnimator;
    public string transitionTriggerParam;
    public AudioClip transitionSound;
    [Range(0f, 1f)] public float volume;
}
```
- Maps locations to transition effects
- Configures animators and sounds
- Controls transition timing
- Manages volume levels

## Configuration

### Transition Settings
```csharp
[Header("Transition Configuration")]
[SerializeField] private List<LocationTransitionMapping> transitionMappings;
[SerializeField] private Animator defaultTransitionAnimator;
[SerializeField] private string defaultTransitionTrigger = "StartTransition";
[SerializeField] private AudioClip defaultTransitionSound;
[Range(0f, 1f)] [SerializeField] private float defaultVolume = 0.5f;
```
- Location-specific mappings
- Default transition settings
- Fallback configurations
- Volume control

### Timing Settings
```csharp
[Header("Timing")]
[SerializeField, Range(0f, 1f)] private float startTransitionAtAudioProgress = 0.8f;
```
- Transition timing control
- Audio synchronization
- Progress tracking

### Behavior Settings
```csharp
[Header("Behavior")]
[SerializeField] private bool ignoreLastSceneTransition = true;
```
- Last scene handling
- Outro coordination
- Transition control

## Core Functionality

### Scene Change Handling
```csharp
private void HandleSceneChanged(string sceneName)
```
- Scene change detection
- State management
- Location tracking
- Transition control

### Transition Playback
```csharp
public void OnLastLineOfScene(EventData speakEvent, float audioLength, string nextLocation)
private IEnumerator PlayTransitionCoroutine(float startDelay)
```
- Transition timing
- Animation control
- Sound playback
- Location mapping

### State Management
```csharp
private void StopTransition()
```
- Transition control
- Coroutine management
- State cleanup
- Error handling

## Dependencies
- ShowRunner: For scene information
- Animator: For transitions
- AudioSource: For sounds
- Event System: For coordination

## Best Practices
1. Configure location mappings
2. Set appropriate timing
3. Handle last scene transitions
4. Manage audio synchronization
5. Test transition effects

## Error Handling
- Validates mappings
- Handles missing components
- Manages null references
- Provides fallbacks
- Logs important events

## Integration Points
- ShowRunner: For scene changes
- Animation System: For transitions
- Audio System: For effects
- Event System: For coordination
- Scene System: For changes

## Performance Considerations
- Animation performance
- Audio playback
- State management
- Memory usage
- Transition timing

## Setup Requirements
1. Transition mappings
2. Animator setup
3. Audio configuration
4. Event subscription
5. Location tracking

## Debugging
- Transition tracking
- Location mapping
- Audio playback
- Animation state
- Event handling

## Event Handling
- Scene changes
- Last line detection
- Transition triggers
- Audio synchronization
- State updates 