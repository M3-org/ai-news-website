# HeadlineScroller Component

## Overview
`HeadlineScroller` is a MonoBehaviour for creating a horizontally scrolling ticker or headline effect using TextMeshProUGUI. It is typically used for news tickers, stock tickers, or any continuously scrolling text in a UI.

## Core Responsibilities
- Scroll a TextMeshProUGUI text element horizontally across its parent RectTransform.
- Reset the text position when it moves out of view, creating a seamless loop.
- Allow configuration of scroll speed and text content.

## Main Features
- `tickerText`: The TextMeshProUGUI element to scroll.
- `scrollSpeed`: The speed at which the text scrolls (pixels per second).
- Automatically adds a ContentSizeFitter for proper sizing.
- Provides `UpdateTextPosition()` to reset the scroll after changing text.

## How It Works
1. On Start, configures anchors, pivot, and ContentSizeFitter for the text.
2. In Update, moves the text left by `scrollSpeed * Time.deltaTime`.
3. When the text moves out of view, resets its position to the right edge of the parent.
4. `UpdateTextPosition()` can be called after changing the text to reset the scroll.

## Best Practices
- Attach to a UI GameObject with a RectTransform and a child TextMeshProUGUI.
- Use for news, stock, or event tickers in UI panels.
- Call `UpdateTextPosition()` after changing the text content.

## Error Handling
- Adds ContentSizeFitter if missing.
- Ensures anchors and pivots are set for left-aligned scrolling.

## Integration Points
- UI: For displaying scrolling headlines or tickers.
- TextMeshProUGUI: For rich text rendering.

## Example Usage
1. Attach to a UI panel with a TextMeshProUGUI child.
2. Assign the text element in the Inspector.
3. Set the scroll speed as desired.
4. Call `UpdateTextPosition()` after changing the text. 