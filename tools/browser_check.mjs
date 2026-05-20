import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:6111';
const outputDir = process.env.OUTPUT_DIR || '/tmp/a9_compute_admin_check';
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined;

fs.mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  await page.goto(`${baseUrl}/compute`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(outputDir, 'compute_1440.png'), fullPage: true });
  const report = await page.evaluate(() => ({
    title: document.title,
    url: location.href,
    gpuCards: document.querySelectorAll('.gpu-card').length,
    instanceRows: document.querySelectorAll('.table-row').length,
    appCards: document.querySelectorAll('.app-grid article').length,
    has4090: document.body.innerText.includes('RTX 4090'),
    hasWan: document.body.innerText.includes('Wan2.2'),
    hasLtx: document.body.innerText.includes('LTX 2.3'),
  }));
  fs.writeFileSync(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
