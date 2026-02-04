# Episodes Directory

This directory contains recorded episodes and their associated metadata files from the Shmotime video production system.

## File Naming Convention

All files follow the pattern: `{date}_{show}_{title}_{suffix}`

```
episodes/
├── {date}_{show}_{title}_episode-data.json      # Original script from Shmotime
├── {date}_{show}_{title}.webm                   # Original recording (large)
├── {date}_{show}_{title}_fps30.mp4              # Processed video (30fps, smaller)
├── {date}_{show}_{title}_session-log.json       # Recording metadata & events
├── {date}_{show}_{title}_fps30_aligned.json     # Transcription (word timestamps)
├── {date}_{show}_{title}_fps30_episode-data-timed.json  # Enriched with timing
└── {date}_{show}_{title}_fps30_temp.m4a         # Temporary audio (can delete)
```

## Data Formats

### episode-data.json

Original script from Shmotime containing the show structure, dialogue, and stage directions.

```json
{
  "id": "S2E1",
  "name": "Episode Title",
  "image": "https://...",
  "image_thumb": "https://...",
  "premise": "Episode description...",
  "scenes": [
    {
      "number": 1,
      "totalInEpisode": 8,
      "location": "news-studio",
      "description": "Scene description",
      "transitionIn": "fade",
      "transitionOut": "fade",
      "cast": {
        "standing00": "eliza",
        "standing01": "jin"
      },
      "total_dialogues": 5,
      "dialogue": [
        {
          "number": 1,
          "totalInScene": 5,
          "actor": "eliza",
          "line": "Dialogue text...",
          "action": "stage direction or media URL"
        }
      ]
    }
  ]
}
```

**Dialogue Types** (determined by `line` content):
- `"line": "Normal dialogue..."` - Speech to be voiced by TTS
- `"line": "roll-commercial"` - Commercial break bumper
- `"line": "roll-media"` - Media insert (action contains URL)

### session-log.json

Recording session metadata captured by recorder4.js. Contains the complete show configuration, episode data, and event timeline.

```json
{
  "episode_id": "S2E1",
  "show_id": "cronjob",
  "recording_session_options": {
    "headless": true,
    "record": true,
    "outputDir": "./episodes",
    "outputFormat": "webm",
    "videoWidth": 1920,
    "videoHeight": 1080,
    "frameRate": 30,
    "baseName": "2026-01-25_Cron-Job_Welcome-To-The-Machine"
  },
  "show_config": {
    "id": "cronjob",
    "description": "Show description...",
    "actors": { /* actor definitions with voice IDs */ },
    "locations": { /* location definitions with images */ }
  },
  "episode_data": { /* same structure as episode-data.json */ },
  "event_timeline": [
    {
      "type": "load_show",
      "timestamp": "2026-01-31T20:12:53.956Z",
      "data": { /* show metadata */ }
    },
    {
      "type": "load_episode",
      "timestamp": "2026-01-31T20:12:53.956Z",
      "data": { /* episode metadata */ }
    },
    {
      "type": "episode_start",
      "timestamp": "2026-01-31T20:12:54.257Z",
      "data": null
    },
    {
      "type": "episode_end",
      "timestamp": "2026-01-31T20:23:31.218Z",
      "data": null
    }
  ],
  "original_video_file": "2026-01-25_Cron-Job_Welcome-To-The-Machine.webm",
  "processed_mp4_file": "2026-01-25_Cron-Job_Welcome-To-The-Machine_fps30.mp4"
}
```

**Event Timeline** is critical for timing synchronization.

Events from recorder4.js (with Remotion-compatible timing):
```json
{
  "type": "recording_start",
  "timestamp": "2026-01-31T20:12:53.500Z",
  "ms": 0,
  "sec": 0,
  "data": { "width": 1920, "height": 1080, "fps": 30 }
}
```

| Event | Description | Timing Use |
|-------|-------------|------------|
| `recording_start` | Stream begins recording | t=0 reference point |
| `click_start` | Start button clicked | User interaction |
| `scene_loaded` | Slate hidden, scene visible | Visual content starts |
| `audio_enabled` | Audio unmuted and playing | Audio sync point |
| `load_show` | Show config loaded (from web app) | - |
| `load_episode` | Episode data loaded (from web app) | - |
| `episode_start` | Playback begins (from web app) | Speech timing reference |
| `episode_end` | Playback complete (from web app) | - |
| `recording_stop` | Stream stopped | Total duration |

**Time formats (Remotion-compatible):**
- `timestamp` - ISO 8601 for debugging/logs
- `ms` - Milliseconds from recording start (matches `@remotion/captions` format)
- `sec` - Seconds from recording start (matches transcript word timestamps)

**Calculate frames at render time:** `Math.floor((ms / 1000) * fps)`

### aligned.json

Transcription output with word-level timestamps from Gemini API.

```json
{
  "segments": [
    {
      "start": 0,
      "end": 6.1,
      "text": "Welcome to the premier episode of Cron Job...",
      "speaker_id": "eliza",
      "speaker_name": "eliza",
      "scene": 1,
      "words": [
        { "word": "Welcome", "start": 0, "end": 0.4 },
        { "word": "to", "start": 0.4, "end": 0.5 },
        { "word": "the", "start": 0.5, "end": 0.6 }
      ]
    }
  ],
  "metadata": {
    "source": "video.mp4",
    "model": "google/gemini-3-flash-preview",
    "duration_seconds": 640,
    "generated_at": "2026-01-31T18:57:00.000Z"
  }
}
```

### episode-data-timed.json

Enriched episode data with timing information and type discriminators. Generated by `scripts/transcribe.ts` with `--script` flag.

```json
{
  "id": "S2E1",
  "name": "Episode Title",
  "image": "https://...",
  "image_thumb": "https://...",
  "premise": "Description...",
  "scenes": [
    {
      "number": 1,
      "location": "news-studio",
      "description": "Scene description",
      "startSec": 0,
      "endSec": 31.5,
      "dialogue": [
        {
          "type": "speech",
          "number": 1,
          "line": "Welcome to the show...",
          "actor": "eliza",
          "action": "professional smile",
          "startSec": 0,
          "endSec": 6.1,
          "words": [
            { "word": "Welcome", "start": 0, "end": 0.4 }
          ]
        },
        {
          "type": "media",
          "number": 2,
          "actor": "aishaw",
          "action": "https://cdn.example.com/image.png",
          "startSec": 6.1,
          "endSec": 9.1
        },
        {
          "type": "bumper",
          "number": 3,
          "actor": "aishaw",
          "startSec": 9.1,
          "endSec": 11.6
        }
      ]
    }
  ],
  "metadata": {
    "source": "video.mp4",
    "model": "google/gemini-3-flash-preview",
    "duration_seconds": 640,
    "generatedAt": "2026-01-31T18:57:00.000Z"
  }
}
```

**Type Discriminators**:
- `speech` - Voiced dialogue with word-level timestamps
- `media` - Image/video insert (URL in `action` field)
- `bumper` - Commercial break transition

## Timing Synchronization

### The Problem
Recording starts when the web app loads, but speech begins when the user clicks "Start". Gemini transcribes from first speech (timestamp 0), but the video includes time before that.

### The Solution
Use `session-log.json` event timeline to calculate the offset:

```
offset = episode_start.timestamp - load_episode.timestamp
```

Apply this offset to all transcription timestamps to sync with video.

### Usage with transcribe.ts

```bash
# Recommended: session-log provides both script and offset
npm run transcribe -- video.mp4 --session-log=session-log.json

# Manual offset override (if needed)
npm run transcribe -- video.mp4 --session-log=session-log.json --intro-offset=5

# Separate script file (legacy, not recommended)
npm run transcribe -- video.mp4 --script=episode-data.json --intro-offset=5
```

## Downstream Usage (Remotion)

Filter captions by type for clean rendering:

```typescript
// Render only speech captions
const captions = scene.dialogue
  .filter(d => d.type === "speech")
  .flatMap(d => d.words);

// Handle media placeholders
const processedDialogue = scene.dialogue.map(d =>
  d.type === "media" ? { ...d, action: "placeholder.png" } : d
);
```

## YouTube Upload Workflow

### Generate Metadata

Generate YouTube-ready metadata (title, description with chapters, tags) from a session log:

```bash
uv run python scripts/generate_youtube_metadata.py episodes/2026-02-02_Cron-Job_Workflow-Revolution_session-log.json
```

Options:
```bash
# Custom output path
uv run python scripts/generate_youtube_metadata.py session-log.json -o metadata.json

# Set playlist and privacy
uv run python scripts/generate_youtube_metadata.py session-log.json \
  --playlist-id PLxxxxxxx \
  --privacy unlisted

# Download thumbnail locally
uv run python scripts/generate_youtube_metadata.py session-log.json --download-thumb
```

### Upload to YouTube

Upload using the generated metadata file:

```bash
uv run python upload_to_youtube.py --from-json episodes/2026-02-02_Cron-Job_Workflow-Revolution_youtube_metadata.json
```

Or upload directly from session log (generates metadata on-the-fly):

```bash
uv run python upload_to_youtube.py --from-session-log episodes/2026-02-02_Cron-Job_Workflow-Revolution_session-log.json
```

Common options:
```bash
# Test with private video first
uv run python upload_to_youtube.py --from-json metadata.json --privacy-status private

# Add to playlist
uv run python upload_to_youtube.py --from-json metadata.json --playlist-id PLxxxxxxx
```

### Output Files

After upload workflow, the directory structure:
```
episodes/
├── thumbnails/
│   └── 2026-02-02_Cron-Job_Workflow-Revolution.png    # Downloaded thumbnail
├── 2026-02-02_Cron-Job_Workflow-Revolution.mp4        # Video file
├── 2026-02-02_Cron-Job_Workflow-Revolution_session-log.json
└── 2026-02-02_Cron-Job_Workflow-Revolution_youtube_metadata.json
```

## CDN Upload Workflow

Upload thumbnails, clips, and videos to Bunny CDN with provenance tracking.

### Environment Setup

Copy `.env.example` to `.env` and configure:
```bash
BUNNY_STORAGE_ZONE="your_storage_zone"
BUNNY_STORAGE_PASSWORD="your_api_password"
BUNNY_CDN_URL="https://cdn.elizaos.news"
```

### Upload Single File

```bash
uv run python scripts/cdn_upload.py episodes/thumbnails/2026-02-02_Cron-Job_Workflow-Revolution.png \
  --remote cronjob/thumbnails/
```

### Upload Directory

```bash
# Upload all thumbnails
uv run python scripts/cdn_upload.py --dir episodes/thumbnails/ --remote cronjob/thumbnails/

# Upload all clips (max 50MB each by default)
uv run python scripts/cdn_upload.py --dir episodes/clips/ --remote cronjob/clips/
```

### Manifest-Based Upload (with Provenance)

For clips with provenance tracking:

```bash
# 1. Generate manifest with provenance info
uv run python scripts/generate_manifest.py episodes/clips/ --show cronjob

# 2. Upload using manifest (updates manifest with CDN URLs)
uv run python scripts/cdn_upload.py --manifest episodes/clips/manifest.json --remote cronjob/clips/
```

### Unix-Style Piping

```bash
# Upload specific files via stdin
find episodes/clips -name "*_scene*.mp4" | uv run python scripts/cdn_upload.py --stdin --remote cronjob/clips/
```

### Dry Run

Test uploads without actually uploading:
```bash
uv run python scripts/cdn_upload.py --dir episodes/clips/ --remote cronjob/clips/ --dry-run
```

### Manifest Schema

The manifest tracks provenance and CDN URLs for each file:

```json
{
  "version": "1.0",
  "generated_at": "2026-02-03T12:00:00Z",
  "source": {
    "show": "cronjob",
    "directory": "episodes/clips"
  },
  "cdn": {
    "provider": "bunny",
    "base_url": "https://cdn.elizaos.news/cronjob/clips",
    "uploaded_at": "2026-02-03T12:05:00Z"
  },
  "files": [
    {
      "filename": "2026-02-02_Cron-Job_Workflow-Revolution_scene3.mp4",
      "size_bytes": 15234567,
      "provenance": {
        "date": "2026-02-02",
        "show": "Cron-Job",
        "title": "Workflow-Revolution",
        "clip_type": "scene",
        "scene": 3,
        "episode_id": "S2E1",
        "episode_name": "Workflow Revolution",
        "scene_description": "Eliza and Jin discuss technical developments..."
      },
      "cdn_url": "https://cdn.elizaos.news/cronjob/clips/2026-02-02_...",
      "cdn_path": "cronjob/clips/2026-02-02_...",
      "uploaded_at": "2026-02-03T12:05:00Z"
    }
  ]
}
```

### Clip Naming Conventions

The manifest generator extracts provenance from these filename patterns:

| Pattern | Example | Type |
|---------|---------|------|
| `{date}_{show}_{title}_scene{N}.mp4` | `2026-02-02_Cron-Job_Title_scene3.mp4` | Scene clip |
| `{date}_{show}_{title}_actor_{name}_{N}.mp4` | `2026-02-02_Cron-Job_Title_actor_jin_5.mp4` | Actor clip |
| `{date}_{show}_{title}_loc_{location}.mp4` | `2026-02-02_Cron-Job_Title_loc_stonks.mp4` | Location clip |
| `{date}_{show}_{title}.png` | `2026-02-02_Cron-Job_Title.png` | Thumbnail |

### Directory Structure After CDN Upload

```
episodes/
├── clips/
│   ├── manifest.json                    # Manifest with CDN URLs
│   ├── 2026-02-02_Cron-Job_*_scene3.mp4
│   └── ...
├── thumbnails/
│   └── 2026-02-02_Cron-Job_*.png
├── 2026-02-02_Cron-Job_Workflow-Revolution.mp4
└── 2026-02-02_Cron-Job_Workflow-Revolution_session-log.json
```

## Cleanup

The `_temp.m4a` files are intermediate audio extracts and can be safely deleted after transcription completes.
