# HappyEffect Script Documentation

## Overview
`HappyEffect` is a Unity MonoBehaviour that animates a character's facial blend shapes and animation layers to create a 'happy' expression, optionally accompanied by particle effects. It is designed for expressive, time-limited facial animations in response to gameplay or narrative events.

## Core Responsibilities
- Animate blend shapes (smile, mouth open, brow up) for a happy facial expression
- Blend in/out an animation layer for additional happy motion
- Optionally play and stop a particle effect during the animation
- Ensure all values are reset after the effect completes or is interrupted

## Main Features
- **Blend Shape Animation:** Smoothly animates smile, mouth open, and brow up blend shapes
- **Animator Layer Blending:** Fades in/out a specified animation layer for happy motion
- **Particle System Integration:** Optionally plays a particle effect during the happy state
- **Inspector Controls:** All key parameters (indices, intensities, durations) are exposed for tuning
- **Safe State Management:** Prevents overlapping animations and resets state on disable

## How It Works
- On `TriggerHappyEffect()`, starts a coroutine that:
  - Blends in the happy animation layer and blend shapes
  - Plays the particle effect (if assigned)
  - Holds the happy state briefly, then blends out
  - Resets all blend shapes and animation layers to their initial values
- Handles early interruption (e.g., OnDisable) by stopping all effects and restoring state

## Example Usage
```csharp
// Attach HappyEffect to a character with a SkinnedMeshRenderer and Animator
// Assign blend shape indices and optional particle system in the Inspector
// Call from another script:
GetComponent<HappyEffect>().TriggerHappyEffect();
```

## Best Practices
- Assign correct blend shape indices for your character's mesh
- Use Inspector to fine-tune animation speed, intensity, and duration
- Avoid triggering while already animating (handled internally)
- Integrate with gameplay triggers, dialogue, or cutscenes for best effect

## Error Handling
- Logs errors and disables itself if required components are missing
- Warns if the particle system is not assigned
- Validates blend shape indices before setting weights
- Resets all values if interrupted or disabled mid-animation

## Integration Points
- Works with any character using blend shapes and an Animator
- Can be triggered by gameplay, UI, or animation events
- Extendable for additional facial expressions or effects

## Example Inspector Setup
- Add `HappyEffect` to a character GameObject
- Assign `mouthMeshRenderer`, blend shape indices, and `animator`
- Optionally assign a `happyParticles` ParticleSystem
- Adjust blend shape intensity, animation speed, and duration as needed

---
**See also:** Other facial effect scripts for additional expressions or moods. 