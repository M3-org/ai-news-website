# LaughEffect Script Documentation

## Overview
`LaughEffect` is a Unity MonoBehaviour that animates a character's facial blend shapes, torso, and animation layers to create a dynamic 'laughing' expression. It is designed for expressive, time-limited facial and body animations in response to gameplay or narrative events.

## Core Responsibilities
- Animate blend shapes (smile, mouth open, brow up/down) for a laughing facial expression
- Animate torso lean and rotation for physicality
- Blend in/out an animation layer for additional laugh motion
- Ensure all values are reset after the effect completes or is interrupted

## Main Features
- **Blend Shape Animation:** Smoothly animates blend shapes for a laugh
- **Torso Animation:** Leans and rotates the torso bone for added realism
- **Animator Layer Blending:** Fades in/out a specified animation layer for laugh motion
- **Inspector Controls:** All key parameters (indices, intensities, durations, torso) are exposed for tuning
- **Safe State Management:** Prevents overlapping animations and resets state on disable

## How It Works
- On `TriggerLaughEffect()`, starts a coroutine that:
  - Blends in the laugh animation layer and blend shapes
  - Animates torso lean and rotation
  - Holds the laugh state briefly, then blends out
  - Resets all blend shapes, torso, and animation layers to their initial values
- Handles early interruption by stopping all effects and restoring state

## Example Usage
```csharp
// Attach LaughEffect to a character with a SkinnedMeshRenderer, Animator, and torso bone
// Assign blend shape indices and torso in the Inspector
// Call from another script:
GetComponent<LaughEffect>().TriggerLaughEffect();
```

## Best Practices
- Assign correct blend shape indices and torso bone for your character
- Use Inspector to fine-tune animation speed, intensity, and duration
- Avoid triggering while already animating (handled internally)
- Integrate with gameplay triggers, dialogue, or cutscenes for best effect

## Error Handling
- Logs errors and disables itself if required components are missing
- Validates blend shape indices and torso before animating
- Resets all values if interrupted or disabled mid-animation

## Integration Points
- Works with any character using blend shapes, Animator, and torso bone
- Can be triggered by gameplay, UI, or animation events
- Extendable for additional body or facial expressions

## Example Inspector Setup
- Add `LaughEffect` to a character GameObject
- Assign `mouthMeshRenderer`, blend shape indices, `animator`, and `torsoBone`
- Adjust blend shape intensity, animation speed, torso lean, and duration as needed

---
**See also:** Other facial/body effect scripts for additional expressions or moods. 