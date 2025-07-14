# SpeakerAware Utility System

## Overview

The **SpeakerAware** utility is a robust, reusable component that tracks the current speaker from speak events and provides offset transforms for targeting systems. It's designed to be easily integrated into various systems that need to respond to who is currently speaking.

## Key Features

- **Event-Driven**: Automatically tracks speaker changes through the existing EventManager system
- **Offset Handling**: Provides customizable global and random offsets (perfect for head-level targeting)
- **Cooldown Protection**: Prevents rapid speaker switching with configurable cooldown
- **Reusable**: Can be added to any GameObject that needs speaker tracking
- **Robust**: Handles edge cases like null speakers and rapid events
- **Visual Debugging**: Includes Gizmos for visualizing speaker positions and offsets

## Architecture

The SpeakerAware system integrates with the existing speak event architecture:

```
EventProcessor → SpeakPayloadManager → EventManager → SpeakerAware → Your System
```

## Setup

### Basic Setup

1. Add the `SpeakerAware` component to any GameObject that needs speaker tracking
2. Configure the offset settings in the inspector
3. Subscribe to the SpeakerAware events in your scripts

### Inspector Settings

| Setting | Description | Default |
|---------|-------------|---------|
| **Global Offset** | Offset applied to all speaker positions (useful for head-level targeting) | (0, 1.8, 0) |
| **Random Offset Range** | Random variation range for speaker positions | (0.2, 0.3, 0.2) |
| **Speaker Switch Cooldown** | Time to wait before switching speakers (prevents rapid switching) | 1.0 seconds |
| **Enable Debug Logging** | Toggle debug logs for speaker events | false |

## Usage Examples

### Example 1: DroneCameraAI Integration

The DroneCameraAI has been updated to use SpeakerAware:

```csharp
[RequireComponent(typeof(SpeakerAware))]
public class DroneCameraAI : MonoBehaviour
{
    private SpeakerAware speakerAware;
    
    private void OnEnable()
    {
        SpeakerAware.OnSpeakerChanged += HandleSpeakerChanged;
        SpeakerAware.OnSpeakerCleared += HandleSpeakerCleared;
    }
    
    private void HandleSpeakerChanged(Transform speaker, Vector3 speakerPosition)
    {
        // Move camera to track the speaker
        Vector3 droneTargetPosition = CalculateDronePositionForSpeaker(speakerPosition);
        SetTargetPosition(droneTargetPosition);
    }
}
```

### Example 2: HandheldCamera Integration

The HandheldCamera has been updated to use SpeakerAware:

```csharp
[RequireComponent(typeof(SpeakerAware))]
public class HandheldCamera : MonoBehaviour
{
    private SpeakerAware speakerAware;
    
    private void OnEnable()
    {
        SpeakerAware.OnSpeakerChanged += HandleSpeakerChanged;
        SpeakerAware.OnSpeakerCleared += HandleSpeakerCleared;
    }
    
    private void HandleSpeakerChanged(Transform speaker, Vector3 speakerPosition)
    {
        // Rotate camera to look at speaker with smooth handheld movement
        Vector3 directionToSpeaker = speakerPosition - transform.position;
        desiredRotation = Quaternion.LookRotation(directionToSpeaker);
    }
}
```

### Example 3: Creating Your Own Speaker-Aware System

```csharp
using ShowRunner.Utility;

public class YourSpeakerAwareSystem : MonoBehaviour
{
    private SpeakerAware speakerAware;
    
    private void Start()
    {
        speakerAware = GetComponent<SpeakerAware>();
    }
    
    private void OnEnable()
    {
        SpeakerAware.OnSpeakerChanged += HandleSpeakerChanged;
        SpeakerAware.OnSpeakerCleared += HandleSpeakerCleared;
    }
    
    private void OnDisable()
    {
        SpeakerAware.OnSpeakerChanged -= HandleSpeakerChanged;
        SpeakerAware.OnSpeakerCleared -= HandleSpeakerCleared;
    }
    
    private void HandleSpeakerChanged(Transform speaker, Vector3 speakerPosition)
    {
        // Your logic here - speakerPosition already includes offsets
        Debug.Log($"Speaker changed to: {speaker.name} at {speakerPosition}");
    }
    
    private void HandleSpeakerCleared()
    {
        // Handle when no one is speaking
        Debug.Log("No one is speaking");
    }
}
```

## API Reference

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `CurrentSpeaker` | Transform | The current speaker's transform, or null if no one is speaking |
| `IsSomeoneSpending` | bool | Whether someone is currently speaking |
| `CurrentSpeakerPosition` | Vector3 | The current speaker's position with all offsets applied |

### Methods

| Method | Description |
|--------|-------------|
| `GetCurrentSpeakerPosition()` | Gets the current speaker's position with all offsets applied |
| `GetCurrentSpeakerPosition(Vector3 additionalOffset)` | Gets the speaker's position with an additional custom offset |
| `SetGlobalOffset(Vector3 newOffset)` | Manually set the global offset at runtime |
| `GetSpeakerInfo()` | Returns a SpeakerInfo struct with complete speaker state |

### Events

| Event | Parameters | Description |
|-------|------------|-------------|
| `OnSpeakerChanged` | Transform speaker, Vector3 speakerPosition | Fired when the current speaker changes |
| `OnSpeakerCleared` | None | Fired when no one is speaking |

## Advanced Features

### Speaker-Aware Camera Systems

Both **DroneCameraAI** and **HandheldCamera** now support speaker-aware targeting with intelligent tracking:

#### DroneCameraAI Speaker-Aware Mode

The DroneCameraAI now supports multiple modes with intelligent tracking:

- **Speaker Tracking Mode**: Follows the current speaker (default)
  - Calculates stable drone position when speaker changes
  - Only recalculates position when speaker moves significantly
  - Smoothly tracks minor speaker movements
  - Prevents oscillation with movement thresholds
- **Fallback Mode**: When no one is speaking, can:
  - Cycle through actors (original behavior)
  - Hover in place
  - Move to random positions

#### Advanced Tracking Settings

| Setting | Description | Default |
|---------|-------------|---------|
| **Speaker Movement Threshold** | Minimum distance speaker must move before recalculating drone position | 1.0 meters |
| **Speaker Tracking Smoothing** | Speed at which drone target smoothly follows speaker movement | 2.0 |

#### HandheldCamera Speaker-Aware Mode

The HandheldCamera provides a simpler but effective speaker-aware implementation:

- **Speaker Tracking Mode**: Rotates to look at the current speaker
  - Uses SpeakerAware position for head-level targeting
  - Maintains handheld camera wobble and overshoot characteristics
  - Integrates with existing zoom behavior
- **Fallback Mode**: When no one is speaking, can:
  - Cycle through targets (original behavior)
  - Hold current target

#### HandheldCamera Settings

| Setting | Description | Default |
|---------|-------------|---------|
| **Enable Speaker Aware Targeting** | Toggle speaker-aware mode on/off | true |
| **No Speaker Fallback** | Behavior when no one is speaking (CycleTargets/Hold) | CycleTargets |
| **Fallback Delay** | Time to wait before switching to fallback mode | 5.0 seconds |

### Fallback Configuration

```csharp
public enum FallbackBehavior
{
    CycleTargets,   // Continue cycling through targets like before
    Hover,          // Just hover in place
    RandomMovement  // Move to random positions within bounds
}
```

### Runtime Control

```csharp
// Toggle speaker-aware targeting
droneCamera.SetSpeakerAwareTargeting(true);
handheldCamera.SetSpeakerAwareTargeting(true);

// Get debugging information
string droneInfo = droneCamera.GetTargetingInfo();
string handheldInfo = handheldCamera.GetTargetingInfo();
Debug.Log(droneInfo);
Debug.Log(handheldInfo);

// Debug speaker positioning
droneCamera.DebugSpeakerPosition();
handheldCamera.DebugSpeakerPosition();
```

## Troubleshooting

### Common Issues

1. **SpeakerAware not responding**
   - Ensure the component is enabled
   - Check that EventManager is properly set up
   - Verify speak events are being processed

2. **Rapid speaker switching**
   - Increase the Speaker Switch Cooldown
   - Check for duplicate speak events

3. **Incorrect positioning**
   - Verify Global Offset is set appropriately
   - Check that speaker transforms are valid
   - Enable Debug Logging to see calculated positions

4. **DroneCameraAI oscillation/jerky movement**
   - Increase Speaker Movement Threshold (try 2-3 meters)
   - Decrease Speaker Tracking Smoothing for slower, steadier movement
   - Check that Rigidbody drag and angular drag are reasonable (2-4 range)
   - Verify boundary constraints aren't too tight

### Debug Gizmos

When the SpeakerAware component is selected, it shows:
- **Red sphere**: Speaker's base position
- **Green sphere**: Target position with offsets
- **Yellow line**: Connection between base and target
- **Blue cube**: Final offset visualization

## Performance Notes

- SpeakerAware is lightweight and only processes events when speakers change
- The system gracefully handles null speakers and missing components
- Event subscription/unsubscription is handled automatically in OnEnable/OnDisable

## Integration with Existing Systems

The SpeakerAware system is designed to work alongside existing camera systems:

- **CameraStateMachine**: Continues to work for static camera switching
- **AutoCam**: Can be used in combination with speaker-aware systems
- **Timer-based cameras**: DroneCameraAI can fall back to timer-based behavior when no speakers

## Future Enhancements

Potential future improvements:
- Multiple speaker tracking
- Speaker priority system
- Prediction-based positioning
- Custom offset profiles per speaker
- Integration with animation systems 