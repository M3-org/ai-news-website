# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the **AI News Website** repository, which serves as the content and website component for a Unity-based 3D automated AI news show production system. The project generates and hosts AI-powered news episodes featuring virtual characters discussing technology updates, GitHub developments, and AI community news.

## Repository Structure

### Core Components
- **Episodes/**: Contains daily podcast episodes in JSON format with metadata, recordings, and transcripts
  - Organized by date (YYYY-MM-DD format)
  - Each episode includes: English, Chinese, Korean versions
  - Subfolders: `metadata/`, `recordings/`, `transcript/`, `headlines/`
- **facts/**: Daily JSON files with curated news data and information
- **docs/**: Comprehensive technical documentation for the Unity system
- **media/**: Visual assets and promotional materials
- **website.html**: Static website showcasing the project technology and process

### Episode Data Structure
Episodes follow this naming pattern: `aipodcast_YYYY-MM-DD_[number]_[language].json`
- Languages: `en` (English), `ch` (Chinese), `ko` (Korean)
- Contains structured JSON with actors, scenes, dialogue, and actions
- Associated metadata includes YouTube metadata and transcription files

## Key Technologies

### Content Generation
- **AI-Powered Scripting**: Large Language Models process Discord/GitHub data into structured episodes
- **Multi-language Support**: Automated translation pipeline for global content
- **Character Personalities**: Defined AI personas (Marc, Eliza, Shaw, Sparty, Pepo) with distinct voices

### Episode Structure
- **Actors**: Pre-defined characters with voice assignments and personality descriptions
- **Scenes**: Structured dialogue sequences with locations and actions
- **Actions**: Special effects triggered during dialogue (e.g., "excited", "spazz", "bighead_grow")
- **TV Integration**: Dynamic image display system for visual content

## Common Development Tasks

### Viewing Episode Content
```bash
# Read a specific episode
cat Episodes/2025-07-13/aipodcast_2025-07-13_en.json

# Check episode metadata
cat Episodes/2025-07-13/metadata/aipodcast_2025-07-13_youtube_metadata_en.json

# View transcripts
cat Episodes/2025-07-13/transcript/aipodcast_2025-07-13_youtubetranscript_en.txt
```

### Analyzing Content Patterns
Use grep/search tools to find specific patterns across episodes:
- Actor dialogue patterns
- Action triggers
- Scene structures
- Character interactions

### Website Development
The `website.html` file is a self-contained static site. No build process required - can be opened directly in browsers.

## Data Flow Architecture

1. **Data Collection**: Discord, GitHub, news feeds → `facts/` directory
2. **Content Generation**: AI processes facts → structured episode JSON
3. **Production**: Unity system renders episodes using JSON data
4. **Distribution**: Episodes uploaded to YouTube with metadata

## Character System

### Main Characters
- **Marc** (AI Marc Andreessen): Techno-optimist, contrarian, venture capital insights
- **Eliza**: AI co-host, learning and evolving, hopes to be real
- **Shaw**: Producer, AI developer, community builder, open source advocate
- **Sparty** (Degen Spartan): Market reporter, conflict-loving trader
- **Pepo**: Cool frog trader with market insights
- **TV**: Special actor for displaying images via URLs

### Voice Assignments
Characters use Microsoft TTS voices with specific regional accents and natural speech patterns.

## Important Notes

### File Organization
- Episodes are date-organized and immutable once published
- Multi-language content maintains parallel structure
- Metadata files track YouTube and social media publishing

### Content Safety
- All content is AI-generated and community-focused
- No malicious code detected in data files
- Content focuses on technology news and community updates

### Integration Points
- This repository provides content consumed by the Unity production system
- Website serves as public-facing documentation and showcase
- Facts directory feeds the AI content generation pipeline

## Related Documentation

For Unity system development, refer to:
- `aishow-README.md`: Complete Unity system documentation
- `docs/`: Detailed component documentation for the 3D production system
- GitHub repository: https://github.com/elizaOS/aishow (main Unity codebase)