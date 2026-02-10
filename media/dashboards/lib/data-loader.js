/**
 * ElizaOS Dashboard Data Loader
 * Version: 1.0.0
 *
 * Unified data loading library for ElizaOS dashboards.
 * Provides caching, retry logic, and convenience methods.
 *
 * Usage:
 *   <script src="../lib/data-loader.js"></script>
 *   <script>
 *     const facts = await ElizaData.getLatestFacts();
 *     const weekStats = await ElizaData.getLatestWeekStats();
 *   </script>
 */

(function(window) {
  'use strict';

  // Custom error types
  class DataFetchError extends Error {
    constructor(path, status) {
      super(`Failed to fetch ${path}: ${status}`);
      this.name = 'DataFetchError';
      this.path = path;
      this.status = status;
    }
  }

  class DataValidationError extends Error {
    constructor(message, data) {
      super(message);
      this.name = 'DataValidationError';
      this.data = data;
    }
  }

  // Main ElizaData object
  const ElizaData = {
    // Configuration
    BASE_URL: '', // Use root-relative paths (assumes deployment at root)
    // Knowledge data prefix: for local dev with symlink use '/knowledge',
    // for production use 'https://elizaos.github.io/knowledge'
    KNOWLEDGE_BASE: '/knowledge',
    // Manifest URL (local copy in dashboards, or from knowledge API)
    MANIFEST_URL: '/knowledge/api/manifest.json',
    CACHE_TTL: 5 * 60 * 1000, // 5 minutes

    // Internal state
    manifest: null,
    cache: new Map(),
    fetchInProgress: new Map(),

    /**
     * Initialize - Load manifest
     */
    async init() {
      if (!this.manifest) {
        this.manifest = await this._fetch(this.MANIFEST_URL);
      }
      return this.manifest;
    },

    /**
     * Core fetch method with caching and retry
     */
    async _fetch(path, options = {}) {
      const {
        skipCache = false,
        retries = 2,
        timeout = 10000
      } = options;

      const cacheKey = path;

      // Check cache
      if (!skipCache) {
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
          return cached.data;
        }
      }

      // Check if fetch already in progress (prevent duplicate requests)
      if (this.fetchInProgress.has(cacheKey)) {
        return this.fetchInProgress.get(cacheKey);
      }

      // Create fetch promise
      const fetchPromise = this._fetchWithRetry(path, retries, timeout);
      this.fetchInProgress.set(cacheKey, fetchPromise);

      try {
        const data = await fetchPromise;

        // Cache the result
        this.cache.set(cacheKey, {
          data,
          timestamp: Date.now()
        });

        return data;
      } finally {
        this.fetchInProgress.delete(cacheKey);
      }
    },

    /**
     * Fetch with retry logic
     */
    async _fetchWithRetry(path, retries, timeout) {
      // Handle path construction (avoid double slashes)
      const url = this.BASE_URL ? `${this.BASE_URL}/${path}` : path;

      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeout);

          const response = await fetch(url, {
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            if (attempt === retries) {
              throw new DataFetchError(path, response.status);
            }
            // Wait before retry (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100));
            continue;
          }

          return await response.json();

        } catch (error) {
          if (attempt === retries) {
            if (error.name === 'AbortError') {
              throw new Error(`Timeout fetching ${path}`);
            }
            throw error;
          }
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100));
        }
      }
    },

    /**
     * Get latest facts
     */
    async getLatestFacts() {
      const manifest = await this.init();
      const date = manifest.latest.facts;

      if (!date) {
        throw new Error('No facts data available');
      }

      return this._fetch(`${this.KNOWLEDGE_BASE}/the-council/facts/${date}.json`);
    },

    /**
     * Get facts for specific date
     */
    async getFacts(date) {
      return this._fetch(`${this.KNOWLEDGE_BASE}/the-council/facts/${date}.json`);
    },

    /**
     * Get latest council briefing
     */
    async getLatestCouncilBriefing() {
      const manifest = await this.init();
      const date = manifest.latest.council_briefing;

      if (!date) {
        throw new Error('No council briefing data available');
      }

      return this._fetch(`${this.KNOWLEDGE_BASE}/the-council/council_briefing/${date}.json`);
    },

    /**
     * Get latest week stats (finds most recent Saturday)
     */
    async getLatestWeekStats() {
      const manifest = await this.init();

      // Try manifest's latest week date first
      if (manifest.latest.github_week) {
        try {
          return await this._fetch(`${this.KNOWLEDGE_BASE}/github/stats/week/stats_${manifest.latest.github_week}.json`);
        } catch (error) {
          // Fallback to searching
        }
      }

      // Fallback: search recent Saturdays
      const saturdays = this.getRecentSaturdays(8); // Try more dates
      for (const saturday of saturdays) {
        try {
          return await this._fetch(`${this.KNOWLEDGE_BASE}/github/stats/week/stats_${saturday}.json`);
        } catch (error) {
          // Try next Saturday
          continue;
        }
      }

      throw new Error('No week stats available');
    },

    /**
     * Get week stats for specific date
     */
    async getWeekStats(date) {
      return this._fetch(`${this.KNOWLEDGE_BASE}/github/stats/week/stats_${date}.json`);
    },

    /**
     * Get month stats
     */
    async getMonthStats(month) {
      return this._fetch(`${this.KNOWLEDGE_BASE}/github/stats/month/stats_${month}.json`);
    },

    /**
     * Get day stats
     */
    async getDayStats(date) {
      return this._fetch(`${this.KNOWLEDGE_BASE}/github/stats/day/stats_${date}.json`);
    },

    /**
     * Get historical month stats
     */
    async getHistoricalMonthStats(count = 12) {
      const manifest = await this.init();
      const months = manifest.available_months.slice(0, count);

      const results = await Promise.allSettled(
        months.map(month => this.getMonthStats(month))
      );

      return results
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value);
    },

    /**
     * Get daily stats for last N days
     */
    async getRecentDayStats(count = 14) {
      const dates = this.getLast14Days(count);

      const results = await Promise.allSettled(
        dates.map(date => this.getDayStats(date))
      );

      return results
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value);
    },

    /**
     * Normalize month stats
     * Handles different data formats and extracts key metrics
     */
    normalizeMonthStats(raw) {
      if (!raw) return null;

      // Extract basic counts from overview string if needed
      let contributors = raw.activeContributors;
      let prs = raw.newPRs;
      let prsMerged = raw.mergedPRs;
      let issues = raw.newIssues;
      let issuesClosed = raw.closedIssues;

      // Fallback: parse overview string if structured data missing
      if (!contributors && raw.overview) {
        const contributorMatch = raw.overview.match(/(\d+)\s+active contributors?/i);
        if (contributorMatch) contributors = parseInt(contributorMatch[1]);
      }

      // Fallback: count from topPRs/topIssues arrays
      if (!prs && raw.topPRs) {
        prs = raw.topPRs.length;
      }
      if (!prsMerged && raw.topPRs) {
        prsMerged = raw.topPRs.filter(pr => pr.mergedAt).length;
      }
      if (!issues && raw.topIssues) {
        issues = raw.topIssues.length;
      }
      if (!issuesClosed && raw.topIssues) {
        issuesClosed = raw.topIssues.filter(i => i.state === 'CLOSED').length;
      }

      return {
        interval: raw.interval,
        repository: raw.repository,
        overview: raw.overview,

        // Normalized counts
        contributors: contributors || 0,
        prs: prs || 0,
        prsMerged: prsMerged || 0,
        issues: issues || 0,
        issuesClosed: issuesClosed || 0,

        // Code changes
        codeChanges: raw.codeChanges || {
          additions: 0,
          deletions: 0,
          files: 0,
          commitCount: 0
        },

        // Arrays
        topPRs: raw.topPRs || [],
        topIssues: raw.topIssues || [],
        topContributors: raw.topContributors || [],
        completedItems: raw.completedItems || [],

        // Original data
        _raw: raw
      };
    },

    /**
     * Clear cache (useful for testing or forced refresh)
     */
    clearCache() {
      this.cache.clear();
      this.manifest = null;
    },

    /**
     * Get cache stats (debugging)
     */
    getCacheStats() {
      return {
        size: this.cache.size,
        entries: Array.from(this.cache.keys())
      };
    },

    // ========================================
    // DATE UTILITIES
    // ========================================

    /**
     * Format date for display
     */
    formatDate(dateStr) {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    },

    /**
     * Format date - short version (MMM DD)
     */
    formatDateShort(dateStr) {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
    },

    /**
     * Format relative time (e.g., "2 days ago")
     */
    formatRelativeTime(dateStr) {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now - date;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
      if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
      return `${Math.floor(diffDays / 365)} years ago`;
    },

    /**
     * Get last N days as YYYY-MM-DD strings
     */
    getLast14Days(count = 14) {
      const dates = [];
      const today = new Date();

      for (let i = 0; i < count; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        dates.push(d.toISOString().split('T')[0]);
      }

      return dates.reverse();
    },

    /**
     * Get recent Saturdays (week stats are keyed by Saturday)
     */
    getRecentSaturdays(count = 4) {
      const saturdays = [];
      const today = new Date();
      const dayOfWeek = today.getDay();

      // Calculate days since last Saturday
      const diff = (dayOfWeek + 1) % 7; // 0=Sun, 6=Sat

      for (let i = 0; i < count; i++) {
        const saturday = new Date(today);
        saturday.setDate(today.getDate() - diff - (i * 7));

        // Use local date to avoid timezone issues
        const year = saturday.getFullYear();
        const month = String(saturday.getMonth() + 1).padStart(2, '0');
        const day = String(saturday.getDate()).padStart(2, '0');
        saturdays.push(`${year}-${month}-${day}`);
      }

      return saturdays;
    },

    /**
     * Parse YYYY-MM-DD date string to Date object
     */
    parseDate(dateStr) {
      if (!dateStr) return null;
      return new Date(dateStr + 'T00:00:00Z');
    },

    /**
     * Get current date as YYYY-MM-DD
     */
    getTodayStr() {
      return new Date().toISOString().split('T')[0];
    },

    // ========================================
    // NUMBER UTILITIES
    // ========================================

    /**
     * Format number with K/M suffix
     */
    formatNumber(num) {
      if (num == null) return '0';
      if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
      if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
      return num.toString();
    },

    /**
     * Format number with commas
     */
    formatNumberWithCommas(num) {
      if (num == null) return '0';
      return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    },

    /**
     * Format percentage
     */
    formatPercentage(num, decimals = 1) {
      if (num == null) return '0%';
      return (num * 100).toFixed(decimals) + '%';
    },

    /**
     * Format delta (change from previous)
     */
    formatDelta(current, previous) {
      if (current == null || previous == null) return { value: 0, formatted: '+0' };
      const delta = current - previous;
      const sign = delta >= 0 ? '+' : '';
      return {
        value: delta,
        formatted: sign + delta.toString(),
        percentage: previous > 0 ? (delta / previous) : 0
      };
    },

    // ========================================
    // STRING UTILITIES
    // ========================================

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
      if (!text) return '';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    },

    /**
     * Truncate text with ellipsis
     */
    truncate(text, maxLength = 100) {
      if (!text || text.length <= maxLength) return text;
      return text.substring(0, maxLength) + '...';
    },

    /**
     * Slugify text (for IDs, URLs)
     */
    slugify(text) {
      if (!text) return '';
      return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    }
  };

  // Expose to global scope
  window.ElizaData = ElizaData;

})(window);
