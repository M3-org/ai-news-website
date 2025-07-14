# IntroSequenceManager Component

## Overview
`IntroSequenceManager` is a MonoBehaviour for managing and playing a sequence of animated or video-based intro steps. It is used to create multi-step intro sequences for scenes, shows, or games, supporting both animations and video clips.

## Core Responsibilities
- Manage a sequence of intro steps, each with its own GameObject.
- Play animations or videos for each step in order.
- Handle activation/deactivation of step objects.
- Provide coroutine-based sequence playback for integration with other systems.

## Main Features
- `introSteps`: Array of `IntroStep` objects, each referencing a GameObject.
- `isEnabled`: Enables or disables the intro sequence.
- Singleton pattern for persistent management.
- Supports both Animator and VideoPlayer components on step objects.
- Cleans up and resets state after sequence completion.

## How It Works
1. On Awake, disables all step objects and ensures singleton instance.
2. `StartIntroSequence()` coroutine plays each step in order:
   - Activates the step object.
   - Plays animation (if Animator is present) or video (if VideoPlayer is present).
   - Waits for the animation/video to finish.
   - Deactivates the previous step.
3. On completion, deactivates all steps and resets VideoPlayers.

## Best Practices
- Assign all intro steps and their GameObjects in the Inspector.
- Use for splash screens, show intros, or scene transitions.
- Integrate with scene preparation or loading systems.

## Error Handling
- Skips steps with missing objects.
- Logs warnings for missing animations or videos.
- Waits a default time if no animation or video is found.

## Integration Points
- ScenePreparationManager: For scene intro sequences.
- Animator: For animated steps.
- VideoPlayer: For video steps.
- UI: For intro overlays or effects.

## Example Usage
1. Attach to a GameObject in your scene.
2. Assign intro steps and their GameObjects in the Inspector.
3. Call `StartIntroSequence()` as a coroutine to play the intro before scene activation. 