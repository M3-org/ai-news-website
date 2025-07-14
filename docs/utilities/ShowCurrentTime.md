# ShowCurrentTime Component

## Overview
`ShowCurrentTime` is a MonoBehaviour for displaying the current date and time in a TextMeshProUGUI element. It updates the text every frame using a configurable format string.

## Core Responsibilities
- Display the current date and time in a UI text element.
- Allow configuration of the date/time format.
- Update the display in real time.

## Main Features
- `dateTimeText`: Reference to the TextMeshProUGUI element for display.
- `dateTimeFormat`: String format for date and time (e.g., "MM/dd/yyyy hh:mm tt").
- Updates the text every frame in `Update()`.

## How It Works
1. On each frame, gets the current system date and time.
2. Formats the date/time string using `dateTimeFormat`.
3. Updates the TextMeshProUGUI element with the formatted string.

## Best Practices
- Assign the TextMeshProUGUI element in the Inspector.
- Set the desired date/time format string.
- Use for clocks, dashboards, or status bars in UI.

## Error Handling
- Does nothing if `dateTimeText` is not assigned.

## Integration Points
- UI: For displaying real-time clocks or timestamps.
- TextMeshProUGUI: For rich text rendering.

## Example Usage
1. Attach to a GameObject in your scene.
2. Assign the TextMeshProUGUI element in the Inspector.
3. Set the desired date/time format.
4. The text will update automatically during play mode. 