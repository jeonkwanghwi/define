// screens-main.jsx — Record (main) + Journal + Word detail timeline
const { useState, useRef, useEffect } = React;

/* ============ helpers ============ */
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
function fmtKDate(d) {
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEKDAYS[d.getDay()]}요일`;
}
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/* ============ Date picker bottom sheet ============ */
function DateSheet({ selected, onPick, onClose }) {
  const [view, setView] = useState(new Date(selected.getFullYear(), selected.getMonth(), 1));
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const year = view.getFullYear(), month = view.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(new Date(year, month, d));
  const canPrev = true;
  const canNext = new Date(year, month + 1, 1) <= today;

  return (
    <div className="sheet-scrim" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip"></div>
        <div className="cal-head">
          <button className="cal-nav" onClick={() => setView(new Date(year, month - 1, 1))}><Icon name="chevronL" size={20} /></button>
          <div className="cal-title">{year}년 {month + 1}월</div>
          <button className="cal-nav" disabled={!canNext} onClick={() => canNext && setView(new Date(year, month + 1, 1))}><Icon name="chevronR" size={20} /></button>
        </div>
        <div className="cal-dow">{WEEKDAYS.map((w) => <span key={w}>{w}</span>)}</div>
        <div className="cal-grid">
          {cells.map((c, i) => {
            if (!c) return <span key={i}></span>;
            const future = c > today;
            const isSel = sameDay(c, selected);
            const isToday = sameDay(c, today);
            return (
              <button key={i} disabled={future}
                className={"cal-cell" + (isSel ? " sel" : "") + (isToday ? " today" : "") + (future ? " future" : "")}
                onClick={() => { onPick(c); onClose(); }}>
                {c.getDate()}
              </button>
            );
          })}
        </div>
        <div className="cal-hint">미래 날짜는 선택할 수 없어요</div>
      </div>
    </div>
  );
}

/* ============ Custom word sheet ============ */
function CustomWordSheet({ onAdd, onClose }) {
  const [val, setVal] = useState("");
  const ref = useRef();
  useEffect(() => { ref.current && ref.current.focus(); }, []);
  return (
    <div className="sheet-scrim" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip"></div>
        <div className="sheet-title">어떤 단어를 정의할까요?</div>
        <input ref={ref} className="field" placeholder="예: 자유, 외로움, 엄마…" value={val}
          maxLength={12} onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && val.trim()) { onAdd(val.trim()); onClose(); } }} />
        <button className="btn btn-primary btn-block" disabled={!val.trim()}
          onClick={() => { onAdd(val.trim()); onClose(); }}>완료</button>
      </div>
    </div>
  );
}

/* ============ MAIN — Record ============ */
function RecordScreen({ onSaved, savedWords }) {
  const D = window.DEFINE_DATA;
  const [pool, setPool] = useState(D.todayWords);
  const [idx, setIdx] = useState(0);
  const [word, setWord] = useState(D.todayWords[0]);
  const [text, setText] = useState("");
  const [date, setDate] = useState(new Date());
  const [showDate, setShowDate] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [swap, setSwap] = useState(false);
  const [done, setDone] = useState(false);
  const taRef = useRef();

  const isToday = sameDay(date, new Date());
  const already = savedWords.includes(word);

  function drawNew() {
    setSwap(true);
    setTimeout(() => {
      const next = (idx + 1) % pool.length;
      setIdx(next); setWord(pool[next]); setSwap(false);
    }, 180);
  }
  function addCustom(w) {
    setSwap(true);
    setTimeout(() => {
      setPool((p) => [w, ...p]); setIdx(0); setWord(w); setSwap(false);
      taRef.current && taRef.current.focus();
    }, 180);
  }
  function complete() {
    if (!text.trim()) return;
    setDone(true);
    onSaved({ word, text: text.trim(), date });
    setTimeout(() => { setDone(false); setText(""); drawNew(); }, 1900);
  }

  return (
    <div className="screen record-screen">
      {/* date selector */}
      <button className="date-chip" onClick={() => setShowDate(true)}>
        <Icon name="calendar" size={16} />
        <span>{fmtKDate(date)}</span>
        {isToday && <span className="date-today">오늘</span>}
        <Icon name="chevronD" size={15} style={{ opacity: .5 }} />
      </button>

      {/* hero word */}
      <div className="hero-word-wrap">
        <div className="hero-cap">오늘의 단어</div>
        <div className={"hero-word" + (swap ? " swap" : "")}>
          {word}<span className="hero-suffix">이란</span>
        </div>
        <button className="redraw" onClick={drawNew}>
          <Icon name="shuffle" size={15} /> 새로운 단어 뽑기
        </button>
        {already && <div className="already-note">이미 오늘 정의한 단어예요 · 다시 적어도 괜찮아요</div>}
      </div>

      {/* the stage — input */}
      <div className="input-stage">
        <textarea ref={taRef} className="define-input" value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`나에게 ${word}이란…`} />
        <div className="input-foot">
          <span className="input-hint">마음 가는 대로 적어보세요</span>
          <span className="input-count">{text.length}자</span>
        </div>
      </div>

      {/* actions */}
      <div className="record-actions">
        <button className="btn btn-soft" onClick={() => setShowCustom(true)}>
          <Icon name="plus" size={17} /> 단어 추가
        </button>
        <button className="btn btn-primary btn-grow" disabled={!text.trim()} onClick={complete}>
          기록 완료
        </button>
      </div>

      {showDate && <DateSheet selected={date} onPick={setDate} onClose={() => setShowDate(false)} />}
      {showCustom && <CustomWordSheet onAdd={addCustom} onClose={() => setShowCustom(false)} />}

      {/* completion micro-interaction */}
      {done && (
        <div className="done-scrim">
          <div className="done-card">
            <div className="done-check"><Icon name="check" size={34} stroke={2.4} color="#fff" /></div>
            <div className="done-title">{word}을(를) 기록했어요</div>
            <div className="done-sub">오늘의 나를 한 조각 남겼어요</div>
            <div className="done-ruby"><Icon name="ruby" size={15} /> +5 루비</div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============ Word detail — timeline ============ */
function WordDetail({ item, onClose }) {
  return (
    <div className="screen detail-screen">
      <div className="detail-head">
        <button className="icon-btn" onClick={onClose}><Icon name="back" size={22} /></button>
        <div className="detail-word">{item.word}</div>
        <span style={{ width: 40 }}></span>
      </div>
      {item.changed && (
        <div className="change-banner">
          <Icon name="sparkle" size={18} color="var(--point-600)" />
          <div>
            <div className="cb-title">생각이 변했어요</div>
            <div className="cb-sub">{item.changeNote}</div>
          </div>
        </div>
      )}
      <div className="detail-count">{item.entries.length}번의 정의 · 시간순</div>
      <div className="tl big">
        {item.entries.map((e, i) => (
          <div className={"tl-node" + (i === 0 ? " now" : "")} key={i}>
            <div className="tl-meta">
              <span className="tl-rel">{e.rel}</span>
              <span className="tl-date">{e.date}</span>
            </div>
            <div className="tl-quote">{e.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============ Journal list ============ */
function JournalScreen({ onOpen }) {
  const D = window.DEFINE_DATA;
  const sorted = [...D.journal].sort((a, b) => a.word.localeCompare(b.word, "ko"));
  return (
    <div className="screen list-screen">
      <div className="screen-title-row">
        <h1 className="screen-title">나만의 단어장</h1>
        <span className="count-pill">{D.journal.length}개 단어</span>
      </div>
      <div className="stat-strip">
        <div className="stat"><div className="stat-num">{D.journal.reduce((s, w) => s + w.entries.length, 0)}</div><div className="stat-lab">총 기록</div></div>
        <div className="stat"><div className="stat-num">{D.journal.filter(w => w.changed).length}</div><div className="stat-lab">생각 변화</div></div>
        <div className="stat"><div className="stat-num">{DEFINE_DATA.user.streak}일</div><div className="stat-lab">연속 기록</div></div>
      </div>
      <div className="word-list">
        {sorted.map((w) => (
          <button className="word-row" key={w.word} onClick={() => onOpen(w)}>
            <div className="wr-main">
              <div className="wr-word">{w.word}</div>
              <div className="wr-latest">{w.entries[0].text}</div>
            </div>
            <div className="wr-side">
              {w.changed && <span className="badge-change sm">↗ 변화</span>}
              <span className="wr-n">{w.entries.length}</span>
              <Icon name="chevronR" size={18} style={{ opacity: .35 }} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { RecordScreen, WordDetail, JournalScreen });
