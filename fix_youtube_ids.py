#!/usr/bin/env python3
"""
Script to fix YouTube video IDs in episodes.json using yt-dlp
Extracts correct video IDs from the playlists listed in README.md
"""

import json
import subprocess
import sys
from pathlib import Path

# Playlist URLs from README.md
PLAYLISTS = {
    'en': 'https://www.youtube.com/playlist?list=PLp5K4ceh2pR0hfdu4bUoNKCeqYm0n78Xx',
    'ch': 'https://www.youtube.com/playlist?list=PLp5K4ceh2pR3EsXoR4E9s8mRVE_ywioJS',
    'ko': 'https://www.youtube.com/playlist?list=PLp5K4ceh2pR3cIS4AEN3UDxoiVrR9J1JB'
}

def get_playlist_videos(playlist_url):
    """Extract video info from YouTube playlist using yt-dlp"""
    try:
        cmd = ['yt-dlp', '--flat-playlist', '-J', playlist_url]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        data = json.loads(result.stdout)
        
        videos = []
        for entry in data.get('entries', []):
            if entry and entry.get('id'):
                videos.append({
                    'id': entry['id'],
                    'title': entry.get('title', ''),
                    'url': f"https://www.youtube.com/watch?v={entry['id']}"
                })
        
        return videos
    except subprocess.CalledProcessError as e:
        print(f"Error extracting playlist {playlist_url}: {e}")
        return []
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON for {playlist_url}: {e}")
        return []

def match_videos_to_episodes(videos, episodes_data):
    """Match videos to episodes based on date patterns in title"""
    updated_count = 0
    
    for video in videos:
        title = video['title']
        
        # Try to extract date from title (looking for YYYY-MM-DD pattern)
        import re
        date_match = re.search(r'(\d{4}-\d{2}-\d{2})', title)
        
        if date_match:
            date = date_match.group(1)
            
            # Check if this date exists in episodes
            if date in episodes_data:
                print(f"Found match for {date}: {title}")
                # Update the video info
                episodes_data[date]['id'] = video['id']
                episodes_data[date]['url'] = video['url']
                updated_count += 1
            else:
                print(f"No episode found for date {date} in title: {title}")
        else:
            print(f"No date pattern found in title: {title}")
    
    return updated_count

def main():
    # Check if yt-dlp is available
    try:
        subprocess.run(['yt-dlp', '--version'], capture_output=True, check=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("Error: yt-dlp is not installed or not in PATH")
        print("Install with: pip install yt-dlp")
        sys.exit(1)
    
    # Load current episodes.json
    episodes_file = Path('episodes.json')
    if not episodes_file.exists():
        print("Error: episodes.json not found")
        sys.exit(1)
    
    with open(episodes_file, 'r', encoding='utf-8') as f:
        episodes_data = json.load(f)
    
    print(f"Loaded {len(episodes_data)} episodes")
    
    # Extract videos from each playlist
    all_videos = {}
    for lang, playlist_url in PLAYLISTS.items():
        print(f"\\nExtracting videos from {lang} playlist...")
        videos = get_playlist_videos(playlist_url)
        all_videos[lang] = videos
        print(f"Found {len(videos)} videos in {lang} playlist")
    
    # Update episodes for each language
    total_updated = 0
    for lang, videos in all_videos.items():
        print(f"\\nUpdating {lang} episodes...")
        
        # Create a temporary structure for this language
        lang_episodes = {}
        for date, episode_data in episodes_data.items():
            if lang in episode_data:
                lang_episodes[date] = episode_data[lang]
        
        updated_count = match_videos_to_episodes(videos, lang_episodes)
        
        # Update the main episodes data
        for date, updated_episode in lang_episodes.items():
            if date in episodes_data and lang in episodes_data[date]:
                episodes_data[date][lang].update(updated_episode)
        
        total_updated += updated_count
        print(f"Updated {updated_count} episodes for {lang}")
    
    # Save updated episodes.json
    if total_updated > 0:
        backup_file = episodes_file.with_suffix('.json.backup')
        print(f"\\nCreating backup: {backup_file}")
        
        with open(backup_file, 'w', encoding='utf-8') as f:
            json.dump(episodes_data, f, indent=2, ensure_ascii=False)
        
        with open(episodes_file, 'w', encoding='utf-8') as f:
            json.dump(episodes_data, f, indent=2, ensure_ascii=False)
        
        print(f"\\nUpdated {total_updated} total episodes")
        print(f"episodes.json has been updated!")
    else:
        print("\\nNo episodes were updated")

if __name__ == '__main__':
    main()