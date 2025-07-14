# Episode Archive Feature

## Overview
This feature automatically creates a zip archive of complete episode folders after batch recording sessions complete. The archive contains all episode assets including recordings, metadata, audio files, and thumbnails.

## Implementation Details

### New Components
- **EpisodeArchiver.cs**: Utility class that handles zip file creation
- **ShowRecorder configuration**: Added `createEpisodeArchive` toggle

### Integration Points
The archiving happens in a carefully orchestrated exit sequence:
1. Episode recording completes
2. Metadata fixing operations complete  
3. **Episode archiving executes and waits for completion** ← New step
4. **File operations buffer time** ← New step
5. **Emergency exit thread starts** ← New step
6. **Unity exits only after everything is confirmed done** ← New step

### Archive Location
Archives are created in: `[Project Root]/EpisodeArchives/`
- Archive filename format: `{episodeId}_{timestamp}.zip`
- Example: `2025-06-26_ch_20250626_143022.zip`
- **Important**: Archives are stored OUTSIDE the Assets folder to prevent Unity's import pipeline from processing them during shutdown

### Configuration
In the ShowRecorder component inspector:
- **Create Episode Archive**: Toggle to enable/disable automatic archiving (Default: Enabled)
- **Force Exit If Hanging**: Force Unity termination if it hangs during exit (Default: Enabled)

The force exit feature prevents Unity from hanging indefinitely during asset cleanup after archiving completes.

## Usage

### Automatic (Recommended)
Archives are created automatically after batch recordings complete when:
- `ShowRecorder.createEpisodeArchive = true` (default)
- Running in batch mode (`Unity.exe -batchmode`)
- Episode folder contains files to archive

### Manual
```csharp
// Create archive programmatically
string archivePath = EpisodeArchiver.ArchiveEpisode("S1E85");
if (archivePath != null)
{
    Debug.Log($"Archive created: {archivePath}");
}

// Check if episode is ready for archiving
bool ready = EpisodeArchiver.IsEpisodeReadyForArchiving("S1E85");
```

## File Structure in Archive
The zip contains the complete episode folder structure:
```
episodeId/
├── metadata/
│   ├── *_youtube_metadata*.json
│   └── other metadata files
├── recordings/
│   ├── *.mp4 (recorded videos)
│   └── *.json (sidecar files)
├── audio/
│   ├── en/ (English audio)
│   ├── ko/ (Korean audio)
│   └── other languages
└── thumbnail/
    ├── *.jpg (thumbnail images)
    └── other media assets
```

## Benefits
1. **Portable Episodes**: Complete episode packages ready for distribution
2. **Backup**: Automatic preservation of all episode assets
3. **Storage Efficiency**: Compressed archives save disk space
4. **Easy Sharing**: Single file contains entire episode
5. **Archival**: Long-term storage with consistent naming

## Error Handling
- Archives are created even if some metadata operations fail
- If archiving fails, Unity still exits gracefully
- Detailed logging shows archive creation progress and any errors
- Archive file size is logged for verification

## Performance Impact
- Archive creation happens after recording, not during
- Uses background compression to minimize delay
- Typical archive creation time: 1-3 seconds for most episodes
- Archive sizes typically 10-50% smaller than original folder

## Troubleshooting

### Archive Not Created
1. Check `ShowRecorder.createEpisodeArchive` is enabled
2. Verify episode folder exists and has content
3. Check Unity console for archiving error messages
4. Ensure sufficient disk space in archives folder

### Unity Hanging After Archive Creation
**Symptoms**: Archive created successfully but Unity doesn't exit
**Cause**: Unity asset cleanup can hang with large projects in batch mode
**Solution**: 
- `ShowRecorder.forceExitIfHanging` is enabled by default
- Emergency exit thread starts ONLY after archiving is confirmed complete
- Thread runs independently and gives Unity 10 seconds for clean shutdown
- Unity exit is called LAST, after all work is verified done
- Look for "[STEP 4] ALL OPERATIONS CONFIRMED COMPLETE" in logs

**Expected Log Sequence:**
```
[STEP 1] Creating episode archive for: episode_id
✅ [STEP 1] Archiving confirmed complete.
[STEP 2] Allowing final file operations to complete...
✅ [STEP 2] File operations wait complete.
[STEP 3] Emergency exit thread started
[STEP 4] ALL OPERATIONS CONFIRMED COMPLETE - INITIATING UNITY EXIT
```

### Large Archive Times
- Normal for episodes with large video files (>1GB)
- Archive creation is logged with timestamps
- Async archiving prevents Unity hanging during compression

## Related Files
- `Assets/Scripts/Utilities/EpisodeArchiver.cs` - Main archiving logic
- `Assets/Scripts/Utilities/ShowRecorder.cs` - Integration point  
- `Assets/Scripts/Automation/BatchRecorder.cs` - Batch processing workflow 