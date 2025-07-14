# System Overview - High-Level Architecture

## Purpose
This diagram shows the complete AIShow system from a 10,000 foot view, illustrating how the major components interact to transform episode configurations into finished video content.

## System Components

### Input Layer (🟦 Blue)
- **Episode JSON**: Configuration files defining show content, scenes, and dialogue
- **CLI Commands**: Batch processing commands for automated content generation
- **Unity UI**: Manual interface for single-episode recording and testing

### Core System Layer (🟪 Purple)
- **ShowRunner**: Central orchestrator managing episode playback and scene flow
- **BatchRecorder**: Manages sequential recording of multiple language variants
- **ShowRecorder**: Handles video capture, encoding, and file output

### Processing Layer (🟨 Orange)
- **EventProcessor**: Handles scene events, dialogue triggers, and transitions
- **Scene Manager**: Manages Unity scene preparation and transitions  
- **Audio Manager**: Controls TTS playback, background music, and audio mixing
- **MetadataFixer**: Updates file paths and metadata after recording completes

### Generation Layer (🟥 Pink)
- **ShowrunnerManager**: Interfaces with LLMs for content generation
- **ElevenLabs API**: Converts text to speech in multiple languages

### Output Layer (🟩 Green)
- **MP4 Videos**: Rendered episode videos in multiple languages
- **Episode Archives**: Complete ZIP packages containing all episode assets

## Key Data Flows

1. **Content Generation**: CLI → ShowrunnerManager → ElevenLabs → Audio Files
2. **Manual Recording**: UI → ShowRunner → ShowRecorder → Video Output
3. **Batch Processing**: CLI → BatchRecorder → (Multiple Episodes) → Archives
4. **Post-Processing**: ShowRecorder → MetadataFixer → EpisodeArchiver → Archives

## Multi-Language Support

The system supports 30+ languages through:
- Content generation in multiple languages via ShowrunnerManager
- TTS generation per language via ElevenLabs API
- Batch recording of each language variant
- Organized file structure with language-specific folders

## Automation Features

- **Batch Processing**: Generate and record multiple episodes automatically
- **Multi-Language**: Create content in all supported languages simultaneously  
- **Archiving**: Automatically package complete episodes for distribution
- **Metadata Management**: Update file paths and durations automatically
- **Error Recovery**: Robust exit handling and cleanup procedures

---
*This diagram represents the current system architecture as of December 2024.* 