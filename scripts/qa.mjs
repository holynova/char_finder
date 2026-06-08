import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const explicitUrl = process.env.QA_URL;
const url = explicitUrl ?? 'http://127.0.0.1:4173/';

let server;
if (!explicitUrl) {
  server = spawn('npm', ['run', 'preview', '--', '--port', '4173'], {
    stdio: 'inherit',
  });

  const startedAt = Date.now();
  while (Date.now() - startedAt < 20_000) {
    try {
      const response = await fetch(url);
      if (response.ok) break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
}

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

let browser;

try {
  browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
  });

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'qa-mobile-viewport.png', fullPage: false });

  const title = await page.locator('h1').textContent();
  const initials = await page.locator('.initial-grid button').count();
  const rows = await page.locator('.result-row').count();
  const toneLegendCount = await page.locator('.tone-legend').count();
  const readingRows = await page.locator('.reading-row').count();
  const repeatedToneWords = await page.locator('text=一声').count();
  const ideaCount = await page.locator('.idea-chip').count();
  const activeToneSlots = await page.locator('.tone-slot.active-tone').count();
  const firstRowBox = await page.locator('.result-row').first().boundingBox();
  const barBox = await page.locator('.action-bar').boundingBox();

  assert(title === '韵脚画布', 'page title should render');
  assert(initials >= 20, 'initial selector should show many initials');
  assert(rows === 4, 'result area should show four primary combinations');
  assert(toneLegendCount === 1, 'tone legend should appear once');
  assert(readingRows === 0, 'top pinyin metadata row should be removed');
  assert(repeatedToneWords === 0, 'repeated tone words should be removed from rows');
  assert(ideaCount === 8, 'random inspiration should show eight options');
  assert(activeToneSlots === rows, 'matching tone should be highlighted in each result row');
  assert(
    firstRowBox && barBox && firstRowBox.y + firstRowBox.height < barBox.y,
    'action bar should not cover first result row',
  );

  await page.getByPlaceholder('输入中文词句').fill('银行');
  await page.waitForTimeout(200);
  const metadataRowsAfterInput = await page.locator('.reading-row').count();
  assert(metadataRowsAfterInput === 0, 'polyphonic pinyin display should stay hidden after input');

  await page.getByRole('button', { name: '换一批' }).click();
  const ideasAfter = await page.locator('.idea-chip').allTextContents();
  assert(ideasAfter.length === 8, 'shuffle should keep eight inspiration choices');

  await page.getByRole('button', { name: 'ch' }).click();
  const adjacentRows = await page.locator('.result-row .row-head strong').allTextContents();
  assert(
    adjacentRows[0] === 'ch' && adjacentRows.includes('zh') && adjacentRows.includes('sh'),
    `result rows should prioritize selected initial and nearby initials, got ${adjacentRows.join(',')}`,
  );
  const firstRowChars = await page.locator('.result-row').nth(1).locator('.char-chip').count();
  assert(firstRowChars >= 10, 'result groups should expose more character options');

  await page.locator('.idea-chip').first().click();
  await page.getByRole('button', { name: /以此字继续/ }).click();
  await page.waitForTimeout(200);
  const queryAfterContinue = await page.getByPlaceholder('输入中文词句').inputValue();
  assert(queryAfterContinue.length === 1, 'continue action should query selected character');

  console.log(
    JSON.stringify(
      {
        url,
        title,
        initials,
        rows,
        toneLegendCount,
        repeatedToneWords,
        ideaCount,
        readingRows,
        activeToneSlots,
        adjacentRows,
        queryAfterContinue,
        screenshot: 'qa-mobile-viewport.png',
      },
      null,
      2,
    ),
  );
} finally {
  await browser?.close();
  server?.kill();
}
