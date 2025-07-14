# CryptoPriceFetcher Component

## Overview
`CryptoPriceFetcher` is a MonoBehaviour for fetching and displaying live prices and 24h changes for selected cryptocurrencies using the CoinGecko API. It formats the data and displays it in an InfiniteScrollText ticker UI.

## Core Responsibilities
- Fetch live price and 24h change data for Bitcoin, Ethereum, Solana, and Polygon.
- Format and display the data in a scrolling ticker using InfiniteScrollText.
- Color-code price changes for easy visual feedback.

## Main Features
- Uses CoinGecko API to fetch prices for specific coins.
- `infiniteScrollText`: Reference to the InfiniteScrollText component for display.
- Formats ticker text with color coding for price changes.
- Shows prices with 4 decimal places for precision.

## How It Works
1. On Start, fetches market data for the selected coins from CoinGecko.
2. Parses the JSON response and updates each coin's price and 24h change.
3. Formats the data as a color-coded ticker string.
4. Updates the InfiniteScrollText component to display the ticker.

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
2. The ticker will update automatically at runtime with live data. 