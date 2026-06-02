// app.jsx — root shell: header, tab bar, navigation, tweaks
const { useState: US, useEffect: UE } = React;

const POINT_OPTIONS = {
  "딥 인디고": "#2E3192",
  "딥 그린": "#1F5C4A",
  "플럼": "#6B4E8E",
};

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "dark": false,
  "point": "#2E3192",
  "glow": true
}/*EDITMODE-END*/;

const TABS = [
  { id: "plaza", icon: "plaza", label: "광장" },
  { id: "mood", icon: "mood", label: "회고" },
  { id: "record", icon: "feather", label: "기록", center: true },
  { id: "past", icon: "past", label: "과거의 나" },
  { id: "journal", icon: "book", label: "단어장" },
];
// All five tabs live in the footer; the center 기록 tab is emphasized, not floating.

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [tab, setTab] = US("record");
  const [overlay, setOverlay] = US(null); // {type:'word', item} | {type:'my'}
  const [savedWords, setSavedWords] = US([]);
  const [attend, setAttend] = US(false);
  const D = window.DEFINE_DATA;

  // theme + point color
  UE(() => {
    document.documentElement.setAttribute("data-theme", t.dark ? "dark" : "light");
  }, [t.dark]);
  UE(() => {
    document.documentElement.style.setProperty("--pt-600", t.point);
  }, [t.point]);
  UE(() => {
    document.documentElement.classList.toggle("no-glow", !t.glow);
  }, [t.glow]);

  // attendance reward on first open
  UE(() => { const id = setTimeout(() => setAttend(true), 700); return () => clearTimeout(id); }, []);

  function onSaved(rec) { setSavedWords((w) => w.includes(rec.word) ? w : [...w, rec.word]); }

  const screens = {
    plaza: <PlazaScreen />,
    mood: <PlaceholderScreen />,
    record: <RecordScreen onSaved={onSaved} savedWords={savedWords} />,
    past: <PastSelfScreen />,
    journal: <JournalScreen onOpen={(item) => setOverlay({ type: "word", item })} />,
  };

  return (
    <div className="app-backdrop">
      <div className="device">
        {/* header */}
        <header className="app-header">
          <div className="brandmark sm">define<span className="dot"></span></div>
          <div className="header-right">
            <div className="ruby-badge"><Icon name="ruby" size={14} color="var(--ruby)" /> {D.user.ruby.toLocaleString()}</div>
            <button className="avatar-btn" onClick={() => setOverlay({ type: "my" })}>{D.user.name[0]}</button>
          </div>
        </header>

        {/* screen */}
        <main className="app-main">
          <div className="screen-anim" key={tab}>{screens[tab]}</div>
        </main>

        {/* tab bar — 5 tabs in the footer, 기록 emphasized */}
        <nav className="tab-bar">
          {TABS.map((tb) => (
            <button key={tb.id}
              className={"tab-item" + (tb.center ? " tab-record" : "") + (tab === tb.id ? " active" : "")}
              onClick={() => setTab(tb.id)}>
              <span className="tab-ico"><Icon name={tb.icon} size={tb.center ? 24 : 23} /></span>
              <span>{tb.label}</span>
            </button>
          ))}
        </nav>

        {/* overlays */}
        {overlay && (
          <div className="overlay-slide">
            {overlay.type === "word" && <WordDetail item={overlay.item} onClose={() => setOverlay(null)} />}
            {overlay.type === "my" && <MyPage onClose={() => setOverlay(null)} />}
          </div>
        )}

        {attend && <AttendanceToast onClose={() => setAttend(false)} />}
      </div>

      {/* TWEAKS */}
      <TweaksPanel>
        <TweakSection label="테마" />
        <TweakToggle label="다크 모드" value={t.dark} onChange={(v) => setTweak("dark", v)} />
        <TweakToggle label="은은한 그라데이션" value={t.glow} onChange={(v) => setTweak("glow", v)} />
        <TweakSection label="포인트 컬러" />
        <TweakColor label="각자의 정의 색" value={t.point}
          options={Object.values(POINT_OPTIONS)}
          onChange={(v) => setTweak("point", v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
