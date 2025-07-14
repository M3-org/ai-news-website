# ExcitedEffect Script Documentation

## Overview
`ExcitedEffect` is a Unity MonoBehaviour that animates a character's facial blend shapes and animation layers to create an 'excited' expression. It is designed for expressive, time-limited facial animations in response to gameplay or narrative events.

## Core Responsibilities
- Animate blend shapes (smile, mouth open, brow up) for an excited facial expression
- Blend in/out an animation layer for additional motion
- Ensure all values are reset after the effect completes or is interrupted

## Main Features
- **Blend Shape Animation:** Smoothly animates blend shapes for an excited look
- **Animator Layer Blending:** Fades in/out a specified animation layer for motion
- **Inspector Controls:** All key parameters (indices, intensities, durations) are exposed for tuning
- **Safe State Management:** Prevents overlapping animations and resets state on disable

## How It Works
- On `TriggerExcitedEffect()`, starts a coroutine that:
  - Blends in the excited animation layer and blend shapes
  - Holds the excited state briefly, then blends out
  - Resets all blend shapes and animation layers to their initial values
- Handles early interruption by stopping all effects and restoring state

## Example Usage
```csharp
// Attach ExcitedEffect to a character with a SkinnedMeshRenderer and Animator
// Assign blend shape indices in the Inspector
// Call from another script:
GetComponent<ExcitedEffect>().TriggerExcitedEffect();
```

## Best Practices
- Assign correct blend shape indices for your character's mesh
- Use Inspector to fine-tune animation speed, intensity, and duration
- Avoid triggering while already animating (handled internally)
- Integrate with gameplay triggers, dialogue, or cutscenes for best effect

## Error Handling
- Logs errors and disables itself if required components are missing
- Validates blend shape indices before setting weights
- Resets all values if interrupted or disabled mid-animation

## Integration Points
- Works with any character using blend shapes and an Animator
- Can be triggered by gameplay, UI, or animation events
- Extendable for additional facial expressions or effects

## Example Inspector Setup
- Add `ExcitedEffect` to a character GameObject
- Assign `mouthMeshRenderer`, blend shape indices, and `animator`
- Adjust blend shape intensity, animation speed, and duration as needed

---
**See also:** Other facial effect scripts for additional expressions or moods. 