# BigHeadMode Component

## Overview
`BigHeadMode` is a MonoBehaviour for dynamically scaling the head bone (and optionally other bones) of a character in Unity. It is useful for fun effects, power-ups, or stylized character visuals.

## Core Responsibilities
- Find and scale the head bone of a character.
- Optionally scale additional bones.
- Allow toggling and adjusting scale at runtime.

## Main Features
- `enableBigHead`: Toggle to enable/disable big head mode.
- `headScale`: Scale multiplier for the head bone.
- `bone1`, `bone2`: Optional additional bones to scale.
- `otherBonesScale`: Scale multiplier for additional bones.
- Public methods to set toggles and scale values at runtime.

## How It Works
1. On Start, finds the head bone (by name) and stores original scales.
2. In Update, applies scaling to the head and additional bones based on current settings.
3. Provides public methods to toggle and adjust scale externally.

## Best Practices
- Attach to the root of a character hierarchy.
- Ensure the head bone contains "head" in its name.
- Assign additional bones in the Inspector if needed.
- Use public methods for runtime control (e.g., from UI or events).

## Error Handling
- Disables itself if the head bone is not found.
- Logs warnings if additional bones are not assigned.

## Integration Points
- Character controllers: For fun or power-up effects.
- UI: For toggling or adjusting scale at runtime.
- Animation: For stylized or exaggerated visuals.

## Example Usage
1. Attach to a character GameObject.
2. Assign head and optional bones in the Inspector.
3. Toggle and adjust scale via Inspector or public methods. 