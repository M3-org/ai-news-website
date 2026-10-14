#!/usr/bin/env node
/**
 * Render print-edition broadsheet PDFs from the built site.
 *
 * Serves dist/ locally, loads /print/<date>/ in headless Chrome, waits for
 * fonts + the in-page pretext headline fit (data-pretext-done), and writes
 * dist/media/daily/<date>/broadsheet.pdf (plus media/daily/ locally when the
 * directory exists).
 *
 * Usage (after `npm run build`):
 *   node scripts/broadsheet/render-pdf.cjs --days 7
 *   node scripts/broadsheet/render-pdf.cjs --date 2026-08-01
 *   node scripts/broadsheet/render-pdf.cjs --date 2026-08-01 --force
 */

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const ROOT = path.resolve(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist');

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.json': 'application/json', '.woff2': 'font/woff2',
};

function parseArgs() {
  const args = { days: 7, date: null, force: false };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--days') args.days = parseInt(argv[++i], 10);
    else if (argv[i] === '--date') args.date = argv[++i];
    else if (argv[i] === '--force') args.force = true;
  }
  return args;
}

function serveDist() {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(DIST, urlPath);
    if (!file.startsWith(DIST)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
      file = path.join(file, 'index.html');
    }
    if (!fs.existsSync(file)) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

async function main() {
  const args = parseArgs();
  if (!fs.existsSync(DIST)) {
    console.error('dist/ not found — run `npm run build` first.');
    process.exit(1);
  }

  const printDir = path.join(DIST, 'print');
  if (!fs.existsSync(printDir)) {
    console.error('dist/print/ not found — the build produced no print pages.');
    process.exit(1);
  }
  let dates = fs.readdirSync(printDir)
    .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort()
    .reverse();
  dates = args.date ? dates.filter(d => d === args.date) : dates.slice(0, args.days);
  if (dates.length === 0) {
    console.error(args.date ? `No print page for ${args.date} in dist/.` : 'No print pages found.');
    process.exit(1);
  }

  const { server, port } = await serveDist();
  const puppeteer = require('puppeteer');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--force-color-profile=srgb'],
  });

  let failed = 0;
  try {
    const page = await browser.newPage();
    for (const date of dates) {
      const distOut = path.join(DIST, 'media', 'daily', date);
      const outPath = path.join(distOut, 'broadsheet.pdf');
      if (!args.force && fs.existsSync(outPath)) {
        console.log(`  – ${date}: exists, skipping`);
        continue;
      }
      try {
        await page.goto(`http://127.0.0.1:${port}/print/${date}/`, {
          waitUntil: 'networkidle0',
          timeout: 60000,
        });
        // Wait for the in-page pretext fit (it also awaits document.fonts.ready).
        await page.waitForFunction(
          () => document.documentElement.dataset.pretextDone === '1',
          { timeout: 30000 },
        );
        const fontsOk = await page.evaluate(
          () => document.fonts.check('900 30px "Playfair Display"'),
        );
        if (!fontsOk) throw new Error('Playfair Display failed to load');

        const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
        fs.mkdirSync(distOut, { recursive: true });
        fs.writeFileSync(outPath, pdf);
        // Convenience copy next to the local poster assets when present.
        const localDir = path.join(ROOT, 'media', 'daily', date);
        if (fs.existsSync(localDir)) {
          fs.writeFileSync(path.join(localDir, 'broadsheet.pdf'), pdf);
        }
        console.log(`  ✓ ${date}: ${(pdf.length / 1024).toFixed(0)} KB`);
      } catch (err) {
        failed++;
        console.error(`  ✗ ${date}: ${err.message}`);
      }
    }
  } finally {
    await browser.close();
    server.close();
  }

  if (failed === dates.length) {
    console.error('All broadsheet renders failed.');
    process.exit(1);
  }
  if (failed) console.warn(`${failed}/${dates.length} render(s) failed; the rest were written.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
