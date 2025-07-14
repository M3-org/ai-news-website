# EpisodeCompletionNotifier Component

## Overview
`EpisodeCompletionNotifier` is a MonoBehaviour that listens for episode completion events from the ShowRunner and notifies other systems when playback is finished. It acts as a decoupled notification layer for triggering outros or other end-of-episode actions.

## Core Responsibilities
- Listen for the `OnLastDialogueComplete` event from ShowRunner.
- Fire its own `OnEpisodePlaybackFinished` event for other systems to subscribe to.
- Relay episode completion data to a global event manager or other listeners.

## Main Features
- `showRunnerInstance`: Optional reference to the ShowRunner. If not set, it will auto-find one in the scene.
- `OnEpisodePlaybackFinished`: Event fired when the episode is finished.
- Subscribes/unsubscribes to ShowRunner events on enable/disable.
- Calls `EventManager.InvokeEpisodeComplete(completionData)` for global notification.

## How It Works
1. On Awake, finds the ShowRunner if not assigned.
2. On Enable, subscribes to ShowRunner's `OnLastDialogueComplete` event.
3. On Disable, unsubscribes to prevent memory leaks.
4. When the episode completes, fires its own event and notifies the global event manager.

## Best Practices
- Attach this script to a GameObject in your scene to decouple outro logic from ShowRunner.
- Subscribe to `OnEpisodePlaybackFinished` in outro or analytics systems.
- Use for modular, event-driven end-of-episode handling.

## Error Handling
- Disables itself if ShowRunner is not found.
- Logs warnings if unable to subscribe.
- Prevents duplicate subscriptions.

## Integration Points
- ShowRunner: For episode completion events.
- EventManager: For global event notification.
- Outro systems: For triggering outro videos or actions.

## Example Usage
1. Attach to a GameObject in your scene.
2. Optionally assign the ShowRunner reference.
3. Subscribe to `OnEpisodePlaybackFinished` in your outro handler.
4. Add outro logic in the event handler or via EventManager. 