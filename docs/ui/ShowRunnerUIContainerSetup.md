# ShowRunnerUIContainerSetup Utility

## Overview
`ShowRunnerUIContainerSetup` is an editor utility script for Unity that automates the creation and setup of the ShowRunner UI container and its controller. It is accessible from the Unity Editor menu and helps streamline the initial UI setup process for the ShowRunner system.

## Usage
- **Menu Path:** `Tools/Show Runner/Create UI Container`
- Creates a new GameObject named `ShowRunnerUIContainer` with the `ShowRunnerUIContainer` component.
- Creates a child GameObject named `ShowRunnerUI` with the `ShowRunnerUI` component.
- Automatically assigns references between the container, UI controller, and the first `ShowRunner` found in the scene.
- Selects the new container in the hierarchy for easy editing.

## How It Works
1. Adds a menu item to the Unity Editor.
2. When selected, creates the required GameObjects and components.
3. Searches for an existing `ShowRunner` in the scene and assigns it to both the container and UI controller.
4. Sets up cross-references between the UI container and UI controller.
5. Leaves the new objects selected for further manual UI element assignment in the Inspector.

## Best Practices
- Use this tool at the start of UI setup for a new scene.
- Manually assign UI elements (dropdowns, buttons, etc.) in the Inspector after running the tool.
- Ensure only one `ShowRunnerUIContainer` exists in the scene to avoid conflicts.

## Error Handling
- If no `ShowRunner` is found, a warning is logged and references must be assigned manually.
- All references are set using Unity's `SerializedObject` and `SerializedProperty` for proper serialization.

## Integration Points
- `ShowRunnerUIContainer`: Main UI container component.
- `ShowRunnerUI`: UI logic controller.
- `ShowRunner`: Main show logic controller.

## Editor Only
- This script is wrapped in `#if UNITY_EDITOR` and only runs in the Unity Editor.
- Not included in builds.

## Debugging
- Logs warnings if `ShowRunner` is not found.
- Selects the new container for easy inspection and assignment.

## Example
To use, open the Unity Editor and select `Tools > Show Runner > Create UI Container`. Then assign your UI elements in the Inspector as needed. 