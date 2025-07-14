# UXAnimationManager Component

## Overview
`UXAnimationManager` is a MonoBehaviour for managing the animation states (show/hide) of multiple UI elements based on game events and timing. It supports auto-hide, location-specific visibility, and integrates with ShowRunner events.

## Core Responsibilities
- Manage visibility of multiple UI elements via Animator parameters.
- Support auto-hide with configurable delay.
- Respond to episode, scene, and commercial events from ShowRunner.
- Allow location-specific UI visibility.

## Main Features
- `managedAnimators`: List of UI animators and their state parameters.
- `autoHideEnabled`: Toggle for auto-hide functionality.
- `autoHideDelay`: Delay before auto-hiding UI.
- Singleton pattern for global access.
- Public methods to show/hide all UI, handle events, and manage timers.

## How It Works
1. On Awake, sets up singleton instance.
2. Provides methods to show/hide all managed UI elements by setting Animator bools.
3. Supports auto-hide via coroutine and configurable delay.
4. Handles ShowRunner events: episode start/end, scene changes, commercial breaks.
5. Allows location-specific UI visibility via `specificLocation` in animator info.

## Best Practices
- Assign all managed animators and state parameters in the Inspector.
- Use for complex UI panels, overlays, or context-sensitive elements.
- Integrate with ShowRunner for event-driven UI state.

## Error Handling
- Logs warnings for missing animators or state parameters.
- Cancels auto-hide timer on explicit show/hide.

## Integration Points
- ShowRunner: For episode, scene, and commercial events.
- Animator: For UI element state transitions.
- UI: For overlays, panels, or context-sensitive elements.

## Example Usage
1. Attach to a GameObject in your scene.
2. Assign UI animators and state parameters in the Inspector.
3. UI will show/hide automatically based on game events and timing. 