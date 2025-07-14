# MarketDataManager Component

## Overview
`MarketDataManager` is a MonoBehaviour for fetching and displaying live cryptocurrency market data in a scrolling ticker UI. It integrates with InfiniteScrollText and uses the CoinGecko API to show real-time prices and 24-hour changes for selected coins.

## Core Responsibilities
- Fetch live price and 24h change data for a list of cryptocurrencies.
- Format and display the data in a scrolling ticker using InfiniteScrollText.
- Allow dynamic addition of new coins to the ticker.

## Main Features
- `symbols`: List of coins to display, each with a name and CoinGecko ID.
- `scrollText`: Reference to the InfiniteScrollText component for display.
- `separator`: String used to separate tickers in the UI.
- Fetches data from the CoinGecko API on Start.
- Formats ticker text with color coding for price changes.
- Public method `AddCoin()` to add new coins at runtime.

## How It Works
1. On Start, fetches market data for all configured coins from CoinGecko.
2. Parses the JSON response and updates each coin's price and 24h change.
3. Formats the data as a color-coded ticker string.
4. Updates the InfiniteScrollText component to display the ticker.
5. Supports adding new coins dynamically.

## Best Practices
- Assign InfiniteScrollText in the Inspector or ensure it is on the same GameObject.
- Use for live crypto tickers, news tickers, or financial dashboards.
- Handle API rate limits and errors gracefully in production.

## Error Handling
- Disables itself if InfiniteScrollText is missing.
- Logs errors for failed API requests or JSON parsing.
- Warns if no data is available for a coin.

## Integration Points
- InfiniteScrollText: For scrolling ticker display.
- CoinGecko API: For live market data.
- UI: For financial dashboards or news tickers.

## Example Usage
1. Attach to a GameObject with InfiniteScrollText.
2. Configure the list of coins in the Inspector.
3. The ticker will update automatically at runtime with live data. 