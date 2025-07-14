# Automated Publishing System

## Table of Contents
1. Scene Setup  
2. Single-Episode Workflow  
3. Batch Publishing Workflow  
4. Script-by-Script Reference  
5. Reliability: Retry / Throttling / Polling  
6. Extending & Customising  
7. Progress vs Issue #55

---

## 1. Scene Setup (one-time)

| Needed | Component | Place it on… | Notes |
| ------ | --------- | ------------ | ----- |
| ✔ | `PublishingManager` | Any GameObject | Core coordinator |
| ✔ | `YoutubeUploader` | Same / child | Needs *client_secrets.json* in StreamingAssets |
| ✔ | `DiscordPoster` | Same / child | Uses webhook from `ShowGeneratorApiKeys` |
| ✔ | `TwitterPoster` | Same / child | Uses Twitter creds in `ShowGeneratorApiKeys` |
| opt | `BatchPublisher` | Same / child | Runs many metadata files in sequence |

1. Drag poster components into **PublishingManager → Core Components**.  
2. Ensure a **ShowGeneratorApiKeys** asset exists.  
   * Either drag it onto each poster **or** add **ShowGeneratorApiKeysBroadcaster** once in the scene.  
3. Save the scene/prefab.

---

## 2. Single-Episode Workflow

| Step | Action | Result |
| ---- | ------ | ------ |
| 1 | Drag `*_youtube_metadata.json` into **PublishingManager → Metadata JSON** | YoutubeUploader auto-fills (file path, title, description, tags, thumbnail) – Discord duration & topics preview update |
| 2 | Choose **Discord Template** & **Tweet Template** | `default` / `title_url` → simple `Title URL` <br> other keys come from `Assets/Resources/Templates/MessageTemplates.json` |
| 3 | *(Optional)* enable **Use Custom Message / Tweet** in posters | Overrides beat templates |
| 4 | Click **Preview Final Messages** | Displays Discord title & tweet text <br> Writes them into poster components' *LastPayloadPreview* fields |
| 5 | Press **Start Upload + Distribute** | ▶ Uploads to YouTube → gets `videoId` <br> ▶ Posts Discord embed (thumbnail if set) <br> ▶ Posts tweet (media upload coming) <br> ▶ Fires `StartPublishing` & `PublishingCompleted` events |

---

## 3. Batch Publishing Workflow

```csharp
public class MyBatchStarter : MonoBehaviour
{
    public BatchPublisher batch;          // drag component
    public List<TextAsset> files;         // metadata JSONs

    private void Awake()
    {
        batch.batchFiles = files;         // assign at runtime
    }
}
```

* `BatchPublisher` subscribes to `PublishingCompleted` and drives files one-by-one.
* Logs start / completion; stops after list is exhausted.

---

## 4. Script-by-Script Reference

### PublishingManager
* Coordinates the whole flow.
* Key Inspector fields: Metadata JSON, Template keys, Platform toggles.
* Events: `StartPublishing(TextAsset)` and `PublishingCompleted(TextAsset, bool success)`.
* Method `PopulateFieldsFromMetadata()` parses JSON and fills out other scripts.

### YoutubeUploader
* Handles OAuth2 + resumable upload via Google library.
* Exposes progress and `UploadVideoWithDetails()` method.

### DiscordPoster
* Sends a single webhook embed.  
* Inspector: footer labels, **Use Custom Message**, *lastPayloadPreview*.
* Retry: 3 attempts, linear back-off, respects 429 `retry_after`.

### TwitterPoster
* Posts tweet (media upload stub ready).  
* Inspector: tweet prefix, **Use Custom Tweet**, *lastTweetPreview*.
* Same retry helper pattern.

### BatchPublisher
* Feeds a list of metadata files into PublishingManager sequentially.

### TemplateManager
* Loads `Resources/Templates/MessageTemplates.json` and replaces tokens `{title}` `{url}`.  
* Default keys provided: `title_url`, `daily_episode`, `market_special`, `interview`.

---

## 5. Reliability – Retry / Throttling / Polling

| Aspect | Implementation |
| ------ | -------------- |
| Retry | Local helper in each poster (3 attempts, 2-4-6 s back-off) |
| Discord 429 | Waits `retry_after` then retries |
| Twitter 429 | Helper ready – detection will be added for media/upload and tweets |
| Sequential batch | Only one upload at a time – avoids quota collisions |
| Events | External code can wait on `PublishingCompleted` to queue next job |
| Logging | Uses `Debug.Log/Warning/Error`; can be redirected via custom `ILogHandler` |

*Optional YouTube processing poll*
```csharp
await WaitUntilProcessed(videoId); // implement with Videos.list API
```

---

## 6. Extending & Customising

* **Multiple Discord channels** – add extra DiscordPoster components each with its own webhook.
* **Parallel batches** – create multiple PublishingManagers or add a semaphore to BatchPublisher.
* **Custom logging** – implement Unity's `ILogHandler` or write to file/Discord.
* **More template tokens** – just add keys in `MessageTemplates.json` and supply via token map in PublishingManager. 

---

## 7. Progress vs Issue #55

### What's Implemented ✔️
| Requirement from Issue #55 | Status | Notes |
|----------------------------|--------|-------|
| Auto-upload to YouTube | ✔ | `YoutubeUploader` handles resumable upload and thumbnail set. |
| Auto-post to Discord after upload | ✔ | `PublishingManager` calls `DiscordPoster` once a `videoId` is obtained. Embed contains title + URL + optional thumbnail. Retries & 429 back-off implemented. |
| Auto-post to Twitter after upload | ✔ (basic) | Sends tweet with title + URL. Custom text & prefix supported. Local retry helper in place. Media upload stub exists (thumbnail attach to be finalised). |
| Configurable message templates | ✔ | `MessageTemplates.json` with default and custom keys (`title_url`, `daily_episode`, etc.). |
| Per-episode custom override | ✔ | Toggles in each poster for one-off text changes. |
| Batch processing | ✔ | `BatchPublisher` feeds multiple metadata files sequentially; fires events. |
| Events / logging | ✔ | `StartPublishing` & `PublishingCompleted` events; extensive `Debug.Log`. |
| Retry / rate-limit handling | ✔ | 3 attempts with back-off in both posters; Discord respects `retry_after`. |

### Still To-Do / Improvements 🛠
1. **Twitter Media Upload**  
   Implement v1.1 `media/upload` so thumbnail image stands out in tweets; handle 429 rate-limit headers.
2. **YouTube Processing Poll (Nice-to-have)**  
   Optionally poll `Videos.list` until `processingStatus==succeeded` before posting to social platforms.
3. **Additional Fields in Discord Embed**  
   Description, duration, topics can be re-enabled via templates if richer embed is desired.
4. **Structured Logging**  
   Swap `Debug.Log` for a pluggable `ILogSink` to write to disk or send to Slack/Discord channel.
5. **Parallel Throttling**  
   Current batch is serial. If future workflows require concurrency, add semaphore limits & queue.
6. **Analytics / A-B testing hooks**  
   Capture tweet/Discord message IDs and feed into analytics service for engagement tracking.
7. **Additional Platforms**  
   Framework is modular; LinkedIn/Reddit posters can follow the same `RunWithRetry` pattern.

> **Summary**: Core automation (YouTube → Discord → Twitter) is functional with retry and batch support. Remaining work focuses on media-rich tweets, optional processing wait, and advanced logging/analytics. 