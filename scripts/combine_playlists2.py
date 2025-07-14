import json
import re

def extract_youtube_id(url):
    if not url:
        return None
    # Match standard, short, and embed URLs
    patterns = [
        r"v=([\w-]{11})",
        r"youtu\.be/([\w-]{11})",
        r"embed/([\w-]{11})"
    ]
    for pat in patterns:
        m = re.search(pat, url)
        if m:
            return m.group(1)
    return None

def update_episodes_json(path='episodes.json'):
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    updated = 0
    for date, langs in data.items():
        for lang, ep in langs.items():
            vid = ep.get('id', '')
            url = ep.get('url', '')
            if not vid or len(vid) != 11:
                new_id = extract_youtube_id(url)
                if new_id:
                    ep['id'] = new_id
                    updated += 1
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Updated {updated} episode entries with YouTube IDs.")

if __name__ == '__main__':
    update_episodes_json() 