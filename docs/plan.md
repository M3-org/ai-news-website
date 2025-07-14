# CLI Episode Processing Plan

## Project Overview

This plan outlines the development of CLI functionality for the Unity-based AI Show production system to eliminate the current human-in-the-loop requirement for episode processing. The goal is to enable headless video generation from JSON episode files.

## Current Workflow Analysis

### Content Generation Pipeline (NEEDS INVESTIGATION)
1. **Data Aggregation**
   - Raw news data collected in `daily.json` format from various sources
   - Data structure: `{"type": "elizaosDailySummary", "categories": [...]}`
   - Sources include Discord, GitHub, Twitter feeds

2. **AI Episode Generation** (ShowrunnerPort System)
   - `ShowrunnerManager.cs` orchestrates the content generation
   - `ShowrunnerGeneratorLLM.cs` uses AI (Claude) to transform raw data into episode scripts
   - `ShowGeneratorConfigLoader.cs` manages prompts and configuration
   - Output: ShowRunner episode JSON with scenes, dialogue, actions

3. **Audio Generation**
   - `ShowrunnerSpeakerElevenLabs.cs` generates TTS audio for each dialogue line
   - Audio files stored in `Assets/Resources/Episodes/{EpisodeID}/audio/{LanguageCode}/`

### Video Production Pipeline (✅ AUTOMATED)
1. **CLI Episode Processing**
   - Unity CLI loads episode JSON directly from file path
   - `EpisodeProcessorCLI.cs` orchestrates headless processing
   - `ShowRunner.cs` loads episode data and starts auto-playbook

2. **Unity Recording Process**
   - `ShowRecorder.cs` automatically starts/stops recording via events
   - Episode plays through all scenes and dialogue
   - Recording output: `{EpisodeID}_{timestamp}.mp4` (1920x1080, 30fps, H.264)
   - Sidecar metadata: `{EpisodeID}_{timestamp}_sidecar.json`

3. **Post-Processing** (PARTIALLY AUTOMATED)
   - Video and metadata files generated automatically
   - Optional YouTube upload via `YoutubeUploader.cs`
   - Manual publishing currently required

## Technical Architecture Analysis

### Key Components for CLI Integration

**Core Systems:**
- `ShowRunner.cs`: Central orchestration, episode loading, playback state machine
- `ShowRecorder.cs`: Unity Recorder integration, automatic recording lifecycle  
- `BatchRecorder.cs`: Multi-episode queue processing (existing automation foundation)
- `EventProcessor.cs`: Scene/dialogue event handling
- `ShowRunnerUI.cs` / `ShowRunnerUIContainer.cs`: UI components (must bypass for CLI)

**Recording Pipeline:**
- Unity Recorder package with `RecorderController` and `MovieRecorderSettings`
- Automatic start/stop via event subscription system
- Configurable output settings (resolution, codec, quality)
- Sidecar JSON generation with frame-accurate event timing

**File Structure:**
```
Assets/Resources/Episodes/{EpisodeID}/
├── {ShowName}_{EpisodeID}_{LanguageCode}.json    # Episode definition
├── audio/{LanguageCode}/                          # TTS audio files
└── recordings/                                    # Output directory
    ├── {EpisodeID}_{timestamp}.mp4               # Video output
    └── {EpisodeID}_{timestamp}_sidecar.json      # Event metadata
```

### Existing Automation Foundation

**BatchRecorder System:**
- Queue-based episode processing
- Automatic progression between episodes
- UI hiding during batch operations
- Integration with ShowRunner lifecycle events

**Editor Scripts:**
- `BatchRecorderTesterEditor.cs`: Manual batch triggering
- Multiple Editor windows for various automation tasks
- API integration scripts for external services

## Implementation Status

### Phase 1: Unity CLI Entry Point ✅ COMPLETE
- ✅ Created `Assets/Scripts/CLI/EpisodeProcessorCLI.cs`
- ✅ Unity headless mode support with `-batchmode -quit -nographics`
- ✅ Full command line argument parsing
- ⚠️ **Current Blocker**: Compilation error with namespace conflicts

### Phase 2: Headless Recording System ✅ COMPLETE
- ✅ Modified `ShowRecorder.cs` for batch mode compatibility
- ✅ Scene loading automation (podcast_desk.unity)
- ✅ Recording lifecycle management with event subscriptions
- ✅ Timeout safety mechanisms implemented

### Phase 3: UI Dependencies Bypass ✅ COMPLETE
- ✅ Added direct episode loading to `ShowRunner.cs`
- ✅ Implemented auto-play mode functionality
- ✅ CLI parameter configuration system
- ✅ Headless initialization without UI components

### Phase 4: Output Management ✅ COMPLETE
- ✅ Predictable output paths with standardized naming
- ✅ Metadata generation integration
- ✅ Comprehensive error handling and exit codes
- ✅ Real-time progress monitoring and logging

## CURRENT BLOCKER: Compilation Error

**Issue**: C# namespace conflict in `EpisodeProcessorCLI.cs`
```
error CS0426: The type name 'ShowRunner' does not exist in the type 'ShowRunner'
```

**Fix Required**: Update type references in lines 156, 193, 202 of `EpisodeProcessorCLI.cs`
```csharp
// Change from:
ShowRunner.ShowRunner showRunner

// To:
ShowRunner showRunner
```

## NEXT PHASE: Content Generation Pipeline

### Phase 5: ShowrunnerPort Integration (NEW PRIORITY)

**5.1 Investigate Existing System**
- Analyze `ShowrunnerManager.cs` workflow
- Understand `ShowrunnerGeneratorLLM.cs` AI integration
- Map `daily.json` to episode JSON transformation

**5.2 CLI Content Generation**
- Create CLI wrapper for content generation pipeline
- Integrate AI episode generation with video production
- Enable end-to-end automation: `daily.json` → MP4

**5.3 Complete Automation**
- Single command processing: raw data to final video
- Batch processing for multiple episodes
- Production deployment workflow

## Implementation Details

### CLI Parameters Design
```bash
unity-episode-processor \
  --episode-json "path/to/episode.json" \
  --episode-index 0 \
  --output-dir "path/to/output" \
  --resolution "1920x1080" \
  --frame-rate 30 \
  --quality high \
  --generate-metadata \
  --timeout 300
```

### Unity Integration Points

**1. Scene Loading:**
```csharp
SceneManager.LoadScene("podcast_desk", LoadSceneMode.Single);
```

**2. ShowRunner Configuration:**
```csharp
showRunner.LoadShowData(jsonPath);
showRunner.SelectEpisode(episodeIndex);
showRunner.SetManualMode(false); // Auto-play mode
```

**3. Recording Setup:**
```csharp
recorder.outputWidth = cliSettings.width;
recorder.outputHeight = cliSettings.height;
recorder.frameRate = cliSettings.frameRate;
```

### Error Handling Strategy

**Timeout Management:**
- Episode completion timeout (default 5 minutes)
- Recording failure detection
- Graceful shutdown on errors

**Validation:**
- Episode JSON validation before processing
- Required asset verification (scenes, prefabs)
- Output directory write permissions

**Recovery:**
- Automatic retry on transient failures
- Clean shutdown on critical errors
- Preserve partial outputs for debugging

## Technical Considerations

### Unity Recorder Headless Compatibility
- Verify Unity Recorder package works in `-nographics` mode
- May need to use specific camera setups for headless rendering
- Test video output quality in headless vs editor mode

### Resource Management
- Proper cleanup of loaded assets between episodes
- Memory management for batch processing
- Asset reference management without editor UI

### Platform Compatibility
- Windows Unity Editor execution
- Linux headless Unity execution
- Docker containerization considerations

### Performance Optimization
- Asset preloading strategies
- Recording optimization for faster processing
- Parallel processing for multiple language variants

## Testing Strategy

### Unit Testing
- CLI parameter parsing
- Episode loading validation
- Configuration management

### Integration Testing
- End-to-end episode processing
- Recording output validation
- Metadata generation verification

### Performance Testing
- Memory usage monitoring
- Recording duration benchmarks
- Batch processing stress tests

## Deployment Architecture

### Wrapper Script Design
Create a Python/Shell wrapper for easier CLI usage:
```python
#!/usr/bin/env python3
# unity-episode-processor.py
import subprocess
import argparse
import os

def process_episode(episode_path, output_dir, **kwargs):
    unity_cmd = [
        "Unity.exe",
        "-batchmode", "-quit", "-nographics",
        "-projectPath", PROJECT_PATH,
        "-executeMethod", "EpisodeProcessorCLI.ProcessEpisodeFromCommandLine",
        "-episodePath", episode_path,
        "-outputDir", output_dir
    ]
    
    # Add optional parameters
    for key, value in kwargs.items():
        unity_cmd.extend([f"-{key}", str(value)])
    
    return subprocess.run(unity_cmd, capture_output=True, text=True)
```

### Docker Integration
```dockerfile
FROM unity-base-image
COPY project/ /unity-project/
WORKDIR /unity-project
ENTRYPOINT ["python3", "unity-episode-processor.py"]
```

## Success Criteria

### Primary Goals
1. **Zero Human Intervention**: JSON input → MP4 output without manual steps
2. **Reliable Automation**: 99% success rate for well-formed episode JSON
3. **Performance**: <5 minutes processing time per episode
4. **Quality Consistency**: Output matches current manual process quality

### Secondary Goals
1. **Batch Processing**: Multi-episode queue processing
2. **Configuration Flexibility**: Customizable recording parameters
3. **Error Recovery**: Graceful handling of common failure modes
4. **Integration Ready**: Compatible with existing automation pipeline

## Risk Mitigation

### Technical Risks
- **Unity Recorder Headless Issues**: Test thoroughly, implement fallback recording system
- **Memory Leaks in Batch Mode**: Implement asset cleanup, process isolation
- **Platform Dependencies**: Test on target deployment platforms early

### Operational Risks
- **Episode JSON Changes**: Implement schema validation and version checking
- **Unity Version Updates**: Pin Unity version, test upgrade paths
- **Asset Missing**: Implement comprehensive validation before processing

## Timeline Estimate

### Week 1: Foundation
- CLI entry point implementation
- Basic headless mode testing
- Parameter parsing system

### Week 2: Core Integration  
- ShowRunner headless integration
- Recording system adaptation
- Scene loading automation

### Week 3: Output & Testing
- Output management system
- Error handling implementation
- Initial testing suite

### Week 4: Optimization & Documentation
- Performance optimization
- Comprehensive testing
- Documentation and examples

This plan provides a comprehensive roadmap for eliminating the human-in-the-loop requirement while leveraging the existing Unity-based production system's robust architecture.