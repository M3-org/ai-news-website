# GlitchOutEffect Script Documentation

**File:** `Assets/Scripts/Effects/GlitchOutEffect.cs`
**Editor:** `Assets/Scripts/Editor/GlitchOutEffectEditor.cs`

## Overview
`GlitchOutEffect` is a Unity MonoBehaviour that creates a visual and audio 'glitch' effect by manipulating sway/lean parameters, triggering sound and particle bursts, and restoring the original state after a timed sequence. It is designed for dramatic, attention-grabbing feedback in response to gameplay or narrative events.

## Core Responsibilities
- Temporarily alter sway, lean, and speed parameters for a glitchy appearance
- Trigger synchronized glitch sound and particle effects
- Restore all parameters to their original values after the effect
- Prevent overlapping glitch effects

## Main Features
- **Parameter Animation:** Smoothly animates sway, lean, and speed for a glitch effect
- **Sound Integration:** Starts and stops a `GlitchSoundEffect` during the glitch
- **Particle Bursts:** Triggers bursts and streams of particles via `ParticleSystemController`
- **Inspector Controls:** All effect parameters are exposed for tuning
- **Safe State Management:** Prevents overlapping glitches and restores state on completion

## How It Works
- **TriggerGlitchOut Method**: Starts a coroutine that:
  - Animates sway/lean/speed parameters to random glitchy values
  - Triggers sound and particle effects
  - Emits particle bursts at intervals
  - Holds the glitch state, then smoothly restores all values
  - Stops all effects and resets state
- Ensures all original values are restored, even if interrupted

## Example Usage
```csharp
// Attach GlitchOutEffect to a GameObject with LookAtLogic, GlitchSoundEffect, and ParticleSystemController
// Call from another script:
GetComponent<GlitchOutEffect>().TriggerGlitchOut();
```

## Best Practices
- Assign all required components (LookAtLogic, GlitchSoundEffect, ParticleSystemController)
- Use Inspector to fine-tune glitch intensity, duration, and burst settings
- Avoid triggering while already glitching (handled internally)
- Integrate with gameplay triggers, cutscenes, or UI for best effect

## Error Handling
- Logs errors and disables itself if LookAtLogic is missing
- Handles missing particle or sound components gracefully
- Restores all values and stops effects on completion or interruption

## Integration Points
- Works with any GameObject using LookAtLogic for sway/lean
- Can be triggered by gameplay, UI, or animation events
- Extendable for custom glitch behaviors or additional VFX

## Example Inspector Setup
- Add `GlitchOutEffect` to a GameObject
- Assign and configure `LookAtLogic`, `GlitchSoundEffect`, and `ParticleSystemController`
- Adjust glitch multipliers, durations, and burst settings as needed

---
**See also:** `GlitchSoundEffect`, `ParticleSystemController`, and other effect scripts for additional feedback. 