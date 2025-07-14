# ShowValidator Component

## Overview
The `ShowValidator` is a utility MonoBehaviour for validating show data and resources in the ShowRunner system. It checks for missing audio files, validates directory structure, and provides UI feedback and automated fixes for common issues.

## Core Responsibilities
- Validate the presence of all required audio files for each episode, scene, and dialogue.
- Check directory structure under Resources/Episodes.
- Provide UI feedback on validation results.
- Offer a one-click fix for missing audio files by creating placeholders.

## UI Integration
- `TextMeshProUGUI validationResultText`: Displays validation results and messages.
- `Button validateButton`: Triggers validation process.
- `Button fixButton`: Triggers automated fixes for missing files.

## Main Methods
- `StartValidation()`: Begins the validation process.
- `ValidateShowData()`: Coroutine that checks show data and audio files.
- `ValidateAudioFiles()`: Checks for missing audio files and directories.
- `FixAudioFiles()`: Starts coroutine to create placeholder files.
- `CreatePlaceholderAudioFiles()`: Creates missing directories and placeholder audio files.

## Validation Process
1. Checks if ShowRunner and show data are loaded.
2. Iterates through all episodes, scenes, and dialogue entries.
3. Verifies the existence of required audio files in Resources/Episodes.
4. Reports missing files and directories.
5. Enables the fix button if issues are found.

## Automated Fixes
- Creates missing episode and audio directories.
- Copies a placeholder audio file for each missing audio file.
- Reports actions taken in the UI.

## Best Practices
- Run validation after importing or editing show data.
- Use the fix button to quickly resolve missing file issues.
- Ensure a placeholder audio file exists at Resources/placeholder_audio.

## Error Handling
- Reports missing ShowRunner or show data.
- Handles missing directories and files gracefully.
- Provides clear UI feedback for all errors and actions.

## Integration Points
- ShowRunner: For accessing loaded show data.
- Unity Resources: For file and directory checks.
- Unity UI: For user interaction and feedback.

## Debugging
- Validation messages are logged to the UI and console.
- Progress is reported during long validation runs.
- Fix actions are reported in the UI.

## Example Usage
1. Assign the script to a GameObject in your scene.
2. Link the UI elements (buttons, text) in the Inspector.
3. Click 'Validate' to check for missing files.
4. Click 'Fix' to auto-create missing directories and placeholder audio files. 