import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import data from '../src/data/rhyme-index.json' with { type: 'json' };

const explicitUrl = process.env.QA_URL;
const url = explicitUrl ?? 'http://127.0.0.1:4173/';
const TONES = [1, 2, 3, 4];

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

function uniqueByChar(items) {
  return [...new Map(items.map((item) => [item.char, item])).values()];
}

function pinyinTone(item) {
  return Number(item.pinyin.match(/[1-4]$/u)?.[0]);
}

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
  const searchButtons = await page.locator('.search-btn').count();
  const toneLegendCount = await page.locator('.tone-legend').count();
  const fontDebugCount = await page.locator('.font-debug').count();
  const historyButtons = await page.getByRole('button', { name: '查看历史' }).count();
  const githubLinks = await page.locator('a[href="https://github.com/holynova/char_finder"]').count();
  const authorLinks = await page.locator('a[href="https://github.com/holynova"]').count();
  const readingRows = await page.locator('.reading-row').count();
  const cardToneLabels = await page.locator('.card-tone b').count();
  const ideaCount = await page.locator('.idea-chip').count();
  const activeToneRows = await page.locator('.card-tone.active-tone').count();
  const selectedResultCards = await page.locator('.result-card.selected').count();
  const thirdRowBox = await page.locator('.result-card').nth(2).boundingBox();
  const actionBars = await page.locator('.action-bar').count();
  const firstMainBorder = await page.locator('.char-chip.main').first().evaluate((node) => getComputedStyle(node).borderStyle);
  await page.evaluate(() => document.fonts.ready);
  const hasBundledFont = await page.evaluate(() =>
    [...document.fonts].some((font) => font.family === 'LXGW WenKai Screen'),
  );
  const resultScroll = await page.locator('.result-list').evaluate((node) => ({
    scrollHeight: node.scrollHeight,
    clientHeight: node.clientHeight,
    scrollTop: node.scrollTop,
  }));
  const longestToneRow = await page.locator('.card-chars').evaluateAll((nodes) =>
    nodes
      .map((node) => ({
        chipCount: node.querySelectorAll('.char-chip').length,
        moreCount: node.querySelectorAll('.char-more').length,
        clientHeight: node.clientHeight,
        clientWidth: node.clientWidth,
        flexWrap: getComputedStyle(node).flexWrap,
        scrollWidth: node.scrollWidth,
      }))
      .sort((a, b) => b.chipCount - a.chipCount)[0],
  );
  const defaultReading = data.characters['光'][0];
  const defaultItems = uniqueByChar(
    Object.values(data.groups[defaultReading.rhyme]).flatMap((group) =>
      TONES.flatMap((tone) => group.tones[String(tone)] ?? []),
    ),
  ).filter((item) => item.char !== '光');
  const sameTonePool = defaultItems.filter((item) => pinyinTone(item) === defaultReading.tone);
  const defaultIdeas = await page.locator('.idea-chip').allTextContents();
  const defaultIdeasPreferActiveTone =
    sameTonePool.length >= defaultIdeas.length &&
    defaultIdeas.every((char) => sameTonePool.some((item) => item.char === char));

  assert(title === '韵脚画布', 'page title should render');
  assert(searchButtons === 0, 'search button should be removed because input searches live');
  assert(initials >= 20, 'initial selector should show many initials');
  assert(rows >= 20, 'result area should render all available initial combinations');
  assert(toneLegendCount === 0, 'tone legend header should be removed from results');
  assert(fontDebugCount === 0, 'font debug picker should not ship');
  assert(historyButtons === 0, 'unused history icon should not ship');
  assert(githubLinks >= 2, 'header and footer should link to the GitHub repository');
  assert(authorLinks >= 1, 'footer should link to the author profile');
  assert(await page.getByText('v1.0.0').count() >= 1, 'footer should show the app version');
  assert(readingRows === 0, 'top pinyin metadata row should be removed');
  assert(cardToneLabels > rows, 'result cards should group characters under tone labels');
  assert(ideaCount === 8, 'random inspiration should show eight options');
  assert(defaultIdeasPreferActiveTone, 'random inspiration should prefer matching-tone characters');
  assert(activeToneRows > 0, 'matching tone rows should be highlighted when available');
  assert(selectedResultCards === 0, 'result cards should not have a selected visual state');
  assert(actionBars === 0, 'bottom action bar should be hidden');
  assert(hasBundledFont, 'bundled LXGW WenKai Screen font should be registered');
  assert(thirdRowBox && thirdRowBox.y < 844, 'first screen should show the third initial result');
  assert(firstMainBorder === 'none', 'character options should not use borders');
  assert(resultScroll.scrollHeight > resultScroll.clientHeight, 'result list should scroll internally');
  assert(longestToneRow.flexWrap === 'nowrap', 'same-tone result rows should not wrap');
  assert(longestToneRow.clientHeight <= 36, 'same-tone result rows should stay one line tall on mobile');
  assert(longestToneRow.chipCount <= 6, 'same-tone result rows should preview at most six characters');
  assert(await page.locator('.char-more').count() > 0, 'long result rows should expose a more button');

  await page.locator('.char-more').first().click();
  const moreDialog = page.getByRole('dialog', { name: '更多答案' });
  await moreDialog.waitFor();
  const modalCharCount = await moreDialog.locator('.more-char').count();
  assert(modalCharCount > 5, 'more dialog should show additional answers');
  await moreDialog.getByRole('button', { name: '关闭' }).click();
  await moreDialog.waitFor({ state: 'detached' });

  await page.locator('.result-list').evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  await page.waitForFunction(() => {
    const node = document.querySelector('.result-list');
    if (!node) return false;
    return node.scrollTop + node.clientHeight >= node.scrollHeight - 2;
  });
  const bottomReach = await page.locator('.result-list').evaluate((node) => {
    const listRect = node.getBoundingClientRect();
    const lastCard = node.querySelector('.result-card:last-child');
    const lastRect = lastCard?.getBoundingClientRect();
    return {
      listBottom: listRect.bottom,
      lastBottom: lastRect?.bottom ?? 0,
    };
  });
  assert(
    bottomReach.lastBottom <= bottomReach.listBottom + 1,
    `result list should scroll to the final card, got last=${bottomReach.lastBottom}, list=${bottomReach.listBottom}`,
  );
  const rowHeadAlignment = await page.locator('.row-head').first().evaluate((node) => {
    const styles = getComputedStyle(node);
    return {
      alignItems: styles.alignItems,
      justifyContent: styles.justifyContent,
      textAlign: styles.textAlign,
    };
  });
  assert(rowHeadAlignment.alignItems === 'center', 'result left rail should center items horizontally');
  assert(rowHeadAlignment.justifyContent === 'center', 'result left rail should center items vertically');
  assert(rowHeadAlignment.textAlign === 'center', 'result left rail text should be centered');

  const exactToggle = page.locator('.common-toggle').nth(0);
  assert((await exactToggle.textContent())?.includes('精确匹配韵母'), 'exact filter should show fixed label');
  assert(!(await exactToggle.getAttribute('class'))?.includes('active'), 'exact filter should start disabled');
  assert(await page.getByText('生僻字').count() === 0, 'rare character checkbox should be removed');

  await page.getByPlaceholder('输入中文词句').fill('民');
  await page.waitForTimeout(200);
  const wideRowHead = await page.locator('.row-head .rhyme-stack').first().evaluate((node) =>
    [...node.querySelectorAll('i')].map((item) => item.textContent),
  );
  assert(wideRowHead.join('') === '+in≈en', `wide rhyme mode should show exact and rhyme finals, got ${wideRowHead.join('')}`);
  assert(wideRowHead.length === 4, 'wide rhyme mode should stack each rhyme part on its own line');
  await page.getByPlaceholder('输入中文词句').fill('男');
  await page.waitForTimeout(200);
  const singleRhymeLabel = await page.locator('.row-head .rhyme-stack').first().evaluate((node) =>
    [...node.querySelectorAll('i')].map((item) => item.textContent).join(''),
  );
  const rhymeOptionCount = await page.locator('.rhyme-options button').count();
  assert(singleRhymeLabel === '+an', `same final/rhyme should only show one label, got ${singleRhymeLabel}`);
  assert(rhymeOptionCount === 0, 'single-rhyme characters should not show a rhyme option list');
  await page.getByPlaceholder('输入中文词句').fill('哪');
  await page.waitForTimeout(200);
  const multiRhymeOptions = await page.locator('.rhyme-options button').allTextContents();
  assert(multiRhymeOptions.length === 4, `multi-rhyme characters should show all rhyme options, got ${multiRhymeOptions.length}`);
  assert(multiRhymeOptions.every((text) => /[a-züv]+[1-5]/u.test(text)), 'rhyme options should show full pinyin labels');
  const rhymeOptionsLayout = await page.locator('.rhyme-options').evaluate((node) => getComputedStyle(node).display);
  assert(rhymeOptionsLayout === 'flex', 'rhyme options should be displayed in one horizontal row');
  await page.getByPlaceholder('输入中文词句').fill('民');
  await page.waitForTimeout(200);
  await exactToggle.click();
  assert((await exactToggle.textContent())?.includes('精确匹配韵母'), 'exact filter should keep fixed label when enabled');
  assert((await exactToggle.getAttribute('class'))?.includes('active'), 'exact filter should have enabled styling');
  const exactFinals = await page.locator('.char-chip').evaluateAll((nodes) =>
    [...new Set(nodes.map((node) => node.getAttribute('data-final')).filter(Boolean))],
  );
  assert(exactFinals.length === 1 && exactFinals[0] === 'in', `exact mode should only show in finals, got ${exactFinals.join(',')}`);
  await exactToggle.click();
  assert((await exactToggle.textContent())?.includes('精确匹配韵母'), 'exact filter should keep fixed label when disabled');

  await page.getByPlaceholder('输入中文词句').fill('银行');
  await page.waitForTimeout(200);
  const metadataRowsAfterInput = await page.locator('.reading-row').count();
  assert(metadataRowsAfterInput === 0, 'polyphonic pinyin display should stay hidden after input');

  await page.getByRole('button', { name: '换一批' }).click();
  const ideasAfter = await page.locator('.idea-chip').allTextContents();
  assert(ideasAfter.length === 8, 'shuffle should keep eight inspiration choices');

  await page.locator('.initial-grid').getByRole('button', { name: 'ch', exact: true }).click();
  await page.waitForTimeout(800);
  const selectedInitial = await page.locator('.initial-grid button.active').textContent();
  const scrolledResult = await page.locator('.result-list').evaluate((node) => node.scrollTop);
  const firstVisibleInitial = await page.locator('.result-list').evaluate((node) => {
    const listTop = node.getBoundingClientRect().top;
    const firstVisible = [...node.querySelectorAll('.result-card')].find(
      (card) => card.getBoundingClientRect().bottom > listTop + 1,
    );
    return firstVisible?.querySelector('.row-head strong')?.textContent ?? '';
  });
  const selectedRowTop = await page.locator('.result-card[data-initial="ch"]').evaluate((node) => {
    const parent = node.parentElement;
    if (!parent) return 9999;
    return node.getBoundingClientRect().top - parent.getBoundingClientRect().top;
  });
  assert(selectedInitial === 'ch', `selected initial button should be ch, got ${selectedInitial}`);
  assert(firstVisibleInitial === 'ch', `first visible result should be ch, got ${firstVisibleInitial}`);
  assert(scrolledResult > 0, 'clicking an initial should scroll the result list');
  assert(selectedRowTop >= -2 && selectedRowTop < 40, 'selected initial should scroll near the top of the result list');
  const resultCardsAfterScroll = await page.locator('.result-card.selected').count();
  assert(resultCardsAfterScroll === 0, 'clicking an initial should not mark result cards selected');
  const maxInlineChars = await page.locator('.result-card[data-initial="ch"] .card-chars').evaluateAll((nodes) =>
    Math.max(...nodes.map((node) => node.querySelectorAll('.char-chip').length)),
  );
  assert(maxInlineChars <= 6, 'each tone row should keep inline character options concise');

  await page.locator('.result-list').evaluate((node) => {
    node.scrollTop = 0;
    node.dispatchEvent(new Event('scroll', { bubbles: true }));
  });
  await page.waitForFunction(() => document.querySelector('.initial-grid button.active')?.textContent === 'b');
  const syncedInitial = await page.locator('.initial-grid button.active').textContent();
  assert(syncedInitial === 'b', `scrolling result list should sync active initial to b, got ${syncedInitial}`);

  await page.locator('.idea-chip').first().click();
  const selectedIdeas = await page.locator('.idea-chip.selected').count();
  assert(selectedIdeas === 1, 'clicking an inspiration option should select it');

  await page.getByPlaceholder('输入中文词句').fill('');
  await page.waitForTimeout(200);
  assert(await page.locator('.empty-state').count() === 1, 'empty input should show an intentional empty state');
  assert(await page.locator('.result-card').count() === 0, 'empty input should hide result cards');
  assert(await page.locator('.initial-grid button').count() === 0, 'empty input should hide initial settings');
  await page.locator('.empty-examples button').first().click();
  await page.waitForTimeout(200);
  assert((await page.getByPlaceholder('输入中文词句').inputValue()).length > 0, 'empty examples should populate the query');

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
        selectedResultCards,
        selectedInitial,
        firstVisibleInitial,
        scrolledResult,
        selectedRowTop,
        actionBars,
        hasBundledFont,
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
