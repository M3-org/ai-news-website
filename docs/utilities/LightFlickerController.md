# LightFlickerController Component

## Overview
`LightFlickerController` is a MonoBehaviour for simulating realistic flickering and burnout effects on one or more Unity Light components. It is ideal for creating atmospheric lighting in scenes such as horror, sci-fi, or industrial environments.

## Core Responsibilities
- Apply flicker and burnout effects to all child Light components.
- Support synchronized or independent flicker patterns.
- Allow configuration of intensity, speed, randomness, and probability settings.
- Provide methods to trigger flicker or reset all lights.

## Main Features
- Flicker intensity, speed, randomness, and probability settings.
- Burnout effect with configurable duration and chance.
- Synchronized flicker option for coordinated light effects.
- Automatic detection and management of all child Light components.
- Public methods: `TriggerFlicker()` and `ResetLights()`.

## How It Works
1. On Start, finds all child Light components and stores their default intensities.
2. In Update, applies flicker and burnout effects based on Perlin noise and random chance.
3. Synchronized flicker uses a global Perlin noise pattern; otherwise, each light flickers independently.
4. Burned out lights are set to zero intensity and recover after a set duration.
5. `TriggerFlicker()` and `ResetLights()` can be called from other scripts or events.

## Best Practices
- Attach to a parent GameObject containing one or more Light components.
- Adjust flicker and burnout settings for desired atmosphere.
- Use synchronized flicker for dramatic, coordinated effects.

## Error Handling
- Automatically detects and manages all child Light components.
- Ensures intensities stay within reasonable bounds.

## Integration Points
- Lighting: For atmospheric or environmental effects.
- Events: For triggering flicker or reset on demand.

## Example Usage
1. Attach to a GameObject with child Light components.
2. Adjust flicker, burnout, and synchronization settings in the Inspector.
3. Call `TriggerFlicker()` or `ResetLights()` from other scripts or events as needed. 