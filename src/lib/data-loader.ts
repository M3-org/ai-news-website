import fs from 'node:fs';
import path from 'node:path';
import type { Manifest, FactsData, CouncilBriefing, HighlightsData, AiNewsData, GitHubStats } from './types';

const KNOWLEDGE_ROOT = process.env.KNOWLEDGE_ROOT || path.resolve(process.cwd(), 'knowledge');

function readJson<T>(filePath: string): T | null {
  try {
    const full = path.resolve(KNOWLEDGE_ROOT, filePath);
    const raw = fs.readFileSync(full, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function readText(filePath: string): string | null {
  try {
    const full = path.resolve(KNOWLEDGE_ROOT, filePath);
    return fs.readFileSync(full, 'utf-8');
  } catch {
    return null;
  }
}

export function getManifest(): Manifest | null {
  return readJson<Manifest>('api/manifest.json');
}

export function getFacts(date: string): FactsData | null {
  return readJson<FactsData>(`the-council/facts/${date}.json`);
}

export function getCouncilBriefing(date: string): CouncilBriefing | null {
  return readJson<CouncilBriefing>(`the-council/council_briefing/${date}.json`);
}

export function getHighlights(date: string): HighlightsData | null {
  return readJson<HighlightsData>(`the-council/highlights/${date}.json`);
}

export function getAiNews(date: string): AiNewsData | null {
  return readJson<AiNewsData>(`ai-news/elizaos/json/${date}.json`);
}

export function getGitHubStats(date: string): GitHubStats | null {
  return readJson<GitHubStats>(`github/stats/day/stats_${date}.json`);
}

export function getGitHubSummary(date: string): string | null {
  const byDate = readJson<{ content?: string }>(`github/api/summaries/overall/day/${date}.json`);
  if (byDate?.content) return byDate.content;
  const latest = readJson<{ content?: string }>(`github/api/summaries/overall/day/latest.json`);
  return latest?.content || null;
}

export function getDailySilk(date: string): string | null {
  return readText(`daily-silk/${date}.md`);
}

export function getAvailableDates(type: 'facts' | 'council_briefing'): string[] {
  const dir = type === 'facts' ? 'the-council/facts' : 'the-council/council_briefing';
  try {
    const fullDir = path.resolve(KNOWLEDGE_ROOT, dir);
    return fs.readdirSync(fullDir)
      .filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
      .map(f => f.replace('.json', ''))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export function getLatestDate(type: 'facts' | 'council_briefing' = 'facts'): string {
  const manifest = getManifest();
  if (manifest?.latest[type]) return manifest.latest[type];
  const dates = getAvailableDates(type);
  return dates[0] || new Date().toISOString().split('T')[0];
}
