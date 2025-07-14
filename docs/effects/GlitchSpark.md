# GlitchSpark Script Documentation

## Overview
`GlitchSpark` is a Unity MonoBehaviour representing a single spark object in a glitch or burst effect. It is designed to be used with object pooling and managed by `GlitchSparkManager` for efficient, reusable visual effects.

## Core Responsibilities
- Represent an individual spark in a glitch/burst effect
- Provide a hook for resetting spark state when reused

## Main Features
- **Reset Method:** `ResetSpark()` can be extended to reset visual or physical state
- **Minimal Overhead:** Lightweight, single-purpose script for pooled objects
- **Extensible:** Add custom behavior (particle, sound, etc.) as needed

## How It Works
- Instantiated and managed by `GlitchSparkManager` via object pooling
- `ResetSpark()` is called when the spark is reused or returned to the pool
- Can be extended for custom VFX, SFX, or logic per spark

## Example Usage
```csharp
// Used internally by GlitchSparkManager and GenericObjectPooler
// Extend ResetSpark() for custom reset logic
```

## Best Practices
- Keep the script lightweight for optimal pooling performance
- Add only spark-specific logic (visuals, reset, etc.)
- Use with a pooling manager for best efficiency

## Error Handling
- No runtime errors expected if used as intended
- Extend ResetSpark() to handle any custom state

## Integration Points
- Used by `GlitchSparkManager` and `GenericObjectPooler`
- Can be extended for custom spark effects

## Example Inspector Setup
- Add `GlitchSpark` to the spark prefab used by `GlitchSparkManager`

---
**See also:** `GlitchSparkManager`, `GenericObjectPooler`, and other effect scripts for pooled VFX. 