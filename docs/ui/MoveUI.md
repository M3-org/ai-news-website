# MoveUI Component

## Overview
`MoveUI` is a MonoBehaviour for smoothly moving a UI element up or down along the Y-axis. It is useful for animated UI transitions, notifications, or context-sensitive panels.

## Core Responsibilities
- Move a UI element up or down by a configurable distance.
- Animate the movement smoothly over a set duration.
- Prevent overlapping or concurrent movements.

## Main Features
- `moveDistance`: Distance to move the UI element (Y-axis).
- `moveDuration`: Duration of the movement animation.
- `MoveUp()`: Public method to move the UI up.
- `MoveDown()`: Public method to move the UI down.
- Uses a coroutine for smooth interpolation.

## How It Works
1. On Start, gets the RectTransform and stores the initial position.
2. `MoveUp()` and `MoveDown()` set the target position and start the animation coroutine.
3. `SmoothMove()` animates the position using Lerp over the specified duration.
4. Prevents multiple moves at the same time with an `isMoving` flag.

## Best Practices
- Attach to a UI GameObject with a RectTransform.
- Use for sliding panels, notifications, or context-sensitive UI.
- Adjust `moveDistance` and `moveDuration` for desired effect.

## Error Handling
- Prevents overlapping moves with an `isMoving` flag.

## Integration Points
- UI: For animated transitions or notifications.
- RectTransform: For position control.

## Example Usage
1. Attach to a UI GameObject with a RectTransform.
2. Call `MoveUp()` or `MoveDown()` from UI events or scripts.
3. The UI element will animate smoothly to the new position. 