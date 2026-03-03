#!/usr/bin/env python3

import argparse
import httplib2
import os
import random
import shutil
import subprocess
import sys
import time
import json # For loading .env.json if used
import urllib.request

try:
    from PIL import Image, ImageOps
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

# The google-api-python-client and oauth2client libraries are typically installed via pip
# For example: pip install google-api-python-client google-auth-oauthlib google-auth-httplib2
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import InstalledAppFlow


# --- Configuration ---
# These can be overridden by command-line arguments or environment variables

# Default path for client secrets. Can be overridden by --client-secrets or YOUTUBE_CLIENT_SECRETS_PATH env var
DEFAULT_CLIENT_SECRETS_FILE = "client_secrets.json"
# Default path for storing OAuth2 credentials. Can be overridden by --credentials-storage or YOUTUBE_CREDENTIALS_PATH env var
DEFAULT_CREDENTIALS_FILE = "youtube_credentials.json"

YOUTUBE_UPLOAD_SCOPE = "https://www.googleapis.com/auth/youtube"
YOUTUBE_API_SERVICE_NAME = "youtube"
YOUTUBE_API_VERSION = "v3"

# Retry logic (can be kept as is from the original sample)
httplib2.RETRIES = 1
MAX_RETRIES = 10
RETRIABLE_EXCEPTIONS = (httplib2.HttpLib2Error, IOError) # Simplified for modern httplib2
RETRIABLE_STATUS_CODES = [500, 502, 503, 504]

THUMBNAIL_MAX_BYTES_DEFAULT = 2 * 1024 * 1024
THUMBNAIL_TARGET_FORMAT = "jpg"
THUMBNAIL_RETRY_ON_FAIL = True


def load_env_vars(env_path='.env.json'):
    """Loads environment variables from a .env.json file if it exists."""
    if os.path.exists(env_path):
        try:
            with open(env_path, 'r') as f:
                env_config = json.load(f)
            for key, value in env_config.items():
                os.environ[key] = str(value) # Ensure env values are strings
            print(f"Loaded environment variables from {env_path}")
        except Exception as e:
            print(f"Warning: Could not load or parse {env_path}: {e}")

def get_authenticated_service(args):
    """
    Authenticates with the YouTube API using OAuth 2.0.
    Prioritizes environment variables for non-interactive flows (e.g., GitHub Actions).
    Falls back to local file-based flow for interactive sessions.
    """
    creds = None

    # CI/CD Flow (GitHub Actions) - using environment variables for credentials
    env_client_id = os.environ.get('YOUTUBE_CLIENT_ID')
    env_client_secret = os.environ.get('YOUTUBE_CLIENT_SECRET')
    env_refresh_token = os.environ.get('YOUTUBE_REFRESH_TOKEN')

    if env_client_id and env_client_secret and env_refresh_token:
        print("Attempting authentication using environment variables (CI/CD mode).")
        creds = Credentials(
            None, # No access token initially, will be fetched using refresh_token
            refresh_token=env_refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=env_client_id,
            client_secret=env_client_secret,
            scopes=[YOUTUBE_UPLOAD_SCOPE]
        )
        # If the credentials have a refresh token, they are likely valid or can be refreshed.
        # A refresh is attempted automatically by the google-auth library when a request is made if the token is expired.
        # We can explicitly try to refresh here if needed for an early check, but often not necessary.
        if creds.expired and creds.refresh_token:
            try:
                print("Refreshing access token via environment credentials...")
                creds.refresh(Request())
                print("Access token refreshed successfully via environment credentials.")
            except Exception as e:
                print(f"Error refreshing token via environment credentials: {e}. Upload may fail.")
                # Depending on strictness, could exit here or let the API call fail
    else:
        print("Environment variables for CI/CD mode not fully set. Attempting local file-based OAuth flow.")
        # Local Interactive Flow (using files)
        credentials_file = args.credentials_storage
        client_secrets_file = args.client_secrets
        if os.path.exists(credentials_file):
            try:
                creds = Credentials.from_authorized_user_file(credentials_file, [YOUTUBE_UPLOAD_SCOPE])
            except Exception as e:
                print(f"Warning: Could not load credentials from {credentials_file}: {e}. Will attempt to re-authorize.")
                creds = None

        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                try:
                    print("Refreshing access token from local file...")
                    creds.refresh(Request())
                except Exception as e:
                    print(f"Failed to refresh token from local file: {e}. Need to re-authorize.")
                    creds = None 
            if not creds:
                if not os.path.exists(client_secrets_file):
                    print(f"ERROR: OAuth 2.0 client secrets file not found at {client_secrets_file}")
                    sys.exit(1)
                
                flow = InstalledAppFlow.from_client_secrets_file(client_secrets_file, [YOUTUBE_UPLOAD_SCOPE])
                print(f"Attempting local authorization. A browser window should open.")
                creds = flow.run_local_server(port=0)
            
            try:
                with open(credentials_file, 'w') as token_file:
                    token_file.write(creds.to_json())
                print(f"Credentials saved to {credentials_file}")
            except Exception as e:
                print(f"Error saving credentials to {credentials_file}: {e}")

    if not creds:
        print("ERROR: Failed to obtain authentication credentials.")
        sys.exit(1)

    return build(YOUTUBE_API_SERVICE_NAME, YOUTUBE_API_VERSION, credentials=creds)

def update_thumbnail(youtube, video_id, thumbnail_path):
    """
    Updates the thumbnail of an existing YouTube video.
    """
    if not os.path.exists(thumbnail_path):
        print(f"ERROR: Thumbnail file not found at {thumbnail_path}")
        return

    print(f"Updating thumbnail for video ID: {video_id}")
    try:
        youtube.thumbnails().set(
            videoId=video_id,
            media_body=MediaFileUpload(thumbnail_path)
        ).execute()
        print("Thumbnail updated successfully.")
    except HttpError as e:
        print(f"HTTP error {e.resp.status} during thumbnail update:\n{e.content}")
    except Exception as e:
        print(f"Unexpected error during thumbnail update: {e}")


def set_privacy(video_id: str, privacy: str = "public") -> dict:
    """Change a video's privacy/listing status (e.g. unlisted -> public).

    Can be called standalone or imported by other scripts (e.g. discord_notify.py).
    """
    from types import SimpleNamespace
    args = SimpleNamespace(
        client_secrets=os.environ.get("YOUTUBE_CLIENT_SECRETS_PATH", DEFAULT_CLIENT_SECRETS_FILE),
        credentials_storage=os.environ.get("YOUTUBE_CREDENTIALS_LOCAL_PATH", DEFAULT_CREDENTIALS_FILE),
    )
    youtube = get_authenticated_service(args)
    response = (
        youtube.videos()
        .update(
            part="status",
            body={"id": video_id, "status": {"privacyStatus": privacy, "embeddable": True}},
        )
        .execute()
    )
    return response


def validate_playlist_id(playlist_id):
    """
    Validates YouTube playlist ID format.
    """
    if not playlist_id:
        return False
    
    # YouTube playlist IDs typically start with PL and are 34 characters total
    # Format: PLxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
    if not playlist_id.startswith('PL'):
        print(f"⚠️  Warning: Playlist ID '{playlist_id}' doesn't start with 'PL'")
        return False
    
    if len(playlist_id) < 24:  # Minimum reasonable length
        print(f"⚠️  Warning: Playlist ID '{playlist_id}' seems too short")
        return False
    
    # Remove any URL parameters that might have been accidentally included
    clean_id = playlist_id.split('&')[0].split('?')[0]
    if clean_id != playlist_id:
        print(f"⚠️  Warning: Cleaned playlist ID from '{playlist_id}' to '{clean_id}'")
        return clean_id
    
    return True


def add_video_to_playlist(youtube, video_id, playlist_id):
    """
    Adds a video to a specified playlist.
    """
    # Validate playlist ID
    validation_result = validate_playlist_id(playlist_id)
    if validation_result is False:
        print(f"❌ Invalid playlist ID format: {playlist_id}")
        return None
    elif isinstance(validation_result, str):
        playlist_id = validation_result  # Use cleaned ID
    
    print(f"📋 Adding video {video_id} to playlist {playlist_id}")
    
    try:
        request_body = {
            'snippet': {
                'playlistId': playlist_id,
                'resourceId': {
                    'kind': 'youtube#video',
                    'videoId': video_id
                }
            }
        }
        
        response = youtube.playlistItems().insert(
            part='snippet',
            body=request_body
        ).execute()
        
        playlist_item_id = response.get('id')
        print(f"✅ Video successfully added to playlist! Playlist item ID: {playlist_item_id}")
        return playlist_item_id
        
    except HttpError as e:
        error_content = e.content.decode('utf-8') if hasattr(e.content, 'decode') else str(e.content)
        print(f"❌ HTTP error {e.resp.status} while adding video to playlist:")
        print(f"   Content: {error_content}")
        
        # Provide specific help for common errors
        if e.resp.status == 403:
            print("💡 This might be a permission issue:")
            print("   • Make sure you own the playlist or have permission to add videos")
            print("   • Verify your OAuth scope includes playlist management permissions")
            print("   • Re-run: python scripts/setup_youtube_auth.py")
        elif e.resp.status == 404:
            print("💡 This might be a playlist ID issue:")
            print(f"   • Double-check playlist ID: {playlist_id}")
            print("   • Make sure the playlist exists and is accessible")
        
        return None
    except Exception as e:
        print(f"❌ Unexpected error while adding video to playlist: {e}")
        return None


def remove_from_playlist(youtube, video_id, playlist_id):
    """
    Removes a video from a specified playlist by finding and deleting its playlist item.
    """
    print(f"Searching for video {video_id} in playlist {playlist_id}...")
    try:
        # List playlist items to find the one matching our video_id
        request = youtube.playlistItems().list(
            part="id,snippet",
            playlistId=playlist_id,
            maxResults=50,
        )
        while request:
            response = request.execute()
            for item in response.get("items", []):
                if item["snippet"]["resourceId"]["videoId"] == video_id:
                    playlist_item_id = item["id"]
                    youtube.playlistItems().delete(id=playlist_item_id).execute()
                    print(f"Removed video {video_id} from playlist (item ID: {playlist_item_id})")
                    return True
            request = youtube.playlistItems().list_next(request, response)

        print(f"Video {video_id} not found in playlist {playlist_id}")
        return False
    except HttpError as e:
        print(f"HTTP error {e.resp.status} while removing from playlist:\n{e.content}")
        return False
    except Exception as e:
        print(f"Error removing from playlist: {e}")
        return False


def initialize_upload(youtube, args):
    """
    Initializes and performs the video upload process.
    """
    tags_list = None
    if args.tags:
        tags_list = [tag.strip() for tag in args.tags.split(',') if tag.strip()] # Ensure clean tags

    video_metadata_body = {
        'snippet': {
            'title': args.title,
            'description': args.description,
            'tags': tags_list,
            'categoryId': args.category_id
        },
        'status': {
            'privacyStatus': args.privacy_status,
            'selfDeclaredMadeForKids': False,
            'embeddable': True,
        }
    }
    
    print(f"\n--- Uploading Video ---")
    print(f"File: {args.video_file}")
    print(f"Title: {args.title}")
    # print(f"Description: {args.description}") # Can be very long
    print(f"Tags: {tags_list}")
    print(f"Category ID: {args.category_id}")
    print(f"Privacy Status: {args.privacy_status}")

    try:
        media_body = MediaFileUpload(args.video_file, chunksize=-1, resumable=True)
    except Exception as e:
        print(f"Error creating MediaFileUpload for {args.video_file}: {e}")
        return None

    insert_request = youtube.videos().insert(
        part=",".join(video_metadata_body.keys()),
        body=video_metadata_body,
        media_body=media_body
    )

    video_id = resumable_upload(insert_request)

    if video_id and args.thumbnail_file:
        if os.path.exists(args.thumbnail_file):
            try:
                thumb_size = os.path.getsize(args.thumbnail_file)
                max_thumb_size = THUMBNAIL_MAX_BYTES_DEFAULT
                if thumb_size > max_thumb_size:
                    print(
                        f"\nWARNING: Thumbnail too large for YouTube API ({thumb_size} bytes > {max_thumb_size} bytes). "
                        "Skipping thumbnail upload."
                    )
                else:
                    print(f"\n--- Uploading Thumbnail ---")
                    print(f"Thumbnail: {args.thumbnail_file} for video ID: {video_id}")
                    print(f"Thumbnail size: {thumb_size} bytes")
                    youtube.thumbnails().set(
                        videoId=video_id,
                        media_body=MediaFileUpload(args.thumbnail_file)
                    ).execute()
                    print("Thumbnail successfully uploaded.")
            except HttpError as e:
                print(f"An HTTP error {e.resp.status} occurred while uploading thumbnail:\n{e.content}")
            except Exception as e:
                 print(f"An error occurred while uploading thumbnail: {e}")
        else:
            print(f"\nWARNING: Thumbnail file specified but not found at {args.thumbnail_file}. Skipping thumbnail upload.")
    elif video_id and not args.thumbnail_file:
        print("\nNo thumbnail file specified. Skipping thumbnail upload.")
    
    # Add video to playlist if specified
    if video_id and args.playlist_id:
        print(f"\n--- Adding to Playlist ---")
        playlist_item_id = add_video_to_playlist(youtube, video_id, args.playlist_id)
        if playlist_item_id:
            print(f"Video successfully added to playlist: {args.playlist_id}")
        else:
            print(f"Failed to add video to playlist: {args.playlist_id}")
    elif video_id and not args.playlist_id:
        print("\nNo playlist specified. Video uploaded but not added to any playlist.")
    
    return video_id


def resumable_upload(request):
    """
    Performs a resumable upload, with retries for transient errors.
    """
    response = None
    error_details = None
    retry_count = 0
    video_id = None

    while response is None:
        try:
            print(f"Uploading chunk (attempt {retry_count + 1}/{MAX_RETRIES + 1})...")
            status, response = request.next_chunk()
            if response is not None:
                if 'id' in response:
                    video_id = response['id']
                    print(f"Video id '{video_id}' was successfully uploaded.")
                else:
                    print(f"The upload failed with an unexpected response: {response}")
                    return None 
        except HttpError as e:
            if e.resp.status in RETRIABLE_STATUS_CODES:
                error_details = f"A retriable HTTP error {e.resp.status} occurred:\n{e.content}"
            else:
                print(f"A non-retriable HTTP error {e.resp.status} occurred:\n{e.content}")
                raise 
        except tuple(RETRIABLE_EXCEPTIONS) as e: 
            error_details = f"A retriable error occurred: {e}"
        except Exception as e: 
            print(f"An unexpected error occurred during upload: {e}")
            raise 

        if error_details:
            print(error_details)
            retry_count += 1
            if retry_count > MAX_RETRIES:
                print("Exceeded maximum number of retries. Upload failed.")
                return None 

            max_sleep = 2**retry_count
            sleep_seconds = random.uniform(0, max_sleep) # Use random.uniform for float sleep
            print(f"Sleeping for {sleep_seconds:.2f} seconds before retrying...")
            time.sleep(sleep_seconds)
            error_details = None 
    return video_id

def load_metadata_from_json(json_file):
    """Load YouTube metadata from JSON file and return as dict."""
    if not os.path.exists(json_file):
        print(f"ERROR: JSON metadata file not found: {json_file}")
        sys.exit(1)

    try:
        with open(json_file, 'r') as f:
            metadata = json.load(f)
        print(f"Loaded metadata from: {json_file}")
        return metadata
    except json.JSONDecodeError as e:
        print(f"ERROR: Invalid JSON in {json_file}: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"ERROR: Could not read {json_file}: {e}")
        sys.exit(1)


def load_metadata_from_session_log(session_log_file, options=None):
    """
    Generate YouTube metadata directly from a session-log.json file.
    Uses the youtube_metadata module for processing.
    """
    if not os.path.exists(session_log_file):
        print(f"ERROR: Session log file not found: {session_log_file}")
        sys.exit(1)

    # Try to import the youtube_metadata module (same directory)
    try:
        from youtube_metadata import generate_metadata

        options = options or {}
        metadata = generate_metadata(session_log_file, options)
        print(f"Generated metadata from session log: {session_log_file}")
        return metadata
    except ImportError as e:
        print(f"ERROR: Could not import youtube_metadata module: {e}")
        print("Make sure scripts/youtube_metadata.py exists")
        sys.exit(1)
    except Exception as e:
        print(f"ERROR: Failed to generate metadata from session log: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


def _project_dir() -> str:
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _thumbnail_dir(output_dir=None) -> str:
    if output_dir:
        return output_dir
    return os.path.join(_project_dir(), 'episodes', 'thumbnails')


def _thumbnail_base_name(video_file: str | None) -> str:
    if video_file:
        return os.path.splitext(os.path.basename(video_file))[0]
    return f"thumbnail_{int(time.time())}"


def _is_url(value: str) -> bool:
    return value.startswith("http://") or value.startswith("https://")


def _safe_remove(path: str) -> None:
    try:
        if path and os.path.exists(path):
            os.remove(path)
    except Exception:
        pass


def _run_command(cmd: list[str], check: bool = True) -> bool:
    try:
        subprocess.run(cmd, check=check, capture_output=True)
        return True
    except subprocess.CalledProcessError as e:
        stderr = e.stderr.decode("utf-8", errors="ignore") if e.stderr else str(e)
        print(f"Warning: Command failed: {' '.join(cmd)}")
        if stderr:
            print(stderr[:400])
        return False
    except FileNotFoundError:
        print(f"Warning: Command not found: {cmd[0]}")
        return False


def _parse_resize(resize: str | None) -> tuple[int, int] | None:
    """Parse ImageMagick-style resize strings like '1280x1280>'."""
    if not resize:
        return None
    clean = resize.strip().rstrip(">")
    if "x" not in clean:
        return None
    w, h = clean.split("x", 1)
    try:
        return int(w), int(h)
    except ValueError:
        return None


def resolve_session_log_path_from_metadata(metadata: dict, metadata_json_path: str | None = None) -> str | None:
    """Resolve session log path stored in metadata['_source']['session_log']."""
    source = metadata.get("_source", {}) if isinstance(metadata, dict) else {}
    session_log = source.get("session_log", "")
    if not session_log:
        return None

    candidates = [session_log]
    if metadata_json_path:
        json_dir = os.path.dirname(os.path.abspath(metadata_json_path))
        candidates.append(os.path.join(json_dir, session_log))
    candidates.append(os.path.join(_project_dir(), session_log.lstrip("./")))

    for candidate in candidates:
        if candidate and os.path.exists(candidate):
            return os.path.abspath(candidate)
    return None


def episode_image_from_session_log(session_log_path: str) -> str | None:
    """Extract thumbnail source from session-log episode.image (fallback: image_thumb)."""
    if not session_log_path or not os.path.exists(session_log_path):
        return None

    try:
        with open(session_log_path, "r", encoding="utf-8") as f:
            session = json.load(f)
    except Exception as e:
        print(f"Warning: Could not read session log for thumbnail source: {e}")
        return None

    episode = session.get("episode", {})
    image = episode.get("image") or episode.get("image_thumb")
    if not image:
        return None

    if _is_url(image) or os.path.isabs(image):
        return image

    # Relative local path: resolve relative to session log directory.
    return os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(session_log_path)), image))


def download_thumbnail_from_url(url, output_dir=None, base_name=None):
    """Download thumbnail from URL to local file.

    Args:
        url: URL to download thumbnail from
        output_dir: Directory to save thumbnail (defaults to episodes/thumbnails/)
        base_name: Base filename without extension (e.g., "2026-02-02_Cron-Job_Workflow-Revolution")
    """
    if not url:
        return None
    try:
        # Determine extension from URL
        ext = os.path.splitext(url.split('?')[0])[1] or '.jpg'

        output_dir = _thumbnail_dir(output_dir)

        os.makedirs(output_dir, exist_ok=True)

        # Generate filename from base_name or use timestamp
        if base_name:
            filename = f"{base_name}{ext}"
        else:
            filename = f"thumbnail_{int(time.time())}{ext}"

        output_path = os.path.join(output_dir, filename)

        print(f"Downloading thumbnail from {url}")

        # Add User-Agent header to avoid 406 errors
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            with open(output_path, 'wb') as f:
                f.write(response.read())

        print(f"Thumbnail downloaded to {output_path}")
        return output_path
    except Exception as e:
        print(f"Warning: Failed to download thumbnail from URL: {e}")
        return None


def _convert_optimize_jpg(source_path: str, output_path: str, quality: int, resize: str | None = None) -> bool:
    """Convert image to JPG and optimize in-place."""
    if PIL_AVAILABLE:
        try:
            with Image.open(source_path) as img:
                img = ImageOps.exif_transpose(img)

                size_limit = _parse_resize(resize)
                if size_limit:
                    # Keep aspect ratio while fitting within max dimensions.
                    img.thumbnail(size_limit, Image.Resampling.LANCZOS)

                # Flatten transparency to white before JPEG conversion.
                if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
                    base = Image.new("RGB", img.size, (255, 255, 255))
                    alpha = img.convert("RGBA")
                    base.paste(alpha, mask=alpha.split()[-1])
                    img = base
                else:
                    img = img.convert("RGB")

                img.save(
                    output_path,
                    format="JPEG",
                    quality=quality,
                    optimize=True,
                    progressive=True,
                )
        except Exception as e:
            print(f"Warning: Pillow thumbnail conversion failed, falling back to ImageMagick: {e}")
        else:
            if shutil.which("jpegoptim"):
                _run_command([
                    "jpegoptim",
                    "--strip-all",
                    f"--max={quality}",
                    "--all-progressive",
                    output_path,
                ], check=False)
            return os.path.exists(output_path)

    # Fallback path when Pillow is unavailable or conversion fails.
    imagemagick_cmd = shutil.which("magick")
    legacy_convert_cmd = shutil.which("convert")
    if not imagemagick_cmd and not legacy_convert_cmd:
        if not PIL_AVAILABLE:
            print("Warning: Pillow not installed and ImageMagick command not found ('magick' or 'convert')")
        else:
            print("Warning: ImageMagick command not found ('magick' or 'convert')")
        return False

    if imagemagick_cmd:
        cmd = [imagemagick_cmd, source_path]
    else:
        cmd = [legacy_convert_cmd, source_path]

    cmd.extend([
        "-auto-orient",
        "-strip",
        "-colorspace", "sRGB",
        "-background", "white",
        "-alpha", "remove",
        "-alpha", "off",
    ])
    if resize:
        cmd.extend(["-resize", resize])
    cmd.extend([
        "-sampling-factor", "4:2:0",
        "-interlace", "Plane",
        "-quality", str(quality),
        output_path,
    ])

    if not _run_command(cmd):
        return False

    if shutil.which("jpegoptim"):
        _run_command([
            "jpegoptim",
            "--strip-all",
            f"--max={quality}",
            "--all-progressive",
            output_path,
        ], check=False)

    return os.path.exists(output_path)


def prepare_thumbnail_file(
    source: str,
    video_file: str | None,
    max_bytes: int = THUMBNAIL_MAX_BYTES_DEFAULT,
    target_format: str = THUMBNAIL_TARGET_FORMAT,
    retry_on_fail: bool = THUMBNAIL_RETRY_ON_FAIL,
    output_dir: str | None = None,
) -> str | None:
    """
    Prepare thumbnail for YouTube upload.

    Strategy:
      1) Resolve source (URL/local)
      2) Convert to JPG
      3) Optimize and enforce max size
      4) Retry once with stronger compression/resize
    """
    if not source:
        return None

    target_format = (target_format or THUMBNAIL_TARGET_FORMAT).lower()
    if target_format not in ("jpg", "jpeg"):
        print(f"Warning: Unsupported thumbnail target format '{target_format}', using jpg")
        target_format = "jpg"

    output_dir = _thumbnail_dir(output_dir)
    os.makedirs(output_dir, exist_ok=True)

    base_name = _thumbnail_base_name(video_file)
    output_path = os.path.join(output_dir, f"{base_name}.jpg")

    downloaded_source = None
    source_path = source
    if _is_url(source):
        downloaded_source = download_thumbnail_from_url(source, output_dir=output_dir, base_name=f"{base_name}_source")
        if not downloaded_source:
            return None
        source_path = downloaded_source
    elif not os.path.exists(source_path):
        print(f"Warning: Thumbnail source file not found: {source_path}")
        return None

    print(f"Preparing thumbnail from source: {source_path}")

    first_ok = _convert_optimize_jpg(source_path, output_path, quality=88, resize=None)
    if not first_ok:
        _safe_remove(downloaded_source)
        return None

    size_bytes = os.path.getsize(output_path)
    print(f"Prepared thumbnail: {output_path} ({size_bytes} bytes)")
    if size_bytes <= max_bytes:
        _safe_remove(downloaded_source)
        return output_path

    print(f"Warning: Thumbnail is too large ({size_bytes} bytes > {max_bytes} bytes)")

    if retry_on_fail:
        print("Retrying thumbnail optimization with stronger compression...")
        retry_ok = _convert_optimize_jpg(source_path, output_path, quality=72, resize="1280x1280>")
        if retry_ok:
            size_bytes = os.path.getsize(output_path)
            print(f"Retry thumbnail: {output_path} ({size_bytes} bytes)")
            if size_bytes <= max_bytes:
                _safe_remove(downloaded_source)
                return output_path
            print(f"Warning: Thumbnail still exceeds limit after retry ({size_bytes} bytes)")

    _safe_remove(downloaded_source)
    return None


def configure_thumbnail_for_upload(args, metadata: dict | None = None, session_log_path: str | None = None):
    """
    Resolve + prepare thumbnail for upload.

    Priority:
      1) Explicit --thumbnail-file (or env-derived arg)
      2) episode.image from session log
      3) metadata.thumbnail_url fallback
    """
    retry = THUMBNAIL_RETRY_ON_FAIL
    max_bytes = THUMBNAIL_MAX_BYTES_DEFAULT
    target_format = THUMBNAIL_TARGET_FORMAT

    # Explicit thumbnail file/source always wins.
    if args.thumbnail_file:
        prepared = prepare_thumbnail_file(
            args.thumbnail_file,
            video_file=args.video_file,
            max_bytes=max_bytes,
            target_format=target_format,
            retry_on_fail=retry,
        )
        if prepared:
            args.thumbnail_file = prepared
        elif os.path.exists(args.thumbnail_file) and os.path.getsize(args.thumbnail_file) <= max_bytes:
            print(f"Using existing thumbnail without conversion: {args.thumbnail_file}")
        else:
            print("Warning: Explicit thumbnail could not be prepared within size constraints; skipping thumbnail upload")
            args.thumbnail_file = None
        return

    sources = []
    if session_log_path:
        session_source = episode_image_from_session_log(session_log_path)
        if session_source:
            sources.append(("session log", session_source))

    if metadata:
        fallback_file = metadata.get("thumbnail_file")
        fallback_url = metadata.get("thumbnail_url")
        if fallback_file:
            sources.append(("metadata file", fallback_file))
        if fallback_url:
            sources.append(("metadata url", fallback_url))

    if not sources:
        return

    attempted = set()
    for label, source in sources:
        key = (label, source)
        if key in attempted:
            continue
        attempted.add(key)

        print(f"Using thumbnail source from {label}: {source}")
        prepared = prepare_thumbnail_file(
            source,
            video_file=args.video_file,
            max_bytes=max_bytes,
            target_format=target_format,
            retry_on_fail=retry,
        )
        if prepared:
            args.thumbnail_file = prepared
            return

    print("Warning: Could not prepare thumbnail from any source; continuing without thumbnail upload")
    args.thumbnail_file = None


def main():
    load_env_vars() # Load .env.json first

    parser = argparse.ArgumentParser(description="Upload or update a video/thumbnail on YouTube.")
    parser.add_argument("--from-json", help="Load all upload parameters from a JSON metadata file. Command line args will override JSON values.")
    parser.add_argument("--from-session-log", help="Generate metadata directly from a session-log.json file and upload. This processes the session log on-the-fly.")
    parser.add_argument("--video-file", default=os.environ.get('YOUTUBE_VIDEO_FILE'),
                        help="Path to the video file to upload.")
    parser.add_argument("--title", default=os.environ.get('YOUTUBE_TITLE', "Default Title"))
    parser.add_argument("--description", default=os.environ.get('YOUTUBE_DESCRIPTION', "Default description."))
    parser.add_argument("--tags", default=os.environ.get('YOUTUBE_TAGS', ""))
    parser.add_argument("--category-id", default=os.environ.get('YOUTUBE_CATEGORY_ID', "22"))
    parser.add_argument("--privacy-status", choices=["public", "private", "unlisted"],
                        default=os.environ.get('YOUTUBE_PRIVACY_STATUS', "private"))
    parser.add_argument("--thumbnail-file", default=os.environ.get('YOUTUBE_THUMBNAIL_FILE'))
    parser.add_argument("--playlist-id", default=os.environ.get('YOUTUBE_PLAYLIST_ID'),
                        help="YouTube playlist ID to add the video to after upload. Extract from playlist URL: youtube.com/playlist?list=PLAYLIST_ID")
    parser.add_argument("--update-thumbnail-for",
                        help="If specified, updates the thumbnail for the given video ID instead of uploading a new video.")
    parser.add_argument("--visibility", choices=["public", "private", "unlisted"],
                        help="Change an existing video's visibility instead of uploading.")
    parser.add_argument("--video",
                        help="YouTube video ID or URL (for --visibility)")
    parser.add_argument("--from-state",
                        help="Read video_id from pipeline state JSON (for --visibility)")
    parser.add_argument("--remove-from-playlist",
                        help="Remove --video from this playlist ID")
    parser.add_argument("--client-secrets",
                        default=os.environ.get('YOUTUBE_CLIENT_SECRETS_PATH', DEFAULT_CLIENT_SECRETS_FILE),
                        help=f"Path to client_secrets.json. Defaults to '{DEFAULT_CLIENT_SECRETS_FILE}' or YOUTUBE_CLIENT_SECRETS_PATH env var.")
    parser.add_argument("--credentials-storage",
                        default=os.environ.get('YOUTUBE_CREDENTIALS_LOCAL_PATH', DEFAULT_CREDENTIALS_FILE),
                        help=f"Path to store/load OAuth2 credentials for local interactive runs. Defaults to '{DEFAULT_CREDENTIALS_FILE}' or YOUTUBE_CREDENTIALS_LOCAL_PATH env var.")
    
    args = parser.parse_args()
    metadata = None
    resolved_session_log = None

    # Shortcut mode: change visibility of an existing video
    if args.visibility:
        video_id = args.video
        if args.from_state:
            with open(args.from_state) as f:
                state = json.load(f)
            video_id = state.get("youtube_video_id", video_id)
        if not video_id:
            parser.error("--visibility requires --video VIDEO_ID_OR_URL or --from-state")
        # Accept full URLs: extract video ID from youtube.com/watch?v=XXX or youtu.be/XXX
        if "youtube.com" in video_id or "youtu.be" in video_id:
            from urllib.parse import urlparse, parse_qs
            parsed = urlparse(video_id)
            if "youtu.be" in parsed.netloc:
                video_id = parsed.path.lstrip("/")
            else:
                video_id = parse_qs(parsed.query).get("v", [""])[0]
            if not video_id:
                parser.error(f"Could not extract video ID from URL: {args.video}")
        result = set_privacy(video_id, args.visibility)
        status = result.get("status", {}).get("privacyStatus", "unknown")
        print(f"{video_id} -> {status}")
        return

    # Shortcut mode: remove a video from a playlist
    if args.remove_from_playlist:
        video_id = args.video
        if args.from_state:
            with open(args.from_state) as f:
                state = json.load(f)
            video_id = state.get("youtube_video_id", video_id)
        if not video_id:
            parser.error("--remove-from-playlist requires --video VIDEO_ID or --from-state")
        youtube = get_authenticated_service(args)
        success = remove_from_playlist(youtube, video_id, args.remove_from_playlist)
        sys.exit(0 if success else 1)

    # Load metadata from session log if specified (generates metadata on-the-fly)
    if args.from_session_log:
        resolved_session_log = os.path.abspath(args.from_session_log)
        session_log_options = {
            'playlist_id': args.playlist_id,
            'privacy': args.privacy_status,
            'download_thumb': False,  # Don't download by default in upload script
        }
        metadata = load_metadata_from_session_log(args.from_session_log, session_log_options)

        # Apply metadata to args
        if 'video_file' in metadata and not args.video_file:
            args.video_file = metadata['video_file']
        if 'title' in metadata and args.title == os.environ.get('YOUTUBE_TITLE', "Default Title"):
            args.title = metadata['title']
        if 'description' in metadata and args.description == os.environ.get('YOUTUBE_DESCRIPTION', "Default description."):
            args.description = metadata['description']
        if 'tags' in metadata and args.tags == os.environ.get('YOUTUBE_TAGS', ""):
            args.tags = metadata['tags']
        if 'category_id' in metadata and args.category_id == os.environ.get('YOUTUBE_CATEGORY_ID', "22"):
            args.category_id = metadata['category_id']
        if 'privacy_status' in metadata and args.privacy_status == os.environ.get('YOUTUBE_PRIVACY_STATUS', "private"):
            args.privacy_status = metadata['privacy_status']
        if 'playlist_id' in metadata and not args.playlist_id:
            args.playlist_id = metadata['playlist_id']

    # Load metadata from JSON if specified
    elif args.from_json:
        metadata = load_metadata_from_json(args.from_json)
        resolved_session_log = resolve_session_log_path_from_metadata(metadata, args.from_json)
        
        # Map JSON fields to args, only if not explicitly set via command line
        if 'video_file' in metadata and not args.video_file:
            args.video_file = metadata['video_file']
        if 'title' in metadata and args.title == os.environ.get('YOUTUBE_TITLE', "Default Title"):
            args.title = metadata['title']
        if 'description' in metadata and args.description == os.environ.get('YOUTUBE_DESCRIPTION', "Default description."):
            args.description = metadata['description']
        if 'tags' in metadata and args.tags == os.environ.get('YOUTUBE_TAGS', ""):
            args.tags = metadata['tags']
        if 'category_id' in metadata and args.category_id == os.environ.get('YOUTUBE_CATEGORY_ID', "22"):
            args.category_id = metadata['category_id']
        if 'privacy_status' in metadata and args.privacy_status == os.environ.get('YOUTUBE_PRIVACY_STATUS', "private"):
            args.privacy_status = metadata['privacy_status']
        if 'playlist_id' in metadata and not args.playlist_id:
            args.playlist_id = metadata['playlist_id']

    # Always prepare thumbnail before validation/upload.
    configure_thumbnail_for_upload(args, metadata=metadata, session_log_path=resolved_session_log)

    # Validate playlist ID if provided
    if args.playlist_id:
        validation_result = validate_playlist_id(args.playlist_id)
        if validation_result is False:
            print(f"ERROR: Invalid playlist ID format: {args.playlist_id}")
            print("💡 Playlist ID should be extracted from URL like:")
            print("   https://www.youtube.com/playlist?list=PLxxxxxxxxxxxxxxxxxxxxxx")
            print("   Correct format: PLxxxxxxxxxxxxxxxxxxxxxx")
            sys.exit(1)
        elif isinstance(validation_result, str):
            args.playlist_id = validation_result  # Use cleaned ID
            print(f"🔧 Using cleaned playlist ID: {args.playlist_id}")

    # Validate arguments based on operation mode
    if args.update_thumbnail_for:
        # For thumbnail-only updates, we only need the thumbnail file
        if not args.thumbnail_file:
            print("ERROR: --thumbnail-file is required when using --update-thumbnail-for")
            sys.exit(1)
        if not os.path.exists(args.thumbnail_file):
            print(f"ERROR: Thumbnail file not found at {args.thumbnail_file}")
            sys.exit(1)
    else:
        # For video uploads, we need the video file
        if not args.video_file:
            print("ERROR: --video-file argument, YOUTUBE_VIDEO_FILE environment variable, or JSON metadata with video_file is required.")
            sys.exit(1)
        if not os.path.exists(args.video_file):
            print(f"ERROR: Video file not found at {args.video_file}")
            sys.exit(1)
        # Thumbnail is optional for video uploads
        if args.thumbnail_file and not os.path.exists(args.thumbnail_file):
            print(f"WARNING: Thumbnail file specified ('{args.thumbnail_file}') but not found. Proceeding without thumbnail upload.")
            args.thumbnail_file = None 

    print("--- YouTube Uploader Initializing ---")
    if args.from_session_log:
        print(f"Using metadata generated from session log: {args.from_session_log}")
    elif args.from_json:
        print(f"Using metadata from: {args.from_json}")
    if not os.environ.get('YOUTUBE_CLIENT_ID'): # Heuristic: if no direct env vars, probably local mode
        print(f"Using Client Secrets Path: {os.path.abspath(args.client_secrets)}")
        print(f"Using Credentials Storage Path (for local flow): {os.path.abspath(args.credentials_storage)}")

    try:
        youtube = get_authenticated_service(args)
        # Shortcut mode: only update thumbnail
        if args.update_thumbnail_for:
            update_thumbnail(youtube, args.update_thumbnail_for, args.thumbnail_file)
            return
        if youtube:
            video_id = initialize_upload(youtube, args)
            
            # Write video_id back to metadata file if upload was successful and --from-json was used
            if video_id and args.from_json:
                try:
                    with open(args.from_json, 'r') as f:
                        metadata = json.load(f)
                    metadata['video_id'] = video_id
                    metadata['url'] = f'https://www.youtube.com/watch?v={video_id}'
                    with open(args.from_json, 'w') as f:
                        json.dump(metadata, f, indent=2)
                    print(f"✅ Video ID {video_id} saved to {args.from_json}")
                except Exception as e:
                    print(f"⚠️  Warning: Could not save video ID to metadata file: {e}")
            
            print("\n--- YouTube Upload Process Finished ---")
        else:
            print("Could not get authenticated YouTube service. Upload aborted.")
    except HttpError as e:
        print(f"An HTTP error {e.resp.status} occurred:\n{e.content}")
    except Exception as e:
        print(f"An unexpected error occurred in main: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main() 
