# AutoTypewriterEffect Component

## Overview
`AutoTypewriterEffect` is a MonoBehaviour for displaying a list of text entries with a typewriter animation in a TextMeshProUGUI element. It cycles through entries automatically, typing each out character by character.

## Core Responsibilities
- Animate text entries with a typewriter effect.
- Cycle through a list of entries, displaying each for a set duration.
- Integrate with TextMeshProUGUI for rich text rendering.

## Main Features
- `typingSpeed`: Speed per character (seconds).
- `delayBetweenEntries`: Delay between entries (seconds).
- `textEntries`: List of text entries to display (can be set in Inspector or auto-filled with crypto jokes).
- Cycles through entries in a loop.

## How It Works
1. On Awake, gets the TextMeshProUGUI component and fills `textEntries` if empty.
2. On Start, begins cycling through entries with a coroutine.
3. Types out each entry character by character, waits, then moves to the next.
4. Loops back to the first entry after the last.

## Best Practices
- Attach to a GameObject with a TextMeshProUGUI component.
- Set `textEntries` in the Inspector or use the default jokes.
- Adjust `typingSpeed` and `delayBetweenEntries` for desired pacing.

## Error Handling
- Fills `textEntries` with defaults if not set.
- Assumes TextMeshProUGUI is present on the same GameObject.

## Integration Points
- UI: For animated text displays, jokes, or tips.
- TextMeshProUGUI: For rich text rendering.

## Example Usage
1. Attach to a GameObject with TextMeshProUGUI.
2. Set text entries, typing speed, and delay in the Inspector.
3. The text will animate and cycle automatically during play mode. 