# BackgroundMusicManager Component

## Overview
The BackgroundMusicManager handles background music playback during the show, coordinating with scene changes and managing transitions between different musical pieces. It supports location-specific music, random selection from music pools, and smooth transitions.

## Data Structures

### LocationMusicMapping
```csharp
[System.Serializable]
public struct LocationMusicMapping
{
    public string locationName;
    public List<AudioClip> musicClips;
    [Range(0f, 1f)] public float volume;
}
```
- Maps locations to music clips
- Supports multiple clips per location
- Configurable volume per location

## Configuration

### Music Settings
```csharp
[Header("Music Configuration")]
[SerializeField] private List<LocationMusicMapping> musicMappings;
[SerializeField] private AudioClip defaultMusicClip;
[Range(0f, 1f)] [SerializeField] private float defaultVolume = 0.3f;
```
- Location-specific music mappings
- Default fallback music
- Default volume level

### Transition Settings
```csharp
[Header("Transition Settings")]
[SerializeField] private float fadeInDuration = 2.0f;
[SerializeField] private float fadeOutDuration = 3.0f;
```
- Fade in duration
- Fade out duration

## Core Functionality

### Scene Change Handling
```csharp
private void HandleScenePreparationComplete(string sceneName)
```
- Responds to scene changes
- Determines new location
- Triggers music changes
- Handles commercial breaks

### Music Playback
```csharp
private void PlayMusicForLocation(string locationName)
```
- Selects appropriate music
- Randomizes from clip pool
- Manages volume levels
- Handles fallback cases

### Fade Management
```csharp
private void FadeInMusic(AudioClip clip, float targetVolume, bool forceRestart = true)
private void FadeOutMusic()
private IEnumerator FadeAudio(AudioSource audioSource, float duration, float targetVolume, bool stopWhenDone = false)
```
- Smooth volume transitions
- Configurable durations
- Stop/start control
- Commercial break handling

### Commercial Integration
```csharp
public void FadeOutForCommercials()
public void ResumeAfterCommercials()
```
- Handles commercial breaks
- Preserves music state
- Manages transitions

## Dependencies
- AudioSource: For music playback
- ScenePreparationManager: For scene changes
- ShowRunner: For location information
- CommercialManager: For break coordination

## Best Practices
1. Configure music mappings in Unity Inspector
2. Use appropriate fade durations
3. Provide fallback music
4. Test commercial break integration
5. Monitor audio memory usage

## Error Handling
- Validates location mappings
- Handles missing clips
- Manages null references
- Provides fallback options
- Logs important events

## Integration Points
- ShowRunner: For location tracking
- ScenePreparationManager: For scene changes
- CommercialManager: For break handling
- Audio System: For playback
- Event System: For coordination

## Performance Considerations
- Audio clip memory management
- Transition smoothness
- Multiple clip handling
- Commercial break transitions
- Scene change timing

## Setup Requirements
1. AudioSource component
2. Music clip assignments
3. Location mappings
4. Transition settings
5. Commercial break integration

## Debugging
- Location change tracking
- Music selection logging
- Volume level monitoring
- Commercial break state
- Scene change events

## Event Handling
- Scene preparation complete
- Last dialogue complete
- Commercial break start/end
- Location changes
- Volume transitions 