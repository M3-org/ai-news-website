import json
import re
from collections import defaultdict

files = ['english.json', 'chinese.json', 'korean.json']
langs = ['en', 'ch', 'ko']
data = [json.load(open(f, encoding='utf-8')) for f in files]
episodes = defaultdict(dict)
date_re = re.compile(r'(\d{4}-\d{2}-\d{2})')

for i, lang in enumerate(langs):
    for entry in data[i]['entries']:
        m = date_re.match(entry['title'])
        if m:
            date = m.group(1)
            episodes[date][lang] = {
                'id': entry['id'],
                'url': entry['url'],
                'title': entry['title'],
                'description': entry.get('description'),
                'thumbnail': entry['thumbnails'][-1]['url'] if entry.get('thumbnails') else None
            }

with open('episodes.json', 'w', encoding='utf-8') as f:
    json.dump(episodes, f, ensure_ascii=False, indent=2) 