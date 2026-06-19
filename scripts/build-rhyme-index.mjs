import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pinyin, getInitialAndFinal } from 'pinyin-pro';
import commonChineseCharacters from 'common-chinese-characters';
import subtlex from 'subtlex-ch-chr';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(__dirname, '../src/data/rhyme-index.json');

const INITIALS = [
  'b',
  'p',
  'm',
  'f',
  'd',
  't',
  'n',
  'l',
  'g',
  'k',
  'h',
  'j',
  'q',
  'x',
  'zh',
  'ch',
  'sh',
  'r',
  'z',
  'c',
  's',
  'y',
  'w',
  '',
];

function flattenCommonTable(table) {
  return Object.keys(table)
    .sort((a, b) => Number(a) - Number(b))
    .flatMap((key) => Array.from(table[key]));
}

const primaryCommon = flattenCommonTable(commonChineseCharacters.常用字());
const secondaryCommon = flattenCommonTable(commonChineseCharacters.次常用字());
const commonSet = new Set([...primaryCommon, ...secondaryCommon]);

const frequency = new Map();
for (const row of subtlex.data) {
  if (row.Character && row.CHRCount) {
    frequency.set(row.Character, Number(row.CHRCount));
  }
}

function normalizeFinal(rawFinal) {
  let final = rawFinal
    .replace(/[1-5]$/u, '')
    .replace(/v/gu, 'ü')
    .toLowerCase();

  const direct = new Map([
    ['iang', 'ang'],
    ['uang', 'ang'],
    ['ang', 'ang'],
    ['ian', 'an'],
    ['uan', 'an'],
    ['üan', 'an'],
    ['an', 'an'],
    ['ing', 'eng'],
    ['ueng', 'eng'],
    ['eng', 'eng'],
    ['in', 'en'],
    ['un', 'en'],
    ['ün', 'en'],
    ['uen', 'en'],
    ['en', 'en'],
    ['iong', 'ong'],
    ['ong', 'ong'],
    ['iu', 'ou'],
    ['iou', 'ou'],
    ['ou', 'ou'],
    ['ui', 'ei'],
    ['uei', 'ei'],
    ['ei', 'ei'],
    ['iao', 'ao'],
    ['ao', 'ao'],
    ['uai', 'ai'],
    ['ai', 'ai'],
    ['ia', 'a'],
    ['ua', 'a'],
    ['a', 'a'],
    ['ie', 'e'],
    ['üe', 'e'],
    ['ue', 'e'],
    ['e', 'e'],
    ['uo', 'o'],
    ['o', 'o'],
  ]);

  if (direct.has(final)) return direct.get(final);
  return final;
}

function parseReading(reading) {
  const tone = Number(reading.match(/[1-5]$/u)?.[0] ?? 5);
  const { initial, final } = getInitialAndFinal(reading);
  return {
    pinyin: reading,
    initial: initial || '',
    final: final.replace(/[1-5]$/u, ''),
    rhyme: normalizeFinal(final),
    tone,
  };
}

function uniqueReadings(char) {
  const raw = pinyin(char, {
    type: 'array',
    toneType: 'num',
    multiple: true,
    v: true,
  });
  return [...new Set(raw)].map(parseReading);
}

const characters = [...new Set([...primaryCommon, ...secondaryCommon])].filter((char) =>
  /[\u4e00-\u9fff]/u.test(char),
);

const entries = [];
const readingsByChar = {};

for (const char of characters) {
  const readings = uniqueReadings(char).filter((reading) => reading.tone >= 1 && reading.tone <= 4);
  if (!readings.length) continue;

  const rank =
    frequency.has(char)
      ? 1_000_000_000 - frequency.get(char)
      : primaryCommon.includes(char)
        ? 2_000_000 + primaryCommon.indexOf(char)
        : 3_000_000 + secondaryCommon.indexOf(char);

  readingsByChar[char] = readings.map((reading) => ({
    ...reading,
    rank,
    commonTier: primaryCommon.includes(char) ? 1 : 2,
  }));

  for (const reading of readings) {
    if (!INITIALS.includes(reading.initial)) continue;
    entries.push({
      char,
      ...reading,
      rank,
      commonTier: primaryCommon.includes(char) ? 1 : 2,
      frequency: frequency.get(char) ?? 0,
    });
  }
}

entries.sort((a, b) => a.rank - b.rank || a.char.localeCompare(b.char, 'zh-Hans-CN'));

const groups = {};
for (const entry of entries) {
  groups[entry.rhyme] ??= {};
  groups[entry.rhyme][entry.initial] ??= { final: entry.final, tones: { 1: [], 2: [], 3: [], 4: [] } };
  groups[entry.rhyme][entry.initial].final ||= entry.final;
  const toneGroup = groups[entry.rhyme][entry.initial].tones[entry.tone];
  if (!toneGroup.some((item) => item.char === entry.char)) {
    toneGroup.push({
      char: entry.char,
      pinyin: entry.pinyin,
      final: entry.final,
      rank: entry.rank,
      commonTier: entry.commonTier,
      frequency: entry.frequency,
    });
  }
}

for (const rhyme of Object.keys(groups)) {
  for (const initial of Object.keys(groups[rhyme])) {
    for (const tone of ['1', '2', '3', '4']) {
      groups[rhyme][initial].tones[tone] = groups[rhyme][initial].tones[tone]
        .sort((a, b) => a.rank - b.rank || a.char.localeCompare(b.char, 'zh-Hans-CN'))
        .slice(0, 12);
    }
  }
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(
  outPath,
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      source: 'common-chinese-characters + SUBTLEX-CH-CHR + pinyin-pro',
      initials: INITIALS.filter(Boolean),
      characters: readingsByChar,
      groups,
    },
    null,
    2,
  )}\n`,
);

console.log(`Generated ${outPath} with ${characters.length} common characters.`);
