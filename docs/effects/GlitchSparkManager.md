# GlitchSparkManager Script Documentation

## Overview
`GlitchSparkManager` is a Unity MonoBehaviour that manages a pool of spark particle GameObjects for glitch/burst effects. It handles spark activation, deactivation, physics, and lifetime, ensuring efficient and visually dynamic glitch bursts.

## Core Responsibilities
- Pool and manage spark GameObjects for glitch effects
- Activate, position, and launch sparks with random force and scale
- Deactivate sparks after their lifetime or if stuck
- Prevent performance issues by reusing objects (object pooling)

## Main Features
- **Object Pooling:** Uses `GenericObjectPooler<GlitchSpark>` for efficient spark reuse
- **Randomized Physics:** Launches sparks in random directions with upward bias and random spin
- **Lifetime Management:** Deactivates sparks after a set time or if stuck on the ground
- **Inspector Controls:** All key parameters (pool size, force, lifetime, origin) are exposed
- **Ground Handling:** Adds upward force if sparks get stuck on the ground

## How It Works
- On `TriggerGlitch()`, deactivates all active sparks and launches a new burst from the pool
- Each spark is positioned at the origin, given random direction, scale, and force
- `Update()` checks for expired or stuck sparks and deactivates them
- All sparks are returned to the pool and cleaned up on destroy

## Example Usage
```csharp
// Attach GlitchSparkManager to a GameObject
// Assign sparkPrefab, sparkOrigin, and configure pool size/force in the Inspector
// Call from another script:
GetComponent<GlitchSparkManager>().TriggerGlitch();
```

## Best Practices
- Set pool size based on expected maximum simultaneous sparks
- Use a dedicated empty GameObject as `sparkOrigin` for clarity
- Adjust burst force, upward force, and lifetime for desired visual effect
- Integrate with glitch or impact events for best results

## Error Handling
- Handles missing pooler or sparks gracefully
- Ensures all sparks are deactivated and returned to the pool on destroy
- Validates required references in Inspector

## Integration Points
- Works with any GameObject for glitch/impact VFX
- Can be triggered by gameplay, UI, or animation events
- Extendable for custom spark behaviors or additional VFX

## Example Inspector Setup
- Add `GlitchSparkManager` to a GameObject
- Assign `sparkPrefab` and `sparkOrigin`
- Set `poolSize`, `burstForce`, and `sparkLifetime` as needed

---
**See also:** `GenericObjectPooler`, `GlitchSpark`, and other effect scripts for additional feedback. 