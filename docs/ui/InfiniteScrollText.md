# InfiniteScrollText Component

## Overview
`InfiniteScrollText` is a MonoBehaviour for creating a seamless, infinitely scrolling ticker using TextMeshProUGUI. It is ideal for news tickers, stock tickers, or any UI element that requires continuous, looping text.

## Core Responsibilities
- Scroll a message horizontally across a UI container, looping seamlessly.
- Clone the text as needed to fill the container and maintain a continuous scroll.
- Allow dynamic updates to the ticker message and scroll speed.

## Main Features
- `tickerText`: The TextMeshProUGUI element to scroll.
- `tickerMessage`: The message to display and scroll.
- `scrollSpeed`: The speed at which the text scrolls (pixels per second).
- Dynamically calculates and instantiates clones to fill the container width.
- Provides `UpdateText()` to change the message at runtime.

## How It Works
1. On Awake, validates required components and disables itself if missing.
2. On Start, sets the initial message and calls `InitializeTicker()`.
3. `InitializeTicker()` calculates how many clones are needed to fill the container and positions them horizontally.
4. In Update, moves all clones left by `scrollSpeed * Time.deltaTime`.
5. When a clone moves off screen, it is repositioned to the right of the last clone, creating a seamless loop.
6. `UpdateText()` can be called to change the message and reinitialize the ticker.

## Best Practices
- Attach to a UI GameObject with a RectTransform and a child TextMeshProUGUI.
- Use for news, stock, or event tickers in UI panels.
- Call `UpdateText()` after changing the message.

## Error Handling
- Disables itself if required components are missing.
- Logs errors for missing references.

## Integration Points
- UI: For displaying scrolling headlines or tickers.
- TextMeshProUGUI: For rich text rendering.

## Example Usage
1. Attach to a UI panel with a TextMeshProUGUI child.
2. Assign the text element and set the initial message in the Inspector.
3. Set the scroll speed as desired.
4. Call `UpdateText("New message")` to change the ticker at runtime. 