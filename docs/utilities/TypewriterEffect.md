# TypewriterEffect Component

## Overview
`TypewriterEffect` is a MonoBehaviour for animating text with a typewriter effect in a TextMeshProUGUI element. It can be toggled on or off and supports instant display as well.

## Core Responsibilities
- Animate text with a typewriter effect (character by character).
- Allow toggling the effect on or off.
- Provide public methods to set or instantly display text.

## Main Features
- `typingSpeed`: Speed per character (seconds).
- `isTypewriterEnabled`: Toggle for enabling/disabling the effect.
- `SetText(string text)`: Public method to set and animate text.
- `DisplayFullText(string text)`: Instantly display the full text.
- `SetTypewriterEnabled(bool isEnabled)`: Toggle the effect at runtime.

## How It Works
1. On Awake, gets the TextMeshProUGUI component.
2. `SetText()` starts the typewriter animation or displays text instantly based on the toggle.
3. `TypeTextCoroutine()` animates the text character by character.
4. `DisplayFullText()` stops any animation and shows the full text immediately.

## Best Practices
- Attach to a GameObject with a TextMeshProUGUI component.
- Use `SetText()` to update text with animation.
- Use `SetTypewriterEnabled()` to toggle the effect at runtime.

## Error Handling
- Clears text if input is null or empty.
- Stops any running coroutine before starting a new one.

## Integration Points
- UI: For animated dialogue, notifications, or tips.
- TextMeshProUGUI: For rich text rendering.

## Example Usage
1. Attach to a GameObject with TextMeshProUGUI.
2. Call `SetText("Hello world!")` to animate text.
3. Call `DisplayFullText("Hello world!")` to show text instantly.
4. Use `SetTypewriterEnabled(true/false)` to toggle the effect. 