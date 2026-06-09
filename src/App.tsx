import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Code2,
  History,
  Search,
  Shuffle,
  X,
} from 'lucide-react';
import data from './data/rhyme-index.json';
import { lastHanChar, readingsForChar, type Reading, type Tone } from './rhyme';
import './styles.css';

const REPO_URL = 'https://github.com/holynova/char_finder';
const TONES: Tone[] = [1, 2, 3, 4];
const TONE_LABELS: Record<Tone, string> = {
  1: '1声',
  2: '2声',
  3: '3声',
  4: '4声',
};

type RhymeItem = {
  char: string;
  pinyin: string;
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

function hasItems(group: RhymeGroup | undefined, commonOnly: boolean) {
  return TONES.some((tone) => toneItems(group, tone, commonOnly).length > 0);
}

function uniqueByChar(items: RhymeItem[]) {
  return [...new Map(items.map((item) => [item.char, item])).values()];
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

function App() {
  const [query, setQuery] = useState('月光');
  const [readingIndex, setReadingIndex] = useState(0);
  const [selectedInitial, setSelectedInitial] = useState('b');
  const [commonOnly, setCommonOnly] = useState(true);
  const [randomSeed, setRandomSeed] = useState(7);
  const [selectedChar, setSelectedChar] = useState('望');
  const resultListRef = useRef<HTMLDivElement | null>(null);
  const resultRefs = useRef(new Map<string, HTMLElement>());

  const targetChar = lastHanChar(query);
  const readings = useMemo(() => mergeReadings(targetChar), [targetChar]);
  const activeReading = readings[Math.min(readingIndex, Math.max(readings.length - 1, 0))];
  const rhymeGroups = activeReading ? index.groups[activeReading.rhyme] ?? {} : {};

  const availableInitials = useMemo(
    () => index.initials.filter((initial) => hasItems(rhymeGroups[initial], commonOnly)),
    [commonOnly, rhymeGroups],
  );

  useEffect(() => {
    setReadingIndex(0);
  }, [targetChar]);

  useEffect(() => {
    if (!availableInitials.length) return;
    if (!availableInitials.includes(selectedInitial)) {
      setSelectedInitial(availableInitials[0]);
    }
  }, [availableInitials, selectedInitial]);

  const displayInitials = index.initials;
  const visibleInitials = availableInitials;

  const allCurrentItems = useMemo(() => {
    return uniqueByChar(
      Object.values(rhymeGroups).flatMap((group) =>
        TONES.flatMap((tone) => toneItems(group, tone, commonOnly)),
      ),
    ).filter((item) => item.char !== targetChar);
  }, [commonOnly, rhymeGroups, targetChar]);

  const inspiration = useMemo(
    () => pickRandom(allCurrentItems.slice(0, 80), randomSeed),
    [allCurrentItems, randomSeed],
  );

  const continueWith = (char = selectedChar) => {
    if (!char) return;
    setQuery(char);
    setSelectedChar(char);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
        <div>
          <p className="eyebrow">SAME RIME</p>
          <h1>韵脚画布</h1>
        </div>
        <div className="header-actions">
          <a className="icon-link" href={REPO_URL} aria-label="GitHub repository">
            <Code2 size={20} />
          </a>
          <button className="icon-link" type="button" aria-label="查看历史">
            <History size={20} />
          </button>
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
        <button className="search-btn" type="button" onClick={() => setRandomSeed(Date.now())}>
          <Search size={24} />
          <span>查韵</span>
        </button>
      </section>

      <section className="inspiration section-line" aria-label="随机灵感">
        <div className="inspiration-row">
          {inspiration.map((item) => (
            <button
              type="button"
              key={`${item.char}-${item.pinyin}`}
              className={item.char === selectedChar ? 'idea-chip selected' : 'idea-chip'}
              onClick={() => setSelectedChar(item.char)}
              onDoubleClick={() => continueWith(item.char)}
            >
              {item.char}
            </button>
          ))}
          <button className="shuffle-btn" type="button" onClick={() => setRandomSeed(Date.now())} aria-label="换一批">
            <Shuffle size={16} />
          </button>
          {!inspiration.length && <p className="muted">没有找到可用的常用押韵字。</p>}
        </div>
      </section>

      <section className="initials section-line" aria-label="选择声母">
        <div className="section-title">
          <h2>选择声母</h2>
          <label className="common-toggle">
            <input
              type="checkbox"
              checked={commonOnly}
              onChange={(event) => setCommonOnly(event.target.checked)}
            />
            <CheckCircle2 size={16} />
            常用字已过滤
          </label>
        </div>
        <div className="initial-grid">
          {displayInitials.map((initial) => {
            const disabled = !availableInitials.includes(initial);
            return (
              <button
                type="button"
                key={initial}
                disabled={disabled}
                className={initial === selectedInitial ? 'active' : ''}
                onClick={() => chooseInitial(initial)}
              >
                {initial}
              </button>
            );
          })}
        </div>
      </section>

      <section className="results section-line" aria-label="押韵结果">
        <div className="result-list" ref={resultListRef} onScroll={syncInitialFromScroll}>
          {visibleInitials.map((initial) => {
            const group = rhymeGroups[initial];
            const toneRows = TONES.map((tone) => ({
              tone,
              items: toneItems(group, tone, commonOnly)
                .filter((item) => item.char !== targetChar)
                .slice(0, 5),
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
                  <span>+ {activeReading?.rhyme}</span>
                </button>
                <div className="card-tones">
                  {toneRows.length ? (
                    toneRows.map(({ tone, items }) => {
                      const [primary, ...rest] = items;

                      return (
                        <div
                          className={tone === activeReading?.tone ? 'card-tone active-tone' : 'card-tone'}
                          key={`${initial}-${tone}`}
                        >
                          <b>{TONE_LABELS[tone]}</b>
                          <div className="card-chars">
                            <button
                              type="button"
                              className={primary.char === selectedChar ? 'char-chip main selected' : 'char-chip main'}
                              onClick={() => setSelectedChar(primary.char)}
                              onDoubleClick={() => continueWith(primary.char)}
                            >
                              {primary.char}
                            </button>
                            {rest.map((item) => (
                              <button
                                type="button"
                                className={item.char === selectedChar ? 'char-chip selected' : 'char-chip'}
                                key={`${item.char}-${item.pinyin}`}
                                onClick={() => setSelectedChar(item.char)}
                                onDoubleClick={() => continueWith(item.char)}
                              >
                                {item.char}
                              </button>
                            ))}
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
        </div>
      </section>

    </main>
  );
}

export default App;
