#!/usr/bin/env python3
"""Unified publisher for Cron Job episode metadata - supports git and FTP backends."""

from __future__ import annotations

import argparse
import ftplib
import glob
import io
import json
import os
import re
import secrets
import ssl
import subprocess
import sys
import warnings
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Dict, Optional

# Load .env file if present
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv not required if env vars set directly


# =============================================================================
# Shared Logic (Backend-Agnostic)
# =============================================================================

def extract_youtube_id(value: str) -> Optional[str]:
    """Extract YouTube video ID from URL or raw ID string."""
    if not value:
        return None
    m = re.search(r"(?:v=|youtu\.be/)([A-Za-z0-9_-]{11})", value)
    if m:
        return m.group(1)
    if re.fullmatch(r"[A-Za-z0-9_-]{11}", value):
        return value
    return None


def normalize_title(raw_title: str) -> str:
    """Normalize title to ensure 'Cron Job: ' prefix."""
    title = raw_title.strip()
    title = re.sub(r"\s+\|\s*.*$", "", title)
    title = re.sub(r"\s*-\s*Cron\s*Job\s*$", "", title, flags=re.IGNORECASE)
    if not title.lower().startswith("cron job"):
        title = f"Cron Job: {title}"
    return title


def load_json(path: Path) -> Any:
    """Load JSON file from disk."""
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path, data: Any) -> None:
    """Write JSON file to disk."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def find_metadata_file(episodes_dir: Path, episode_date: str, override: Optional[Path]) -> Path:
    """Find metadata JSON file for given episode date."""
    if override:
        if not override.exists():
            raise FileNotFoundError(f"metadata file not found: {override}")
        return override

    pattern = str(episodes_dir / f"{episode_date}_*_youtube_metadata*.json")
    candidates = sorted(glob.glob(pattern))
    if not candidates:
        raise FileNotFoundError(f"no metadata JSON found for date {episode_date}: {pattern}")

    # Use latest mtime if multiple candidates
    candidates.sort(key=lambda p: Path(p).stat().st_mtime, reverse=True)
    return Path(candidates[0])


def prepare_episode_payload(metadata: dict, episode_date: str) -> dict:
    """Prepare episode payload from metadata JSON."""
    raw_title = metadata.get("title", "").strip()
    source_show = str(metadata.get("_source", {}).get("show_name", "")).strip()

    if not raw_title:
        raise RuntimeError(f"metadata missing title")
    if "cron" not in raw_title.lower() and "cron" not in source_show.lower():
        raise RuntimeError(f"metadata does not look like Cron Job episode")

    video_id = extract_youtube_id(str(metadata.get("video_id", "")))
    if not video_id:
        video_id = extract_youtube_id(str(metadata.get("url", "")))
    if not video_id:
        raise RuntimeError(f"unable to extract YouTube video ID from metadata")

    title = normalize_title(raw_title)
    return {
        "id": video_id,
        "title": title,
        "thumbnail": f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg",
        "url": f"https://www.youtube.com/watch?v={video_id}",
    }


def upsert_episode_data(data: Dict[str, Any], episode_date: str, payload: Dict[str, str]) -> bool:
    """Update episodes data with new payload. Returns True if changed."""
    changed = False
    if episode_date not in data:
        data[episode_date] = {}
        changed = True
    if data[episode_date].get("en") != payload:
        data[episode_date]["en"] = payload
        changed = True
    return changed


def upsert_gallery_item(gallery: Dict[str, Any], payload: Dict[str, str], episode_date: str) -> bool:
    """Update gallery data with new payload. Returns True if changed."""
    items = gallery["items"]
    target_idx = None
    for idx, item in enumerate(items):
        if item.get("show") == "cronjob" and item.get("youtube") == payload["id"]:
            target_idx = idx
            break

    desired = {
        "show": "cronjob",
        "youtube": payload["id"],
        "title": payload["title"],
        "thumbnail": payload["thumbnail"],
        "label": episode_date,
        "description": "Weekly Cron Job episode",
    }

    if target_idx is not None:
        changed = items[target_idx] != desired
        if changed:
            items[target_idx] = desired
        return changed

    insert_at = next((i for i, it in enumerate(items) if it.get("show") == "cronjob"), 0)
    items.insert(insert_at, desired)
    return True


# =============================================================================
# Backend Abstraction
# =============================================================================

class PublishBackend(ABC):
    """Abstract base class for publishing backends."""

    @abstractmethod
    def validate_config(self, dry_run: bool) -> bool:
        """Validate backend-specific configuration. Returns True if valid."""
        pass

    @abstractmethod
    def load_existing_data(self, dry_run: bool = False) -> tuple[dict, dict]:
        """Load existing cronjob-episodes.json and gallery.json.
        Returns: (episodes_data, gallery_data) tuple."""
        pass

    @abstractmethod
    def publish(self, episodes_data: dict, gallery_data: dict, dry_run: bool) -> dict:
        """Publish updated data.
        Returns: {"status": "success"|"error"|"dry_run", "message": str, ...}"""
        pass


# =============================================================================
# Git Backend (M3TV Website Repo)
# =============================================================================

class GitPublisher(PublishBackend):
    """Git-based publisher for M3TV website repo."""

    def __init__(self, website_repo: Path, episode_date: str, push: bool, no_push: bool):
        self.website_repo = website_repo
        self.episode_date = episode_date
        self.push = push and not no_push
        self.episodes_file = website_repo / "tv" / "data" / "cronjob-episodes.json"
        self.gallery_file = website_repo / "tv" / "gallery.json"

    def validate_config(self, dry_run: bool) -> bool:
        """Validate git repo exists and has required structure."""
        if dry_run:
            return True
        if not self.website_repo.exists():
            print(f"ERROR: Website repo not found: {self.website_repo}", file=sys.stderr)
            return False
        if not self.episodes_file.parent.exists():
            print(f"ERROR: tv/data/ directory not found in repo", file=sys.stderr)
            return False
        return True

    def load_existing_data(self, dry_run: bool = False) -> tuple[dict, dict]:
        """Load existing JSON files from git repo."""
        episodes = load_json(self.episodes_file) if self.episodes_file.exists() else {}
        gallery = load_json(self.gallery_file) if self.gallery_file.exists() else {"items": []}
        return episodes, gallery

    def publish(self, episodes_data: dict, gallery_data: dict, dry_run: bool) -> dict:
        """Write files to git repo and optionally commit/push."""
        if dry_run:
            return {
                "status": "dry_run",
                "message": f"Would update git repo at {self.website_repo}",
                "push": self.push
            }

        # Write files
        write_json(self.episodes_file, episodes_data)
        write_json(self.gallery_file, gallery_data)

        result = {
            "status": "success",
            "message": f"Updated files in {self.website_repo}",
            "files": [str(self.episodes_file), str(self.gallery_file)],
            "pushed": False
        }

        if self.push:
            try:
                # Stage files
                self._run_git(["add", "tv/data/cronjob-episodes.json", "tv/gallery.json"])

                # Check if there are actual changes
                diff = self._run_git(["diff", "--cached", "--quiet"], check=False)
                if diff.returncode == 0:
                    result["message"] = "No staged changes after git add; skipping commit"
                    return result

                # Configure git user
                self._run_git(["config", "user.email", "github-actions[bot]@users.noreply.github.com"])
                self._run_git(["config", "user.name", "github-actions[bot]"])

                # Commit and push
                self._run_git(["commit", "-m", f"Cron Job weekly update: {self.episode_date}"])
                self._run_git(["push", "origin", "main"])

                result["pushed"] = True
                result["message"] = f"Committed and pushed to {self.website_repo}"
            except subprocess.CalledProcessError as e:
                result["status"] = "error"
                result["message"] = f"Git operation failed: {e}"
                return result

        return result

    def _run_git(self, args: list[str], check: bool = True) -> subprocess.CompletedProcess:
        """Run git command in website repo."""
        return subprocess.run(
            ["git", "-C", str(self.website_repo), *args],
            capture_output=True,
            text=True,
            check=check
        )


# =============================================================================
# FTP Backend (Direct Server Upload)
# =============================================================================

class FtpPublisher(PublishBackend):
    """FTP-based publisher using FTPS (FTP over TLS)."""

    def __init__(self, host: str, user: str, password: str, remote_path: str,
                 episode_date: str, port: int = 21, use_tls: bool = True,
                 verify_ssl: bool = True, timeout: int = 30):
        self.host = host
        self.port = port
        self.user = user
        self.password = password
        self.remote_path = remote_path.rstrip('/')
        self.episode_date = episode_date
        self.use_tls = use_tls
        self.verify_ssl = verify_ssl
        self.timeout = timeout

    def validate_config(self, dry_run: bool) -> bool:
        """Validate FTP configuration."""
        if dry_run:
            return True

        missing = []
        if not self.host:
            missing.append("FTP_HOST")
        if not self.user:
            missing.append("FTP_USER")
        if not self.password:
            missing.append("FTP_PASSWORD")

        if missing:
            print(f"ERROR: Missing FTP config: {', '.join(missing)}", file=sys.stderr)
            return False

        return True

    def _connect(self) -> ftplib.FTP:
        """Establish FTP connection with secure TLS."""
        try:
            if self.use_tls:
                # Create secure SSL context with certificate verification
                if self.verify_ssl:
                    ssl_context = ssl.create_default_context(ssl.Purpose.SERVER_AUTH)
                    ssl_context.check_hostname = True
                    ssl_context.verify_mode = ssl.CERT_REQUIRED
                    ftp = ftplib.FTP_TLS(context=ssl_context, timeout=self.timeout)
                else:
                    # Insecure mode: TLS without cert verification (break-glass only)
                    warnings.warn(
                        "FTP_VERIFY_SSL=false: Certificate validation disabled. "
                        "Connection is vulnerable to MITM attacks!",
                        UserWarning
                    )
                    ftp = ftplib.FTP_TLS(timeout=self.timeout)
            else:
                ftp = ftplib.FTP(timeout=self.timeout)

            # Connect and login
            ftp.connect(self.host, self.port)
            ftp.login(self.user, self.password)

            # Enable encryption for data channel (FTPS)
            if self.use_tls:
                ftp.prot_p()

            # Navigate to remote directory
            ftp.cwd(self.remote_path)

            return ftp
        except Exception as e:
            raise RuntimeError(f"FTP connection failed: {e}")

    def _download_json(self, ftp: ftplib.FTP, filename: str) -> dict:
        """Download JSON file from FTP, return {} or {"items": []} if not found."""
        try:
            bio = io.BytesIO()
            ftp.retrbinary(f"RETR {filename}", bio.write)
            return json.loads(bio.getvalue().decode('utf-8'))
        except ftplib.error_perm as e:
            if "550" in str(e):  # File not found
                return {} if filename == "cronjob-episodes.json" else {"items": []}
            raise

    def _upload_json_atomic(self, ftp: ftplib.FTP, filename: str, data: dict):
        """Upload JSON with collision-safe atomic rename."""
        json_str = json.dumps(data, ensure_ascii=False, indent=2) + "\n"

        # Generate unique temp name to prevent collisions
        random_suffix = secrets.token_hex(8)
        temp_name = f"{filename}.{random_suffix}.tmp"

        try:
            # Upload to unique temp file
            bio = io.BytesIO(json_str.encode('utf-8'))
            ftp.storbinary(f"STOR {temp_name}", bio)

            # Attempt atomic rename (behavior depends on FTP server)
            try:
                # Try direct rename (may overwrite atomically)
                ftp.rename(temp_name, filename)
            except ftplib.error_perm as e:
                # Only delete+retry for explicit "file exists" errors (FTP 550)
                # Do NOT handle general permission errors (destructive and unhelpful)
                error_msg = str(e).lower()
                if "550" in str(e) and ("exists" in error_msg or "already" in error_msg):
                    try:
                        ftp.delete(filename)
                        ftp.rename(temp_name, filename)
                    except Exception as retry_error:
                        raise RuntimeError(
                            f"Atomic rename failed after delete retry: {retry_error}"
                        )
                else:
                    raise

        except Exception as e:
            # Cleanup: Remove temp file if upload succeeded but rename failed
            try:
                ftp.delete(temp_name)
            except:
                pass  # Temp file may not exist or may be inaccessible
            raise RuntimeError(f"Atomic upload failed for {filename}: {e}")

    def load_existing_data(self, dry_run: bool = False) -> tuple[dict, dict]:
        """Download existing JSON files from FTP.
        In dry-run mode with missing credentials, returns empty data structures."""
        # In dry-run mode, skip connection if credentials are missing
        if dry_run and (not self.host or not self.user or not self.password):
            return {}, {"items": []}

        ftp = self._connect()
        try:
            episodes = self._download_json(ftp, "cronjob-episodes.json")
            gallery = self._download_json(ftp, "gallery.json")
            return episodes, gallery
        finally:
            try:
                ftp.quit()
            except:
                pass

    def publish(self, episodes_data: dict, gallery_data: dict, dry_run: bool) -> dict:
        """Upload updated JSON files via FTP."""
        if dry_run:
            return {
                "status": "dry_run",
                "message": f"Would upload to FTP: {self.host}:{self.remote_path}",
                "protocol": "FTPS" if self.use_tls else "FTP"
            }

        try:
            ftp = self._connect()
            try:
                self._upload_json_atomic(ftp, "cronjob-episodes.json", episodes_data)
                self._upload_json_atomic(ftp, "gallery.json", gallery_data)

                return {
                    "status": "success",
                    "message": f"Published to FTP: {self.host}{self.remote_path}",
                    "files": ["cronjob-episodes.json", "gallery.json"],
                    "protocol": "FTPS" if self.use_tls else "FTP"
                }
            finally:
                try:
                    ftp.quit()
                except:
                    pass
        except Exception as e:
            return {
                "status": "error",
                "message": f"FTP upload failed: {e}"
            }


# =============================================================================
# Backend Factory
# =============================================================================

def create_backend(args) -> PublishBackend:
    """Factory function to create appropriate backend."""
    if args.target == "m3tv":
        if not args.website_repo:
            raise ValueError(
                "--website-repo required for --target=m3tv (or set WEBSITE_REPO env var)"
            )
        return GitPublisher(
            website_repo=Path(args.website_repo),
            episode_date=args.episode_date,
            push=args.push,
            no_push=args.no_push
        )

    elif args.target == "ftp":
        return FtpPublisher(
            host=os.environ.get("FTP_HOST", ""),
            user=os.environ.get("FTP_USER", ""),
            password=os.environ.get("FTP_PASSWORD", ""),
            remote_path=os.environ.get("FTP_REMOTE_PATH", "/public_html/m3org/tv"),
            episode_date=args.episode_date,
            port=int(os.environ.get("FTP_PORT", "21")),
            use_tls=os.environ.get("FTP_USE_TLS", "true").lower() == "true",
            verify_ssl=os.environ.get("FTP_VERIFY_SSL", "true").lower() == "true",
            timeout=int(os.environ.get("FTP_TIMEOUT", "30"))
        )

    raise ValueError(f"Unknown target: {args.target}")


# =============================================================================
# Main Entry Point
# =============================================================================

def main() -> int:
    parser = argparse.ArgumentParser(
        description="Publish Cron Job episode data via git or FTP"
    )

    # Target selection
    parser.add_argument(
        "--target",
        choices=["m3tv", "ftp"],
        default="m3tv",
        help="Publishing target: m3tv (git repo) or ftp (FTP server)"
    )

    # Required for all targets
    parser.add_argument(
        "--episode-date",
        required=True,
        help="Episode date (YYYY-MM-DD)"
    )
    parser.add_argument(
        "--metadata-json",
        help="Override metadata JSON path"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview without publishing"
    )

    # Git-specific arguments (only used when --target=m3tv)
    parser.add_argument(
        "--website-repo",
        default=os.environ.get("WEBSITE_REPO"),
        help="Path to website repo (for --target=m3tv)"
    )
    parser.add_argument(
        "--push",
        action="store_true",
        help="Push to git remote (git backend only)"
    )
    parser.add_argument(
        "--no-push",
        action="store_true",
        help="Skip git push even if --push provided"
    )

    args = parser.parse_args()

    # Find project root
    project_dir = Path(__file__).resolve().parents[1]
    episodes_dir = project_dir / "episodes"

    try:
        # Create backend
        backend = create_backend(args)
    except ValueError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 1

    # Validate config
    if not backend.validate_config(args.dry_run):
        return 1

    # Find and load metadata JSON
    try:
        metadata_path = find_metadata_file(
            episodes_dir,
            args.episode_date,
            Path(args.metadata_json) if args.metadata_json else None
        )
        metadata = load_json(metadata_path)
    except (FileNotFoundError, RuntimeError) as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 1

    # Prepare episode payload (shared logic)
    try:
        payload = prepare_episode_payload(metadata, args.episode_date)
    except RuntimeError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 1

    # Load existing data via backend
    try:
        episodes_data, gallery_data = backend.load_existing_data(args.dry_run)
    except Exception as e:
        print(f"ERROR: Failed to load existing data: {e}", file=sys.stderr)
        return 1

    # Update data (shared logic)
    changed_episodes = upsert_episode_data(episodes_data, args.episode_date, payload)
    changed_gallery = upsert_gallery_item(gallery_data, payload, args.episode_date)

    if not changed_episodes and not changed_gallery:
        print("✓ No changes detected")
        return 0

    # Publish via backend
    result = backend.publish(episodes_data, gallery_data, args.dry_run)

    # Print result
    if result["status"] == "success":
        print(f"✓ {result['message']}")
        if "pushed" in result and result["pushed"]:
            print("  Git changes committed and pushed")
    elif result["status"] == "error":
        print(f"✗ {result['message']}", file=sys.stderr)
        return 1
    elif result["status"] == "dry_run":
        print(f"[DRY RUN] {result['message']}")
        if changed_episodes:
            print("  Would update: cronjob-episodes.json")
        if changed_gallery:
            print("  Would update: gallery.json")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
