# Unity CLI Episode Processing - Usage Guide

## Overview

The Unity CLI system enables headless processing of AI Show episodes without human intervention. This allows you to automate the conversion of episode JSON files into MP4 videos through Unity's 3D rendering pipeline.

## Components

### 1. EpisodeProcessorCLI.cs
- **Location**: `Assets/Scripts/CLI/EpisodeProcessorCLI.cs`
- **Purpose**: Main CLI entry point for Unity command line execution
- **Features**: Argument parsing, episode loading, recording configuration

### 2. Modified ShowRunner.cs
- **New Methods**:
  - `LoadShowDataFromJsonContent()`: Load episode directly from JSON content
  - `SetAutoPlayMode()`: Enable automatic playback without UI
  - `SelectAndStartEpisode()`: Select and start episode by index

### 3. Enhanced ShowRecorder.cs
- **Updates**: Added batch mode detection and logging
- **Compatibility**: Works in Unity's `-nographics` headless mode

## Command Line Usage

### Direct Unity Command
```bash
Unity.exe -batchmode -quit -nographics \
  -projectPath "/path/to/aishow" \
  -executeMethod "ShowRunner.CLI.EpisodeProcessorCLI.ProcessEpisodeFromCommandLine" \
  -episodePath "/path/to/episode.json" \
  -outputDir "/path/to/output" \
  -episodeIndex 0 \
  -width 1920 \
  -height 1080 \
  -frameRate 30
```

### Python Test Script
```bash
# Basic usage
python test-cli.py --episode "/path/to/episode.json" --output "/path/to/output"

# Advanced usage with custom settings
python test-cli.py \
  --project "/path/to/aishow" \
  --episode "/path/to/episode.json" \
  --output "/path/to/output" \
  --index 0 \
  --width 1920 \
  --height 1080 \
  --fps 30
```

## Arguments Reference

### Required Arguments
- **`-episodePath`**: Absolute path to the episode JSON file
- **`-outputDir`**: Directory where MP4 and metadata will be saved

### Optional Arguments
- **`-episodeIndex`**: Index of episode to process (default: 0)
- **`-width`**: Video width in pixels (default: 1920)
- **`-height`**: Video height in pixels (default: 1080)
- **`-frameRate`**: Recording frame rate (default: 30)

## Input Requirements

### Episode JSON Format
The episode JSON must follow the existing ShowRunner format:
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

### Scene Requirements
- The `podcast_desk.unity` scene must be properly configured
- All required prefabs and assets must be available
- ShowRunner, ShowRecorder, and related components must be in the scene

## Output

### Video Files
- **Format**: MP4 (H.264 codec)
- **Location**: `{outputDir}/{episodeId}_{timestamp}.mp4`
- **Quality**: High quality encoding (configurable in ShowRecorder)

### Metadata Files
- **Sidecar JSON**: `{episodeId}_{timestamp}_sidecar.json`
- **Content**: Frame-accurate event timing and metadata

## Process Flow

1. **Initialization**
   - Parse command line arguments
   - Validate episode file and output directory
   - Load podcast_desk scene

2. **Episode Loading**
   - Load JSON content directly from file
   - Parse episode structure and metadata
   - Initialize ShowRunner for headless operation

3. **Recording Setup**
   - Configure Unity Recorder with specified settings
   - Set output paths and naming convention
   - Subscribe to episode lifecycle events

4. **Playback & Recording**
   - Enable auto-play mode (no manual intervention)
   - Start episode playback automatically
   - Recording starts/stops via event system
   - Complete episode plays through all scenes

5. **Completion**
   - Recording stops automatically after outro
   - Metadata files generated
   - Unity exits with success/failure code

## Troubleshooting

### Common Issues

**Unity executable not found**
- Ensure Unity 2022.3.53f1 is installed
- Update paths in test-cli.py if needed
- Add Unity to system PATH

**Scene loading fails**
- Verify podcast_desk.unity scene exists
- Check for missing prefabs or assets
- Ensure scene is properly configured

**Recording starts but no output**
- Check Unity Recorder package is installed
- Verify output directory permissions
- Check Unity console logs for errors

**Episode JSON validation fails**
- Validate JSON syntax
- Ensure required fields are present
- Check episode index is valid

### Debug Logging
All CLI operations include detailed logging:
- `[CLI]` prefix for CLI-specific messages
- `[ShowRunner]` prefix for ShowRunner operations
- `ShowRecorder:` prefix for recording events

### Exit Codes
- **0**: Success - episode processed successfully
- **1**: Failure - check console output for specific error

## Testing

### Step 1: Verify Unity Setup
```bash
# Test Unity and project setup first
python test-unity.py
```

This will verify:
- Unity executable is accessible
- Project loads correctly
- CLI method is compiled and available

### Step 2: Test Episode Processing
```bash
# Test with real-time logging and monitoring
python test-cli.py \
  --episode "daily.json" \
  --output "./output"
```

### Enhanced Features:
- **Real-time log monitoring**: See Unity logs as they happen
- **Progress tracking**: Monitor file creation in output directory
- **20-minute timeout**: Extended from 10 minutes for complex episodes
- **Better error reporting**: Detailed logs and exit codes
- **JSON validation**: Pre-flight check of episode structure

### Troubleshooting Workflow:
1. **If Unity times out**: Check the Unity log file in output directory
2. **If CLI method not found**: Run `test-unity.py` to verify compilation
3. **If scene loading fails**: Check for missing assets or prefabs
4. **If recording doesn't start**: Verify ShowRecorder component in scene

### Log Monitoring:
The enhanced script provides real-time monitoring:
- `📖` Unity log messages (filtered for important events)
- `📄` File creation notifications
- `🎬` Recording progress with file sizes
- `⏱️` Process timing information

## Integration

This CLI system is designed to integrate with:
- **Batch Processing**: Multiple episodes in sequence
- **CI/CD Pipelines**: Automated episode generation workflows
- **Docker Containers**: Headless Unity execution environments
- **Content Management**: Automated publishing systems

The implementation provides a foundation for fully automated AI show production pipelines.

# use this to clear unity if there are multiple instances running for some reason

Stop-Process -Name Unity*,UnityCrashHandler64,UnityShaderCompiler,UnityPackageManager,UnityAutoQuitter,Unity.ILPP.Runner,Unity.Licensing.Client -Force -ErrorAction SilentlyContinue; Remove-Item -Force .\Library\UnityLockfile,.\Temp\UnityLockfile -ErrorAction SilentlyContinue

# use this to batch generate and record

& "C:\Program Files\Unity\Hub\Editor\2022.3.53f1\Editor\Unity.exe" -batchmode -logFile - `
  -projectPath "C:\Users\dev\Documents\GitHub\aishow" `
  -executeMethod ShowRunner.CLI.EpisodeProcessorCLI.ProcessFlexibleBatchFromCommandLine `
  -generate -record | Tee-Object -FilePath "C:\temp\cli_live.log"