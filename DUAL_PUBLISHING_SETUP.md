# Dual Publishing Setup Guide

## Overview

The pipeline now supports **simultaneous publishing to both git (M3TV website) and FTP server**. This provides redundancy and allows for gradual migration between hosting methods.

## Quick Setup

### 1. Configure Both Backends in `.env`

```bash
# Git backend (M3TV website repo)
WEBSITE_REPO=/home/jin/repo/website

# FTP backend (direct server upload)
FTP_HOST=ftp.example.com
FTP_USER=your_username
FTP_PASSWORD=your_password
FTP_REMOTE_PATH=/public_html/m3org/tv

# Publish to both (space-separated)
PUBLISH_TARGETS="m3tv ftp"
```

### 2. Git Credentials Setup (Required for Cronjob)

Your cronjob already handles git commits successfully. The script automatically configures:
- `git config user.email "github-actions[bot]@users.noreply.github.com"`
- `git config user.name "github-actions[bot]"`

**Ensure git credentials are configured** for the cron user:

```bash
# Option A: SSH key (recommended for automated pushes)
# Your existing SSH key should already work if you can push manually
ssh -T git@github.com  # Test it works

# Option B: Git credential cache (if using HTTPS)
git config --global credential.helper store
git push  # Enter credentials once, then cached
```

### 3. Test Dual Publishing

```bash
# Dry-run test (safe, no actual changes)
PUBLISH_TARGETS="m3tv ftp" ./scripts/run_pipeline.sh --dry-run --from-step=8

# Manual test with real data
uv run python scripts/publish.py --episode-date=2026-02-09 --target=m3tv --push
uv run python scripts/publish.py --episode-date=2026-02-09 --target=ftp
```

### 4. Enable in Cron Job

Your existing cron job will automatically use `PUBLISH_TARGETS` from `.env`:

```crontab
15 2 * * 0 cd /path/to/ai-news-website && ./scripts/run_pipeline.sh >> logs/pipeline.log 2>&1
```

No changes needed! Just set `PUBLISH_TARGETS="m3tv ftp"` in `.env`.

## How It Works

### Sequential Publishing

The pipeline publishes to each target **sequentially** (not parallel):

```
Step 8: Update Website
├─ Publish to m3tv (git)
│  ├─ Load existing data from website repo
│  ├─ Merge episode data
│  ├─ Commit changes
│  └─ Push to GitHub
│
└─ Publish to ftp (FTPS)
   ├─ Connect to FTP server
   ├─ Download existing JSON files
   ├─ Merge episode data
   ├─ Upload atomically (temp file + rename)
   └─ Disconnect
```

**If one target fails, the other still completes.** The pipeline returns an error code if any target fails, but continues publishing to remaining targets.

### Resilience

- **Git push fails?** FTP still publishes ✓
- **FTP connection fails?** Git still publishes ✓
- **Both succeed?** Pipeline continues to step 9 (notifications) ✓

## Cronjob vs Tmux While Loop

### ✅ Cronjob (Recommended - Current Setup)

**Pros:**
- ✅ Automatic restart after reboot
- ✅ System-managed, reliable scheduling
- ✅ Standard logging to files
- ✅ Already working with git commits
- ✅ No manual intervention needed

**Cons:**
- ❌ Limited environment (but we handle this with `.env`)

### ❌ Tmux While Loop (Not Recommended)

```bash
# Example tmux loop (not recommended)
while true; do
    ./scripts/run_pipeline.sh
    sleep 604800  # 1 week
done
```

**Cons:**
- ❌ Dies on server reboot (must manually restart)
- ❌ Tmux session can crash/hang
- ❌ No standard logging
- ❌ Harder to monitor/debug
- ❌ Manual management required

**The only reason to use tmux would be if:**
- Your cron user can't push to git (but it already can!)
- You need interactive prompts (but automated scripts don't)

**Verdict: Stick with cron.** It's already working and is more reliable.

## Git Commits in Cronjob - Yes, It Works!

Your current setup **already does git commits and pushes in cron**. The script handles it automatically:

1. **Git user configuration** - Script sets user.email and user.name
2. **SSH authentication** - Uses your existing SSH key
3. **Non-interactive push** - No TTY required for automated pushes

**Proof:** Your existing `publish_m3tv.py` has been doing this successfully. The new `publish.py` uses identical git logic.

## Testing Checklist

### Pre-Production Testing

- [x] Dry-run both targets individually
- [x] Verify git backend works (already proven)
- [ ] Test FTP connection manually
- [ ] Run full pipeline in dry-run mode
- [ ] Check logs for any errors

### Commands

```bash
# Test git backend (should work - already used in production)
uv run python scripts/publish.py --episode-date=2026-02-09 --target=m3tv --dry-run

# Test FTP connection (requires credentials in .env)
uv run python scripts/publish.py --episode-date=2026-02-09 --target=ftp --dry-run

# Test full pipeline with dual publishing
PUBLISH_TARGETS="m3tv ftp" ./scripts/run_pipeline.sh --dry-run --from-step=8

# Real test (when ready)
PUBLISH_TARGETS="m3tv ftp" ./scripts/run_pipeline.sh --from-step=8
```

## Production Deployment

### Step 1: Add FTP Credentials

```bash
# Edit .env
nano .env

# Add FTP configuration
FTP_HOST=ftp.example.com
FTP_USER=your_username
FTP_PASSWORD=your_password
FTP_REMOTE_PATH=/public_html/m3org/tv
```

### Step 2: Test FTP Connection

```bash
# Test with dry-run first
uv run python scripts/publish.py --episode-date=2026-02-09 --target=ftp --dry-run

# Test actual upload
uv run python scripts/publish.py --episode-date=2026-02-09 --target=ftp

# Verify files on FTP server
curl https://m3org.com/tv/cronjob-episodes.json
curl https://m3org.com/tv/gallery.json
```

### Step 3: Enable Dual Publishing

```bash
# Edit .env
nano .env

# Set dual targets
PUBLISH_TARGETS="m3tv ftp"

# Save and exit
```

### Step 4: Monitor Next Cron Run

```bash
# Watch the log live (next Sunday 02:15 UTC)
tail -f logs/pipeline_$(date +%Y-%m-%d).log

# Or check afterward
less logs/pipeline_2026-02-16.log

# Look for:
# "Publishing to: m3tv ftp"
# "✓ Published to m3tv"
# "✓ Published to ftp"
```

## Troubleshooting

### Git Push Fails

```bash
# Check SSH key works
ssh -T git@github.com

# Check repo is clean
cd /home/jin/repo/website
git status
git pull

# Test push manually
git commit --allow-empty -m "test"
git push
```

### FTP Connection Fails

```bash
# Test FTP connection with CLI
ftp ftp.example.com
# Enter username and password

# Or use Python
python3 -c "
import ftplib
ftp = ftplib.FTP_TLS('ftp.example.com')
ftp.login('your_user', 'your_pass')
ftp.cwd('/public_html/m3org/tv')
print(ftp.nlst())
ftp.quit()
"
```

### Both Fail

```bash
# Check .env is loaded
grep PUBLISH_TARGETS .env

# Check script works
uv run python scripts/publish.py --help

# Run with debug
set -x
./scripts/run_pipeline.sh --dry-run --from-step=8
set +x
```

## Monitoring

### Check Last Publish Status

```bash
# Check latest episode in git repo
cat /home/jin/repo/website/tv/data/cronjob-episodes.json | jq 'keys | sort | last'

# Check latest episode on FTP
curl -s https://m3org.com/tv/cronjob-episodes.json | jq 'keys | sort | last'

# Should match!
```

### Pipeline Logs

```bash
# View latest pipeline log
ls -t logs/pipeline_*.log | head -1 | xargs less

# Search for publish status
grep "Published to" logs/pipeline_*.log | tail -5

# Check for errors
grep -i error logs/pipeline_*.log | tail -10
```

## Rollback Plan

If dual publishing causes issues:

```bash
# Quick fix: Disable FTP, keep git only
nano .env
# Change: PUBLISH_TARGETS=m3tv

# Or revert to old script
nano scripts/run_pipeline.sh
# Replace step 8:
# python3 scripts/publish_m3tv.py --episode-date="$date_str" --push
```

## Summary

✅ **Use cronjob** - Already working, no need for tmux
✅ **Git commits work** - Already proven in production
✅ **Dual publishing** - Set `PUBLISH_TARGETS="m3tv ftp"` in `.env`
✅ **Sequential, resilient** - One failure doesn't block the other
✅ **No code changes needed** - Just configure `.env`

The infrastructure is ready. Just add FTP credentials and enable dual publishing!
