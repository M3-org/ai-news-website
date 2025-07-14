# SplitScreenManager Component

## Overview
`SplitScreenManager` is a MonoBehaviour that manages splitscreen UI functionality based on scene location changes. It activates or deactivates a splitscreen GameObject when the current location matches a specified name.

## Core Responsibilities
- Listen for scene/location changes from ShowRunner.
- Activate or deactivate the splitscreen UI based on the current location.
- Provide methods to query splitscreen state and current location.

## Main Features
- `splitScreenObject`: The GameObject containing splitscreen UI elements.
- `splitScreenLocationName`: The location name that triggers splitscreen mode.
- Subscribes to `ShowRunner.OnSceneChangedForDisplay` for location updates.
- Ensures splitscreen is disabled by default.

## How It Works
1. On Awake, finds the ShowRunner and validates the splitscreen object.
2. On Enable, subscribes to scene/location change events.
3. On scene change, checks if the new location matches the splitscreen trigger name.
4. Activates or deactivates the splitscreen UI accordingly.
5. Provides public methods to get the current location and splitscreen state.

## Best Practices
- Assign the splitscreen UI object and trigger location in the Inspector.
- Use clear, unique location names for splitscreen triggers.
- Ensure only one SplitScreenManager is active per scene.

## Error Handling
- Disables itself if ShowRunner or splitscreen object is missing.
- Logs warnings for invalid location names.
- Prevents duplicate event subscriptions.

## Integration Points
- ShowRunner: For scene/location change events.
- UI: For splitscreen display.

## Example Usage
1. Attach to a GameObject in your scene.
2. Assign the splitscreen UI object and trigger location name.
3. Splitscreen UI will activate automatically when the location matches. 