# ShowRunnerSetup Utility

## Overview
`ShowRunnerSetup` is an editor utility script for Unity that automates the creation and setup of the ShowRunner system, including the main ShowRunner object, UI container, and essential UI elements. It is accessible from the Unity Editor menu and helps streamline the initial setup process for a new show scene.

## Usage
- **Menu Path:** `Tools/Show Runner/Create Show Runner`
- Creates a new GameObject named `ShowRunner` with the `ShowRunner` component.
- Finds and assigns the first `EventProcessor` in the scene to the ShowRunner.
- Creates a UI Canvas, UI Container, and all required UI elements (dropdowns, buttons, etc.).
- Sets up references between the ShowRunner, UI container, and UI controller.
- Creates the `Episodes` directory structure in the project if it does not exist.
- Selects the new ShowRunner object in the hierarchy for easy editing.

## How It Works
1. Adds a menu item to the Unity Editor.
2. When selected, creates the ShowRunner GameObject and adds the ShowRunner component.
3. Searches for an existing `EventProcessor` in the scene and assigns it to the ShowRunner.
4. Creates a UI Canvas and populates it with a UI container, control panel, and all required UI elements.
5. Sets up cross-references between the ShowRunner, UI container, and UI controller.
6. Ensures the `Episodes` and `Resources` directories exist in the project.
7. Selects the new ShowRunner object for further manual assignment and editing.

## Best Practices
- Use this tool at the start of a new scene setup.
- Manually assign any additional references or UI elements in the Inspector after running the tool.
- Ensure only one ShowRunner exists in the scene to avoid conflicts.

## Error Handling
- If no `EventProcessor` is found, a warning is logged and the reference must be assigned manually.
- All references are set using Unity's `SerializedObject` and `SerializedProperty` for proper serialization.
- Creates missing directories and refreshes the AssetDatabase.

## Integration Points
- `ShowRunner`: Main show logic controller.
- `EventProcessor`: Event processing component.
- `ShowRunnerUIContainer`: Main UI container component.
- `ShowRunnerUI`: UI logic controller.
- Unity UI system: For all UI elements.

## Editor Only
- This script is wrapped in `#if UNITY_EDITOR` and only runs in the Unity Editor.
- Not included in builds.

## Debugging
- Logs warnings if `EventProcessor` is not found.
- Logs directory creation and setup steps.
- Selects the new ShowRunner object for easy inspection and assignment.

## Example
To use, open the Unity Editor and select `Tools > Show Runner > Create Show Runner`. Then assign any additional references or UI elements in the Inspector as needed. 