# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an AI-powered 3D show production system built in Unity. The project generates automated news shows featuring VRM avatars, with complete pipeline for content creation, episode management, and video production. The system transforms scattered information from Discord, GitHub, and Twitter into engaging 3D video content.

## Unity Project Details

- **Unity Version**: 2022.3.53f1
- **Key Dependencies**: 
  - UniVRM VRM 1.0 for avatar support
  - Newtonsoft JSON for data handling
  - Animation Rigging for character animation
  - Timeline for sequence management
  - Oculus Lip Sync for facial animation

## Core Architecture

### ShowRunner System
The heart of the project is the ShowRunner framework that orchestrates show production:

- **ShowRunner.cs**: Central controller managing episode playback, scene transitions, and event processing
- **ShowData.cs**: Data structures for episodes, scenes, and dialogue management
- **EventProcessor.cs**: Handles show events (scene preparation, dialogue, transitions)
- **ScenePreparationManager.cs**: Manages asynchronous scene loading and preparation

### Key Directories
- `Assets/Scripts/ShowRunner/`: Core show management system
- `Assets/Scripts/APIs/`: External API integrations (YouTube, ElevenLabs, translation services)
- `Assets/Scripts/Effects/`: Visual effects system (glitch effects, particle systems)
- `Assets/Scripts/UI/`: User interface components
- `Assets/VRMs/`: Avatar models in VRM format
- `Assets/Resources/Episodes/`: JSON episode data files

### Data Flow
1. JSON episode files define show structure and dialogue
2. ShowRunner loads and processes episodes
3. EventProcessor handles scene preparation and transitions
4. Avatar system manages character animations and lip sync
5. Effects system adds visual enhancements
6. Recording system captures final video output

## Development Commands

### Video Processing
```bash
# Python script for fixing video color space issues
python fix_videos.py

# PowerShell script for batch video conversion
./Convert-Videos.ps1 -InputDirectory "path/to/videos" -OutputDirectory "path/to/output"
```

### Unity Development
- Open project in Unity 2022.3.53f1
- Use the ShowRunner scene as the main development environment
- Episode JSON files are loaded from `Assets/Resources/Episodes/`
- VRM avatars can be imported to `Assets/VRMs/`

## Episode Structure

Episodes are defined in JSON format with this structure:
```json
{
  "config": {
    "name": "Show Name",
    "actors": { ... }
  },
  "episodes": [
    {
      "id": "episode_id",
      "name": "Episode Name", 
      "scenes": [
        {
          "name": "Scene Name",
          "dialogues": [
            {
              "actor": "character_name",
              "line": "dialogue text",
              "action": "animation_action"
            }
          ]
        }
      ]
    }
  ]
}
```

## API Integration

The system integrates with multiple external services:
- **YouTube API**: For automated video uploads and playlist management
- **ElevenLabs**: For text-to-speech generation
- **Translation Services**: For multi-language episode generation
- **X23 API**: For remote interview capabilities

## Commercial & Transition System

- **CommercialManager**: Handles video commercials between scenes
- **BackgroundMusicManager**: Scene-specific music management
- **SceneTransitionManager**: Smooth transitions between content

## Key Features

- **VRM Avatar Support**: Full 3D character animation with facial expressions
- **Automated Lip Sync**: Using Oculus Lip Sync for speech synchronization
- **Effects System**: Glitch effects, particle systems, and visual enhancements
- **Multi-language Support**: Translation pipeline for international content
- **Automated Publishing**: YouTube upload and cross-platform posting
- **Episode Archive**: Searchable content management system

<<<<<<< HEAD
=======
## Critical Documentation Reference

For detailed implementation guidance, refer to these enhanced documentation files:

### Core System Documentation
- **[Component Relationships](docs/COMPONENT_RELATIONSHIPS.md)** - Complete system architecture, dependencies, and integration patterns
- **[ShowRunner API](docs/core/ShowRunner.md)** - Central controller with complete public API (15+ methods, events, data structures)
- **[EventProcessor API](docs/core/EventProcessor.md)** - Event handling system with supported actor actions and MIDI events
- **[ShowData Structures](docs/core/ShowData.md)** - JSON data formats and serialization patterns

### Implementation Examples
- **[Animation Components](docs/animation/)** - RotateSphere, WaypointManager with method signatures
- **[Effects System](docs/effects/)** - GlitchOutEffect, BigHeadEffect with API details
- **[UI Components](docs/ui/)** - ShowRunnerUI and container setup patterns

### Key Integration Points
- ShowRunner singleton: `ShowRunner.Instance` - Access from any component
- Event processing: `EventProcessor.ProcessEvent(EventData)` - Handle dialogue, scenes, MIDI
- Effect triggering: Action strings like "excited", "happy", "spazz", "bighead_grow"
- Scene management: Async preparation via ScenePreparationManager

### Common Patterns
- All components validate dependencies in Awake()
- Effects use graceful degradation for missing components
- Event-driven architecture with static events for loose coupling
- Serialized fields exposed in Inspector for configuration

>>>>>>> main
## Development Notes

- The system uses an event-driven architecture for show management
- VRM avatars require proper rigging for animation support
- Video output uses Unity's Recorder system
- The project supports both manual and automated playbook modes
- Scene preparation is handled asynchronously to prevent blocking
- All external API calls should be handled with proper error management

## Planning & Roadmap

The `plan/` directory contains detailed roadmaps for:
- Milestone 1: Automation Foundation (YouTube API, playlist management)
- Milestone 2: Global Expansion (multi-language support)
- Milestone 3: Content Hub (searchable archive website)
- Milestone 4: Ecosystem Integration (community features, DAO integration)