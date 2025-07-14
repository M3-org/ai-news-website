# ObjectDropAndDisappearOnCollision Script Documentation

## Overview
`ObjectDropAndDisappearOnCollision` is a Unity MonoBehaviour that manages a pool of objects which drop from above, disappear on collision, and can trigger avatar impact reactions. It is ideal for VFX, rain, debris, or interactive objects that need to be pooled, dropped, and animated efficiently.

## Core Responsibilities
- Pool and manage reusable GameObjects for dropping and collision
- Spawn and drop objects from random positions above a defined area
- Animate scale-down and deactivate objects on collision
- Integrate with avatar impact reactions if present

## Main Features
- **Object Pooling:** Efficiently reuses objects to avoid instantiation overhead
- **Drop Animation:** Drops objects from random X positions at a set height
- **Collision Handling:** On collision, objects scale down and disappear
- **Avatar Integration:** Triggers `AvatarImpactReaction` if present on collision target
- **Inspector Controls:** All key parameters (pool size, spawn area, delay, scale curve) are exposed
- **Editor Button:** Custom inspector button for manual drop testing

## How It Works
- On `Start()`, initializes a pool of inactive objects with Rigidbody and Collider
- `StartDropSequence()` drops all inactive objects in sequence with a delay
- On collision, each object triggers scale-down animation and deactivates
- If colliding with an avatar, triggers impact reaction
- All objects are reset and reused for the next drop

## Example Usage
```csharp
// Attach ObjectDropAndDisappearOnCollision to a GameObject
// Assign prefab and configure pool/spawn/animation settings in the Inspector
// Call from another script:
GetComponent<ObjectDropAndDisappearOnCollision>().StartDropSequence();
```

## Best Practices
- Set pool size based on expected maximum simultaneous drops
- Use a simple, lightweight prefab for best performance
- Adjust spawn area, drop delay, and scale curve for desired effect
- Integrate with avatar or gameplay events for best results

## Error Handling
- Handles missing or inactive objects gracefully
- Validates required references in Inspector
- Ensures objects are always reset and deactivated after use

## Integration Points
- Works with any GameObject for VFX, debris, or interactive drops
- Can trigger `AvatarImpactReaction` on collision
- Extendable for custom collision or animation behaviors

## Example Inspector Setup
- Add `ObjectDropAndDisappearOnCollision` to a GameObject
- Assign `prefab` and set `poolSize`, `spawnHeight`, `spawnWidth`, `dropDelay`, `scaleDownDuration`, and `scaleCurve`

---
**See also:** Other pooling and VFX scripts for advanced or specialized effects. 