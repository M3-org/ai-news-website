#!/usr/bin/env node
/**
 * Generate 1200x630 og:image share cards for daily + council pages.
 *
 * Headlines are wrapped with @chenglou/pretext (measured line breaking) drawn
 * over the day's poster art, inside a headless Chrome page — pretext is
 * browser-only (Intl.Segmenter + Canvas 2D), so all layout happens in-page
 * via scripts/og/template.html.
 *
 * Usage:
 *   node scripts/og-cards.cjs                 # all dates with usable facts
 *   node scripts/og-cards.cjs --date 2026-07-19
 *   node scripts/og-cards.cjs --force         # regenerate existing
 *   node scripts/og-cards.cjs --limit 30
 *
 * Output: media/og/<date>.png and media/og/council-<date>.png
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const KNOWLEDGE_ROOT = process.env.KNOWLEDGE_ROOT || path.join(ROOT, 'knowledge');
const OUT_DIR = path.join(ROOT, 'media', 'og');
const TEMPLATE = path.join(__dirname, 'og', 'template.html');

function parseArgs() {
  const args = { force: false, date: null, limit: Infinity };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--force') args.force = true;
    else if (argv[i] === '--date') args.date = argv[++i];
    else if (argv[i] === '--limit') args.limit = parseInt(argv[++i], 10);
  }
  return args;
}

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return null; }
}

function firstSentence(text, maxLen = 140) {
  if (!text) return null;
  const match = text.match(/^(.+?[.!?])(?=\s|$)/);
  let s = match ? match[1] : text;
  if (s.length > maxLen) s = s.substring(0, maxLen).replace(/\s+\S*$/, '') + '…';
  return s.trim();
}

function formatDateLabel(date) {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

function posterDataUrl(date) {
  const p = path.join(ROOT, 'media', 'daily', date, 'overall.png');
  if (!fs.existsSync(p)) return null;
  return `data:image/png;base64,${fs.readFileSync(p).toString('base64')}`;
}

/** Bundle pretext into a single IIFE exposing window.pretext for addScriptTag. */
function bundlePretext() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'og-pretext-'));
  const out = path.join(tmp, 'pretext.iife.js');
  const entry = require.resolve('@chenglou/pretext', { paths: [ROOT] });
  const esbuild = path.join(ROOT, 'node_modules', '.bin', 'esbuild');
  execFileSync(esbuild, [entry, '--bundle', '--format=iife', '--global-name=pretext', `--outfile=${out}`], {
    cwd: ROOT,
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  return out;
}

function collectJobs(args) {
  const factsDir = path.join(KNOWLEDGE_ROOT, 'the-council', 'facts');
  const briefingDir = path.join(KNOWLEDGE_ROOT, 'the-council', 'council_briefing');
  let dates;
  if (args.date) {
    dates = [args.date];
  } else {
    dates = fs.readdirSync(factsDir)
      .filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
      .map(f => f.replace('.json', ''))
      .sort()
      .reverse()
      .slice(0, args.limit === Infinity ? undefined : args.limit);
  }

  const jobs = [];
  for (const date of dates) {
    const dateLabel = formatDateLabel(date);
    const poster = posterDataUrl(date);

    const facts = readJson(path.join(factsDir, `${date}.json`));
    // Skip LLM error placeholders — no headline worth sharing.
    if (facts && facts._metadata?.status !== 'error' && facts.overall_summary && !/^Error:/i.test(facts.overall_summary)) {
      jobs.push({
        out: path.join(OUT_DIR, `${date}.png`),
        payload: {
          headline: firstSentence(facts.overall_summary),
          kicker: 'Daily Briefing',
          dateLabel,
          posterDataUrl: poster,
        },
      });
    }

    const briefing = readJson(path.join(briefingDir, `${date}.json`));
    if (briefing?.daily_focus && !/^Error/i.test(briefing.daily_focus)) {
      jobs.push({
        out: path.join(OUT_DIR, `council-${date}.png`),
        payload: {
          headline: firstSentence(briefing.daily_focus),
          kicker: 'Council Briefing',
          dateLabel,
          posterDataUrl: poster,
        },
      });
    }
  }
  return jobs;
}

async function main() {
  const args = parseArgs();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let jobs = collectJobs(args);
  if (!args.force) {
    const skipped = jobs.filter(j => fs.existsSync(j.out)).length;
    jobs = jobs.filter(j => !fs.existsSync(j.out));
    if (skipped) console.log(`Skipping ${skipped} existing card(s) (use --force to regenerate)`);
  }
  if (jobs.length === 0) {
    console.log('Nothing to generate.');
    return;
  }
  console.log(`Generating ${jobs.length} card(s)…`);

  const pretextBundle = bundlePretext();
  const puppeteer = require('puppeteer');
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--force-color-profile=srgb'] });
  let failed = 0;
  try {
    const page = await browser.newPage();
    await page.goto(`file://${TEMPLATE}`, { waitUntil: 'networkidle0' });
    await page.addScriptTag({ path: pretextBundle });

    for (const job of jobs) {
      try {
        const dataUrl = await page.evaluate((payload) => window.renderCard(payload), job.payload);
        fs.writeFileSync(job.out, Buffer.from(dataUrl.split(',')[1], 'base64'));
        console.log(`  ✓ ${path.relative(ROOT, job.out)}`);
      } catch (err) {
        failed++;
        console.error(`  ✗ ${path.relative(ROOT, job.out)}: ${err.message}`);
      }
    }
  } finally {
    await browser.close();
  }

  if (failed === jobs.length) {
    console.error('All cards failed to generate.');
    process.exit(1);
  }
  if (failed) console.warn(`${failed}/${jobs.length} card(s) failed; the rest were written.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
