# CameraDropdownHandler Component

## Overview
`CameraDropdownHandler` is a MonoBehaviour for managing a TMP_Dropdown UI element that allows users to switch between multiple cameras in the scene. It automatically populates the dropdown with all cameras and handles switching logic.

## Core Responsibilities
- Populate a TMP_Dropdown with all cameras in the scene.
- Switch the active camera based on dropdown selection.
- Optionally integrate with a payload manager for further actions.

## Main Features
- `cameraDropdown`: Reference to the TMP_Dropdown UI element.
- `payloadManager`: Optional reference for future integration.
- Finds all cameras (active and inactive) in the scene.
- Switches cameras by enabling/disabling GameObjects.
- Handles dropdown value changes to switch cameras.

## How It Works
1. On Start, finds all cameras and populates the dropdown with their names.
2. Adds a listener to the dropdown to handle selection changes.
3. When a new camera is selected, disables all cameras and enables the selected one.

## Best Practices
- Assign the TMP_Dropdown in the Inspector.
- Use for multi-camera scenes, cutscenes, or debugging tools.
- Optionally extend to trigger additional logic via the payload manager.

## Error Handling
- Assumes all cameras are valid and present in the scene.
- Logs camera switches for debugging.

## Integration Points
- TMP_Dropdown: For camera selection UI.
- Camera: For scene view switching.
- PayloadManager: For future integration.

## Example Usage
1. Attach to a GameObject in your scene.
2. Assign the TMP_Dropdown and (optionally) the payload manager in the Inspector.
3. The dropdown will list all cameras and allow switching at runtime. 