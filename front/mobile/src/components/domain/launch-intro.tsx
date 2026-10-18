/**
 * LaunchIntro — 앱을 새로 켰을 때(콜드 스타트) 한 번, "define."을 붓으로 한 글자씩 쓰는 시작 화면.
 *
 * 흐름(시안: 명조 붓글씨 v1):
 *   1) 글자마다 획 순서대로 — 마스크 속 굵은 흰 선이 dashoffset으로 그어지며 글자 윤곽을 드러내고,
 *      작은 먹색 타원(붓끝)이 그 선의 앞머리를 따라간다(획 방향으로 기울어서).
 *   2) 한 글자가 끝나면 글자 전체가 살짝 페이드인 — 붓이 덜 덮은 틈을 메운다.
 *   3) 먹색 마침표가 톡 떨어지고, 작은 잉크 방울 셋이 튀었다 사라진다.
 *   4) 로고 전체가 헤더 로고 자리로 날아가 앉고, 종이 바탕이 걷히며 홈 화면이 드러난다.
 *
 * 정책:
 *   - 그날 첫 실행이면 전체 속도, 아니면 2.6배 빠르게(날짜는 폰의 지역 날짜로 AsyncStorage에 기록).
 *   - 아무 데나 누르면 즉시 건너뜀. OS "동작 줄이기"면 아예 안 나온다.
 *   - 앱을 막지 않는다: 위에 덮는 레이어일 뿐이고, 아래에서 화면·데이터는 그대로 준비된다.
 *
 * 움직임은 시간값 하나(t, 시안 기준 ms)로 전부 계산한다. 각 획·붓끝·마침표는 "t가 내 구간의
 * 몇 %인가"만 보고 스스로 그린다 → 순서·겹침이 한 표(TIMELINE)에 모여 있어 고치기 쉽다.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, G, Mask, Path } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { LOGO_VIEWBOX_STR, measureWordmark } from '@/components/domain/wordmark';
import { LOGO } from '@/data/logo';
import { LOGO_STROKES, LOGO_VIEWBOX } from '@/data/logo-strokes.generated';
import { formatYmd } from '@/lib/format-date';
import { useSettingsStore } from '@/store/settings-store';
import { useTheme } from '@/theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** 그날 전체 속도로 보여 준 날짜(YYYY.MM.DD). */
const FULL_DAY_KEY = 'define-intro-full-day-v1';
/** 평소(그날 두 번째 실행부터) 배속. */
const SHORT_SPEED = 2.6;

// ── 타임라인(시안과 같은 숫자, 단위 ms·전체 속도 기준) ─────────────────────────
const PER_LETTER = 300;
type StrokeTiming = { d: string; width: number; len: number; pts: number[]; start: number; dur: number };
type LetterTiming = { d: string; strokes: StrokeTiming[]; fillStart: number };

const LETTERS: LetterTiming[] = [];
let cursor = 120; // 시작 직후 잠깐 빈 종이
LOGO.letters.forEach((letter, i) => {
  const n = letter.strokes.length;
  const strokes = letter.strokes.map((s, k) => {
    const { len, pts } = LOGO_STROKES[i][k];
    // 긴 획일수록 오래, 획이 많은 글자는 획당 짧게(그래도 셋 이상이면 조금 여유)
    const dur = (Math.max(120, PER_LETTER * (0.55 + len / 140)) / n) * (n > 2 ? 1.3 : 1);
    const st = { d: s.d, width: s.width, len, pts, start: cursor, dur };
    cursor += dur * 0.92; // 다음 획은 앞 획 끝나기 살짝 전에 — 붓이 쉬지 않고 이어지게
    return st;
  });
  LETTERS.push({ d: letter.d, strokes, fillStart: cursor - 60 });
  cursor += 70;
});
const FILL_DUR = 160;
const DOT_START = cursor + 80;
const DOT_DUR = 260;
const DROPS = [
  [-13, -15, 2.2],
  [9, 9, 1.6],
  [-6, 10, 1.3],
] as const; // 마침표 기준 [dx, dy, r]
const DROP_DUR = 460;
const LAND_START = DOT_START + 520;
const LAND_DUR = 420;
const PAPER_START = LAND_START + LAND_DUR * 0.6; // 착지 막바지부터 바탕이 걷힌다
const PAPER_DUR = LAND_DUR * 0.5;
const END = LAND_START + LAND_DUR + 140;

// ── 작은 계산 도우미(UI 스레드에서 돌아야 해서 'worklet') ─────────────────────
function progress(t: number, start: number, dur: number) {
  'worklet';
  return Math.min(1, Math.max(0, (t - start) / dur));
}
function easeOut(q: number) {
  'worklet';
  return 1 - Math.pow(1 - q, 3);
}
function easeInOut(q: number) {
  'worklet';
  return q < 0.5 ? 4 * q * q * q : 1 - Math.pow(-2 * q + 2, 3) / 2;
}

/** 이 콜드 스타트에서 이미 보여 줬는지 — 루트가 다시 마운트돼도 두 번 안 나오게. */
let shownThisLaunch = false;

export function LaunchIntro() {
  const reduceMotion = useReducedMotion();
  const [gone, setGone] = useState(reduceMotion || shownThisLaunch);
  if (gone) return null;
  return <IntroLayer onDone={() => setGone(true)} />;
}

function IntroLayer({ onDone }: { onDone: () => void }) {
  const theme = useTheme();
  const { width: W, height: H } = useWindowDimensions();
  const t = useSharedValue(0);
  const layer = useSharedValue(1); // 건너뛰기용 전체 투명도
  // 착지 목표(마크 중심 → 헤더 로고 중심 이동량, 배율). 못 재면 hasTarget=0 → 제자리에서 페이드.
  const target = useSharedValue({ dx: 0, dy: 0, scale: 1, hasTarget: 0 });
  const landTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 마크(가운데 로고)의 크기·위치 — 화면 폭 80%, 정가운데
  const markW = W * 0.8;
  const markH = (markW * LOGO_VIEWBOX.h) / LOGO_VIEWBOX.w;
  const markX = (W - markW) / 2;
  const markY = (H - markH) / 2;

  useEffect(() => {
    shownThisLaunch = true;
    let cancelled = false;
    (async () => {
      // 다크·팔레트 설정이 읽히기 전에 시작하면 라이트로 그렸다가 바뀐다 → 하이드레이션을 기다린다.
      // 단, 1초까지만 — 저장소가 끝내 응답하지 않으면 인트로가 화면을 덮은 채 영원히 멈춘다.
      const persist = useSettingsStore.persist;
      if (!persist.hasHydrated()) {
        await new Promise<void>((res) => {
          const timer = setTimeout(res, 1000);
          persist.onFinishHydration(() => {
            clearTimeout(timer);
            res();
          });
        });
      }
      // 그날 첫 실행이면 전체, 아니면 짧게. 저장소가 실패해도 인트로는 돈다(짧게).
      const today = formatYmd(new Date());
      let speed = SHORT_SPEED;
      try {
        if ((await AsyncStorage.getItem(FULL_DAY_KEY)) !== today) {
          speed = 1;
          await AsyncStorage.setItem(FULL_DAY_KEY, today);
        }
      } catch {}
      if (cancelled) return;

      // 착지 직전에 헤더 로고 위치를 잰다 — 그때쯤이면 아래 화면이 다 깔려 있다.
      landTimer.current = setTimeout(() => {
        measureWordmark((r) => {
          if (!r) return;
          target.value = {
            dx: r.x + r.width / 2 - (markX + markW / 2),
            dy: r.y + r.height / 2 - (markY + markH / 2),
            scale: r.width / markW,
            hasTarget: 1,
          };
        });
      }, Math.max(0, LAND_START / speed - 60));

      t.value = withTiming(END, { duration: END / speed, easing: Easing.linear }, (finished) => {
        if (finished) scheduleOnRN(onDone);
      });
    })();
    return () => {
      cancelled = true;
      if (landTimer.current) clearTimeout(landTimer.current);
    };
    // 콜드 스타트 1회용 — 화면 크기가 바뀌어도 다시 시작하지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function skip() {
    if (landTimer.current) clearTimeout(landTimer.current);
    layer.value = withTiming(0, { duration: theme.motion.duration.base }, (finished) => {
      if (finished) scheduleOnRN(onDone);
    });
  }

  const layerStyle = useAnimatedStyle(() => ({ opacity: layer.value }));
  const paperStyle = useAnimatedStyle(() => ({ opacity: 1 - progress(t.value, PAPER_START, PAPER_DUR) }));
  const markStyle = useAnimatedStyle(() => {
    const e = easeInOut(progress(t.value, LAND_START, LAND_DUR));
    const { dx, dy, scale, hasTarget } = target.value;
    return {
      // 목표를 못 쟀으면 날지 않고 바탕과 함께 사라진다
      opacity: hasTarget ? 1 : 1 - progress(t.value, PAPER_START, PAPER_DUR),
      transform: [{ translateX: dx * e }, { translateY: dy * e }, { scale: 1 + (scale - 1) * e }],
    };
  });

  const ink = theme.colors.ink.primary;
  const { cx, cy, r } = LOGO.dot;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, layerStyle]}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={skip}
        accessibilityRole="button"
        accessibilityLabel="define 시작 화면, 누르면 건너뜁니다"
      >
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.paper.base }, paperStyle]} />
        <Animated.View style={[{ position: 'absolute', left: markX, top: markY, width: markW, height: markH }, markStyle]}>
          <Svg width={markW} height={markH} viewBox={LOGO_VIEWBOX_STR}>
            <Defs>
              {LETTERS.map((l, i) => (
                // 붓이 지나간 자리(흰 선)만 글자가 보이는 마스크
                <Mask key={i} id={`intro-m${i}`} maskUnits="userSpaceOnUse" x={-20} y={-20} width={380} height={160}>
                  {l.strokes.map((s, k) => (
                    <RevealStroke key={k} t={t} s={s} />
                  ))}
                </Mask>
              ))}
            </Defs>
            {LETTERS.map((l, i) => (
              <G key={i}>
                <Path d={l.d} fill={ink} mask={`url(#intro-m${i})`} />
                <LetterFill t={t} d={l.d} start={l.fillStart} color={ink} />
                {l.strokes.map((s, k) => (
                  <BrushTip key={k} t={t} s={s} color={ink} />
                ))}
              </G>
            ))}
            <Dot t={t} cx={cx} cy={cy} r={r} color={ink} />
            {DROPS.map(([dx, dy, dr], k) => (
              <Drop key={k} t={t} cx={cx + dx} cy={cy + dy} r={dr} start={DOT_START + 60 + k * 30} color={ink} />
            ))}
          </Svg>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

type T = { t: SharedValue<number> };

/** 마스크 속 흰 선 — dashoffset이 길이→0으로 줄며 "그어진다". 붓 굵기의 1.5배라 글자 획을 넉넉히 덮는다. */
function RevealStroke({ t, s }: T & { s: StrokeTiming }) {
  const props = useAnimatedProps(() => {
    const q = progress(t.value, s.start, s.dur);
    return {
      strokeDashoffset: s.len * (1 - easeOut(q)),
      // 길이 0인 선도 둥근 끝(cap)은 점으로 찍힌다 → 시작 전엔 아예 숨겨야 획 시작점에 먹점이 안 남는다
      opacity: q > 0 ? 1 : 0,
    };
  });
  return (
    <AnimatedPath
      d={s.d}
      fill="none"
      stroke="#fff"
      strokeWidth={s.width * 1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={[s.len, s.len]}
      animatedProps={props}
    />
  );
}

/**
 * 붓끝 — 획의 앞머리에 붙어 가는 작은 타원. 미리 잰 점들(pts) 사이를 보간해 위치를,
 * 앞뒤 점의 방향으로 기울기를 정한다. 타원은 transform 대신 경로(d)를 매 프레임 새로 만든다
 * (SVG transform 애니메이션은 네이티브·웹 지원이 들쭉날쭉해서).
 */
function BrushTip({ t, s, color }: T & { s: StrokeTiming; color: string }) {
  const rx = s.width * 0.62;
  const ry = s.width * 0.42;
  const props = useAnimatedProps(() => {
    const q = progress(t.value, s.start, s.dur);
    const n = s.pts.length / 2;
    const f = easeOut(q) * (n - 1);
    const i = Math.min(n - 2, Math.floor(f));
    const k = f - i;
    const x = s.pts[i * 2] + (s.pts[i * 2 + 2] - s.pts[i * 2]) * k;
    const y = s.pts[i * 2 + 1] + (s.pts[i * 2 + 3] - s.pts[i * 2 + 1]) * k;
    const a = Math.atan2(s.pts[i * 2 + 3] - s.pts[i * 2 + 1], s.pts[i * 2 + 2] - s.pts[i * 2]);
    const c = Math.cos(a) * rx;
    const sn = Math.sin(a) * rx;
    const deg = (a * 180) / Math.PI;
    // 처음 12%에 나타나고 마지막 15%에 사라진다(붓을 대고 떼는 느낌)
    const env = q <= 0 || q >= 1 ? 0 : q < 0.12 ? q / 0.12 : q > 0.85 ? (1 - q) / 0.15 : 1;
    return {
      d: `M${x + c} ${y + sn}A${rx} ${ry} ${deg} 1 0 ${x - c} ${y - sn}A${rx} ${ry} ${deg} 1 0 ${x + c} ${y + sn}Z`,
      opacity: env * 0.9,
    };
  });
  return <AnimatedPath fill={color} animatedProps={props} />;
}

/** 글자 하나를 다 쓴 뒤 전체 윤곽이 페이드인 — 붓이 덜 덮은 틈을 먹이 번지듯 메운다. */
function LetterFill({ t, d, start, color }: T & { d: string; start: number; color: string }) {
  const props = useAnimatedProps(() => ({ opacity: easeOut(progress(t.value, start, FILL_DUR)) }));
  return <AnimatedPath d={d} fill={color} animatedProps={props} />;
}

/** 마침표 — 위에서 10만큼 내려오며 커지고 진해진다. 크기 변화는 반지름으로(변형 없이). */
function Dot({ t, cx, cy, r, color }: T & { cx: number; cy: number; r: number; color: string }) {
  const props = useAnimatedProps(() => {
    const e = easeOut(progress(t.value, DOT_START, DOT_DUR));
    return { cy: cy - 10 * (1 - e), r: r * (0.55 + 0.45 * e), opacity: e };
  });
  return <AnimatedCircle cx={cx} fill={color} animatedProps={props} />;
}

/** 잉크 방울 — 빨리 나타났다 천천히 사라진다. */
function Drop({ t, cx, cy, r, start, color }: T & { cx: number; cy: number; r: number; start: number; color: string }) {
  const props = useAnimatedProps(() => {
    const q = progress(t.value, start, DROP_DUR);
    return { opacity: q <= 0 || q >= 1 ? 0 : q < 0.35 ? q / 0.35 : (1 - q) / 0.65 };
  });
  return <AnimatedCircle cx={cx} cy={cy} r={r} fill={color} animatedProps={props} />;
}

