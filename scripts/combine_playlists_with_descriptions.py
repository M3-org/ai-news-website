import os
import json
import re
from collections import defaultdict

episodes_dir = 'Episodes'
output_file = 'episodes.json'
languages = {'en': 'english', 'ch': 'chinese', 'ko': 'korean'}
lang_suffix = {'en': '_en', 'ch': '_ch', 'ko': '_ko'}

result = defaultdict(dict)

def get_metadata_path(date, lang):
    # New scheme
    new_path = os.path.join(
        episodes_dir, date, 'metadata', f'aipodcast_{date}_youtube_metadata{lang_suffix[lang]}.json')
    if os.path.exists(new_path):
        return new_path
    # Old scheme (English only)
    if lang == 'en':
        old_path = os.path.join(
            episodes_dir, date, 'metadata', f'aipodcast_{date}_youtube_metadata.json')
        if os.path.exists(old_path):
            return old_path
    return None

def extract_info(meta, lang):
    # Try to get YouTube ID from url or video_file or playlist_id
    # Fallback to None if not found
    url = None
    yt_id = None
    if 'video_file' in meta:
        # Try to extract ID from video_file path
        m = re.search(r'/([\w-]{11})[_.]', meta['video_file'])
        if m:
            yt_id = m.group(1)
    if 'url' in meta:
        url = meta['url']
        m = re.search(r'v=([\w-]{11})', url)
        if m:
            yt_id = m.group(1)
    # If not found, try playlist_id (not ideal)
    if not yt_id and 'playlist_id' in meta:
        yt_id = meta['playlist_id']
    # Compose YouTube URL if missing
    if not url and yt_id:
        url = f'https://www.youtube.com/watch?v={yt_id}'
    # Thumbnail: prefer thumbnail_file, else None
    thumb = None
    if 'thumbnail_file' in meta:
        thumb = meta['thumbnail_file']
    elif 'thumbnail' in meta:
        thumb = meta['thumbnail']
    return {
        'id': yt_id,
        'url': url,
        'title': meta.get('title'),
        'description': meta.get('description'),
        'thumbnail': thumb
    }

total_dates = 0
lang_counts = defaultdict(int)
for date in sorted(os.listdir(episodes_dir)):
    meta_dir = os.path.join(episodes_dir, date, 'metadata')
    if not os.path.isdir(meta_dir):
        continue
    found_any = False
    for lang in languages:
        meta_path = get_metadata_path(date, lang)
        if meta_path and os.path.exists(meta_path):
            with open(meta_path, encoding='utf-8') as f:
                meta = json.load(f)
            info = extract_info(meta, lang)
            result[date][lang] = info
            lang_counts[lang] += 1
            found_any = True
    if found_any:
        total_dates += 1

with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

print(f"Wrote {len(result)} dates to {output_file}")
for lang in languages:
    print(f"  {lang}: {lang_counts[lang]} episodes") 