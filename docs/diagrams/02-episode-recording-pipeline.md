# Episode Recording & Archiving Pipeline

## Purpose
This diagram details the complete flow from episode configuration to archived video package, showing each step in the recording and post-processing pipeline.

## Pipeline Stages

### 1. Episode Initialization (🟩 Green)
**Components**: ShowRunner, Scene Manager
- Load episode JSON configuration
- Select first episode (index 0) for recording
- Prepare Unity scene for recording

### 2. Recording Setup (🟨 Orange)  
**Components**: ShowRecorder
- Initialize Unity's RecorderController
- Configure video encoding (MP4, 1920x1080, 30fps)
- Set up audio capture and sidecar event logging

### 3. Episode Playback (🟦 Blue)
**Components**: ShowRunner, EventProcessor, Scene Manager
- Execute episode in auto or manual mode
- Process speak events and scene transitions
- Handle intro → content → outro sequence
- Capture video frames and audio continuously

### 4. Post-Recording Processing (🟪 Purple)
**Sequential steps that must complete in order**:

#### 4a. Immediate Cleanup
- Stop video recording
- Write sidecar JSON with SMPTE timecode data
- Generate MP4 and sidecar files

#### 4b. Metadata Fixing
- Update JSON metadata files with correct file paths
- Fix video_file and thumbnail_file references
- Wait for all metadata operations to complete

#### 4c. Episode Archiving  
- Create ZIP archive of entire episode folder
- Include all videos, audio, metadata, and thumbnails
- Verify archive creation and log file size
- Confirm archiving completion via callback

### 5. Safe Exit Sequence (🟥 Red)
**Components**: ShowRecorder Emergency System
- Start 15-second emergency timeout thread
- Attempt graceful Unity exit
- Force termination if Unity hangs during cleanup

## Critical Success Factors

### Sequential Processing
**Why Order Matters**:
1. **Metadata first**: File paths must be fixed before archiving
2. **Archiving second**: Complete episode must be packaged
3. **Exit last**: Unity only exits after ALL work is confirmed done

### Error Recovery
**Emergency Thread Protection**:
- Runs independently of Unity's main thread
- Prevents indefinite hanging during Unity asset cleanup
- Uses thread-safe exit methods only
- Provides 15-second timeout for normal shutdown

### File Organization
**Output Structure**:
```
Episodes/
└── episodeId/
    ├── recordings/
    │   ├── episodeId_lang_timestamp.mp4
    │   └── episodeId_lang_timestamp.json
    ├── metadata/
    │   └── *_youtube_metadata*.json
    ├── audio/
    │   └── lang/
    └── thumbnail/

EpisodeArchives/
└── episodeId_timestamp.zip
```

## Performance Considerations

### Video Recording
- **Resolution**: 1920x1080 (configurable)
- **Frame Rate**: 30fps (configurable)  
- **Codec**: H.264/MP4 for compatibility
- **Audio**: Captured with video track

### Archive Creation
- **Compression**: ZIP compression reduces size ~20-30%
- **Typical Size**: 300-400MB per episode
- **Creation Time**: 1-3 seconds for most episodes
- **Location**: Outside Unity Assets folder (prevents import loops)

### Memory Management
- Sidecar events logged in memory during recording
- SMPTE timecode calculated from frame count
- Proper cleanup of recorder resources after completion

## Batch Processing Integration

This pipeline runs for **each language variant** during batch processing:
1. **English episode** → Record → Archive
2. **Korean episode** → Record → Archive  
3. **Chinese episode** → Record → Archive
4. *...continue for all enabled languages*

Each iteration produces a complete archive package ready for distribution or upload to platforms.

---
*This pipeline has been optimized for reliability and handles Unity's complex shutdown sequence robustly.* 