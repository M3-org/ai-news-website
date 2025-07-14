# ObjectPoolerAndMover Script Documentation

## Overview
`ObjectPoolerAndMover` is a Unity MonoBehaviour that manages a pool of objects for efficient spawning, movement, and scaling effects. It is ideal for repeated, animated VFX (e.g., floating particles, collectibles) that need to be reused and animated across the screen.

## Core Responsibilities
- Pool and manage reusable GameObjects for animation
- Spawn, move, and scale objects with random parameters
- Deactivate and reset objects for reuse

## Main Features
- **Object Pooling:** Efficiently reuses objects to avoid instantiation overhead
- **Randomized Animation:** Each object moves and scales down with random speed, position, and scale
- **Inspector Controls:** All key parameters (pool size, speed, scale, range) are exposed
- **Automatic Reset:** Objects reset and return to the pool after scaling down

## How It Works
- On `Start()`, initializes a pool of inactive objects
- `SpawnObjects()` activates and animates all inactive objects in the pool
- Each object moves from a random Y position at the origin to the right, scaling down to zero
- When an object finishes its animation, it is reset and deactivated for reuse

## Example Usage
```csharp
// Attach ObjectPoolerAndMover to a GameObject
// Assign prefab and configure pool/animation settings in the Inspector
// Call from another script:
GetComponent<ObjectPoolerAndMover>().SpawnObjects();
```

## Best Practices
- Set pool size based on expected maximum simultaneous objects
- Use a simple, lightweight prefab for best performance
- Adjust speed, scale, and range for desired visual effect
- Integrate with VFX triggers, gameplay events, or UI for best results

## Error Handling
- Handles missing or inactive objects gracefully
- Validates required references in Inspector
- Ensures objects are always reset and deactivated after use

## Integration Points
- Works with any GameObject for animated VFX or collectibles
- Can be triggered by gameplay, UI, or animation events
- Extendable for custom movement or animation behaviors

## Example Inspector Setup
- Add `ObjectPoolerAndMover` to a GameObject
- Assign `prefab` and set `poolSize`, `minSpeed`, `maxSpeed`, `yRange`, `boxWidth`, `scaleDownSpeed`, and `scaleRange`

---
**See also:** Other pooling and VFX scripts for advanced or specialized effects. 