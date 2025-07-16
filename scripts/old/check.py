import json

with open('episodes.json', 'r', encoding='utf-8') as f:
    episodes = json.load(f)

for date, langs in episodes.items():
    for lang, ep in langs.items():
        if not ep.get('id') or not ep.get('url'):
            print(f"Missing id or url: {date} [{lang}]")
        elif f"https://www.youtube.com/watch?v={ep['id']}" != ep['url']:
            print(f"Inconsistent id/url: {date} [{lang}]")
