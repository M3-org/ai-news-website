#!/usr/bin/env python3

import os
import json
import argparse
import glob
import subprocess
import re
from datetime import datetime

LANGS = ['en', 'ch', 'ko']

def extract_youtube_id(url):
    """Extract YouTube video ID from a standard YouTube URL."""
    if not url:
        return None
    # Handles URLs like https://www.youtube.com/watch?v=VIDEO_ID
    if 'v=' in url:
        return url.split('v=')[1].split('&')[0]
    # Handles URLs like https://youtu.be/VIDEO_ID
    if 'youtu.be/' in url:
        return url.split('youtu.be/')[1].split('?')[0]
    return None

def update_episodes_json(episode_date):
    """Update episodes.json with latest YouTube video info."""
    meta_dir = f'Episodes/{episode_date}/metadata'
    
    if not os.path.isdir(meta_dir):
        print(f"Metadata directory not found: {meta_dir}")
        return False
    
    # Load or create episodes.json
    episodes_path = 'episodes.json'
    if os.path.exists(episodes_path):
        with open(episodes_path, 'r', encoding='utf-8') as f:
            episodes = json.load(f)
    else:
        episodes = {}
    
    if episode_date not in episodes:
        episodes[episode_date] = {}
    
    # Normalize all episodes to ensure id and url consistency
    for date, langs in episodes.items():
        for lang, ep in langs.items():
            video_id = ep.get('id')
            url = ep.get('url')
            # If only url is present, extract id
            if not video_id and url:
                video_id = extract_youtube_id(url)
                ep['id'] = video_id
            # If only id is present, generate url
            if video_id and not url:
                ep['url'] = f'https://www.youtube.com/watch?v={video_id}'
            # If both are present but inconsistent, fix
            if video_id and url:
                extracted_id = extract_youtube_id(url)
                if extracted_id and extracted_id != video_id:
                    # Prefer the id field, regenerate url
                    ep['url'] = f'https://www.youtube.com/watch?v={video_id}'
            # If both are missing, skip (or optionally warn)
            if not ep.get('id') and not ep.get('url'):
                print(f"Warning: Episode {date} [{lang}] missing both id and url.")
    
    # Process current episode
    for lang in LANGS:
        meta_pattern = os.path.join(meta_dir, f'*_youtube_metadata_{lang}.json')
        files = glob.glob(meta_pattern)
        print(f"Looking for: {meta_pattern} -> Found: {files}")  # DEBUG
        if not files:
            continue
        meta_file = files[0]
        with open(meta_file, 'r', encoding='utf-8') as f:
            meta = json.load(f)
        # Flatten if needed
        if 'episode_metadata' in meta:
            meta = meta['episode_metadata']
        # Extract info
        video_id = meta.get('video_id') or meta.get('id')
        title = meta.get('title', '')
        description = meta.get('description', '')
        # Try to find thumbnail
        thumb_path = f'Episodes/{episode_date}/thumbnail/thumbnail_{lang}.jpg'
        thumbnail = thumb_path if os.path.exists(thumb_path) else ''
        url = f'https://www.youtube.com/watch?v={video_id}' if video_id else ''
        episodes[episode_date][lang] = {
            'title': title,
            'description': description,
            'thumbnail': thumbnail,
            'id': video_id,
            'url': url
        }
    
    with open(episodes_path, 'w', encoding='utf-8') as f:
        json.dump(episodes, f, ensure_ascii=False, indent=2)
    print(f"Updated {episodes_path} for {episode_date}.")
    return True

def get_latest_episodes(episodes_data, count=5):
    """Get the latest N episodes sorted by date."""
    if not episodes_data:
        return []
    
    # Sort episodes by date (newest first)
    sorted_episodes = sorted(episodes_data.items(), key=lambda x: x[0], reverse=True)
    return sorted_episodes[:count]

def format_episode_html(date, episode_data):
    """Format episode data into HTML."""
    # Default to English if available, otherwise first available language
    languages = ['en', 'ch', 'ko']
    episode_info = None
    
    for lang in languages:
        if lang in episode_data:
            episode_info = episode_data[lang]
            break
    
    if not episode_info:
        return ""
    
    title = episode_info.get('title', f'Episode {date}')
    video_id = episode_info.get('id', '')
    thumbnail = episode_info.get('thumbnail', f'Episodes/{date}/thumbnail/thumbnail_en.jpg')
    
    # Format date for display
    try:
        date_obj = datetime.strptime(date, '%Y-%m-%d')
        formatted_date = date_obj.strftime('%B %d, %Y')
    except ValueError:
        formatted_date = date
    
    html = f"""
    <div class="episode-card">
        <div class="episode-thumbnail">
            <img src="{thumbnail}" alt="{title}" loading="lazy">
            {f'<a href="https://www.youtube.com/watch?v={video_id}" target="_blank" class="play-button">▶</a>' if video_id else ''}
        </div>
        <div class="episode-info">
            <h3>{title}</h3>
            <p class="episode-date">{formatted_date}</p>
            <div class="episode-languages">
    """
    
    # Add language links
    for lang in languages:
        if lang in episode_data and episode_data[lang].get('id'):
            lang_names = {'en': 'English', 'ch': '中文', 'ko': '한국어'}
            video_id = episode_data[lang]['id']
            html += f'<a href="https://www.youtube.com/watch?v={video_id}" target="_blank">{lang_names[lang]}</a>'
    
    html += """
            </div>
        </div>
    </div>
    """
    
    return html

def update_index_html(episodes_data, episode_date=None):
    """Update index.html with latest episodes."""
    if not os.path.exists('index.html'):
        print("ERROR: index.html not found")
        return False
    
    # Read current index.html
    with open('index.html', 'r') as f:
        content = f.read()
    
    # Get latest episodes
    latest_episodes = get_latest_episodes(episodes_data, 5)
    
    if not latest_episodes:
        print("No episodes found to display")
        return False
    
    # Generate episodes HTML
    episodes_html = ""
    for date, episode_data in latest_episodes:
        episodes_html += format_episode_html(date, episode_data)
    
    # Update the episodes section in index.html
    # Look for a section with id="episodes" or similar
    pattern = r'(<div[^>]*id=["\']episodes["\'][^>]*>)(.*?)(</div>)'
    replacement = f'\\1\n{episodes_html}\n\\3'
    
    if re.search(pattern, content, re.DOTALL):
        content = re.sub(pattern, replacement, content, flags=re.DOTALL)
    else:
        # If no episodes section found, add one before closing body
        episodes_section = f"""
<div id="episodes" class="episodes-section">
    <h2>Latest Episodes</h2>
{episodes_html}
</div>
"""
        content = content.replace('</body>', f'{episodes_section}\n</body>')
    
    # Write updated content
    with open('index.html', 'w') as f:
        f.write(content)
    
    print(f"Updated index.html with {len(latest_episodes)} episodes")
    return True

def main():
    parser = argparse.ArgumentParser(description='Update website files with latest episodes')
    parser.add_argument('--episode-date', required=True, help='Episode date (YYYY-MM-DD)')
    parser.add_argument('--push', action='store_true', help='If set, commit and push the updated files')
    parser.add_argument('--update-index', action='store_true', help='Also update index.html')
    
    args = parser.parse_args()
    
    # Update episodes.json
    if not update_episodes_json(args.episode_date):
        print("Failed to update episodes.json")
        return 1
    
    # Update index.html if requested
    if args.update_index:
        # Load episodes data for index update
        with open('episodes.json', 'r', encoding='utf-8') as f:
            episodes_data = json.load(f)
        
        if not update_index_html(episodes_data, args.episode_date):
            print("Failed to update index.html")
            return 1
    
    # Commit and push if requested
    if args.push:
        subprocess.run(['git', 'config', '--global', 'user.email', 'github-actions[bot]@users.noreply.github.com'])
        subprocess.run(['git', 'config', '--global', 'user.name', 'github-actions[bot]'])
        subprocess.run(['git', 'add', 'episodes.json'])
        if args.update_index:
            subprocess.run(['git', 'add', 'index.html'])
        subprocess.run(['git', 'commit', '-m', f'Update website for {args.episode_date} [CI]'], check=False)
        subprocess.run(['git', 'push'], check=False)
    
    print("Website update completed successfully")
    return 0

if __name__ == "__main__":
    exit(main())