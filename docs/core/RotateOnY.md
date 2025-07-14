# RotateOnY Component

## Overview
`RotateOnY` is a simple MonoBehaviour that continuously rotates a GameObject around its Y axis at a configurable speed. Attach this script to any GameObject you want to spin.

## Core Responsibilities
- Rotate the GameObject around its Y axis every frame.
- Allow configuration of rotation speed via the Inspector.

## Main Features
- `rotationSpeed`: Rotation speed in degrees per second (default: 90).
- Uses `Update()` to apply rotation every frame.

## How It Works
1. On each frame, rotates the GameObject by `rotationSpeed * Time.deltaTime` degrees around the Y axis.
2. Speed can be adjusted in the Inspector.

## Best Practices
- Attach to any GameObject that should spin (e.g., props, effects).
- Adjust `rotationSpeed` for desired effect.

## Example Usage
1. Attach to a GameObject in your scene.
2. Set the desired rotation speed in the Inspector.
3. The object will spin automatically during play mode. 