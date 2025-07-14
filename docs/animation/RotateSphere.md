# RotateSphere Script Documentation

**File:** `Assets/Scripts/Animation/RotateSphere.cs`

## Overview
`RotateSphere` is a simple Unity MonoBehaviour that continuously rotates a GameObject around its Y-axis. It is typically used for visual effects, animated props, or highlighting objects in the scene.

## Core Responsibilities
- Rotate the attached GameObject smoothly around the Y-axis
- Expose rotation speed for easy adjustment in the Inspector

## Main Features
- **Continuous Rotation:** Rotates every frame in `Update()`
- **Inspector Integration:** `rotationSpeed` is adjustable via the Inspector
- **Minimal Overhead:** Lightweight, single-purpose script

## How It Works
- **Update Method** (`RotateSphere.cs:9`): On each `Update()`, the script calls `transform.Rotate(Vector3.up, rotationSpeed * Time.deltaTime)`
- **rotationSpeed Field** (`RotateSphere.cs:7`): Serialized float field for Inspector configuration
- The rotation is frame-rate independent using `Time.deltaTime`

## Example Usage
```csharp
// Attach to any GameObject (e.g., sphere, coin, pickup)
// Set the desired rotation speed in the Inspector
```

## Best Practices
- Use for simple, continuous rotation effects
- Adjust `rotationSpeed` for desired visual effect
- For more complex rotation (multiple axes, triggers), extend or combine with other scripts

## Error Handling
- No runtime errors expected if attached to a valid GameObject
- `rotationSpeed` defaults to 10 if not set

## Integration Points
- Can be combined with other animation/effect scripts
- Useful for highlighting interactable or collectible objects

## Example Inspector Setup
- Add `RotateSphere` to a GameObject
- Set `rotationSpeed` in the Inspector

---
**See also:** Other animation scripts for advanced or event-driven rotation. 