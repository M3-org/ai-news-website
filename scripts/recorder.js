/**
 * Shmotime Recorder v6
 *
 * Key improvements over v5:
 * 1. speak_start event handling for word-level timestamps from ElevenLabs TTS
 * 2. Word timestamps embedded directly in episode_data.scenes[].dialogue[].words[]
 * 3. No Gemini transcription needed - timestamps come from TTS timing data
 * 4. Perfect sync since timestamps are from actual audio playback
 *
 * speak_start event structure:
 * {
 *   number: 1,                     // Dialogue number (1-indexed)
 *   line: "Today on Retro...",     // Dialogue text
 *   actor: { id: "nick", title: "Nick", ... },
 *   duration: 10.03102,            // Line duration in seconds
 *   sceneNumber: 1,                // Scene number (1-indexed)
 *   timingData: {
 *     duration: 10.031,
 *     timestamps: [
 *       { character: "T", start: 0, end: 0.07 },
 *       { character: "o", start: 0.07, end: 0.163 },
 *       ...
 *     ]
 *   }
 * }
 */

const { launch, getStream, wss } = require('puppeteer-stream');
const path = require('path');
const fs = require('fs');
const os = require('os');

// ============================================================================
// Timing Constants
// ============================================================================

const TIMING = {
  SLATE_WAIT_MS: 60000,           // Max wait for slate/start button
  POST_RECORDING_BUFFER_MS: 3000,  // Buffer after completion before stopping
  MONITOR_INTERVAL_MS: 2000,       // Navigation monitor polling interval
  AUDIO_ENABLE_RETRY_MS: [1000, 3000], // Retry delays for audio enable
  STATUS_LOG_INTERVAL_MS: 30000,   // Status log interval during wait
  AUTO_COMPLETE_THRESHOLD_MS: 90000, // Auto-complete if no events after this
  EPISODE_LOOP_THRESHOLD_MS: 60000,  // Time before considering start screen as loop
  WAIT_DEFAULT_TIMEOUT_MS: 3600000,  // Default episode wait timeout (1 hour)
};

// Completion events that should trigger recording stop
const COMPLETION_EVENTS = ['end_ep', 'end_credits', 'end_postcredits', 'episode_end'];

// ============================================================================
// Recorder Class
// ============================================================================

class ShmotimeRecorder {
  constructor(options = {}) {
    // Selectors for UI elements
    this.SLATE_BUTTON_SELECTORS = [
      '.slate-ready',
      '.start-button',
      '[data-action="start"]',
      '#play-button',
      '#play-overlay',
      '.play-content-wrapper',
      'iframe',
    ];
    this.TEXT_BUTTON_SELECTORS_LOWERCASE = ['start', 'begin', 'play'];
    this.SLATE_CONTAINER_SELECTORS = [
      '.slate',
      '.slate-container',
      '.player-container',
      '.play-content-wrapper',
      'iframe',
    ];
    this.SLATE_WAIT_SELECTOR = '.slate-ready, .slate-loading, #play-button, #play-overlay, .play-content-wrapper, iframe';
    this.DIALOGUE_TEXT_SELECTORS = [
      '.now-playing-container[data-field="dialogue_line"] .now-playing-text',
      '.dialogue-text'
    ];

    this.options = {
      headless: false,
      record: true,
      verbose: true,
      outputDir: './episodes',
      waitTimeout: TIMING.SLATE_WAIT_MS,
      outputFormat: 'mp4',
      exportData: true,
      stopRecordingAt: 'end_credits',
      fixFrameRate: true,
      videoWidth: 1920,
      videoHeight: 1080,
      frameRate: 30,
      episodeData: null,
      muteAudio: false,
      filenameSuffix: '',
      dateOverride: '',
      baseName: '',
      ...options
    };

    this.browser = null;
    this.page = null;
    this.stream = null;
    this.outputFile = null;
    this.episodeInfo = null;
    this.navigationMonitor = null;
    this.endDetected = false;
    this.recordingStopped = false;
    this.showConfig = null;
    this.episodeData = null;
    this.eventTimeline = [];
    this.currentPhase = 'waiting';
    this.ffmpegPromise = null;
    this.recordingStartTime = null;

    // Dialogue tracking for embedded timestamps
    this.dialogueIndex = 0;
    this.currentSceneIndex = 0;
    this.currentDialogueInScene = 0;
    this.lastDialogueEndSec = 0;

    // Final video path (set after FFmpeg processing)
    this.finalVideoPath = null;
  }

  // ==========================================================================
  // Word-Level Timestamp Extraction (NEW in v6)
  // ==========================================================================

  /**
   * Convert character-level timestamps to word-level timestamps.
   *
   * Word boundaries (where new word starts):
   * - First character of line (if alphanumeric)
   * - First alphanumeric character after space
   * - First alphanumeric character after sentence punctuation (!?.:;)
   *
   * NOT word boundaries (keep as part of current word):
   * - Apostrophes within words: "Rockstar's" -> one word
   * - Hyphens within words: "neon-soaked" -> one word
   * - Colons after words: attached to previous word "Shat:"
   *
   * @param {Array<{character: string, start: number, end: number}>} characterTimestamps
   * @returns {Array<{word: string, start: number, end: number}>}
   */
  extractWordTimings(characterTimestamps) {
    if (!characterTimestamps || characterTimestamps.length === 0) {
      return [];
    }

    const words = [];
    let currentWord = null;

    for (let i = 0; i < characterTimestamps.length; i++) {
      const { character: char, start, end } = characterTimestamps[i];
      const prevChar = characterTimestamps[i - 1]?.character;

      const isAlphanumeric = /[a-zA-Z0-9]/.test(char);
      const isSpace = /\s/.test(char);
      const isSentencePunctuation = /[!?.:;]/.test(prevChar);
      const isPrevSpace = /\s/.test(prevChar);

      // New word starts when: alphanumeric AND (first char OR after space OR after sentence punctuation)
      const isWordStart = isAlphanumeric && (i === 0 || isPrevSpace || isSentencePunctuation);

      if (isWordStart) {
        // Finalize previous word
        if (currentWord) {
          words.push(currentWord);
        }
        // Start new word
        currentWord = { word: char, start, end };
      } else if (currentWord && !isSpace) {
        // Continue current word (includes apostrophes, hyphens, trailing punctuation)
        currentWord.word += char;
        currentWord.end = end;
      }
      // Spaces are skipped (not added to any word)
    }

    // Don't forget final word
    if (currentWord) {
      words.push(currentWord);
    }

    return words;
  }

  /**
   * Handle speak_start event with timing data.
   * This fires when audio STARTS PLAYING (not when loading begins).
   *
   * @param {object} eventData - speak_start event data
   */
  handleSpeakStart(eventData) {
    // Calculate video timestamp (recording base time + event fire time)
    const now = Date.now();
    const videoBaseSec = this.recordingStartTime
      ? (now - this.recordingStartTime) / 1000
      : 0;

    // Extract word timings from character data
    const wordTimings = this.extractWordTimings(eventData.timingData?.timestamps || []);

    // Convert relative timestamps to absolute video timestamps
    const words = wordTimings.map(w => ({
      word: w.word,
      start: videoBaseSec + w.start,
      end: videoBaseSec + w.end
    }));

    // Find dialogue in episode data and embed timestamps
    // Note: sceneNumber and number are 1-indexed from the event
    const sceneIdx = (eventData.sceneNumber || 1) - 1;
    const dialogueIdx = (eventData.number || 1) - 1;

    if (this.episodeData?.scenes?.[sceneIdx]?.dialogue?.[dialogueIdx]) {
      const dialogue = this.episodeData.scenes[sceneIdx].dialogue[dialogueIdx];

      // Embed timing data
      dialogue.startSec = videoBaseSec;
      dialogue.endSec = videoBaseSec + (eventData.duration || eventData.timingData?.duration || 0);
      dialogue.words = words;

      // Update scene timing
      const scene = this.episodeData.scenes[sceneIdx];
      if (!scene.startSec || videoBaseSec < scene.startSec) {
        scene.startSec = videoBaseSec;
      }
      scene.endSec = dialogue.endSec;
    }

    // Log event for debugging
    this.logEvent('speak_start', {
      sceneIndex: sceneIdx,
      dialogueIndex: dialogueIdx,
      line: (eventData.line || '').substring(0, 50),
      actor: eventData.actor?.id || eventData.actor,
      duration: eventData.duration,
      wordCount: words.length,
      videoBaseSec
    });
  }

  // ==========================================================================
  // Unified Event Logging
  // ==========================================================================

  /**
   * Log any event with automatic timestamp and metadata.
   * Unified replacement for captureEvent() and handleRecorderEvent().
   *
   * @param {string} type - Event type (e.g., 'recording_start', 'dialogue_start')
   * @param {object} data - Optional event data
   * @returns {object} The logged event
   */
  logEvent(type, data = null) {
    const now = Date.now();
    const ms = this.recordingStartTime ? now - this.recordingStartTime : 0;
    const sec = ms / 1000;
    const fps = this.options.frameRate || 30;
    const frame = Math.floor(sec * fps);

    const event = {
      type,
      timestamp: new Date(now).toISOString(),
      ms,
      sec,
      frame,
      fps,
      ...(data && { data })
    };

    this.eventTimeline.push(event);
    this.log(`Event: ${type} @ ${sec.toFixed(3)}s (frame ${frame})`);

    // Handle phase transitions and completion
    this.handlePhaseTransition(type, data);

    return event;
  }

  /**
   * Handle phase transitions and completion detection.
   * Simplified from v4's scattered logic.
   */
  handlePhaseTransition(eventType, eventData) {
    // Process show/episode data
    switch (eventType) {
      case 'load_show':
        if (eventData) this.processShowConfig(eventData);
        break;
      case 'load_episode':
        if (eventData) this.processEpisodeData(eventData);
        break;
      case 'start_intro':
        this.currentPhase = 'intro';
        break;
      case 'end_intro':
        this.currentPhase = 'waiting';
        break;
      case 'start_ep':
        this.currentPhase = 'episode';
        this.episodePlaybackStartTime = Date.now();
        break;
      case 'start_credits':
        this.currentPhase = 'credits';
        break;
      case 'end_credits':
        this.currentPhase = 'waiting';
        break;
      case 'start_postcredits':
        this.currentPhase = 'postcredits';
        break;
      case 'scene_loaded':
        // Update scene index and reset dialogue counter
        if (eventData?.sceneIndex !== undefined) {
          this.currentSceneIndex = eventData.sceneIndex;
          this.currentDialogueInScene = 0;
        }
        break;
    }

    // Completion detection - single state machine
    const isCompletionEvent = COMPLETION_EVENTS.includes(eventType);
    const isConfiguredStop = this.options.stopRecordingAt === eventType;

    if (isCompletionEvent || isConfiguredStop) {
      this.currentPhase = 'ended';
      this.endDetected = true;

      if (this.navigationMonitor) {
        clearInterval(this.navigationMonitor);
        this.navigationMonitor = null;
      }

      this.log(`*** Completion detected: ${eventType} ***`);
      this.log(`Adding ${TIMING.POST_RECORDING_BUFFER_MS}ms buffer before stopping...`);

      setTimeout(() => this.stopRecording(), TIMING.POST_RECORDING_BUFFER_MS);
    }
  }

  /**
   * Embed timestamp in episode data dialogue object.
   * Called when dialogue_start event is detected (fallback for non-speak_start events).
   */
  embedDialogueTimestamp(sec, sceneIndex, dialogueIndex) {
    if (!this.episodeData?.scenes) return;

    const scene = this.episodeData.scenes[sceneIndex];
    if (!scene?.dialogue) return;

    const dialogue = scene.dialogue[dialogueIndex];
    if (!dialogue) return;

    // Only set if not already set by speak_start
    if (dialogue.startSec === undefined) {
      dialogue.startSec = sec;
    }

    // Set end time for previous dialogue (if exists)
    if (dialogueIndex > 0) {
      const prevDialogue = scene.dialogue[dialogueIndex - 1];
      if (prevDialogue && !prevDialogue.endSec) {
        prevDialogue.endSec = sec;
      }
    } else if (sceneIndex > 0) {
      // First dialogue of new scene - close previous scene's last dialogue
      const prevScene = this.episodeData.scenes[sceneIndex - 1];
      if (prevScene?.dialogue?.length > 0) {
        const lastDialogue = prevScene.dialogue[prevScene.dialogue.length - 1];
        if (lastDialogue && !lastDialogue.endSec) {
          lastDialogue.endSec = sec;
        }
        // Also set scene end time
        if (!prevScene.endSec) {
          prevScene.endSec = sec;
        }
      }
    }

    // Set scene start time if first dialogue
    if (dialogueIndex === 0 && !scene.startSec) {
      scene.startSec = sec;
    }

    this.lastDialogueEndSec = sec;
  }

  // ==========================================================================
  // Frame and Path Utilities
  // ==========================================================================

  async getPlayableFrame() {
    const frames = this.page.frames();
    for (const frame of frames) {
      const url = frame.url();
      if (url.includes('stageshat') || url.includes('/stage')) {
        return frame;
      }
    }
    return this.page.mainFrame();
  }

  getChromePath() {
    const platform = os.platform();
    if (platform === 'win32') {
      return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    } else if (platform === 'darwin') {
      return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    } else if (platform === 'linux') {
      const possiblePaths = [
        '/snap/bin/chromium',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable'
      ];
      for (const chromePath of possiblePaths) {
        if (fs.existsSync(chromePath)) return chromePath;
      }
      return '/snap/bin/chromium';
    }
    return '';
  }

  getRecordingFilename(extension = 'webm') {
    return path.join(this.options.outputDir, `${this.options.baseName}.${extension}`);
  }

  // ==========================================================================
  // Data Processing
  // ==========================================================================

  processShowConfig(showConfig) {
    this.log('Processing show config...');
    // Keep full show config for posterity (included once, not repeated)
    this.showConfig = {
      id: showConfig.id || '',
      name: showConfig.title || showConfig.name || '',
      description: showConfig.description || '',
      creator: showConfig.creator || '',
      image: showConfig.image || '',
      actors: {},
      locations: {}
    };

    if (showConfig.actors) {
      Object.keys(showConfig.actors).forEach(actorId => {
        const actor = showConfig.actors[actorId];
        this.showConfig.actors[actorId] = {
          name: actor.title || actor.name || actorId,
          description: actor.description || '',
          image: actor.image || ''
        };
      });
    }

    if (showConfig.locations) {
      Object.keys(showConfig.locations).forEach(locationId => {
        const location = showConfig.locations[locationId];
        this.showConfig.locations[locationId] = {
          name: location.title || location.name || locationId,
          description: location.description || '',
          image: location.image || ''
        };
      });
    }

    this.log(`Show config: ${Object.keys(this.showConfig.actors).length} actors, ${Object.keys(this.showConfig.locations).length} locations`);
  }

  processEpisodeData(episodeData) {
    this.log('Processing episode data...');

    // IMPROVEMENT: Populate name from episodeData (was empty in v4)
    const episodeName = episodeData.name || episodeData.title || '';

    this.episodeData = {
      id: episodeData.id || '',
      name: episodeName,
      image: episodeData.image || false,
      image_thumb: episodeData.image_thumb || false,
      premise: episodeData.premise || '',
      scenes: []
    };

    if (episodeData.scenes && Array.isArray(episodeData.scenes)) {
      this.episodeData.scenes = episodeData.scenes.map((scene, sceneIdx) => ({
        number: scene.number || sceneIdx + 1,
        description: scene.description || '',
        location: scene.location || '',
        transitionIn: scene.transitionIn || '',
        transitionOut: scene.transitionOut || '',
        cast: {
          center_pod: scene.cast?.center_pod || undefined,
          east_pod: scene.cast?.east_pod || undefined,
          north_pod: scene.cast?.north_pod || undefined,
          south_pod: scene.cast?.south_pod || undefined,
          west_pod: scene.cast?.west_pod || undefined
        },
        // Scene-level timing (populated during recording)
        startSec: undefined,
        endSec: undefined,
        dialogue: (scene.dialogue || []).map((dialogue, dialogueIdx) => ({
          number: dialogue.number || dialogueIdx + 1,
          action: dialogue.action || '',
          line: dialogue.line || '',
          actor: dialogue.actor || '',
          // Dialogue-level timing (populated during recording)
          startSec: undefined,
          endSec: undefined,
          // NEW in v6: Word-level timestamps (populated by speak_start)
          words: []
        })),
        length: scene.length || 0,
        totalInEpisode: scene.totalInEpisode || 0,
        total_dialogues: scene.total_dialogues || 0
      }));
    }

    this.log(`Episode: "${episodeName}" - ${this.episodeData.scenes.length} scenes`);
  }

  // ==========================================================================
  // Recording Control
  // ==========================================================================

  async stopRecording() {
    if (this.stream && !this.recordingStopped) {
      try {
        this.logEvent('recording_stop', {
          filename: this.outputFile?.path || null
        });

        // Finalize timing for last dialogue
        if (this.episodeData?.scenes?.length > 0) {
          const lastScene = this.episodeData.scenes[this.episodeData.scenes.length - 1];
          if (lastScene?.dialogue?.length > 0) {
            const lastDialogue = lastScene.dialogue[lastScene.dialogue.length - 1];
            const now = Date.now();
            const sec = this.recordingStartTime ? (now - this.recordingStartTime) / 1000 : 0;
            if (lastDialogue && !lastDialogue.endSec) {
              lastDialogue.endSec = sec;
            }
            if (!lastScene.endSec) {
              lastScene.endSec = sec;
            }
          }
        }

        this.log('Stopping recording...');
        this.recordingStopped = true;
        await this.stream.destroy();
        this.log('Recording stopped');
        this.log(`Video saved to: ${this.outputFile?.path || "unknown"}`);

        if (this.outputFile) this.outputFile.end();

        if (this.options.fixFrameRate && this.outputFile?.path) {
          this.ffmpegPromise = this.fixVideoFrameRateWithFfmpeg();
        }
      } catch (error) {
        this.log(`Error stopping recording: ${error.message}`, 'error');
      }
    }
  }

  async fixVideoFrameRateWithFfmpeg() {
    if (!this.outputFile?.path || !this.options.fixFrameRate) {
      return null;
    }

    const inputFile = this.outputFile.path;
    const targetFrameRate = this.options.frameRate;
    // Output as .mp4 (no _fps suffix needed)
    const outputPath = inputFile.replace(/(\.\w+)$/, `.mp4`);

    return new Promise((resolve) => {
      const { spawn } = require('child_process');

      this.log(`Post-processing to ${targetFrameRate}fps MP4: ${outputPath}`);

      const ffmpegArgs = [
        '-i', inputFile,
        '-r', String(targetFrameRate),
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '23',
        '-c:a', 'aac',
        '-strict', 'experimental',
        '-b:a', '192k',
        '-y',
        '-progress', 'pipe:1',
        outputPath
      ];

      const ffmpeg = spawn('ffmpeg', ffmpegArgs);
      let totalDuration = 0;
      let lastProgress = -1;

      ffmpeg.stderr.on('data', (data) => {
        const str = data.toString();
        const durationMatch = str.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
        if (durationMatch && totalDuration === 0) {
          const [, hours, mins, secs, ms] = durationMatch;
          totalDuration = parseInt(hours) * 3600 + parseInt(mins) * 60 + parseInt(secs) + parseInt(ms) / 100;
        }
      });

      ffmpeg.stdout.on('data', (data) => {
        const str = data.toString();
        const timeMatch = str.match(/out_time_ms=(\d+)/);
        if (timeMatch && totalDuration > 0) {
          const currentTime = parseInt(timeMatch[1]) / 1000000;
          const progress = Math.min(100, Math.round((currentTime / totalDuration) * 100));
          if (progress !== lastProgress) {
            lastProgress = progress;
            const bar = '\u2588'.repeat(Math.round(progress / 2.5)) + '\u2591'.repeat(40 - Math.round(progress / 2.5));
            const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
            process.stdout.write(`\r[${timestamp}] FFmpeg: [${bar}] ${progress}%  `);
          }
        }
      });

      ffmpeg.on('close', (code) => {
        process.stdout.write('\n');
        if (code === 0) {
          this.log(`Video processed: ${outputPath}`);
          // Delete source webm file after successful conversion
          try {
            if (fs.existsSync(inputFile) && inputFile !== outputPath) {
              fs.unlinkSync(inputFile);
              this.log(`Removed intermediate file: ${path.basename(inputFile)}`);
            }
          } catch (unlinkErr) {
            this.log(`Warning: Could not remove ${inputFile}: ${unlinkErr.message}`, 'warn');
          }
          // Store final mp4 path
          this.finalVideoPath = outputPath;
          resolve(outputPath);
        } else {
          this.log(`FFmpeg exited with code ${code}`, 'error');
          resolve(null);
        }
      });

      ffmpeg.on('error', (err) => {
        process.stdout.write('\n');
        this.log(`FFmpeg error: ${err.message}`, 'error');
        resolve(null);
      });
    });
  }

  // ==========================================================================
  // Data Export
  // ==========================================================================

  async exportProcessedData() {
    if (!this.options.exportData) {
      return;
    }

    try {
      const finalJsonPath = path.join(this.options.outputDir, `${this.options.baseName}_session-log.json`);

      if (this.showConfig || this.episodeData) {
        // Calculate duration from recording
        const durationSec = this.recordingStartTime
          ? (Date.now() - this.recordingStartTime) / 1000
          : 0;

        // Count dialogues with word timestamps
        let dialoguesWithWords = 0;
        let totalWords = 0;
        if (this.episodeData?.scenes) {
          for (const scene of this.episodeData.scenes) {
            for (const dialogue of scene.dialogue || []) {
              if (dialogue.words?.length > 0) {
                dialoguesWithWords++;
                totalWords += dialogue.words.length;
              }
            }
          }
        }

        // DRY output structure:
        // - show: full config (once, for posterity)
        // - episode: scene/dialogue data with timestamps
        // - No event_timeline (verbose debug data removed)
        // - No legacy fields
        const sessionData = {
          version: '6.0',
          recorded_at: new Date().toISOString(),
          duration_sec: durationSec,
          video_file: this.finalVideoPath
            ? path.basename(this.finalVideoPath)
            : (this.outputFile?.path ? path.basename(this.outputFile.path).replace(/(\.\w+)$/, '.mp4') : null),
          // Show config (full info, included once)
          show: this.showConfig || null,
          // Episode data with embedded timestamps and words
          episode: this.episodeData || null
        };

        fs.writeFileSync(finalJsonPath, JSON.stringify(sessionData, null, 2));
        this.log(`Session log exported: ${finalJsonPath}`);
        this.log(`  - ${dialoguesWithWords} dialogues with word timestamps, ${totalWords} total words`);
      }
    } catch (error) {
      this.log(`Error exporting data: ${error.message}`, 'error');
    }
  }

  // ==========================================================================
  // Browser Setup
  // ==========================================================================

  log(message, level = 'info') {
    if (!this.options.verbose && level === 'debug') return;
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    switch (level) {
      case 'error':
        console.error(`[${timestamp}] ERROR: ${message}`);
        break;
      case 'warn':
        console.warn(`[${timestamp}] WARN: ${message}`);
        break;
      case 'debug':
        console.log(`[${timestamp}] DEBUG: ${message}`);
        break;
      default:
        console.log(`[${timestamp}] ${message}`);
    }
  }

  async initialize() {
    this.log('Initializing browser...');
    fs.mkdirSync(this.options.outputDir, { recursive: true });

    if (this.options.headless && this.options.outputFormat === 'mp4') {
      this.log('MP4 not supported in headless mode, using WebM', 'warn');
      this.options.outputFormat = 'webm';
    }

    const windowWidth = this.options.videoWidth;
    const windowHeight = this.options.videoHeight;

    const browserArgs = [
      '--no-sandbox',
      `--ozone-override-screen-size=${windowWidth},${windowHeight}`,
      '--disable-setuid-sandbox',
      '--no-first-run',
      '--disable-infobars',
      '--hide-crash-restore-bubble',
      '--disable-blink-features=AutomationControlled',
      '--hide-scrollbars',
      '--autoplay-policy=no-user-gesture-required',
      '--enable-gpu-rasterization',
      '--ignore-gpu-blocklist',
      '--use-gl=angle',
      '--enable-accelerated-video-decode',
      '--enable-accelerated-video',
      '--disable-features=AudioServiceOutOfProcess',
      '--force-video-overlays',
      '--enable-features=VaapiVideoDecoder',
      '--disable-features=VizDisplayCompositor',
      '--force-device-scale-factor=1',
      '--disable-plugins',
      '--no-default-browser-check',
      '--allowlisted-extension-id=jjndjgheafjngoipoacpjgeicjeomjli',
    ];

    if (this.options.muteAudio) {
      browserArgs.push('--mute-audio', '--disable-audio-output', '--disable-audio');
    }

    if (this.options.headless) {
      browserArgs.push('--headless=new', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox');
    }

    const executablePath = this.options.executablePath || this.getChromePath();
    if (!executablePath) {
      throw new Error('Could not find Chrome executable. Use --chrome-path=');
    }

    this.log(`Chrome: ${executablePath}`);

    this.browser = await launch({
      headless: this.options.headless ? "new" : false,
      args: browserArgs,
      executablePath: executablePath,
      defaultViewport: null
    });

    this.page = await this.browser.newPage();

    const session = await this.page.target().createCDPSession();
    const { windowId } = await session.send('Browser.getWindowForTarget');

    const uiSize = await this.page.evaluate(() => ({
      height: window.outerHeight - window.innerHeight,
      width: window.outerWidth - window.innerWidth,
    }));

    await session.send('Browser.setWindowBounds', {
      windowId,
      bounds: {
        height: windowHeight + uiSize.height,
        width: windowWidth + uiSize.width,
      },
    });

    await this.page.setViewport({
      width: windowWidth,
      height: windowHeight,
      deviceScaleFactor: 1
    });

    await this.page.addStyleTag({
      content: `
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          width: ${windowWidth}px !important;
          height: ${windowHeight}px !important;
          overflow: hidden !important;
          background: black !important;
        }
        #root, main, .app-container, .scene-container, .player-container,
        [class*="container"], [class*="wrapper"], [class*="player"], [class*="scene"] {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          height: 100% !important;
          z-index: 1 !important;
        }
        video {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          height: 100% !important;
          z-index: 999000 !important;
          background: black !important;
          object-fit: contain !important;
        }
        .header-container, header { z-index: 0 !important; }
      `
    });

    this.page.setDefaultNavigationTimeout(120000);
    this.setupErrorHandling();
    this.log('Browser initialized');
    return this;
  }

  setupErrorHandling() {
    this.page.on('console', async msg => {
      const msgArgs = msg.args();
      if (msgArgs.length === 0) return;

      let eventText = '';
      try {
        eventText = await msgArgs[0].jsonValue();
      } catch {
        eventText = msg.text();
      }

      if (typeof eventText !== 'string') {
        eventText = msg.text();
        if (typeof eventText !== 'string') return;
      }

      // Handle recorder: prefixed events (including speak_start)
      if (eventText.startsWith('recorder:')) {
        const eventTypeMatch = eventText.match(/^recorder:(\w+)/);
        if (eventTypeMatch) {
          const eventType = eventTypeMatch[1];
          let eventData = null;

          if (msgArgs.length > 1) {
            try {
              eventData = await msgArgs[1].jsonValue();
            } catch {
              // Ignore parse errors
            }
          }

          // NEW in v6: Handle speak_start with timing data
          if (eventType === 'speak_start' && eventData?.timingData) {
            this.handleSpeakStart(eventData);
            return;
          }

          this.logEvent(eventType, eventData);
          return;
        }
      }

      // Fallback: Capture DIALOGUE START events for dialogue without speak_start
      if (eventText.includes('DIALOGUE START')) {
        this.dialogueIndex++;

        // Calculate scene/dialogue indices
        let globalIdx = 0;
        let foundSceneIdx = 0;
        let foundDialogueIdx = 0;

        if (this.episodeData?.scenes) {
          outer: for (let s = 0; s < this.episodeData.scenes.length; s++) {
            const scene = this.episodeData.scenes[s];
            for (let d = 0; d < (scene.dialogue?.length || 0); d++) {
              globalIdx++;
              if (globalIdx === this.dialogueIndex) {
                foundSceneIdx = s;
                foundDialogueIdx = d;
                break outer;
              }
            }
          }
        }

        const now = Date.now();
        const sec = this.recordingStartTime ? (now - this.recordingStartTime) / 1000 : 0;

        // Embed timestamp in episode data (only if not already set by speak_start)
        this.embedDialogueTimestamp(sec, foundSceneIdx, foundDialogueIdx);

        // Also log event with indices for debugging
        const dialogue = this.episodeData?.scenes?.[foundSceneIdx]?.dialogue?.[foundDialogueIdx];
        this.logEvent('dialogue_start', {
          globalIndex: this.dialogueIndex,
          sceneIndex: foundSceneIdx,
          dialogueIndex: foundDialogueIdx,
          line: dialogue?.line?.substring(0, 50) || '',
          actor: dialogue?.actor || ''
        });
      }

      // Navigation detection
      if (eventText.includes('Navigating to next episode:')) {
        this.log('Episode end: navigation to next detected');
        this.endDetected = true;
        if (this.navigationMonitor) {
          clearInterval(this.navigationMonitor);
          this.navigationMonitor = null;
        }
      }

      // Log relevant console messages
      if (this.options.verbose || msg.type() === 'error' || msg.type() === 'warning') {
        const relevant = ['scene:', 'showrunner:', 'dialogue:', 'playback', 'start_', 'end_', 'recorder:', 'intro', 'credits'];
        if (relevant.some(r => eventText.includes(r))) {
          this.log(`Browser: ${eventText}`, msg.type() === 'error' ? 'error' : 'debug');
        }
      }
    });

    this.page.on('requestfailed', request => {
      const url = request.url();
      if (url.includes('.mp3') || url.includes('.mp4') || url.includes('media')) {
        this.log(`Failed to load media: ${url}`, 'error');
      }
    });

    this.page.on('error', err => this.log(`Page error: ${err.message}`, 'error'));
    this.page.on('close', () => {
      this.log('Page closed');
      this.endDetected = true;
    });
  }

  // ==========================================================================
  // Episode Loading and Playback
  // ==========================================================================

  async loadEpisodeUrl(url) {
    this.log(`Loading: ${url}`);

    try {
      this.startNavigationMonitoring(url);
      await this.page.setCacheEnabled(false);

      await this.page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: this.options.waitTimeout
      });

      this.episodeInfo = await this.page.evaluate(() => ({
        name: document.title.split(' - ')[0] || 'episode',
        showTitle: window.shmotimeVoice?.showTitle || 'show',
        episodeId: window.shmotimeVoice?.shmotimeId || ''
      }));

      await this.page.evaluate(() => {
        const originalPushState = history.pushState;
        history.pushState = function() {
          originalPushState.apply(this, arguments);
          console.log(`Navigation to: ${arguments[2]}`);
        };
        document.querySelectorAll('audio, video').forEach(el => {
          el.muted = false;
          el.volume = 1;
        });
      });

      this.log(`Loaded: ${this.episodeInfo.name}`);
      return this.episodeInfo;
    } catch (error) {
      this.log(`Error loading episode: ${error.message}`, 'error');
      return null;
    }
  }

  startNavigationMonitoring(originalUrl) {
    if (this.navigationMonitor) {
      clearInterval(this.navigationMonitor);
    }

    this.navigationMonitor = setInterval(async () => {
      try {
        if (!this.page || this.page.isClosed()) {
          clearInterval(this.navigationMonitor);
          this.navigationMonitor = null;
          this.endDetected = true;
          return;
        }

        const currentUrl = await this.page.url();
        if (currentUrl !== originalUrl && !currentUrl.includes('chrome-extension://')) {
          this.log(`Navigation: ${originalUrl} -> ${currentUrl}`);
          this.endDetected = true;
        }

        // Detect episode loop (returned to start screen)
        const playbackDuration = this.episodePlaybackStartTime
          ? Date.now() - this.episodePlaybackStartTime
          : 0;

        if (playbackDuration > TIMING.EPISODE_LOOP_THRESHOLD_MS) {
          const hasStartScreen = await this.page.evaluate(() => {
            const btn = document.querySelector('.slate-ready, .start-button, [data-action="start"]');
            return btn && window.getComputedStyle(btn).display !== 'none';
          }).catch(() => false);

          if (hasStartScreen) {
            this.log(`Episode loop detected after ${Math.round(playbackDuration / 1000)}s`);
            this.endDetected = true;
          }
        }
      } catch {
        // Ignore monitor errors
      }
    }, TIMING.MONITOR_INTERVAL_MS);
  }

  async startEpisode() {
    this.log('Starting playback...');

    try {
      const playFrame = await this.getPlayableFrame();
      const isIframe = playFrame !== this.page.mainFrame();

      if (isIframe) {
        this.log(`Iframe player: ${playFrame.url()}`);
      }

      this.log('Waiting for start button...');
      await playFrame.waitForFunction((selector) => {
        const slate = document.querySelector(selector);
        return slate && window.getComputedStyle(slate).display !== 'none';
      }, { timeout: this.options.waitTimeout }, this.SLATE_WAIT_SELECTOR);

      let videoFile = null;

      if (this.options.record) {
        const filename = this.getRecordingFilename(this.options.outputFormat);
        this.log(`Recording: ${filename}`);
        this.outputFile = fs.createWriteStream(filename);

        const mimeType = this.options.outputFormat === 'mp4'
          ? "video/mp4;codecs=avc1,mp4a.40.2"
          : "video/webm;codecs=vp8,opus";

        try {
          this.stream = await getStream(this.page, {
            audio: true,
            video: true,
            frameSize: 1000,
            bitsPerSecond: 8000000,
            mimeType: mimeType
          });
          videoFile = filename;
        } catch (error) {
          if (this.options.outputFormat === 'mp4') {
            this.log('MP4 failed, falling back to WebM', 'warn');
            this.options.outputFormat = 'webm';
            if (this.outputFile) this.outputFile.close();

            const webmFilename = this.getRecordingFilename('webm');
            this.outputFile = fs.createWriteStream(webmFilename);

            this.stream = await getStream(this.page, {
              audio: true,
              video: true,
              frameSize: 1000,
              bitsPerSecond: 6000000,
              mimeType: "video/webm;codecs=vp8,opus"
            });
            videoFile = webmFilename;
          } else {
            throw error;
          }
        }

        this.stream.pipe(this.outputFile);
        this.recordingStartTime = Date.now();

        this.log(`Recording: ${this.options.videoWidth}x${this.options.videoHeight}@${this.options.frameRate}fps`);

        this.logEvent('recording_start', {
          filename: videoFile,
          width: this.options.videoWidth,
          height: this.options.videoHeight,
          fps: this.options.frameRate,
          format: this.options.outputFormat
        });
      }

      this.log('Clicking start...');
      const clickResult = await playFrame.evaluate(({ slateButtonSelectors, textButtonSelectorsLC, slateContainerSelectors }) => {
        let clicked = false;
        let info = 'No target found';

        for (const selector of slateButtonSelectors) {
          const btn = document.querySelector(selector);
          if (btn) {
            try {
              btn.click();
              clicked = true;
              info = `Clicked: ${selector}`;
              break;
            } catch {}
          }
        }

        if (!clicked) {
          const allButtons = Array.from(document.querySelectorAll('button'));
          for (const btn of allButtons) {
            const btnText = btn.textContent.toLowerCase();
            if (textButtonSelectorsLC.some(txt => btnText.includes(txt))) {
              try {
                btn.click();
                clicked = true;
                info = `Clicked button with text: ${btn.textContent}`;
                break;
              } catch {}
            }
          }
        }

        if (!clicked) {
          for (const selector of slateContainerSelectors) {
            const el = document.querySelector(selector);
            if (el) {
              try {
                el.click();
                clicked = true;
                info = `Clicked container: ${selector}`;
                break;
              } catch {}
            }
          }
        }

        return info;
      }, {
        slateButtonSelectors: this.SLATE_BUTTON_SELECTORS,
        textButtonSelectorsLC: this.TEXT_BUTTON_SELECTORS_LOWERCASE,
        slateContainerSelectors: this.SLATE_CONTAINER_SELECTORS
      });

      this.log(clickResult);
      this.logEvent('click_start', { result: clickResult });

      this.log('Waiting for scene...');
      try {
        await playFrame.waitForFunction((selectors) => {
          return (
            document.querySelector(selectors.slate)?.style.display === 'none' ||
            selectors.dialogue.some(sel => document.querySelector(sel)?.textContent !== '')
          );
        }, { timeout: this.options.waitTimeout }, {
          slate: this.SLATE_WAIT_SELECTOR,
          dialogue: this.DIALOGUE_TEXT_SELECTORS
        });
        this.log('Scene loaded');
        this.logEvent('scene_loaded', { sceneIndex: 0 });
      } catch {
        this.log('Scene load detection timeout', 'warn');
        this.logEvent('scene_load_timeout');
      }

      await this.ensureAudioEnabled();
      this.logEvent('audio_enabled');

      this.log('Playback started');
      return { videoFile };
    } catch (error) {
      this.log(`Error starting episode: ${error.message}`, 'error');
      return { videoFile: null };
    }
  }

  async ensureAudioEnabled() {
    // Pass timing values to browser context (TIMING is Node.js only)
    const retryDelays = TIMING.AUDIO_ENABLE_RETRY_MS || [1000, 3000];

    await this.page.evaluate(({ mute, delays }) => {
      function enableAudio() {
        document.querySelectorAll('audio, video').forEach(el => {
          if (el.paused) el.play().catch(() => {});
          el.muted = mute;
          el.volume = mute ? 0 : 1;
        });

        const speakerAudio = document.getElementById('speaker-audio');
        if (speakerAudio) {
          if (speakerAudio.paused) speakerAudio.play().catch(() => {});
          speakerAudio.muted = mute;
          speakerAudio.volume = mute ? 0 : 1;
        }

        try {
          document.querySelectorAll('iframe').forEach(iframe => {
            try {
              const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
              iframeDoc.querySelectorAll('audio, video').forEach(el => {
                if (el.paused) el.play().catch(() => {});
                el.muted = mute;
                el.volume = mute ? 0 : 1;
              });
            } catch {}
          });
        } catch {}
      }

      enableAudio();
      setTimeout(enableAudio, delays[0] || 1000);
      setTimeout(enableAudio, delays[1] || 3000);
    }, { mute: this.options.muteAudio || false, delays: retryDelays });
  }

  async waitForEpisodeToFinish(timeout = TIMING.WAIT_DEFAULT_TIMEOUT_MS) {
    this.log(`Waiting for episode (timeout: ${timeout}ms)...`);

    const startTime = Date.now();
    let statusInterval;

    try {
      this.endDetected = false;

      statusInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        this.log(`Waiting... (${Math.floor(elapsed / 60)}m ${elapsed % 60}s) - Phase: ${this.currentPhase}`);

        // Auto-complete check
        if (elapsed * 1000 > TIMING.AUTO_COMPLETE_THRESHOLD_MS &&
            this.eventTimeline.length <= 2 &&
            this.eventTimeline.some(e => e.type === 'load_episode')) {
          this.log('Auto-completing: no playback events detected');
          this.endDetected = true;
        }
      }, TIMING.STATUS_LOG_INTERVAL_MS);

      while (!this.endDetected && (Date.now() - startTime) < timeout) {
        if (this.currentPhase === 'ended') {
          this.log('Episode ended (phase tracking)');
          this.endDetected = true;
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      if (statusInterval) {
        clearInterval(statusInterval);
        statusInterval = null;
      }

      if (!this.endDetected) {
        this.log('Timeout reached', 'warn');
        this.endDetected = true;
      }

      await new Promise(r => setTimeout(r, 2000));
      return this.endDetected;
    } catch (error) {
      this.log(`Error waiting: ${error.message}`, 'error');
      if (statusInterval) clearInterval(statusInterval);
      return false;
    } finally {
      if (this.navigationMonitor) {
        clearInterval(this.navigationMonitor);
        this.navigationMonitor = null;
      }
    }
  }

  async waitForEpisodeData(timeout = 30000) {
    this.log(`Waiting for episode data (${timeout}ms)...`);
    const startTime = Date.now();
    while (!this.episodeData && (Date.now() - startTime) < timeout) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    return !!this.episodeData;
  }

  async close() {
    this.log('Cleaning up...');

    if (this.stream && !this.recordingStopped) {
      await this.stopRecording();
    }

    if (this.ffmpegPromise) {
      this.log('Waiting for FFmpeg...');
      try {
        await this.ffmpegPromise;
        this.log('FFmpeg done');
      } catch (err) {
        this.log(`FFmpeg error: ${err.message}`, 'error');
      }
    }

    await this.exportProcessedData();

    if (this.navigationMonitor) {
      clearInterval(this.navigationMonitor);
      this.navigationMonitor = null;
    }

    if (this.browser && !this.browser.process()?.killed) {
      try {
        await this.browser.close();
        this.log('Browser closed');
      } catch (error) {
        this.log(`Error closing browser: ${error.message}`, 'error');
      }
    }

    try {
      if (wss) (await wss).close();
    } catch {}

    this.log(`Session complete: ${this.eventTimeline.length} events`);
  }
}

// ============================================================================
// URL/Slug Utilities
// ============================================================================

function getEpisodeSlug(urlString) {
  try {
    const { pathname } = new URL(urlString);
    const parts = pathname.split('/').filter(Boolean);
    const i = parts.indexOf('shmotime_episode');
    if (i >= 0 && i + 1 < parts.length) return parts[i + 1];
    return parts.at(-1) ?? '';
  } catch {
    return '';
  }
}

function slugToTitleCase(slug) {
  return slug
    .replace(/[^a-zA-Z0-9\- ]/g, ' ')
    .replace(/-/g, ' ')
    .trim()
    .split(/\s+/)
    .map(w => w[0] ? w[0].toUpperCase() + w.slice(1) : '')
    .join('-');
}

function loadListTxtMapping(listPath) {
  if (!listPath) return {};
  const mapping = {};
  try {
    const lines = fs.readFileSync(listPath, 'utf-8').split('\n');
    for (const line of lines) {
      if (!line.trim() || !line.includes(',')) continue;
      const [date, url] = line.split(',', 2);
      let slug = url.trim().split('/').filter(Boolean).pop();
      mapping[slug] = date.trim();
    }
  } catch {}
  return mapping;
}

// ============================================================================
// CLI
// ============================================================================

function parseArgs() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.length === 0) {
    console.log(`
Shmotime Recorder v6

Key features (v6):
  - Word-level timestamps from ElevenLabs TTS timing data
  - No Gemini needed for word alignment
  - Perfect audio sync from actual TTS playback timing
  - Timestamps embedded in episode_data.scenes[].dialogue[].words[]

Usage: node recorder6.js [options] <url>

Options:
  --headless                    Run in headless mode
  --no-record                   Disable video recording
  --no-export                   Disable data export
  --no-fix-framerate            Disable ffmpeg post-processing
  --mute                        Mute audio during recording
  --quiet                       Reduce log output
  --wait=<ms>                   Maximum wait time (default: 3600000)
  --output=<dir>                Output directory (default: ./episodes)
  --chrome-path=<path>          Chrome executable path
  --format=<format>             Video format: webm or mp4 (default: webm)
  --stop-recording-at=<event>   Stop trigger (default: end_postcredits)
  --height=<pixels>             Video height (default: 1080)
  --width=<pixels>              Video width (default: 1920)
  --fps=<number>                Frame rate (default: 30)
  --date=<YYYY-MM-DD>           Override date for filenames
  --show=<name>                 Show name for filename (default: Show)
  --list=<path>                 Path to list file for date mapping
  --help                        Show this help

Output files:
  {date}_{show}_{episode}.mp4          - Final video (webm is deleted after conversion)
  {date}_{show}_{episode}_session-log.json - Timing data with word timestamps

Session log format (v6):
  - version: "6.0" (for format detection)
  - episode_data with embedded timestamps AND word-level timing:
    - scenes[].startSec, scenes[].endSec
    - scenes[].dialogue[].startSec, scenes[].dialogue[].endSec
    - scenes[].dialogue[].words[] (from speak_start timing data)
  - event_timeline (kept for debugging)
  - metadata with duration, fps, resolution, word stats

Word timestamp format:
  dialogue.words = [
    { "word": "Welcome", "start": 9.821, "end": 10.1 },
    { "word": "to", "start": 10.1, "end": 10.3 },
    { "word": "the", "start": 10.3, "end": 10.5 },
    { "word": "show", "start": 10.5, "end": 10.9 }
  ]

Examples:
  node recorder6.js https://shmotime.com/shmotime_episode/episode-url/
  node recorder6.js --date=2026-02-02 --show=Cron-Job https://shmotime.com/...
`);
    process.exit(0);
  }

  const headless = args.includes('--headless');
  const noRecord = args.includes('--no-record');
  const noExport = args.includes('--no-export');
  const noFixFrameRate = args.includes('--no-fix-framerate');
  const muteAudio = args.includes('--mute');
  const verbose = !args.includes('--quiet');
  const url = args.find(arg => !arg.startsWith('--')) || '';
  const waitTime = parseInt(args.find(arg => arg.startsWith('--wait='))?.split('=')[1] || String(TIMING.WAIT_DEFAULT_TIMEOUT_MS), 10);
  const outputDir = args.find(arg => arg.startsWith('--output='))?.split('=')[1] || './episodes';
  const chromePath = args.find(arg => arg.startsWith('--chrome-path='))?.split('=')[1] || '';
  const outputFormat = args.find(arg => arg.startsWith('--format='))?.split('=')[1] || 'webm';
  const stopRecordingAt = args.find(arg => arg.startsWith('--stop-recording-at='))?.split('=')[1] || 'end_postcredits';
  const viewportHeight = parseInt(args.find(arg => arg.startsWith('--height='))?.split('=')[1] || '1080', 10);
  const viewportWidth = parseInt(args.find(arg => arg.startsWith('--width='))?.split('=')[1] || '1920', 10);
  const frameRate = parseInt(args.find(arg => arg.startsWith('--fps='))?.split('=')[1] || '30', 10);
  const dateOverride = args.find(arg => arg.startsWith('--date='))?.split('=')[1] || '';
  const showName = args.find(arg => arg.startsWith('--show='))?.split('=')[1] || 'Show';
  const listPath = args.find(arg => arg.startsWith('--list='))?.split('=')[1];

  // Build base name
  const slug = getEpisodeSlug(url);
  if (!slug) {
    console.error('Could not extract episode slug from URL');
    process.exit(1);
  }

  let canonicalDate = dateOverride;
  if (!canonicalDate) {
    const listMapping = loadListTxtMapping(listPath);
    if (listMapping[slug]) {
      canonicalDate = listMapping[slug];
    }
  }
  if (!canonicalDate) {
    canonicalDate = new Date().toISOString().slice(0, 10);
  }

  const baseName = `${canonicalDate}_${showName}_${slugToTitleCase(slug)}`;

  const validStopEvents = [
    'start_intro', 'end_intro',
    'start_ep', 'end_ep',
    'start_credits', 'end_credits',
    'start_postcredits', 'end_postcredits',
    'episode_end', 'never'
  ];

  if (!validStopEvents.includes(stopRecordingAt)) {
    console.error(`Invalid --stop-recording-at: ${stopRecordingAt}`);
    console.error(`Valid: ${validStopEvents.join(', ')}`);
    process.exit(1);
  }

  return {
    url,
    options: {
      headless,
      record: !noRecord,
      exportData: !noExport,
      fixFrameRate: !noFixFrameRate,
      muteAudio,
      verbose,
      outputDir,
      waitTimeout: TIMING.SLATE_WAIT_MS,
      executablePath: chromePath,
      outputFormat,
      stopRecordingAt,
      videoWidth: viewportWidth,
      videoHeight: viewportHeight,
      frameRate,
      dateOverride,
      showName,
      listPath,
      baseName
    },
    waitTime
  };
}

async function main() {
  const { url, options, waitTime } = parseArgs();

  console.log('Shmotime Recorder v6');
  console.log(`URL: ${url}`);
  console.log(`Settings: headless=${options.headless}, record=${options.record}, format=${options.outputFormat}`);
  console.log(`Video: ${options.videoWidth}x${options.videoHeight}@${options.frameRate}fps`);
  console.log(`Stop at: ${options.stopRecordingAt}`);
  console.log('Features: speak_start word-level timestamps enabled');

  const recorder = new ShmotimeRecorder(options);

  try {
    await recorder.initialize();

    const episodeInfo = await recorder.loadEpisodeUrl(url);
    if (!episodeInfo) {
      throw new Error('Failed to load episode');
    }

    const { videoFile } = await recorder.startEpisode();

    if (options.record) {
      if (!videoFile) {
        throw new Error('Failed to start recording');
      }
      await recorder.waitForEpisodeToFinish(waitTime);
      console.log('Episode complete');
      if (videoFile) console.log(`Video: ${videoFile}`);
    } else {
      await recorder.waitForEpisodeData();
      console.log('Data retrieval complete');
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
  } finally {
    await recorder.close();
    console.log('Done');
    process.exit(0);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(`Fatal: ${error.message}`);
    process.exit(1);
  });
}

module.exports = ShmotimeRecorder;
