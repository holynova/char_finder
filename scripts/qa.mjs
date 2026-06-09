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
  const rows = await page.locator('.result-card').count();
  const toneLegendCount = await page.locator('.tone-legend').count();
  const fontDebugCount = await page.locator('.font-debug').count();
  const readingRows = await page.locator('.reading-row').count();
  const cardToneLabels = await page.locator('.card-tone b').count();
  const ideaCount = await page.locator('.idea-chip').count();
  const activeToneRows = await page.locator('.card-tone.active-tone').count();
  const thirdRowBox = await page.locator('.result-card').nth(2).boundingBox();
  const actionBars = await page.locator('.action-bar').count();
  const firstMainBorder = await page.locator('.char-chip.main').first().evaluate((node) => getComputedStyle(node).borderStyle);
  const resultScroll = await page.locator('.result-list').evaluate((node) => ({
    scrollHeight: node.scrollHeight,
    clientHeight: node.clientHeight,
    scrollTop: node.scrollTop,
  }));

  assert(title === '韵脚画布', 'page title should render');
  assert(initials >= 20, 'initial selector should show many initials');
  assert(rows >= 20, 'result area should render all available initial combinations');
  assert(toneLegendCount === 0, 'tone legend header should be removed from results');
  assert(fontDebugCount === 0, 'font debug picker should not ship');
  assert(readingRows === 0, 'top pinyin metadata row should be removed');
  assert(cardToneLabels > rows, 'result cards should group characters under tone labels');
  assert(ideaCount === 8, 'random inspiration should show eight options');
  assert(activeToneRows > 0, 'matching tone rows should be highlighted when available');
  assert(actionBars === 0, 'bottom action bar should be hidden');
  assert(thirdRowBox && thirdRowBox.y < 844, 'first screen should show the third initial result');
  assert(firstMainBorder === 'none', 'character options should not use borders');
  assert(resultScroll.scrollHeight > resultScroll.clientHeight, 'result list should scroll internally');

  await page.getByPlaceholder('输入中文词句').fill('银行');
  await page.waitForTimeout(200);
  const metadataRowsAfterInput = await page.locator('.reading-row').count();
  assert(metadataRowsAfterInput === 0, 'polyphonic pinyin display should stay hidden after input');

  await page.getByRole('button', { name: '换一批' }).click();
  const ideasAfter = await page.locator('.idea-chip').allTextContents();
  assert(ideasAfter.length === 8, 'shuffle should keep eight inspiration choices');

  await page.locator('.initial-grid').getByRole('button', { name: 'ch', exact: true }).click();
  await page.waitForTimeout(800);
  const selectedInitial = await page.locator('.result-card.selected .row-head strong').textContent();
  const scrolledResult = await page.locator('.result-list').evaluate((node) => node.scrollTop);
  const selectedRowTop = await page.locator('.result-card.selected').evaluate((node) => {
    const parent = node.parentElement;
    if (!parent) return 9999;
    return node.getBoundingClientRect().top - parent.getBoundingClientRect().top;
  });
  assert(selectedInitial === 'ch', `selected result row should be ch, got ${selectedInitial}`);
  assert(scrolledResult > 0, 'clicking an initial should scroll the result list');
  assert(selectedRowTop >= -2 && selectedRowTop < 40, 'selected initial should scroll near the top of the result list');
  const firstRowChars = await page.locator('.result-card.selected').locator('.char-chip').count();
  assert(firstRowChars >= 10, 'result groups should expose more character options');

  await page.locator('.idea-chip').first().click();
  const selectedIdeas = await page.locator('.idea-chip.selected').count();
  assert(selectedIdeas === 1, 'clicking an inspiration option should select it');

  console.log(
    JSON.stringify(
      {
        url,
        title,
        initials,
        rows,
        toneLegendCount,
        fontDebugCount,
        cardToneLabels,
        ideaCount,
        readingRows,
        activeToneRows,
        selectedInitial,
        scrolledResult,
        selectedRowTop,
        actionBars,
        firstMainBorder,
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
