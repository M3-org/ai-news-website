# GlitchSoundEffect Script Documentation

## Overview
`GlitchSoundEffect` is a Unity MonoBehaviour that generates and plays glitchy sound effects, either procedurally or from a set of predefined audio clips. It is designed to provide dynamic, randomized audio feedback for glitch or error events in games or interactive experiences.

## Core Responsibilities
- Generate and play glitch sound effects with random pitch, frequency, and duration
- Support both generative (procedural) and predefined sound modes
- Manage audio playback, fading, and pitch variation
- Integrate with other glitch effect scripts for synchronized feedback

## Main Features
- **Generative Mode:** Creates procedural sine wave sounds with random parameters
- **Predefined Mode:** Plays random clips from a user-supplied array
- **Pitch & Volume Randomization:** Adds variety to each glitch sound
- **Fade In/Out:** Smoothly fades sounds in and out for polish
- **Inspector Controls:** All key parameters (frequency, duration, volume, pitch, intervals) are exposed
- **Safe State Management:** Prevents overlapping sounds and resets state on stop

## How It Works
- On `StartGlitchSounds()`, begins a coroutine that:
  - Randomly generates or selects glitch sounds
  - Plays each sound with random pitch, volume, and fade
  - Waits a random interval before the next sound
- On `StopGlitchSounds()`, stops all coroutines, resets volume and pitch, and stops playback
- Can be triggered by other scripts (e.g., `GlitchOutEffect`) for synchronized audio-visual feedback

## Example Usage
```csharp
// Attach GlitchSoundEffect to a GameObject with an AudioSource
// Configure generative or predefined mode in the Inspector
// Call from another script:
GetComponent<GlitchSoundEffect>().StartGlitchSounds();
// To stop:
GetComponent<GlitchSoundEffect>().StopGlitchSounds();
```

## Best Practices
- Assign an AudioSource and configure parameters in the Inspector
- Use generative mode for dynamic, unpredictable effects
- Use predefined mode for curated glitch sounds
- Integrate with visual glitch effects for best results

## Error Handling
- Logs errors and disables itself if AudioSource is missing
- Switches to generative mode if no predefined sounds are set
- Resets all audio parameters on stop

## Integration Points
- Works with any GameObject for glitch/error audio feedback
- Can be triggered by visual glitch scripts or gameplay events
- Extendable for custom sound generation or advanced audio behaviors

## Example Inspector Setup
- Add `GlitchSoundEffect` to a GameObject with an AudioSource
- Set `useGenerativeSounds`, frequency, duration, volume, pitch, and intervals
- Optionally assign `predefinedSounds` array

---
**See also:** `GlitchOutEffect` and other effect scripts for synchronized audio-visual feedback. 