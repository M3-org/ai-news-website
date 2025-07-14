# BigHeadEffect Script Documentation

**File:** `Assets/Scripts/Effects/BigHeadEffect.cs`
**Editor:** `Assets/Scripts/Editor/BigHeadEffectEditor.cs`

## Overview
`BigHeadEffect` is a Unity MonoBehaviour that manages timed scaling effects for a character's head, using the `BigHeadMode` component. It supports Grow, Shrink, and Random scaling modes, making it ideal for comedic or attention-grabbing visual effects in games or interactive shows.

## Core Responsibilities
- Animate the head scale of a character using different effect modes
- Ensure smooth transitions and proper enabling/disabling of the `BigHeadMode`
- Prevent overlapping or conflicting effects

## Main Features
- **Effect Modes:**
  - **Grow:** Enlarges the head, then returns to normal
  - **Shrink:** Shrinks the head, then returns to normal
  - **Random:** Rapidly changes head size within a range, then returns to normal
- **Inspector Controls:**
  - Adjustable effect duration, scale multipliers, and randomization settings
- **Safe Animation:**
  - Prevents overlapping effects with an internal state flag
  - Handles all transitions smoothly with coroutines

## How It Works
- Requires a `BigHeadMode` component (`Assets/Scripts/Utilities/BigHeadMode.cs`) on the same GameObject
- **TriggerEffect Method**: Call `TriggerEffect(EffectMode mode)` to start an effect
- Internally uses coroutines to animate the scale and manage timing
- Automatically resets the head to normal size and disables the effect when done

## Example Usage
```csharp
// Attach BigHeadEffect to a character with BigHeadMode
// Call from another script:
GetComponent<BigHeadEffect>().TriggerEffect(BigHeadEffect.EffectMode.Grow);
```

## Best Practices
- Always ensure `BigHeadMode` is present (enforced by [RequireComponent])
- Use Inspector to fine-tune effect duration and scale values
- Avoid triggering multiple effects simultaneously
- Integrate with animation events or gameplay triggers for best results

## Error Handling
- Logs an error and disables itself if `BigHeadMode` is missing
- Prevents overlapping effects and logs a warning if triggered while already running
- Handles unsupported modes with error logging

## Integration Points
- Works with any character or object using `BigHeadMode`
- Can be triggered by gameplay events, UI buttons, or animation events
- Extendable for custom effect modes or editor integration

## Example Inspector Setup
- Add `BigHeadEffect` to a character GameObject
- Adjust effect duration, grow/shrink/random scale values in the Inspector
- Use custom editor or context menu for quick testing (if implemented)

---
**See also:** `BigHeadMode` for core scaling logic, and other effect scripts for additional visual effects. 