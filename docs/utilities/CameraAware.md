# CameraAware & CameraFollower Utility System

## Overview

The **CameraAware** and **CameraFollower** utilities provide a robust system for tracking active cameras and moving objects to follow them. This system mirrors the SpeakerAware/SpeakerFollower architecture but is designed for camera-following behaviors.

## CameraAware

### Features

- **Active Camera Tracking**: Automatically detects cameras with "MainCamera" tag that are enabled and active
- **Event-Driven**: Fires events when active camera changes or is cleared
- **Speaker Event Integration**: Listens to speak events since cameras get activated during speak events
- **Offset Handling**: Provides customizable global and random offsets
- **Continuous Monitoring**: Uses coroutines to check for camera changes at configurable intervals
- **Cooldown Protection**: Prevents rapid camera switching

### Setup

1. Add the `CameraAware` component to any GameObject that needs to track active cameras
2. Configure the tracking settings in the inspector
3. Subscribe to the CameraAware events in your scripts

### Inspector Settings

| Setting | Description | Default |
|---------|-------------|---------|
| **Global Offset** | Offset applied to active camera position | (0, 0, -2) |
| **Random Offset Range** | Random variation range for camera positions | (0.2, 0.2, 0.2) |
| **Camera Switch Cooldown** | Time to wait before switching cameras | 0.5 seconds |
| **Camera Check Interval** | How often to check for camera changes | 0.1 seconds |
| **Enable Debug Logging** | Toggle debug logs for camera events | false |

### Events

- **`OnCameraChanged`** - Fired when active camera changes
  - Parameters: `(Transform camera, Vector3 targetPosition)`
- **`OnCameraCleared`** - Fired when no camera is active
  - Parameters: None

### Usage Example

```csharp
public class CameraTracker : MonoBehaviour
{
    private CameraAware cameraAware;
    
    void Start()
    {
        cameraAware = GetComponent<CameraAware>();
    }
    
    void OnEnable()
    {
        CameraAware.OnCameraChanged += HandleCameraChanged;
        CameraAware.OnCameraCleared += HandleCameraCleared;
    }
    
    void OnDisable()
    {
        CameraAware.OnCameraChanged -= HandleCameraChanged;
        CameraAware.OnCameraCleared -= HandleCameraCleared;
    }
    
    private void HandleCameraChanged(Transform camera, Vector3 targetPosition)
    {
        Debug.Log($"Active camera changed to: {camera.name} at {targetPosition}");
    }
    
    private void HandleCameraCleared()
    {
        Debug.Log("No active camera");
    }
}
```

## CameraFollower

### Features

- **Automatic Camera Following**: Uses CameraAware to automatically follow the active camera
- **Smooth Movement**: Configurable interpolation speed for smooth position transitions
- **Event Broadcasting**: Broadcasts movement updates for other systems to respond to
- **Customizable Offsets**: Additional offset on top of CameraAware's built-in offsets
- **Idle Behavior**: Choose what happens when no camera is active
- **Runtime Configuration**: Change target transform and settings at runtime
- **Visual Debugging**: Gizmos show current position, target position, and camera location

### Setup

1. Add the `CameraFollower` component to any GameObject
2. The component will automatically add a `CameraAware` component if not present
3. Assign the **Target Transform** in the inspector (the GameObject you want to move)
4. Configure movement settings as needed

### Inspector Settings

#### Target Settings
- **Target Transform**: The Transform GameObject to move to the camera's location

#### Movement Settings
- **Follow Speed**: How fast the target moves to the camera position (default: 3)
- **Additional Offset**: Extra offset to apply beyond CameraAware's global offset

#### Behavior Settings
- **Idle Behavior**: What to do when no camera is active
  - **Stay In Place**: Keep current position when no camera
  - **Return To Origin**: Move to specified idle position
- **Idle Position**: Position to move to when idle (if using ReturnToOrigin)
- **Enable Debug Logging**: Toggle debug logs for this component

### Events

The CameraFollower broadcasts events that other systems can subscribe to:

- **`OnTargetPositionChanged`**: Fired when the target position changes
  - Parameters: `(Transform follower, Transform target, Vector3 newPosition, bool isFollowingCamera)`

- **`OnStartedFollowingCamera`**: Fired when the follower starts tracking a camera
  - Parameters: `(Transform follower, Transform target, Transform camera)`

- **`OnStoppedFollowingCamera`**: Fired when the follower stops tracking a camera
  - Parameters: `(Transform follower, Transform target, Vector3 idlePosition)`

### Usage Example

```csharp
// Simple usage - move a light to follow the active camera
public class CameraLight : MonoBehaviour
{
    [SerializeField] private Light spotLight;
    private CameraFollower follower;
    
    void Start()
    {
        follower = GetComponent<CameraFollower>();
        follower.SetTargetTransform(spotLight.transform);
        follower.SetAdditionalOffset(new Vector3(0, 1, -1)); // Above and behind camera
    }
}

// Advanced usage - listen to events
public class CameraFollowerListener : MonoBehaviour
{
    void OnEnable()
    {
        CameraFollower.OnTargetPositionChanged += HandlePositionChange;
        CameraFollower.OnStartedFollowingCamera += HandleStartedFollowing;
        CameraFollower.OnStoppedFollowingCamera += HandleStoppedFollowing;
    }
    
    void OnDisable()
    {
        CameraFollower.OnTargetPositionChanged -= HandlePositionChange;
        CameraFollower.OnStartedFollowingCamera -= HandleStartedFollowing;
        CameraFollower.OnStoppedFollowingCamera -= HandleStoppedFollowing;
    }
    
    private void HandlePositionChange(Transform follower, Transform target, Vector3 newPosition, bool isFollowingCamera)
    {
        // React to camera follower movement
        Debug.Log($"CameraFollower moving {target.name} to {newPosition}");
    }
    
    private void HandleStartedFollowing(Transform follower, Transform target, Transform camera)
    {
        Debug.Log($"Started following camera: {camera.name}");
    }
    
    private void HandleStoppedFollowing(Transform follower, Transform target, Vector3 idlePosition)
    {
        Debug.Log($"Stopped following camera, going to: {idlePosition}");
    }
}
```

## Integration with Your System

Since your cameras are activated during speak events:

1. **CameraAware** listens to the same speak events that activate cameras
2. When a speak event occurs, CameraAware immediately checks for active cameras
3. It finds the newly activated camera with "MainCamera" tag
4. **CameraFollower** automatically moves objects to follow the active camera
5. Other systems can subscribe to CameraFollower events to react to camera changes

## Debug Features

### Context Menu Options
- **Debug Camera Position**: Logs detailed camera positioning
- **List MainCamera Objects**: Shows all objects with MainCamera tag and their states
- **Debug Current State**: Shows current follower state
- **Move to Current Camera**: Manually triggers movement to current camera
- **Test Fire Events**: Manually fires events for testing

### Visual Debugging
- **Cyan Sphere**: Current camera position
- **Blue Sphere**: Target position with offsets
- **Yellow Line**: Connection between camera and target
- **Magenta Cube**: Offset visualization

## Common Use Cases

1. **Lighting Effects**: Move lights to illuminate from the camera's perspective
2. **UI Elements**: Position 3D UI elements relative to the active camera
3. **Audio Sources**: Move 3D audio sources for positional audio effects
4. **Visual Effects**: Position particle systems or other effects relative to camera
5. **Props and Objects**: Move scene objects to follow camera perspective

## Tips

- Set **Camera Check Interval** lower (0.05s) for more responsive camera switching
- Use **Additional Offset** to fine-tune positioning without affecting CameraAware's global offset
- Enable **Debug Logging** during development to track camera changes
- Use **ReturnToOrigin** behavior for objects that should have a "home" position
- The system automatically integrates with your existing speak event architecture 