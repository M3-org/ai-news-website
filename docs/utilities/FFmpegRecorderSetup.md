# FFmpeg Recorder Setup Guide

## Overview
Your Unity project now supports both Unity's default encoder and FFmpeg encoder for video recording. FFmpeg provides better quality, more format options, and advanced encoding features.

## Installation

### 1. Install FFmpeg
**Windows:**
- Download FFmpeg from https://ffmpeg.org/download.html
- Extract to `C:\ffmpeg\` (or your preferred location)
- Add `C:\ffmpeg\bin` to your system PATH environment variable
- Test by opening Command Prompt and typing: `ffmpeg -version`

**macOS:**
```bash
# Using Homebrew
brew install ffmpeg

# Using MacPorts
sudo port install ffmpeg
```

**Linux:**
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install ffmpeg

# CentOS/RHEL
sudo yum install ffmpeg
```

### 2. Verify Installation
Open terminal/command prompt and run:
```bash
ffmpeg -version
```
You should see FFmpeg version information.

## Configuration in Unity

### 1. ShowRecorder Component Settings
In your ShowRecorder component, you'll now see these new sections:

**FFmpeg Encoder Settings:**
- ✅ **Use FFmpeg Encoder**: Enable this to use FFmpeg instead of Unity's default encoder
- **FFmpeg Path**: Leave empty to use system PATH, or specify full path to ffmpeg executable
- **FFmpeg Output Format**: Choose from various high-quality formats

**Unity Default Encoder Settings:**
- **Video Quality**: Only used when FFmpeg is disabled

### 2. Recommended Settings

**For High Quality:**
- Use FFmpeg Encoder: ✅ Enabled
- FFmpeg Path: (leave empty if ffmpeg is in PATH)
- FFmpeg Output Format: `H.264 Default` or `H.264 Lossless 420`

**For Maximum Quality (Large Files):**
- FFmpeg Output Format: `Apple ProRes 422 HQ` or `H.264 Lossless 444`

**For Web/Streaming:**
- FFmpeg Output Format: `H.264 Default` or `VP9 (WebM)`

**For Hardware Acceleration (NVIDIA GPUs):**
- FFmpeg Output Format: `H.264 NVIDIA` or `H.265 HEVC NVIDIA`

## Available Output Formats

| Format | Extension | Use Case | Quality | File Size |
|--------|-----------|----------|---------|-----------|
| H.264 Default | .mp4 | General purpose, good quality | High | Medium |
| H.264 NVIDIA | .mp4 | Hardware accelerated (NVIDIA) | High | Medium |
| H.264 Lossless 420 | .mp4 | Lossless, compatible | Perfect | Large |
| H.264 Lossless 444 | .mp4 | Lossless, highest quality | Perfect | Very Large |
| H.265 HEVC Default | .mp4 | Modern, efficient | High | Small |
| H.265 HEVC NVIDIA | .mp4 | Hardware accelerated HEVC | High | Small |
| Apple ProRes 422 HQ | .mov | Professional editing | Very High | Large |
| Apple ProRes 4444 | .mov | Professional with alpha | Perfect | Very Large |
| VP8 (WebM) | .webm | Web streaming | Good | Small |
| VP9 (WebM) | .webm | Modern web streaming | High | Small |

## Troubleshooting

### FFmpeg Not Found Error
**Problem:** "Cannot find the FFMPEG encoder at path: ffmpeg"

**Solutions:**
1. Ensure FFmpeg is installed and in your system PATH
2. Specify the full path to ffmpeg.exe in the "FFmpeg Path" field
   - Windows: `C:\ffmpeg\bin\ffmpeg.exe`
   - macOS/Linux: `/usr/local/bin/ffmpeg`

### Performance Issues with Hardware Acceleration
**Problem:** NVIDIA encoder formats cause errors or poor performance

**Solutions:**
1. Ensure you have a compatible NVIDIA GPU
2. Update your GPU drivers
3. Fall back to software encoding (H.264 Default)

### Large File Sizes
**Problem:** Video files are too large

**Solutions:**
1. Use H.265 HEVC formats for better compression
2. Use VP9 (WebM) for web content
3. Avoid lossless formats unless necessary

### Audio Sync Issues
**Problem:** Audio and video are out of sync

**Solutions:**
1. Enable "Prevent Frame Skipping" in IntroSequenceManager for video steps
2. Use consistent frame rates (30fps recommended)
3. Ensure your system can handle the encoding workload

## Performance Recommendations

### For Real-time Recording:
- Use hardware acceleration (NVIDIA formats) if available
- Lower resolution/frame rate if CPU usage is high
- Ensure sufficient disk space and write speed

### For Batch Processing:
- Use highest quality settings (lossless formats)
- Hardware acceleration is less critical
- Monitor disk space during long recordings

### For Streaming/Web:
- Use VP9 (WebM) or H.264 Default
- Test different quality settings
- Consider lower frame rates (24fps) for smaller files

## Command Line Usage

When running Unity in batch mode, FFmpeg settings are automatically applied:

```bash
# Windows
Unity.exe -batchmode -projectPath "C:\path\to\project" -executeMethod YourBatchMethod

# macOS/Linux
Unity -batchmode -projectPath "/path/to/project" -executeMethod YourBatchMethod
```

The ShowRecorder will use your configured FFmpeg settings automatically.

## Advanced Configuration

### Custom FFmpeg Path Per Environment
You can set different FFmpeg paths for different environments:

```csharp
// In your custom script
var showRecorder = FindObjectOfType<ShowRecorder>();
if (Application.isBatchMode)
{
    showRecorder.ffmpegPath = "/opt/ffmpeg/bin/ffmpeg"; // Server path
}
else
{
    showRecorder.ffmpegPath = ""; // Use system PATH
}
```

### Environment Variables
Set environment variables for consistent configuration:

```bash
# Set FFmpeg path
export FFMPEG_PATH="/usr/local/bin/ffmpeg"

# Unity can read this in your scripts
```

## Testing Your Setup

### 1. Quick Test
1. Enable "Use FFmpeg Encoder" in ShowRecorder
2. Set format to "H.264 Default"
3. Start a recording test
4. Check console for "Using FFmpeg encoder" message

### 2. Quality Comparison
1. Record the same content with Unity's default encoder
2. Record with FFmpeg encoder (same settings)
3. Compare file sizes and visual quality
4. FFmpeg should produce better quality at similar file sizes

### 3. Format Testing
Try different formats to find the best balance for your use case:
- Quality vs. file size
- Encoding speed vs. output quality
- Compatibility with your editing/streaming workflow

## Best Practices

1. **Test First**: Always test your FFmpeg setup before important recordings
2. **Monitor Resources**: Watch CPU/GPU usage during encoding
3. **Plan Storage**: FFmpeg can produce large files with high-quality settings
4. **Backup Settings**: Document your optimal settings for different scenarios
5. **Update Regularly**: Keep FFmpeg updated for latest features and bug fixes

## Support

If you encounter issues:
1. Check Unity Console for specific error messages
2. Test FFmpeg command line separately
3. Verify system requirements for chosen formats
4. Consider falling back to Unity's default encoder if problems persist 