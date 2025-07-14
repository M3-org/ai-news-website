# SpeakerFollower Utility

## Overview

The **SpeakerFollower** component moves a specified Transform GameObject to the current speaker's location. It integrates with the existing **SpeakerAware** system to automatically track speaker changes and smoothly move any Transform to follow the speaker.

## Features

- **Automatic Speaker Tracking**: Uses the SpeakerAware system to automatically follow the current speaker
- **Smooth Movement**: Configurable interpolation speed for smooth position transitions
- **Optional Rotation**: Can rotate the target to look at the speaker
- **Customizable Offsets**: Additional offset on top of SpeakerAware's built-in offsets
- **Idle Behavior**: Choose what happens when no one is speaking (stay in place or return to origin)
- **Runtime Configuration**: Change target transform and settings at runtime
- **Event System**: Broadcasts movement updates for other systems to respond to
- **Visual Debugging**: Gizmos show current position, target position, and speaker location

## Easing Types

The SpeakerFollower supports multiple easing curves for smooth, natural movement:

- **Linear**: No easing, constant speed
- **EaseIn**: Slow start, fast end
- **EaseOut**: Fast start, slow end
- **EaseInOut**: Slow start and end, fast middle (recommended for most cases)
- **EaseInCubic**: Cubic ease in (more dramatic than EaseIn)
- **EaseOutCubic**: Cubic ease out (more dramatic than EaseOut)
- **EaseInOutCubic**: Cubic ease in-out (smoother than EaseInOut)
- **EaseInQuart**: Quartic ease in (very dramatic)
- **EaseOutQuart**: Quartic ease out (very dramatic)
- **EaseInOutQuart**: Quartic ease in-out (very smooth)
- **Bounce**: Bouncy easing (fun for playful effects)
- **Elastic**: Elastic easing (springy effect)

You can also use a **Custom Easing Curve** by setting an AnimationCurve in the inspector, which will override the selected easing type.

## Events

The SpeakerFollower broadcasts events that other systems can subscribe to:

### Static Events

- **OnTargetPositionChanged**: Fired when the target position changes
  - Parameters: `(Transform follower, Transform target, Vector3 newPosition, bool isFollowingSpeaker)`
  - Use this to react to any movement changes

- **OnStartedFollowingSpeaker**: Fired when the follower starts tracking a speaker
  - Parameters: `(Transform follower, Transform target, Transform speaker)`
  - Use this to trigger effects when speaker tracking begins

- **OnStoppedFollowingSpeaker**: Fired when the follower stops tracking a speaker
  - Parameters: `(Transform follower, Transform target, Vector3 idlePosition)`
  - Use this to trigger effects when speaker tracking ends

### Event Usage Example

```csharp
public class SpeakerFollowerListener : MonoBehaviour
{
    void OnEnable()
    {
        // Subscribe to events
        SpeakerFollower.OnTargetPositionChanged += HandleTargetPositionChanged;
        SpeakerFollower.OnStartedFollowingSpeaker += HandleStartedFollowing;
        SpeakerFollower.OnStoppedFollowingSpeaker += HandleStoppedFollowing;
    }
    
    void OnDisable()
    {
        // Unsubscribe from events
        SpeakerFollower.OnTargetPositionChanged -= HandleTargetPositionChanged;
        SpeakerFollower.OnStartedFollowingSpeaker -= HandleStartedFollowing;
        SpeakerFollower.OnStoppedFollowingSpeaker -= HandleStoppedFollowing;
    }
    
    private void HandleTargetPositionChanged(Transform follower, Transform target, Vector3 newPosition, bool isFollowingSpeaker)
    {
        Debug.Log($"SpeakerFollower on {follower.name} moving {target.name} to {newPosition}");
        
        // Your logic here - maybe trigger particle effects, update UI, etc.
    }
    
    private void HandleStartedFollowing(Transform follower, Transform target, Transform speaker)
    {
        Debug.Log($"Started following speaker: {speaker.name}");
        
        // Your logic here - maybe change target appearance, play sound, etc.
    }
    
    private void HandleStoppedFollowing(Transform follower, Transform target, Vector3 idlePosition)
    {
        Debug.Log($"Stopped following speaker, going to idle position: {idlePosition}");
        
        // Your logic here - maybe dim lights, stop effects, etc.
    }
}
```

## Setup

### Basic Setup

1. Add the `SpeakerFollower` component to any GameObject
2. The component will automatically add a `SpeakerAware` component if not present
3. Assign the **Target Transform** in the inspector (the GameObject you want to move)
4. Configure movement settings as needed

### Inspector Settings

#### Target Settings
- **Target Transform**: The Transform GameObject to move to the speaker's location

#### Movement Settings
- **Follow Speed**: How fast the target moves to the speaker position (default: 3)
- **Easing Type**: Type of easing curve for smooth movement (default: EaseInOut)
- **Custom Easing Curve**: Optional custom animation curve (overrides easing type if set)
- **Additional Offset**: Extra offset to apply beyond SpeakerAware's global offset (default: 0,0,0)
- **Rotate To Look At Speaker**: Whether to also rotate the target to look at the speaker (default: false)
- **Rotation Speed**: Speed of rotation when looking at speaker (default: 2)
- **Rotation Easing Type**: Type of easing curve for smooth rotation (default: EaseInOut)

#### Behavior Settings
- **Idle Behavior**: What to do when no one is speaking
  - **Stay In Place**: Keep current position when no speaker
  - **Return To Origin**: Move to specified idle position
- **Idle Position**: Position to move to when idle (if using ReturnToOrigin)
- **Enable Debug Logging**: Toggle debug logs for this component

## Usage Examples

### Example 1: Simple Light Follower

```csharp
// This script automatically moves a light to follow the current speaker
public class LightFollower : MonoBehaviour
{
    [SerializeField] private Light targetLight;
    private SpeakerFollower follower;
    
    void Start()
    {
        follower = GetComponent<SpeakerFollower>();
        follower.SetTargetTransform(targetLight.transform);
        follower.SetAdditionalOffset(new Vector3(0, 2, 0)); // Above speaker
    }
}
```

### Example 2: Particle Effect Follower

```csharp
// Move particle effects to follow the current speaker
public class ParticleFollower : MonoBehaviour
{
    [SerializeField] private ParticleSystem particles;
    private SpeakerFollower follower;
    
    void Start()
    {
        follower = GetComponent<SpeakerFollower>();
        follower.SetTargetTransform(particles.transform);
        
        // Set up to look at speaker and return to origin when idle
        follower.rotateToLookAtSpeaker = true;
        follower.idleBehavior = SpeakerFollower.IdleBehavior.ReturnToOrigin;
    }
}
```

### Example 3: Runtime Configuration

```csharp
// Change target and settings at runtime
public class DynamicFollower : MonoBehaviour
{
    [SerializeField] private Transform[] possibleTargets;
    private SpeakerFollower follower;
    private int currentTargetIndex = 0;
    
    void Start()
    {
        follower = GetComponent<SpeakerFollower>();
        follower.SetTargetTransform(possibleTargets[0]);
    }
    
    void Update()
    {
        // Switch targets with key press
        if (Input.GetKeyDown(KeyCode.Space))
        {
            currentTargetIndex = (currentTargetIndex + 1) % possibleTargets.Length;
            follower.SetTargetTransform(possibleTargets[currentTargetIndex]);
        }
    }
}
```

## Public Methods

### Runtime Configuration

- `SetTargetTransform(Transform newTarget)`: Change the target transform
- `SetAdditionalOffset(Vector3 newOffset)`: Update the additional offset
- `SetIdlePosition(Vector3 newIdlePosition)`: Set the idle position for ReturnToOrigin behavior

### Information

- `GetStatusInfo()`: Returns formatted string with current state information
- Properties:
  - `TargetPosition`: Current target position the transform is moving towards
  - `IsFollowingSpeaker`: Whether currently tracking a speaker
  - `TargetTransform`: The Transform being moved (get/set)

## Integration with SpeakerAware

The SpeakerFollower leverages the existing SpeakerAware system:

1. **Automatic Events**: Subscribes to `SpeakerAware.OnSpeakerChanged` and `SpeakerAware.OnSpeakerCleared`
2. **Offset Handling**: Uses `speakerAware.GetCurrentSpeakerPosition()` with additional offset
3. **Real-time Updates**: Continuously updates position as speaker moves
4. **Cooldown Protection**: Inherits SpeakerAware's cooldown protection against rapid speaker switching

## Gizmos and Visual Debugging

When selected in the Scene view, the component shows:
- **Blue Sphere**: Current position of the target transform
- **Green Sphere**: Target position the transform is moving towards
- **Yellow Line**: Movement direction from current to target
- **Grey Cube**: Idle position (if using ReturnToOrigin behavior)
- **Red Sphere**: Current speaker position (if available)

## Context Menu Options

Right-click the component in the Inspector for:
- **Debug Current State**: Logs detailed status information
- **Move to Current Speaker**: Manually triggers movement to current speaker (for testing)
- **Test Fire Events**: Manually fires all events for testing event listeners

## Common Use Cases

1. **Lighting Effects**: Move spotlights or ambient lights to illuminate the current speaker
2. **Particle Systems**: Position particle effects around the speaking character
3. **UI Elements**: Move 3D UI elements to float near the speaker
4. **Camera Rigs**: Position camera equipment or rigs to follow speakers
5. **Audio Sources**: Move 3D audio sources for positional audio effects
6. **Props and Objects**: Animate props or scene objects to follow the conversation

## Tips

- Use **Additional Offset** to fine-tune positioning without affecting the global SpeakerAware offset
- Enable **Rotate To Look At Speaker** for objects that should face the speaker (like cameras or lights)
- Use **ReturnToOrigin** behavior for objects that should have a "home" position when no one is speaking
- Set **Follow Speed** lower (1-2) for heavy or important objects that should move more deliberately
- Enable **Debug Logging** during development to track speaker changes and positioning 