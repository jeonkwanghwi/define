// screens-more.jsx — Plaza, Past-self chat, placeholder, My page, Attendance
const { useState: uS, useRef: uR, useEffect: uE } = React;

/* ============ 광장 — Plaza (reciprocity lock) ============ */
function PlazaScreen() {
  const D = window.DEFINE_DATA;
  const [shared, setShared] = uS(false); // 비공개 → 공유하면 잠금 해제
  return (
    <div className="screen list-screen">
      <div className="screen-title-row">
        <h1 className="screen-title">광장</h1>
        <button className={"share-toggle" + (shared ? " on" : "")} onClick={() => setShared(!shared)}>
          <span className="st-dot"></span>{shared ? "공개 중" : "비공개"}
        </button>
      </div>
      <p className="screen-sub">같은 단어, 저마다 다른 정의들</p>

      {!shared && (
        <div className="reciprocity">
          <div className="rc-icon"><Icon name="lock" size={20} color="var(--point-600)" /></div>
          <div className="rc-text">
            <b>내 생각을 공유해야 다른 사람들의 생각을 읽을 수 있어요</b>
            <span>공개로 바꾸면 광장의 모든 정의가 열려요</span>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShared(true)}>공유하고 열기</button>
        </div>
      )}

      <div className="plaza-feed">
        {D.plaza.map((grp) => (
          <div className="plaza-group" key={grp.word}>
            <div className="pg-head">
              <span className="pg-word">{grp.word}</span>
              <span className="pg-count">{grp.count.toLocaleString()}개의 정의</span>
            </div>
            <div className={"pg-cards" + (shared ? "" : " locked")}>
              {grp.defs.map((d, i) => (
                <div className="plaza-card" key={i}>
                  <div className="pc-text">{d.text}</div>
                  <div className="pc-author">— {d.author}</div>
                </div>
              ))}
              {!shared && (
                <div className="pg-lock-overlay">
                  <Icon name="lock" size={22} color="var(--ink-400)" />
                  <span>공유하면 보여요</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============ 과거의 나와 대화하기 ============ */
const PAST_REPLIES = {
  20: ["스무 살의 나? 아직 다 모르겠지만, 무서운 것도 많고 하고 싶은 것도 많아.", "그땐 행복이 막연히 '성공'인 줄 알았어. 지금의 너는 좀 다르려나?"],
  25: ["스물다섯의 나야. 요즘은 불안과 설렘이 반반이야.", "남들 속도에 자꾸 나를 비교하던 시절이지. 너는 좀 편안해졌어?"],
  28: ["스물여덟. 이제야 조금은 나를 알 것 같아.", "행복은 멀리 있지 않더라. 너도 그걸 느끼고 있길."],
};
function PastSelfScreen() {
  const D = window.DEFINE_DATA;
  const ages = [20, 25, 28];
  const [age, setAge] = uS(null);
  const [msgs, setMsgs] = uS([]);
  const [input, setInput] = uS("");
  const [typing, setTyping] = uS(false);
  const scrollRef = uR();

  uE(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [msgs, typing]);

  function pick(a) {
    setAge(a);
    setMsgs([{ who: "past", text: `${a}살의 나야. 오랜만이네. 무슨 얘기가 하고 싶어?` }]);
  }
  function send() {
    if (!input.trim()) return;
    const q = input.trim();
    setMsgs((m) => [...m, { who: "me", text: q }]); setInput(""); setTyping(true);
    setTimeout(() => {
      const pool = PAST_REPLIES[age] || PAST_REPLIES[28];
      setTyping(false);
      setMsgs((m) => [...m, { who: "past", text: pool[m.length % pool.length] }]);
    }, 1300);
  }

  if (!age) {
    return (
      <div className="screen past-intro">
        <div className="past-glow"></div>
        <div className="past-badge"><Icon name="sparkle" size={13} /> 프리미엄</div>
        <Icon name="past" size={40} color="var(--point-600)" style={{ marginBottom: 18 }} />
        <h1 className="past-title">과거의 나와 대화하기</h1>
        <p className="past-desc">그 시절 내가 남긴 정의로 되살린, 그때의 나. 어떤 나를 만나볼까요?</p>
        <div className="age-cards">
          {ages.map((a) => (
            <button className="age-card" key={a} onClick={() => pick(a)}>
              <div className="age-num">{a}<span>살</span></div>
              <div className="age-tag">의 나와 대화</div>
              <Icon name="chevronR" size={18} style={{ opacity: .4 }} />
            </button>
          ))}
        </div>
        <div className="past-foot"><Icon name="lock" size={13} /> 무료 체험 1회 · 이후 50루비</div>
      </div>
    );
  }

  return (
    <div className="screen chat-screen">
      <div className="chat-head">
        <button className="icon-btn" onClick={() => { setAge(null); setMsgs([]); }}><Icon name="back" size={22} /></button>
        <div className="chat-id">
          <div className="chat-avatar">{age}</div>
          <div><div className="chat-name">{age}살의 나</div><div className="chat-status">그때의 정의로 되살림</div></div>
        </div>
        <span style={{ width: 40 }}></span>
      </div>
      <div className="chat-body" ref={scrollRef}>
        <div className="chat-day">2018년의 나와 연결됨</div>
        {msgs.map((m, i) => (
          <div className={"bubble-row " + m.who} key={i}>
            <div className={"bubble " + m.who}>{m.text}</div>
          </div>
        ))}
        {typing && <div className="bubble-row past"><div className="bubble past typing"><span></span><span></span><span></span></div></div>}
      </div>
      <div className="chat-input">
        <input className="chat-field" value={input} placeholder="과거의 나에게 물어보세요"
          onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
        <button className="chat-send" disabled={!input.trim()} onClick={send}><Icon name="send" size={20} color="#fff" /></button>
      </div>
    </div>
  );
}

/* ============ placeholder (좌2 미확정) ============ */
function PlaceholderScreen() {
  return (
    <div className="screen ph-screen">
      <div className="ph-box">
        <Icon name="sparkle" size={32} color="var(--point-300)" />
        <div className="ph-title">주간 회고</div>
        <div className="ph-tag">구상 중인 공간</div>
        <p className="ph-desc">한 주 동안 내가 내린 정의들을 모아 돌아보는 회고 화면을 구상하고 있어요. 기분 기록·검색도 후보예요.</p>
        <div className="ph-chips">
          <span className="chip-pill">주간 회고</span>
          <span className="chip-pill">오늘의 기분</span>
          <span className="chip-pill">단어 검색</span>
        </div>
      </div>
    </div>
  );
}

/* ============ My page ============ */
function MyPage({ onClose }) {
  const D = window.DEFINE_DATA;
  const rows = [
    ["닉네임 변경", D.user.name], ["알림 설정", "켜짐"],
    ["프리미엄 테마 · 폰트", "둘러보기"], ["단어장 PDF 내보내기", "소장용"], ["버전 정보", "1.0.0"],
  ];
  return (
    <div className="screen my-screen">
      <div className="detail-head">
        <button className="icon-btn" onClick={onClose}><Icon name="back" size={22} /></button>
        <div className="detail-word" style={{ fontSize: 18 }}>마이페이지</div>
        <span style={{ width: 40 }}></span>
      </div>
      <div className="profile">
        <div className="profile-avatar">{D.user.name[0]}</div>
        <div className="profile-name">{D.user.name}</div>
        <div className="profile-meta">{D.user.streak}일 연속 기록 중</div>
        <div className="ruby-card"><Icon name="ruby" size={18} color="var(--ruby)" /> {D.user.ruby.toLocaleString()} 루비</div>
      </div>
      <div className="setting-list">
        {rows.map(([k, v]) => (
          <div className="setting-row" key={k}><span>{k}</span><span className="sr-val">{v}<Icon name="chevronR" size={16} style={{ opacity: .4 }} /></span></div>
        ))}
      </div>
    </div>
  );
}

/* ============ Attendance toast ============ */
function AttendanceToast({ onClose }) {
  uE(() => { const t = setTimeout(onClose, 2600); return () => clearTimeout(t); }, []);
  return (
    <div className="attend-toast">
      <div className="at-ruby"><Icon name="ruby" size={20} color="var(--ruby)" /></div>
      <div><div className="at-title">7일 연속 출석!</div><div className="at-sub">+10 루비를 받았어요</div></div>
    </div>
  );
}

Object.assign(window, { PlazaScreen, PastSelfScreen, PlaceholderScreen, MyPage, AttendanceToast });
