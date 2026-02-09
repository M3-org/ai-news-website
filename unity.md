# AI Show

> Automated 3D media pipeline for teams that ship in public.

Your project already has a story. AI Show turns it into a daily show
with virtual hosts, scenes, narration, and automated publishing.

Website: https://elizaos.news/unity/


## What It Does

- Collects updates from GitHub, Discord, and social feeds
- Transforms raw updates into structured episode scripts
- Renders 3D virtual hosts, scenes, voice, and effects
- Runs event-driven scene transitions and actor actions
- Records and publishes finished episodes automatically
- Supports multilingual workflows and scalable production cadence


## Pipeline Stages

1. **Data Collection** - GitHub + community sources aggregated into daily JSON
2. **Script Generation** - AI writes scene/dialogue JSON, ElevenLabs generates voices
3. **3D Production** - Unity 2022.3.53f1 + UniVRM renders scenes, effects, camera moves
4. **Distribution** - YouTube & social posting, multilingual, fully automated


## Core System Layers

### Content Ingestion + AI Scripting
Aggregates GitHub, Discord, and social activity into structured daily JSON.
Transforms updates into deterministic episode JSON with scenes, dialogue,
actions, and timing-friendly events.

### Unity Runtime + World Systems
Built on Unity 2022.3.53f1 with a central ShowRunner and event-driven
architecture. Async scene loading, dynamic character spawn points, scene
transitions, camera logic, and runtime orchestration.

### Avatars, Voice, Lip Sync, and Effects
UniVRM avatars with character-specific voice and action mapping. ElevenLabs
TTS pipeline with per-line speech timing and event hooks. Oculus Lip Sync
integration plus modular effect triggers.

### Recording, Distribution, and Scale
Automated recording pipeline with transcript generation and multi-format
outputs. Near-daily production cadence with reusable studio environments
and expandable cast workflows.


## Characters

- **Eli5** - Main host, explains complex topics simply
- **Shaw** - Technical co-host, covers code and architecture
- **Various Guests** - Community members and project contributors


## Tech Stack

- Unity 2022.3.53f1 (3D rendering)
- UniVRM (avatar system)
- ElevenLabs (text-to-speech)
- Python (data pipeline, scripting)
- GitHub Actions (CI/CD automation)
- YouTube API (publishing)


## Stats

- Production cadence: Daily
- Languages: English, Chinese, Korean
- Manual intervention: None (fully automated)


## Links

- Website: https://elizaos.news
- YouTube: https://www.youtube.com/@m3org
- Discord: https://discord.gg/ai16z
- X/Twitter: https://x.com/dankvr
- GitHub: https://github.com/elizaOS
- Contact: https://elizaos.news/unity.html#contact
