#!/bin/bash

# Simple local daily upload script
set -euo pipefail

# Configuration
REMOTE_HOST="news.clanktank.tv"
REMOTE_USER="uploader"
EPISODES_PATH="/home/uploader/news"

# Get episode date (default to yesterday)
EPISODE_DATE="${1:-$(date -d 'yesterday' '+%Y-%m-%d')}"

echo "=== Processing episode $EPISODE_DATE ==="

# Change to repo directory
cd /home/jin/repo/ai-news-website

# Download episode to zips folder
echo "Downloading episode..."
mkdir -p zips
scp -i ~/.ssh/id_ed25519_cron -o StrictHostKeyChecking=no -o IdentitiesOnly=yes $REMOTE_USER@$REMOTE_HOST:$EPISODES_PATH/${EPISODE_DATE}.zip zips/

# Extract episode
echo "Extracting episode..."
unzip -q zips/${EPISODE_DATE}.zip -d Episodes/${EPISODE_DATE}/

# Set up conda environment
export PATH="/home/jin/miniconda3/bin:$PATH"
source ~/miniconda3/etc/profile.d/conda.sh
conda activate base

# Upload each language to YouTube
for lang in ch ko en; do
    METADATA_FILE="Episodes/${EPISODE_DATE}/metadata/aipodcast_${EPISODE_DATE}_youtube_metadata_${lang}.json"
    
    if [[ ! -f "$METADATA_FILE" ]]; then
        echo "Skipping $lang - metadata not found"
        continue
    fi
    
    echo "Uploading $lang version..."
    python3 upload_to_youtube.py --from-json "$METADATA_FILE"
done

# Update website files
echo "Updating website..."
python3 scripts/update_website.py --episode-date "$EPISODE_DATE"

# Commit and push
echo "Committing changes..."
git add episodes.json "Episodes/${EPISODE_DATE}/"
git commit -m "automated update site" || echo "No changes to commit"
git push

echo "✅ Episode $EPISODE_DATE completed!"
