# InverseRotation Component

## Overview
`InverseRotation` is a MonoBehaviour for applying the inverse rotation of a source Transform to the attached GameObject. It is useful for counter-rotating objects, camera effects, or special UI elements.

## Core Responsibilities
- Apply the inverse of a source object's rotation to this GameObject every frame.

## Main Features
- `sourceObject`: The Transform whose rotation will be inverted and applied.
- Updates the rotation in `Update()`.

## How It Works
1. On each frame, checks if `sourceObject` is assigned.
2. Sets this GameObject's rotation to the inverse of the source object's rotation.

## Best Practices
- Assign the source object in the Inspector.
- Use for counter-rotating props, camera rigs, or UI elements.

## Error Handling
- Does nothing if `sourceObject` is not assigned.

## Integration Points
- Camera rigs: For counter-rotation effects.
- UI: For special visual effects.
- Props: For mechanical or puzzle elements.

## Example Usage
1. Attach to a GameObject in your scene.
2. Assign the source object in the Inspector.
3. The object will always have the inverse rotation of the source during play mode. 