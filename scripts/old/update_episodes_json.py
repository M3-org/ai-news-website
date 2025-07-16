import os
import json
import argparse
import glob
import subprocess

LANGS = ['en', 'ch', 'ko']

parser = argparse.ArgumentParser(description='Update episodes.json with latest YouTube video info.')
parser.add_argument('--episode-date', required=True, help='Episode date (YYYY-MM-DD)')
parser.add_argument('--push', action='store_true', help='If set, commit and push the updated episodes.json')
args = parser.parse_args()

episode_date = args.episode_date
meta_dir = f'Episodes/{episode_date}/metadata'

if not os.path.isdir(meta_dir):
    print(f"Metadata directory not found: {meta_dir}")
    exit(1)

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

if args.push:
    # Commit and push the updated episodes.json
    subprocess.run(['git', 'config', '--global', 'user.email', 'github-actions[bot]@users.noreply.github.com'])
    subprocess.run(['git', 'config', '--global', 'user.name', 'github-actions[bot]'])
    subprocess.run(['git', 'add', episodes_path])
    subprocess.run(['git', 'commit', '-m', f'Update episodes.json for {episode_date} [CI]'], check=False)
    subprocess.run(['git', 'push'], check=False) 