# AmusedLazerEffect Script Documentation

## Overview
`AmusedLazerEffect` is a Unity MonoBehaviour that manages a simple laser visual and audio effect, typically triggered by an 'amused' action or event. It activates a laser GameObject, plays a sound, waits for a set duration, and then deactivates the effect.

## Core Responsibilities
- Activate and deactivate a laser visual effect
- Play a laser sound effect in sync with the visual
- Ensure effects do not overlap and are safely stopped on disable

## Main Features
- **Visual Effect:** Activates a specified GameObject as the laser
- **Audio Effect:** Plays a specified AudioClip via an AudioSource
- **Duration Control:** Configurable effect duration
- **Inspector Controls:** All references and settings are exposed for easy setup
- **Safe State Management:** Prevents overlapping effects and cleans up on disable

## How It Works
- On `TriggerEffect()`, starts a coroutine that:
  - Activates the laser visual
  - Plays the laser sound (if assigned)
  - Waits for the specified duration
  - Stops the sound and deactivates the visual
- Prevents overlapping triggers by tracking the running coroutine
- Cleans up all effects if stopped early or disabled

## Example Usage
```csharp
// Attach AmusedLazerEffect to a GameObject
// Assign laserObject, laserAudioSource, and laserSound in the Inspector
// Call from another script:
GetComponent<AmusedLazerEffect>().TriggerEffect();
```

## Best Practices
- Assign all required references in the Inspector
- Use unique GameObjects for each effect instance
- Integrate with gameplay triggers, animation events, or UI for best results
- Optionally extend with fade-out or additional visual/audio polish

## Error Handling
- Logs errors and disables itself if the laserObject is missing
- Warns if audio components are missing or incomplete
- Ensures all effects are stopped and cleaned up on disable

## Integration Points
- Works with any GameObject for visual/audio effects
- Can be triggered by gameplay, UI, or animation events
- Extendable for more complex laser or VFX behaviors

## Example Inspector Setup
- Add `AmusedLazerEffect` to a GameObject
- Assign `laserObject` (visual), `laserAudioSource`, and `laserSound`
- Set `onDuration` for effect timing

---
**See also:** Other effect scripts for additional visual/audio feedback. 