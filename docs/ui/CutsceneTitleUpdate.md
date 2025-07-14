# CutsceneTitleUpdate Component

## Overview
`CutsceneTitleUpdate` is a MonoBehaviour for updating UI TextMeshProUGUI elements to display the current episode's name and premise. It listens for episode selection events from ShowRunner and ensures the UI is updated and visible.

## Core Responsibilities
- Display the current episode's name and premise in the UI.
- Listen for episode selection events from ShowRunner.
- Ensure target UI elements are active before updating.

## Main Features
- `episodeNameText`: TextMeshProUGUI for the episode name.
- `episodePremiseText`: TextMeshProUGUI for the episode premise.
- Subscribes to `ShowRunner.OnEpisodeSelectedForDisplay` for updates.
- Provides public methods to update name and premise manually.

## How It Works
1. On Start, subscribes to ShowRunner's episode selection event.
2. When an episode is selected, updates both name and premise UI elements.
3. Ensures UI elements are active before updating their text.
4. Unsubscribes from events on destroy.

## Best Practices
- Assign both TextMeshProUGUI references in the Inspector.
- Use for cutscene, episode, or scene title displays.
- Use public methods for manual updates if needed.

## Error Handling
- Logs errors if ShowRunner is missing.
- Logs warnings if UI references are not set.
- Ensures UI elements are active before updating.

## Integration Points
- ShowRunner: For episode selection events.
- UI: For displaying episode titles and descriptions.
- TextMeshProUGUI: For rich text rendering.

## Example Usage
1. Attach to a UI GameObject with two TextMeshProUGUI elements.
2. Assign the name and premise text fields in the Inspector.
3. UI will update automatically when an episode is selected in ShowRunner. 