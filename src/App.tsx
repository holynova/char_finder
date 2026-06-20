import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronRight,
  Shuffle,
  X,
} from 'lucide-react';
import data from './data/rhyme-index.json';
import { lastHanChar, readingsForChar, type Reading, type Tone } from './rhyme';
import './styles.css';

const REPO_URL = 'https://github.com/holynova/char_finder';
const AUTHOR_NAME = 'holynova';
const APP_VERSION = '1.0.1';
const TONES: Tone[] = [1, 2, 3, 4];
const INLINE_RESULT_LIMIT = 6;
const INLINE_RESULT_LIMIT_WITH_MORE = 5;
const TONE_LABELS: Record<Tone, string> = {
  1: '1声',
  2: '2声',
  3: '3声',
  4: '4声',
};

type RhymeItem = {
  char: string;
  pinyin: string;
  final?: string;
  rank: number;
  commonTier: 1 | 2;
  frequency: number;
};

type RhymeGroup = {
  final: string;
  tones: Record<string, RhymeItem[]>;
};

type IndexData = {
  initials: string[];
  characters: Record<string, Reading[]>;
  groups: Record<string, Record<string, RhymeGroup>>;
};

const index = data as IndexData;

function GitHubMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" width="18" height="18" fill="currentColor">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82A7.65 7.65 0 0 1 8 4.38c.68 0 1.36.09 2 .26 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.19 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
      />
    </svg>
  );
}

function rhymeLabel(reading: Reading | undefined, exactOnly: boolean) {
  if (!reading) return '';
  if (exactOnly || reading.final === reading.rhyme) return reading.final;
  return `${reading.final}≈${reading.rhyme}`;
}

function rhymeLabelParts(reading: Reading | undefined, exactOnly: boolean) {
  if (!reading) return [];
  if (exactOnly || reading.final === reading.rhyme) return ['+', reading.final];
  return ['+', reading.final, '≈', reading.rhyme];
}

function mergeReadings(char: string) {
  const fromIndex = index.characters[char] ?? [];
  const fromRuntime = readingsForChar(char);
  const byPinyin = new Map<string, Reading>();

  [...fromIndex, ...fromRuntime].forEach((reading) => {
    byPinyin.set(reading.pinyin, reading);
  });

  return [...byPinyin.values()].sort(
    (a, b) => (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER),
  );
}

function toneItems(group: RhymeGroup | undefined, tone: Tone, commonOnly: boolean) {
  return (group?.tones[String(tone)] ?? []).filter((item) => !commonOnly || item.commonTier === 1);
}

function itemFinal(item: RhymeItem) {
  return item.final ?? readingsForChar(item.char).find((reading) => reading.pinyin === item.pinyin)?.final ?? '';
}

function finalMatches(item: RhymeItem, final: string | undefined) {
  return !final || itemFinal(item) === final;
}

function sortByResultPriority(items: RhymeItem[], final: string | undefined) {
  return [...items].sort((a, b) => {
    const exactDelta = Number(finalMatches(b, final)) - Number(finalMatches(a, final));
    return (
      exactDelta ||
      b.frequency - a.frequency ||
      a.commonTier - b.commonTier ||
      a.rank - b.rank ||
      a.char.localeCompare(b.char, 'zh-Hans-CN')
    );
  });
}

function displayToneItems(
  group: RhymeGroup | undefined,
  tone: Tone,
  commonOnly: boolean,
  final: string | undefined,
  exactOnly: boolean,
) {
  const items = toneItems(group, tone, commonOnly);
  const filtered = exactOnly ? items.filter((item) => finalMatches(item, final)) : items;
  return sortByResultPriority(filtered, final);
}

function hasItems(group: RhymeGroup | undefined, commonOnly: boolean, final: string | undefined, exactOnly: boolean) {
  return TONES.some((tone) => displayToneItems(group, tone, commonOnly, final, exactOnly).length > 0);
}

function uniqueByChar(items: RhymeItem[]) {
  return [...new Map(items.map((item) => [item.char, item])).values()];
}

function uniqueRhymeReadings(readings: Reading[]) {
  return [...new Map(readings.map((reading) => [`${reading.final}-${reading.rhyme}`, reading])).values()];
}

function pickRandom(items: RhymeItem[], seed: number) {
  const pool = [...items];
  let state = seed || 1;
  const next = () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };

  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return pool.slice(0, 8);
}

function pickToneFirstRandom(items: RhymeItem[], preferredTone: Tone | undefined, seed: number) {
  if (!preferredTone) return pickRandom(items, seed);

  const preferred = items.filter((item) => Number(item.pinyin.match(/[1-4]$/u)?.[0]) === preferredTone);
  const fallback = items.filter((item) => Number(item.pinyin.match(/[1-4]$/u)?.[0]) !== preferredTone);

  return [...pickRandom(preferred, seed), ...pickRandom(fallback, seed + 1)].slice(0, 8);
}

const trackEvent = (name: string, props?: Record<string, any>) => {
  try {
    if (window.umami && typeof window.umami.track === 'function') {
      window.umami.track(name, props);
    }
  } catch (err) {
    console.error('Umami track failed:', err);
  }
};

function App() {
  const [query, setQuery] = useState('月光');
  const [readingIndex, setReadingIndex] = useState(0);
  const [selectedInitial, setSelectedInitial] = useState('b');
  const [exactOnly, setExactOnly] = useState(false);
  const [randomSeed, setRandomSeed] = useState(7);
  const [selectedChar, setSelectedChar] = useState('望');
  const [morePanel, setMorePanel] = useState<{ initial: string; tone: Tone; items: RhymeItem[] } | null>(null);
  const resultListRef = useRef<HTMLDivElement | null>(null);
  const resultRefs = useRef(new Map<string, HTMLElement>());
  const commonOnly = false;

  const targetChar = lastHanChar(query);
  const readings = useMemo(() => mergeReadings(targetChar), [targetChar]);
  const rhymeReadings = useMemo(() => uniqueRhymeReadings(readings), [readings]);
  const activeReading = rhymeReadings[Math.min(readingIndex, Math.max(rhymeReadings.length - 1, 0))];
  const rhymeGroups = activeReading ? index.groups[activeReading.rhyme] ?? {} : {};

  const availableInitials = useMemo(
    () => index.initials.filter((initial) => hasItems(rhymeGroups[initial], commonOnly, activeReading?.final, exactOnly)),
    [activeReading?.final, commonOnly, exactOnly, rhymeGroups],
  );

  // Debounced search query tracking
  useEffect(() => {
    if (!query || !query.trim()) return;
    const timer = setTimeout(() => {
      trackEvent('search_query', { query });
    }, 1000);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setReadingIndex(0);
  }, [targetChar]);

  useEffect(() => {
    if (!availableInitials.length) return;
    if (!availableInitials.includes(selectedInitial)) {
      setSelectedInitial(availableInitials[0]);
    }
  }, [availableInitials, selectedInitial]);

  const visibleInitials = availableInitials;

  const allCurrentItems = useMemo(() => {
    return uniqueByChar(
      Object.values(rhymeGroups).flatMap((group) =>
        TONES.flatMap((tone) => displayToneItems(group, tone, commonOnly, activeReading?.final, exactOnly)),
      ),
    ).filter((item) => item.char !== targetChar);
  }, [activeReading?.final, commonOnly, exactOnly, rhymeGroups, targetChar]);

  const inspiration = useMemo(
    () => pickToneFirstRandom(allCurrentItems.slice(0, 80), activeReading?.tone, randomSeed),
    [activeReading?.tone, allCurrentItems, randomSeed],
  );

  const continueWith = (char = selectedChar) => {
    if (!char) return;
    setQuery(char);
    setSelectedChar(char);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    trackEvent('continue_rhyme', { char });
  };

  const chooseInitial = (initial: string) => {
    setSelectedInitial(initial);
    requestAnimationFrame(() => {
      const target = resultRefs.current.get(initial);
      const list = resultListRef.current;
      if (!target || !list) return;
      list.scrollTo({
        top: target.offsetTop,
        behavior: 'smooth',
      });
    });
    trackEvent('select_initial', { initial });
  };

  const syncInitialFromScroll = () => {
    const list = resultListRef.current;
    if (!list) return;

    const listTop = list.getBoundingClientRect().top;
    const firstVisible = visibleInitials.find((initial) => {
      const row = resultRefs.current.get(initial);
      if (!row) return false;
      return row.getBoundingClientRect().bottom > listTop + 1;
    });

    if (firstVisible && firstVisible !== selectedInitial) {
      setSelectedInitial(firstVisible);
    }
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <h1>韵脚画布</h1>
        <div className="header-actions">
          <a className="icon-link" href={REPO_URL} aria-label="GitHub repository">
            <GitHubMark />
          </a>
        </div>
      </header>

      <section className="composer" aria-label="查询输入">
        <label className="query-box">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="输入中文词句"
            autoFocus
          />
          {query && (
            <button type="button" className="clear-btn" onClick={() => setQuery('')} aria-label="清空">
              <X size={18} />
            </button>
          )}
          {targetChar && <span className="target-chip">{targetChar}</span>}
        </label>
        <label className={exactOnly ? 'common-toggle exact-toggle active' : 'common-toggle exact-toggle'}>
          <input
            type="checkbox"
            checked={exactOnly}
            onChange={(event) => {
              const checked = event.target.checked;
              setExactOnly(checked);
              trackEvent('toggle_exact', { enabled: checked });
            }}
          />
          <span>精确</span>
        </label>
      </section>

      {targetChar && (
        <section className="initials section-line" aria-label="选择声母">
          <div className="settings-row">
            <div className="initial-grid" aria-label="声母">
              {visibleInitials.map((initial) => (
                <button
                  type="button"
                  key={initial}
                  className={initial === selectedInitial ? 'active' : ''}
                  onClick={() => chooseInitial(initial)}
                >
                  {initial}
                </button>
              ))}
            </div>
          </div>
          {rhymeReadings.length > 1 && (
            <div className="rhyme-options" aria-label="押韵韵母">
              {rhymeReadings.map((reading, idx) => (
                <button
                  type="button"
                  key={`${reading.pinyin}-${reading.final}-${reading.rhyme}`}
                  className={reading === activeReading ? 'active' : ''}
                  onClick={() => {
                    setReadingIndex(idx);
                    trackEvent('select_reading', { pinyin: reading.pinyin });
                  }}
                >
                  {reading.pinyin}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="results section-line" aria-label="押韵结果">
        {targetChar && (
          <div className="inspiration-strip" aria-label="随机灵感">
            {inspiration.map((item) => (
              <button
                type="button"
                key={`${item.char}-${item.pinyin}`}
                data-final={itemFinal(item)}
                className={item.char === selectedChar ? 'idea-chip selected' : 'idea-chip'}
                onClick={() => {
                  setSelectedChar(item.char);
                  trackEvent('select_character', { char: item.char, source: 'inspiration' });
                }}
                onDoubleClick={() => continueWith(item.char)}
              >
                {item.char}
              </button>
            ))}
            <button
              className="shuffle-btn"
              type="button"
              onClick={() => {
                setRandomSeed(Date.now());
                trackEvent('shuffle_inspiration');
              }}
              aria-label="换一批"
            >
              <Shuffle size={15} />
            </button>
            {!inspiration.length && <p className="muted">没有找到可用的常用押韵字。</p>}
          </div>
        )}
        <div className="result-list" ref={resultListRef} onScroll={syncInitialFromScroll}>
          {!targetChar && (
            <div className="empty-state">
              <strong>输入一个汉字或词句</strong>
              <p>会自动取最后一个汉字查找同韵脚结果。</p>
              <div className="empty-examples" aria-label="示例">
                {['月光', '山川', '民', '男'].map((example) => (
                  <button type="button" key={example} onClick={() => setQuery(example)}>
                    {example}
                  </button>
                ))}
              </div>
            </div>
          )}
          {targetChar && visibleInitials.map((initial) => {
            const group = rhymeGroups[initial];
            const toneRows = TONES.map((tone) => ({
              tone,
              items: displayToneItems(group, tone, commonOnly, activeReading?.final, exactOnly)
                .filter((item) => item.char !== targetChar)
                .slice(0, 15),
            })).filter(({ items }) => items.length > 0);

            return (
              <article
                className="result-card"
                data-initial={initial}
                key={initial}
                ref={(node) => {
                  if (node) resultRefs.current.set(initial, node);
                  else resultRefs.current.delete(initial);
                }}
              >
                <button className="row-head" type="button" onClick={() => chooseInitial(initial)}>
                  <strong>{initial}</strong>
                  <span className="rhyme-stack" aria-label={`+ ${rhymeLabel(activeReading, exactOnly)}`}>
                    {rhymeLabelParts(activeReading, exactOnly).map((part, index) => (
                      <i key={`${part}-${index}`}>{part}</i>
                    ))}
                  </span>
                </button>
                <div className="card-tones">
                  {toneRows.length ? (
                    toneRows.map(({ tone, items }) => {
                      const hasMore = items.length > INLINE_RESULT_LIMIT;
                      const previewLimit = hasMore ? INLINE_RESULT_LIMIT_WITH_MORE : INLINE_RESULT_LIMIT;
                      const previewItems = items.slice(0, previewLimit);
                      const [primary, ...rest] = previewItems;

                      return (
                        <div
                          className={tone === activeReading?.tone ? 'card-tone active-tone' : 'card-tone'}
                          key={`${initial}-${tone}`}
                        >
                          <b>{TONE_LABELS[tone]}</b>
                          <div className={hasMore ? 'card-chars has-more' : 'card-chars'}>
                            <button
                              type="button"
                              data-final={itemFinal(primary)}
                              className={primary.char === selectedChar ? 'char-chip main selected' : 'char-chip main'}
                              onClick={() => {
                                setSelectedChar(primary.char);
                                trackEvent('select_character', { char: primary.char, source: 'result_list' });
                              }}
                              onDoubleClick={() => continueWith(primary.char)}
                            >
                              {primary.char}
                            </button>
                            {rest.map((item) => (
                              <button
                                type="button"
                                data-final={itemFinal(item)}
                                className={item.char === selectedChar ? 'char-chip selected' : 'char-chip'}
                                key={`${item.char}-${item.pinyin}`}
                                onClick={() => {
                                  setSelectedChar(item.char);
                                  trackEvent('select_character', { char: item.char, source: 'result_list' });
                                }}
                                onDoubleClick={() => continueWith(item.char)}
                              >
                                {item.char}
                              </button>
                            ))}
                            {hasMore && (
                              <button
                                type="button"
                                className="char-more"
                                aria-label={`查看更多${initial}${TONE_LABELS[tone]}`}
                                onClick={() => {
                                  setMorePanel({ initial, tone, items });
                                  trackEvent('view_more', { initial, tone });
                                }}
                              >
                                <ChevronRight size={18} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="empty-card">当前筛选下没有可展示的押韵字。</p>
                  )}
                </div>
              </article>
            );
          })}
          <footer className="app-footer">
            <span>作者</span>
            <a href="https://github.com/holynova">{AUTHOR_NAME}</a>
            <a href={REPO_URL}>GitHub</a>
            <span>v{APP_VERSION}</span>

            {/* 访问统计 (Vercount/不蒜子) */}
            <div className="footer-stats">
              <span id="busuanzi_container_site_pv">
                本站总访问量 <span id="busuanzi_value_site_pv" className="footer-stats-val">-</span> 次
              </span>
              <span>·</span>
              <span id="busuanzi_container_site_uv">
                访客数 <span id="busuanzi_value_site_uv" className="footer-stats-val">-</span> 人
              </span>
            </div>
          </footer>
        </div>
      </section>

      {morePanel && (
        <div className="more-overlay" role="dialog" aria-modal="true" aria-label="更多答案">
          <div className="more-sheet">
            <div className="more-head">
              <div>
                <p>{morePanel.initial} · {TONE_LABELS[morePanel.tone]}</p>
                <strong>{rhymeLabel(activeReading, exactOnly)}</strong>
              </div>
              <button type="button" className="more-close" onClick={() => setMorePanel(null)} aria-label="关闭">
                <X size={20} />
              </button>
            </div>
            <div className="more-grid">
              {morePanel.items.map((item) => (
                <button
                  type="button"
                  key={`${item.char}-${item.pinyin}`}
                  data-final={itemFinal(item)}
                  className={item.char === selectedChar ? 'more-char selected' : 'more-char'}
                  onClick={() => {
                    setSelectedChar(item.char);
                    trackEvent('select_character', { char: item.char, source: 'more_panel' });
                  }}
                  onDoubleClick={() => {
                    setMorePanel(null);
                    continueWith(item.char);
                  }}
                >
                  {item.char}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

    </main>
  );
}

export default App;
