import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Clipboard,
  Code2,
  History,
  Search,
  Shuffle,
  Star,
  X,
} from 'lucide-react';
import data from './data/rhyme-index.json';
import { lastHanChar, readingsForChar, type Reading, type Tone } from './rhyme';
import './styles.css';

const REPO_URL = 'https://github.com/holynova/char_finder';
const TONES: Tone[] = [1, 2, 3, 4];

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

function adjacentInitials(selected: string, available: string[]) {
  if (!available.length) return [];
  const selectedIndex = Math.max(0, available.indexOf(selected));
  const neighbors = available
    .filter((initial) => initial !== selected)
    .sort((a, b) => {
      const aDistance = Math.abs(available.indexOf(a) - selectedIndex);
      const bDistance = Math.abs(available.indexOf(b) - selectedIndex);
      return aDistance - bDistance || available.indexOf(a) - available.indexOf(b);
    });
  return [available[selectedIndex], ...neighbors].filter(Boolean).slice(0, 4);
}

function App() {
  const [query, setQuery] = useState('月光');
  const [readingIndex, setReadingIndex] = useState(0);
  const [selectedInitial, setSelectedInitial] = useState('w');
  const [commonOnly, setCommonOnly] = useState(true);
  const [randomSeed, setRandomSeed] = useState(7);
  const [selectedChar, setSelectedChar] = useState('望');
  const [toast, setToast] = useState('');
  const [saved, setSaved] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('saved-rhymes') ?? '[]') as string[];
    } catch {
      return [];
    }
  });

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
  const visibleInitials = useMemo(() => {
    return adjacentInitials(selectedInitial, availableInitials);
  }, [availableInitials, selectedInitial]);

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

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 1600);
  };

  const copyChar = async (char: string) => {
    setSelectedChar(char);
    await navigator.clipboard?.writeText(char);
    showToast(`已复制「${char}」`);
  };

  const continueWith = (char = selectedChar) => {
    if (!char) return;
    setQuery(char);
    setSelectedChar(char);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleSave = () => {
    if (!selectedChar) return;
    const next = saved.includes(selectedChar)
      ? saved.filter((char) => char !== selectedChar)
      : [selectedChar, ...saved].slice(0, 12);
    setSaved(next);
    localStorage.setItem('saved-rhymes', JSON.stringify(next));
    showToast(saved.includes(selectedChar) ? '已取消收藏' : `已收藏「${selectedChar}」`);
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
                onClick={() => setSelectedInitial(initial)}
              >
                {initial}
              </button>
            );
          })}
        </div>
      </section>

      <section className="results section-line" aria-label="押韵结果">
        <div className="tone-legend">
          <span>声调</span>
          {TONES.map((tone) => (
            <b className={tone === activeReading?.tone ? 'active' : ''} key={tone}>
              <i>{tone}</i>
            </b>
          ))}
        </div>

        <div className="result-list">
          {visibleInitials.map((initial) => {
            const group = rhymeGroups[initial];
            return (
              <article className={initial === selectedInitial ? 'result-row selected' : 'result-row'} key={initial}>
                <button className="row-head" type="button" onClick={() => setSelectedInitial(initial)}>
                  <strong>{initial}</strong>
                  <span>+ {activeReading?.rhyme}</span>
                </button>
                <div className="tone-slots">
                  {TONES.map((tone) => {
                    const items = toneItems(group, tone, commonOnly).filter(
                      (item) => item.char !== targetChar,
                    );
                    const [primary, ...rest] = items.slice(0, 5);
                    return (
                      <div
                        className={tone === activeReading?.tone ? 'tone-slot active-tone' : 'tone-slot'}
                        key={`${initial}-${tone}`}
                      >
                        {primary ? (
                          <>
                            <button
                              type="button"
                              className={primary.char === selectedChar ? 'char-chip main selected' : 'char-chip main'}
                              onClick={() => setSelectedChar(primary.char)}
                              onDoubleClick={() => continueWith(primary.char)}
                            >
                              {primary.char}
                            </button>
                            <div className="mini-chips">
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
                          </>
                        ) : (
                          <span className="empty-tone">-</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {saved.length > 0 && (
        <section className="saved-strip" aria-label="收藏">
          <span>收藏</span>
          {saved.slice(0, 6).map((char) => (
            <button type="button" key={char} onClick={() => setSelectedChar(char)}>
              {char}
            </button>
          ))}
        </section>
      )}

      <nav className="action-bar" aria-label="操作">
        <button type="button" onClick={() => selectedChar && copyChar(selectedChar)}>
          <Clipboard size={22} />
          复制
        </button>
        <button type="button" onClick={toggleSave}>
          <Star size={22} />
          收藏
        </button>
        <button type="button" className="primary" onClick={() => continueWith()}>
          <ArrowRight size={24} />
          以此字继续
        </button>
      </nav>

      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}

export default App;
