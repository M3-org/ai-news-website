# ActorAudioSourceAssigner Component

## Overview
`ActorAudioSourceAssigner` is a MonoBehaviour for managing and assigning audio sources to actor GameObjects in the ShowRunner system. It ensures each actor has a properly configured AudioSource for lip sync and dialogue playback.

## Core Responsibilities
- Assign an AudioSource to the correct mesh object for each actor.
- Support both manual and automatic assignment of the target mesh object.
- Configure AudioSource settings for 3D spatial audio.
- Provide access to the assigned AudioSource for lip sync and playback.

## Main Features
- `targetAudioObject`: The GameObject (usually with a mesh renderer) that should receive the AudioSource.
- `autoFindMeshRenderer`: If enabled, automatically finds a suitable mesh renderer child if not specified.
- `GetAudioSource()`: Returns the assigned or created AudioSource for this actor.

## How It Works
1. On Awake, attempts to find or assign the correct mesh object for audio.
2. If `autoFindMeshRenderer` is enabled, searches for a SkinnedMeshRenderer or MeshRenderer in children.
3. Ensures an AudioSource exists on the target object, creating one if needed.
4. Configures the AudioSource for 3D sound and appropriate rolloff.
5. Provides a public method to access the AudioSource for use in lip sync and dialogue playback.

## Best Practices
- Attach this script to the root GameObject of each actor.
- Use `autoFindMeshRenderer` for automatic setup, or manually assign the target mesh object in the Inspector.
- Use the provided `GetAudioSource()` method for all audio playback and lip sync operations.

## Error Handling
- Falls back to the root GameObject if no mesh renderer is found.
- Ensures an AudioSource is always available.
- Configures AudioSource with sensible defaults for 3D audio.

## Integration Points
- ShowRunner: For actor audio mapping.
- Lip sync systems: For driving visemes and mouth movement.
- Dialogue playback: For playing actor lines.

## Example Usage
1. Attach to an actor GameObject.
2. Assign the target mesh object or enable auto-find.
3. Use `GetAudioSource()` to play dialogue or drive lip sync. 