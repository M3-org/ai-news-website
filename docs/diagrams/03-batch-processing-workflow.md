# Batch Processing Workflow

## Purpose
This diagram illustrates the complete batch processing system that can generate content and record episodes across 30+ languages automatically via CLI commands.

## Workflow Phases

### 1. CLI Entry Points (🟩 Green)
**Three main operational modes**:

- **Generate Only**: `Unity.exe -executeMethod ShowRunner.CLI.EpisodeProcessorCLI.GenerateAndRecordBatchFromCommandLine -generate`
  - Creates episode content via LLM
  - Generates multi-language translations
  - Produces TTS audio files
  - Exits after generation

- **Record Only**: `Unity.exe -executeMethod ShowRunner.CLI.EpisodeProcessorCLI.ProcessBatchFromCommandLine -batchEpisodeId "S1E86"`
  - Records existing episodes in all languages
  - Requires pre-generated content
  - Produces video files and archives

- **Generate + Record**: Combined operation
  - Full pipeline from content creation to video archives
  - Most common production workflow

### 2. Content Generation Phase (🟨 Orange)
**Components**: ShowrunnerManager, LLM APIs, ElevenLabs

**Process Flow**:
1. **LLM Content Generation**: Create episode script, scenes, and dialogue
2. **Multi-Language Translation**: Translate content to all enabled languages
3. **TTS Audio Generation**: Generate speech audio for each language variant
4. **File Organization**: Structure content in episode folders

**Output**: Episode JSON files + Audio files for each language

### 3. Episode Discovery & Queue Creation (🟦 Blue)
**Components**: BatchRecorder

**Process**:
- Scan episode folder for language variants
- Create processing queue: `[episode_en.json, episode_ko.json, episode_ch.json, ...]`
- Sort queue for consistent processing order
- Initialize batch recording session

### 4. Batch Recording Loop (🟪 Purple)
**Components**: BatchRecorder, ShowRunner, ShowRecorder

**For Each Language Variant**:
1. **Dequeue Episode**: Load next language variant from queue
2. **Record Episode**: Execute complete recording pipeline (see Episode Recording diagram)
3. **Episode Completion**: Wait for outro and fade completion
4. **Queue Check**: Determine if more episodes remain
5. **Process Next**: Continue to next language or complete batch

**Key Features**:
- Automatic episode loading and state reset
- UI disabled during batch processing
- Error handling and recovery
- Progress logging for each language

### 5. Batch Completion Processing (🟪 Purple)
**Final Steps After All Languages**:
- **Metadata Fixing**: Update all JSON files with correct video paths
- **Episode Archiving**: Create ZIP packages for distribution
- **Cleanup**: Re-enable UI and restore normal operation mode

## Multi-Language Support

### Language Processing Order
The system processes languages in alphabetical order:
1. **English (en)** - Base language
2. **Chinese (ch)** - Simplified Chinese
3. **Korean (ko)** - Korean
4. **Spanish (es)** - Spanish
5. *...additional languages as configured*

### File Organization
```
Episodes/
└── episodeId/
    ├── metadata/
    │   ├── episode_youtube_metadata_en.json
    │   ├── episode_youtube_metadata_ko.json
    │   └── episode_youtube_metadata_ch.json
    ├── recordings/
    │   ├── episodeId_en_timestamp.mp4
    │   ├── episodeId_ko_timestamp.mp4
    │   └── episodeId_ch_timestamp.mp4
    └── audio/
        ├── en/
        ├── ko/
        └── ch/
```

## Automation Benefits

### Scalability
- **30+ Languages**: Simultaneous content generation
- **Batch Processing**: Multiple episodes in sequence
- **Unattended Operation**: No manual intervention required

### Quality Assurance
- **Consistent Output**: Same pipeline for all languages
- **Error Recovery**: Robust handling of individual episode failures
- **Verification**: Automatic file verification and metadata validation

### Production Efficiency
- **Time Savings**: Hours of manual work automated
- **Resource Optimization**: Efficient Unity lifecycle management
- **Distribution Ready**: Archives ready for immediate upload

## CLI Usage Examples

### Full Production Pipeline
```bash
Unity.exe -batchmode -nographics -logFile - \
  -executeMethod ShowRunner.CLI.EpisodeProcessorCLI.GenerateAndRecordBatchFromCommandLine \
  -generate -record
```

### Record Pre-Generated Content
```bash
Unity.exe -batchmode -nographics -logFile - \
  -executeMethod ShowRunner.CLI.EpisodeProcessorCLI.ProcessBatchFromCommandLine \
  -batchEpisodeId "S1E86"
```

### Generate Content Only
```bash
Unity.exe -batchmode -nographics -logFile - \
  -executeMethod ShowRunner.CLI.EpisodeProcessorCLI.GenerateAndRecordBatchFromCommandLine \
  -generate
```

## Performance Characteristics

### Typical Processing Times
- **Content Generation**: 5-10 minutes per episode
- **TTS Generation**: 2-3 minutes per language
- **Video Recording**: 3-5 minutes per language
- **Total Time**: 45-60 minutes for full 10-language batch

### Resource Requirements
- **CPU**: High during video encoding
- **Memory**: 4-8GB for Unity + content processing
- **Storage**: 300-400MB per language variant
- **Network**: API calls for LLM and TTS services

---
*This workflow enables fully automated content production at scale across multiple languages.* 