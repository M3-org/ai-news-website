#!/usr/bin/env python3
"""
CDN Upload Script - Unix-philosophy uploader for Bunny CDN.

Upload files to Bunny CDN with support for single files, directories,
stdin input, and manifest-based uploads.

Environment Variables:
    BUNNY_STORAGE_ZONE: Your Bunny storage zone name (required)
    BUNNY_STORAGE_PASSWORD: Your Bunny API password (required)
    BUNNY_CDN_URL: Your CDN URL (required, e.g., https://cdn.example.com)
    BUNNY_STORAGE_HOST: Storage host (default: https://la.storage.bunnycdn.com)

Examples:
    # Upload single file
    uv run python scripts/cdn_upload.py episodes/thumbnails/thumb.png --remote cronjob/thumbnails/

    # Upload directory
    uv run python scripts/cdn_upload.py --dir episodes/clips/ --remote cronjob/clips/

    # Upload from stdin (pipe-friendly)
    find episodes/clips -name "*.mp4" | uv run python scripts/cdn_upload.py --stdin --remote cronjob/clips/

    # Upload using manifest (updates manifest with CDN URLs)
    uv run python scripts/cdn_upload.py --manifest episodes/clips/manifest.json --remote cronjob/clips/

    # Dry run
    uv run python scripts/cdn_upload.py file.mp4 --remote path/ --dry-run
"""

import argparse
import json
import os
import sys
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

# Load .env file if python-dotenv is available
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv not installed, rely on environment variables


# Default settings
DEFAULT_STORAGE_HOST = "https://la.storage.bunnycdn.com"
DEFAULT_MAX_SIZE_MB = 50
MEDIA_EXTENSIONS = {'.mp4', '.webm', '.mov', '.png', '.jpg', '.jpeg', '.gif', '.webp'}


def get_env_config() -> dict:
    """Load configuration from environment variables."""
    config = {
        'storage_zone': os.environ.get('BUNNY_STORAGE_ZONE', ''),
        'storage_password': os.environ.get('BUNNY_STORAGE_PASSWORD', ''),
        'cdn_url': os.environ.get('BUNNY_CDN_URL', ''),
        'storage_host': os.environ.get('BUNNY_STORAGE_HOST', DEFAULT_STORAGE_HOST),
    }
    return config


def validate_config(config: dict, dry_run: bool = False) -> bool:
    """Validate required configuration."""
    if dry_run:
        return True

    missing = []
    if not config['storage_zone']:
        missing.append('BUNNY_STORAGE_ZONE')
    if not config['storage_password']:
        missing.append('BUNNY_STORAGE_PASSWORD')
    if not config['cdn_url']:
        missing.append('BUNNY_CDN_URL')

    if missing:
        print(f"ERROR: Missing required environment variables: {', '.join(missing)}", file=sys.stderr)
        print("See .env.example for required configuration.", file=sys.stderr)
        return False
    return True


def get_file_size_mb(file_path: str) -> float:
    """Get file size in megabytes."""
    return os.path.getsize(file_path) / (1024 * 1024)


def upload_file(
    local_path: str,
    remote_path: str,
    config: dict,
    dry_run: bool = False,
    skip_existing: bool = True
) -> dict:
    """
    Upload a single file to Bunny CDN.

    Args:
        local_path: Local file path
        remote_path: Remote path (e.g., 'cronjob/clips/file.mp4')
        config: CDN configuration dict
        dry_run: If True, simulate upload without actually uploading
        skip_existing: If True, skip files that may already exist (default behavior)

    Returns:
        Dict with upload result including cdn_url, cdn_path, status
    """
    filename = os.path.basename(local_path)
    full_remote_path = remote_path.rstrip('/') + '/' + filename if not remote_path.endswith(filename) else remote_path

    # Ensure remote path doesn't start with /
    full_remote_path = full_remote_path.lstrip('/')

    result = {
        'filename': filename,
        'local_path': local_path,
        'cdn_path': full_remote_path,
        'cdn_url': f"{config['cdn_url'].rstrip('/')}/{full_remote_path}",
        'size_bytes': os.path.getsize(local_path) if os.path.exists(local_path) else 0,
        'status': 'pending',
        'uploaded_at': None,
        'error': None
    }

    if not os.path.exists(local_path):
        result['status'] = 'error'
        result['error'] = f"File not found: {local_path}"
        return result

    if dry_run:
        result['status'] = 'dry_run'
        print(f"[DRY RUN] Would upload: {local_path} -> {full_remote_path}")
        return result

    # Build upload URL
    upload_url = f"{config['storage_host']}/{config['storage_zone']}/{full_remote_path}"

    try:
        # Read file content
        with open(local_path, 'rb') as f:
            file_data = f.read()

        # Create request
        req = urllib.request.Request(
            upload_url,
            data=file_data,
            method='PUT',
            headers={
                'AccessKey': config['storage_password'],
                'Content-Type': 'application/octet-stream',
            }
        )

        # Execute upload
        with urllib.request.urlopen(req) as response:
            response_data = response.read().decode('utf-8')
            if response.status in (200, 201):
                result['status'] = 'uploaded'
                result['uploaded_at'] = datetime.now(timezone.utc).isoformat()
                print(f"[OK] Uploaded: {local_path} -> {result['cdn_url']}")
            else:
                result['status'] = 'error'
                result['error'] = f"HTTP {response.status}: {response_data}"
                print(f"[ERROR] Failed to upload {local_path}: {result['error']}", file=sys.stderr)

    except urllib.error.HTTPError as e:
        result['status'] = 'error'
        result['error'] = f"HTTP {e.code}: {e.reason}"
        print(f"[ERROR] Failed to upload {local_path}: {result['error']}", file=sys.stderr)
    except Exception as e:
        result['status'] = 'error'
        result['error'] = str(e)
        print(f"[ERROR] Failed to upload {local_path}: {result['error']}", file=sys.stderr)

    return result


def collect_files_from_dir(directory: str, max_size_mb: float = DEFAULT_MAX_SIZE_MB) -> list:
    """Collect media files from a directory."""
    files = []
    dir_path = Path(directory)

    if not dir_path.exists():
        print(f"ERROR: Directory not found: {directory}", file=sys.stderr)
        return files

    for file_path in dir_path.iterdir():
        if file_path.is_file() and file_path.suffix.lower() in MEDIA_EXTENSIONS:
            size_mb = get_file_size_mb(str(file_path))
            if size_mb <= max_size_mb:
                files.append(str(file_path))
            else:
                print(f"[SKIP] {file_path.name}: {size_mb:.1f}MB exceeds max size ({max_size_mb}MB)")

    return sorted(files)


def collect_files_from_stdin(max_size_mb: float = DEFAULT_MAX_SIZE_MB) -> list:
    """Collect files from stdin (one path per line)."""
    files = []
    for line in sys.stdin:
        file_path = line.strip()
        if not file_path:
            continue
        if not os.path.exists(file_path):
            print(f"[SKIP] File not found: {file_path}", file=sys.stderr)
            continue
        size_mb = get_file_size_mb(file_path)
        if size_mb <= max_size_mb:
            files.append(file_path)
        else:
            print(f"[SKIP] {file_path}: {size_mb:.1f}MB exceeds max size ({max_size_mb}MB)")
    return files


def load_manifest(manifest_path: str) -> Optional[dict]:
    """Load a manifest file."""
    try:
        with open(manifest_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"ERROR: Failed to load manifest: {e}", file=sys.stderr)
        return None


def save_manifest(manifest: dict, manifest_path: str) -> bool:
    """Save a manifest file."""
    try:
        with open(manifest_path, 'w', encoding='utf-8') as f:
            json.dump(manifest, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"ERROR: Failed to save manifest: {e}", file=sys.stderr)
        return False


def upload_from_manifest(
    manifest_path: str,
    remote_path: str,
    config: dict,
    dry_run: bool = False,
    skip_existing: bool = True
) -> list:
    """
    Upload files listed in a manifest and update it with CDN URLs.

    Args:
        manifest_path: Path to manifest.json
        remote_path: Remote CDN path prefix
        config: CDN configuration
        dry_run: If True, simulate uploads
        skip_existing: If True, skip already-uploaded files

    Returns:
        List of upload results
    """
    manifest = load_manifest(manifest_path)
    if not manifest:
        return []

    results = []
    manifest_dir = os.path.dirname(os.path.abspath(manifest_path))
    files = manifest.get('files', [])

    for file_entry in files:
        # Skip already uploaded files if requested
        if skip_existing and file_entry.get('cdn_url'):
            print(f"[SKIP] Already uploaded: {file_entry.get('filename')}")
            continue

        filename = file_entry.get('filename')
        if not filename:
            continue

        # Resolve local path relative to manifest directory
        local_path = os.path.join(manifest_dir, filename)
        if not os.path.exists(local_path):
            print(f"[SKIP] File not found: {local_path}", file=sys.stderr)
            continue

        result = upload_file(local_path, remote_path, config, dry_run, skip_existing)
        results.append(result)

        # Update manifest entry with CDN info
        if result['status'] in ('uploaded', 'dry_run'):
            file_entry['cdn_url'] = result['cdn_url']
            file_entry['cdn_path'] = result['cdn_path']
            file_entry['uploaded_at'] = result['uploaded_at'] or datetime.now(timezone.utc).isoformat()

    # Update manifest CDN metadata
    if not dry_run and results:
        manifest.setdefault('cdn', {})
        manifest['cdn']['provider'] = 'bunny'
        manifest['cdn']['base_url'] = f"{config['cdn_url'].rstrip('/')}/{remote_path.strip('/')}"
        manifest['cdn']['uploaded_at'] = datetime.now(timezone.utc).isoformat()

        save_manifest(manifest, manifest_path)
        print(f"\nManifest updated: {manifest_path}")

    return results


def main():
    parser = argparse.ArgumentParser(
        description="Upload files to Bunny CDN",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Upload single file
  uv run python scripts/cdn_upload.py episodes/thumbnails/thumb.png --remote cronjob/thumbnails/

  # Upload directory
  uv run python scripts/cdn_upload.py --dir episodes/clips/ --remote cronjob/clips/

  # Upload from stdin
  find episodes/clips -name "*.mp4" | uv run python scripts/cdn_upload.py --stdin --remote cronjob/clips/

  # Upload using manifest
  uv run python scripts/cdn_upload.py --manifest episodes/clips/manifest.json --remote cronjob/clips/

  # Dry run
  uv run python scripts/cdn_upload.py file.mp4 --remote path/ --dry-run
"""
    )

    # Input sources (mutually exclusive)
    input_group = parser.add_mutually_exclusive_group()
    input_group.add_argument(
        "file",
        nargs="?",
        help="Single file to upload"
    )
    input_group.add_argument(
        "--dir", "-d",
        dest="directory",
        help="Directory to upload (all media files)"
    )
    input_group.add_argument(
        "--stdin",
        action="store_true",
        help="Read file paths from stdin (one per line)"
    )
    input_group.add_argument(
        "--manifest", "-m",
        help="Upload files from manifest.json and update it with CDN URLs"
    )

    # Required options
    parser.add_argument(
        "--remote", "-r",
        required=True,
        help="Remote CDN path (e.g., 'cronjob/clips/')"
    )

    # Optional flags
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Simulate uploads without actually uploading"
    )
    parser.add_argument(
        "--no-skip-existing",
        action="store_true",
        help="Re-upload files even if they may already exist"
    )
    parser.add_argument(
        "--max-size",
        type=float,
        default=DEFAULT_MAX_SIZE_MB,
        help=f"Maximum file size in MB (default: {DEFAULT_MAX_SIZE_MB})"
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output results as JSON"
    )

    args = parser.parse_args()

    # Load and validate config
    config = get_env_config()
    if not validate_config(config, args.dry_run):
        sys.exit(1)

    skip_existing = not args.no_skip_existing
    results = []

    # Determine input source and collect files
    if args.manifest:
        # Upload from manifest
        results = upload_from_manifest(
            args.manifest,
            args.remote,
            config,
            args.dry_run,
            skip_existing
        )
    elif args.directory:
        # Upload from directory
        files = collect_files_from_dir(args.directory, args.max_size)
        if not files:
            print("No files found to upload.", file=sys.stderr)
            sys.exit(1)
        print(f"Found {len(files)} files to upload\n")
        for file_path in files:
            result = upload_file(file_path, args.remote, config, args.dry_run, skip_existing)
            results.append(result)
    elif args.stdin:
        # Upload from stdin
        files = collect_files_from_stdin(args.max_size)
        if not files:
            print("No files provided via stdin.", file=sys.stderr)
            sys.exit(1)
        print(f"Processing {len(files)} files\n")
        for file_path in files:
            result = upload_file(file_path, args.remote, config, args.dry_run, skip_existing)
            results.append(result)
    elif args.file:
        # Upload single file
        size_mb = get_file_size_mb(args.file) if os.path.exists(args.file) else 0
        if size_mb > args.max_size:
            print(f"ERROR: File size ({size_mb:.1f}MB) exceeds max size ({args.max_size}MB)", file=sys.stderr)
            sys.exit(1)
        result = upload_file(args.file, args.remote, config, args.dry_run, skip_existing)
        results.append(result)
    else:
        parser.print_help()
        sys.exit(1)

    # Output results
    if args.json:
        print(json.dumps(results, indent=2))
    else:
        # Summary
        uploaded = sum(1 for r in results if r['status'] == 'uploaded')
        dry_run_count = sum(1 for r in results if r['status'] == 'dry_run')
        errors = sum(1 for r in results if r['status'] == 'error')

        print(f"\n--- Summary ---")
        if args.dry_run:
            print(f"Would upload: {dry_run_count} files")
        else:
            print(f"Uploaded: {uploaded} files")
        if errors:
            print(f"Errors: {errors} files")

    # Exit with error code if any uploads failed
    if any(r['status'] == 'error' for r in results):
        sys.exit(1)


if __name__ == "__main__":
    main()
