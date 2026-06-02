// icons.jsx — define line icon set (modern, 1.7px stroke)
const Icon = ({ name, size = 24, stroke = 1.7, color = "currentColor", style = {} }) => {
  const p = {
    fill: "none", stroke: color, strokeWidth: stroke,
    strokeLinecap: "round", strokeLinejoin: "round",
  };
  const paths = {
    // 광장 — compass / discover
    plaza: <><circle cx="12" cy="12" r="9" {...p} /><path d="M15.5 8.5l-2 5-5 2 2-5z" {...p} /></>,
    // placeholder tab — sparkle/seed
    mood: <><path d="M12 4c.6 3 2.4 4.8 5.4 5.4-3 .6-4.8 2.4-5.4 5.4-.6-3-2.4-4.8-5.4-5.4 3-.6 4.8-2.4 5.4-5.4z" {...p} /><circle cx="18" cy="18" r="1.4" {...p} /></>,
    // record — feather pen
    feather: <><path d="M20 5c-4 0-8 1.5-11 6-1.2 1.8-2 4-2.5 6.5M20 5c0 4-1.5 8-6 11-1.8 1.2-4 2-6.5 2.5M20 5l-9 9M11 14H7m0 0v4" {...p} /></>,
    // past self — clock with back arrow
    past: <><path d="M3.5 12a8.5 8.5 0 105-7.7" {...p} /><path d="M3.5 4.5v3.2h3.2" {...p} /><path d="M12 8.5V12l2.4 1.4" {...p} /></>,
    // journal / book
    book: <><path d="M5 4.5h11a2 2 0 012 2V19a1.5 1.5 0 00-1.5-1.5H5z" {...p} /><path d="M5 4.5v14.5a1.5 1.5 0 001.5 1.5H17" {...p} /><path d="M9 9h6M9 12h4" {...p} /></>,
    calendar: <><rect x="4" y="5" width="16" height="15" rx="2.5" {...p} /><path d="M4 9.5h16M8 3.5v3M16 3.5v3" {...p} /></>,
    shuffle: <><path d="M4 7h3.2c1.2 0 2.3.6 3 1.6l3.6 5.8c.7 1 1.8 1.6 3 1.6H20M16.5 4.5L20 7l-3.5 2.5M4 17h3.2c1.2 0 2.3-.6 3-1.6M20 17l-3.5 2.5M16.5 14.5L20 17" {...p} /></>,
    plus: <><path d="M12 5v14M5 12h14" {...p} /></>,
    check: <><path d="M5 12.5l4.5 4.5L19 7" {...p} /></>,
    chevronR: <><path d="M9 5l7 7-7 7" {...p} /></>,
    chevronL: <><path d="M15 5l-7 7 7 7" {...p} /></>,
    chevronD: <><path d="M5 9l7 7 7-7" {...p} /></>,
    back: <><path d="M15 5l-7 7 7 7" {...p} /></>,
    close: <><path d="M6 6l12 12M18 6L6 18" {...p} /></>,
    lock: <><rect x="5" y="11" width="14" height="9" rx="2.5" {...p} /><path d="M8 11V8a4 4 0 018 0v3" {...p} /></>,
    send: <><path d="M5 12l15-7-7 15-2.5-5.5L5 12z" {...p} /></>,
    settings: <><circle cx="12" cy="12" r="3" {...p} /><path d="M12 3v2.5M12 18.5V21M21 12h-2.5M5.5 12H3M18 6l-1.8 1.8M7.8 16.2 6 18M18 18l-1.8-1.8M7.8 7.8 6 6" {...p} /></>,
    bell: <><path d="M6.5 10a5.5 5.5 0 0111 0c0 4 1.5 5.5 1.5 5.5H5s1.5-1.5 1.5-5.5z" {...p} /><path d="M10 18.5a2 2 0 004 0" {...p} /></>,
    ruby: <><path d="M7 4h10l3.5 5L12 20.5 3.5 9z" {...p} /><path d="M3.5 9h17M9 4l-2 5 5 11.5M15 4l2 5-5 11.5" {...p} /></>,
    sun: <><circle cx="12" cy="12" r="4" {...p} /><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4 4.2 19.8M19.8 4.2l-1.4 1.4" {...p} /></>,
    moon: <><path d="M20 14.5A8 8 0 119.5 4a6.5 6.5 0 0010.5 10.5z" {...p} /></>,
    user: <><circle cx="12" cy="8" r="3.5" {...p} /><path d="M5.5 20a6.5 6.5 0 0113 0" {...p} /></>,
    arrowUp: <><path d="M12 19V5M6 11l6-6 6 6" {...p} /></>,
    edit: <><path d="M4 20h4L18.5 9.5a2 2 0 00-3-3L5 17v3z" {...p} /><path d="M14 7l3 3" {...p} /></>,
    search: <><circle cx="11" cy="11" r="6.5" {...p} /><path d="M16 16l4 4" {...p} /></>,
    sparkle: <><path d="M12 4l1.8 5.2L19 11l-5.2 1.8L12 18l-1.8-5.2L5 11l5.2-1.8z" {...p} /></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style} aria-hidden="true">
      {paths[name] || null}
    </svg>
  );
};
window.Icon = Icon;
