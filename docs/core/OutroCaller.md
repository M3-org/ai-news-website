# OutroCaller Component

## Overview
`OutroCaller` is a MonoBehaviour that listens for episode completion events and triggers the playback of an outro video. It manages video playback, audio routing, caption handling, and fade-out effects for a polished end-of-episode experience.

## Core Responsibilities
- Listen for episode completion via `EpisodeCompletionNotifier`.
- Activate and play an outro video using a `VideoPlayer`.
- Manage video audio output and UI elements (captions, fade panel).
- Ensure the outro video starts from the beginning and fades out smoothly.

## Main Features
- `outroVideoObject`: GameObject containing the outro `VideoPlayer`.
- `completionNotifier`: Reference to the `EpisodeCompletionNotifier`.
- `captionsTextbox`: UI element for captions, disabled before outro.
- `videoAudioSource`: AudioSource for video playback.
- `fadePanel`: UI panel for fade-to-black effect.
- `fadeDuration`: Duration of fade effect.

## How It Works
1. On Awake, finds and validates all required references.
2. On Enable, subscribes to the episode completion event.
3. When triggered, disables captions, activates the video, resets and prepares the player, and starts playback.
4. Waits for video to finish, then fades out using the fade panel.
5. Handles cleanup and state reset as needed.

## Best Practices
- Assign all references in the Inspector for reliability.
- Use a dedicated outro video object and fade panel for best results.
- Ensure the outro video is properly formatted and tested.

## Error Handling
- Disables itself if critical references are missing.
- Logs warnings and errors for missing components or failed playback.
- Prevents duplicate outro triggers.

## Integration Points
- `EpisodeCompletionNotifier`: For episode end events.
- `VideoPlayer`: For outro video playback.
- `AudioSource`: For video audio routing.
- UI: For captions and fade effects.

## Example Usage
1. Attach to a GameObject in your scene.
2. Assign the outro video object, notifier, captions, audio source, and fade panel.
3. Outro will play automatically at the end of each episode. 