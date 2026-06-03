import { getInitialAndFinal, pinyin } from 'pinyin-pro';

export type Tone = 1 | 2 | 3 | 4;

export type Reading = {
  pinyin: string;
  initial: string;
  final: string;
  rhyme: string;
  tone: Tone;
  rank?: number;
  commonTier?: 1 | 2;
};

const TONE_RE = /[1-5]$/u;
const HAN_RE = /[\u4e00-\u9fff]/u;

export function lastHanChar(text: string) {
  return Array.from(text).reverse().find((char) => HAN_RE.test(char)) ?? '';
}

export function normalizeFinal(rawFinal: string) {
  const final = rawFinal.replace(TONE_RE, '').replace(/v/gu, 'ü').toLowerCase();

  const direct: Record<string, string> = {
    iang: 'ang',
    uang: 'ang',
    ang: 'ang',
    ian: 'an',
    uan: 'an',
    üan: 'an',
    an: 'an',
    ing: 'eng',
    ueng: 'eng',
    eng: 'eng',
    in: 'en',
    un: 'en',
    ün: 'en',
    uen: 'en',
    en: 'en',
    iong: 'ong',
    ong: 'ong',
    iu: 'ou',
    iou: 'ou',
    ou: 'ou',
    ui: 'ei',
    uei: 'ei',
    ei: 'ei',
    iao: 'ao',
    ao: 'ao',
    uai: 'ai',
    ai: 'ai',
    ia: 'a',
    ua: 'a',
    a: 'a',
    ie: 'e',
    üe: 'e',
    ue: 'e',
    e: 'e',
    uo: 'o',
    o: 'o',
  };

  return direct[final] ?? final;
}

export function parseReading(reading: string): Reading | null {
  const tone = Number(reading.match(TONE_RE)?.[0] ?? 5);
  if (tone < 1 || tone > 4) return null;

  const { initial, final } = getInitialAndFinal(reading);
  return {
    pinyin: reading,
    initial: initial || '',
    final: final.replace(TONE_RE, ''),
    rhyme: normalizeFinal(final),
    tone: tone as Tone,
  };
}

export function readingsForChar(char: string): Reading[] {
  if (!char) return [];
  const readings = pinyin(char, {
    type: 'array',
    toneType: 'num',
    multiple: true,
    v: true,
  });

  return [...new Set(readings)]
    .map(parseReading)
    .filter((reading): reading is Reading => Boolean(reading));
}

export function toneName(tone: Tone) {
  return ({ 1: '平', 2: '扬', 3: '转', 4: '落' } as const)[tone];
}
