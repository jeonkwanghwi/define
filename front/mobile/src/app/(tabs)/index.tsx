/**
 * 메인 — 오늘의 단어 기록하기 (서비스의 핵심 화면).
 *
 * 화면 구성 (PLANNING.md 5-1 / design-source/app/screens-main.jsx 참조):
 *   1. 날짜 줄      — 오늘 날짜 + '오늘' 뱃지. 누르는 곳이 아니라 라벨이다 (항상 오늘 고정 —
 *                     과거 날짜 기록은 "현재를 기록한다" 의미가 퇴색되어 제거, 2026-07-09 팀 결정)
 *   2. Hero 단어    — "오늘의 단어"(직접 고른 단어면 "내가 고른 단어") 캡션 + 큰 단어 + "이란" + 다시 뽑기
 *   3. 입력 스테이지 — 카드 안의 multiline 입력창 + 안내 문구 + 글자 수
 *   4. 액션         — "단어 추가"(soft, 쓰는 중엔 "접기") + "기록 완료"(primary, MIN_DEFINITION_LENGTH자 미만이면 disabled)
 *
 * 저장하면 journal-store에 쌓이고 SaveConfirmation이 완료를 연출한다.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { AppHeader } from '@/components/domain/app-header';
import { CustomWordSheet } from '@/components/domain/custom-word-sheet';
import { SaveConfirmation } from '@/components/domain/save-confirmation';
import { Button, Card, ConfirmDialog, FadeIn } from '@/components/primitives';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { RECOMMENDED_WORDS } from '@/data/recommended-words';
import { Icon } from '@/icons';
import { MIN_DEFINITION_LENGTH } from '@/lib/definition';
import { formatKoreanDate, formatYmd } from '@/lib/format-date';
import { hapticSuccess, hapticTap } from '@/lib/haptics';
import { topicSuffix } from '@/lib/korean';
import { getRecommendedWords } from '@/services/word-api';
import { useAuthHydrated, useAuthStore } from '@/store/auth-store';
import { useEntryCountForWord, useJournalStore } from '@/store/journal-store';
import { controlPresets, fontFamily, useTheme } from '@/theme';

// 입력창 고정 높이(px). 처음부터 이 크기로 고정 — 타이핑에 따라 박스가 커지지 않아
// 화면이 출렁이지 않는다. 내용이 넘치면 입력창 내부에서 스크롤(캐럿=마지막 줄 따라감).
// 이 값이 탭바 위에 머물러 "기록 완료" 버튼이 밀려나지 않는 상한이기도 하다(뷰포트 664 기준).
const INPUT_HEIGHT = 200;
/**
 * 작은 폰(창 높이 < SMALL_WINDOW_H)의 평소 입력란 높이. 200이면 360×640에서
 * "기록 완료"가 탭바 아래로 밀려 포커스해야만 보였다(120으로도 반쯤 가려짐 — 실측).
 * 쓰기 모드 높이는 따로 역산하므로 평소 높이와 위 여백만 줄이면 된다. 84 ≈ 세 줄.
 */
const INPUT_HEIGHT_SMALL = 84;
const SMALL_WINDOW_H = 700;
/** 서버 단어 풀을 기다리는 최대 시간 — 넘으면 폴백 풀의 단어로 띄운다. */
const HERO_HOLD_MS = 800;

/**
 * "오늘의 단어"는 하루 동안 고정 — 열 때마다 바뀌면 '오늘의'가 거짓말이 된다(2026-10-17 결정).
 * 날짜 해시로 풀에서 고르는 건 안 된다: 서버 풀이 **요청마다 다른 무작위 30개**라 같은
 * 해시도 다른 단어를 가리킨다(실측). 그래서 그날 처음 보여 준 단어를 폰에 적어 두고
 * 자정 전까지 그 단어로 연다. "새로운 단어 뽑기"는 사용자의 선택이라 적지 않는다.
 */
const TODAY_WORD_KEY = 'define-today-word-v1';
function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
/** 오늘 이미 보여 준 단어. 없거나(다른 날) 못 읽으면 null. */
async function readTodayWord(): Promise<string | null> {
  try {
    const v = JSON.parse((await AsyncStorage.getItem(TODAY_WORD_KEY)) ?? 'null');
    return v?.day === todayKey() && typeof v.word === 'string' ? v.word : null;
  } catch {
    return null;
  }
}

/** 쓰기 모드 상단 바(단어 + 글자 수)의 높이. 접힐 때 0까지 줄어든다. */
const WRITE_BAR_HEIGHT = 46;
/** 평소 ↔ 쓰기 모드 전환 시간. 길면 굼뜨고 짧으면 뚝 끊긴다. */
const WRITE_DURATION = 220;
/**
 * 입력란 포커스가 풀린 뒤 쓰기 모드를 끄기까지 기다리는 시간(ms).
 * RN Web의 Pressable은 누른 뒤 약 50ms 늦게 onPressIn을 부른다 — 그보다 넉넉하면 된다.
 */
const BLUR_SETTLE_MS = 150;
/**
 * 쓰기 모드에서 입력란 말고 남겨야 하는 **여백들**의 합.
 * 카드 위 여백(32) + 카드 안쪽 패딩 위아래(20+20) + 액션 위 여백(16)
 * + 스크롤 위아래 패딩(24+32) = 144. 전부 이 파일이 정하는 값이라 여기 둔다.
 *
 * 높이가 있는 것(헤더·상단 바·액션)은 **상수로 박지 않고 잰다.** 처음엔 액션을 50으로
 * 추정하고 헤더를 아예 빼먹어 **버튼이 화면 밖으로 94px 밀렸다** — 글꼴·기기마다
 * 달라지는 값을 눈대중하면 이렇게 된다.
 */
const WRITE_RESERVED = 144;

export default function RecordScreen() {
  const theme = useTheme();
  // display 토큰을 52로 키워 쓴다. **lineHeight를 같이 올리지 않으면** 줄 높이가
  // 글자 크기보다 작아져 한글 윗부분이 잘린다(실기기에서 발견). 명조는 글자 상자를
  // 더 꽉 채우므로 1.35배로 잡는다. 크기와 줄높이를 한 곳에 묶어 다시 어긋나지 않게.
  // 크기·줄높이는 한 곳에서. 글꼴은 토큰이 들고 있어 화면은 글꼴 이름을 모른다
  // (유료 글꼴로 바꿀 때 theme/만 고치면 되게).
  const heroSize = { fontSize: 52, lineHeight: 70 } as const;
  const heroText = { ...theme.typography.display, ...heroSize };
  const heroSuffix = { ...theme.typography.displaySub, ...heroSize };
  const router = useRouter();
  const addEntry = useJournalStore((s) => s.addEntry);

  // 단어 풀과 현재 인덱스. 진입 시 값은 임시 — 오늘의 단어는 아래 settleHero가 정해 띄운다.
  // 사용자가 커스텀 단어를 추가할 수 있으므로 mutable.
  // 초기값은 **폴백 풀**이다 — 서버에서 받아오는 동안에도 홈이 비면 안 되기 때문(아래 effect).
  const [pool, setPool] = useState<string[]>(() => RECOMMENDED_WORDS.map((w) => w.word));
  const [wordIdx, setWordIdx] = useState(() => Math.floor(Math.random() * RECOMMENDED_WORDS.length));

  const [definition, setDefinition] = useState('');
  const [customSheetVisible, setCustomSheetVisible] = useState(false);
  /** 시트에서 직접 고른 단어 — 지금 단어가 이것이면 캡션이 "내가 고른 단어"가 된다. */
  const [pickedWord, setPickedWord] = useState<string | null>(null);
  /**
   * 쓰던 글이 있는데 단어를 바꾸려 할 때, 확인을 받은 뒤 실행할 전환.
   * 묻지 않고 바꾸면 글은 그대로 남은 채 단어만 바뀌어 **엉뚱한 단어로 저장된다.**
   */
  const [pendingSwap, setPendingSwap] = useState<(() => void) | null>(null);

  // 저장 완료 마이크로 인터랙션 상태
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmedWord, setConfirmedWord] = useState('');
  // 방금 저장으로 이 단어가 몇 번째 정의가 됐는지 — 2 이상이면 완료 화면에서 리빌.
  const [confirmedCount, setConfirmedCount] = useState(1);

  // ─── Hero 단어 swap 트랜지션 — "차분히 떠오름": 이전 단어는 가라앉고, 새 단어가 아래에서 무게감 있게 안착 ───
  // 처음엔 0 — 서버 풀이 오거나 HERO_HOLD_MS가 지나야 떠오른다(아래 "단어 풀" effect).
  const heroOpacity = useRef(new Animated.Value(0)).current;
  const heroTranslateY = useRef(new Animated.Value(0)).current;
  const heroScale = useRef(new Animated.Value(1)).current;
  const reduceMotion = useReducedMotion();

  /**
   * 단어를 부드럽게 바꾸는 공통 함수.
   * fade-out + 살짝 아래로 → 인덱스/풀 갱신 → fade-in.
   * @param nextIdx 새 단어 인덱스
   * @param poolUpdate 풀을 동시에 변경해야 할 때(addCustomWord)
   */
  const swapTo = useCallback(
    (nextIdx: number, poolUpdate?: (prev: string[]) => string[]) => {
      const applyChange = () => {
        if (poolUpdate) setPool(poolUpdate);
        setWordIdx(nextIdx);
      };

      if (reduceMotion) {
        applyChange();
        heroOpacity.setValue(1);
        heroTranslateY.setValue(0);
        heroScale.setValue(1);
        return;
      }

      // 이전 단어: 아래로 가라앉으며 사라짐.
      Animated.parallel([
        Animated.timing(heroOpacity, { toValue: 0, duration: 160, useNativeDriver: true }),
        Animated.timing(heroTranslateY, { toValue: 12, duration: 160, useNativeDriver: true }),
      ]).start(() => {
        applyChange();
        // 새 단어: 아래에서 무게감 있게 떠올라 spring으로 안착(차분한 착지, 오버슛 최소).
        heroTranslateY.setValue(22);
        heroScale.setValue(0.96);
        Animated.parallel([
          Animated.timing(heroOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
          Animated.spring(heroTranslateY, { toValue: 0, friction: 8, tension: 55, useNativeDriver: true }),
          Animated.spring(heroScale, { toValue: 1, friction: 7, tension: 90, useNativeDriver: true }),
        ]).start();
      });
    },
    [heroOpacity, heroTranslateY, heroScale, reduceMotion],
  );

  // ─── 쓰기 모드 — 키보드가 올라오면 위를 접고 글에 공간을 준다 ───
  //
  // 왜: 키보드가 올라와도 헤더·날짜·큰 단어가 자리를 그대로 지켜서, 입력란이 키보드 위
  // 좁은 틈에 끼였다. 길게 쓸수록 **쓰고 있는 줄이 가려졌다.**
  //
  // 전환의 방아쇠는 **키보드가 아니라 입력란의 포커스**다. 키보드 이벤트는 웹에서 아예
  // 오지 않아(RN Web이 발생시키지 않는다) 웹에서 확인할 길이 없어지고, 애초에 "쓰기
  // 시작"의 진짜 신호는 포커스다. 다만 iOS에서 키보드를 쓸어내리면 포커스가 남은 채로
  // 키보드만 사라지므로, hide 이벤트를 안전망으로 같이 듣는다.
  const [writing, setWriting] = useState(false);
  /** 0 = 평소 · 1 = 쓰기 모드. 높이를 같이 움직여야 해서 네이티브 드라이버를 쓸 수 없다. */
  const write = useRef(new Animated.Value(0)).current;
  /** 접었다 펼 높이는 재서 안다 — 글꼴·기기마다 다르므로 숫자로 박으면 어긋난다. */
  const [topHeight, setTopHeight] = useState(0);
  const [footHeight, setFootHeight] = useState(0);
  /** 스크롤 영역의 현재 높이. 키보드가 오르내리면 이 값이 바뀐다 — 한 번만 재면 안 된다. */
  const [viewportHeight, setViewportHeight] = useState(0);
  /** 액션 버튼 행의 실제 높이. 글꼴에 따라 달라져 상수로 박으면 어긋난다. */
  const [actionsHeight, setActionsHeight] = useState(0);
  /** 앱 헤더(워드마크·잉크·아바타) 높이. 공용 컴포넌트라 안을 모르므로 감싸서 잰다. */
  const [headerHeight, setHeaderHeight] = useState(0);

  useEffect(() => {
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const sub = Keyboard.addListener(hideEvent, () => setWriting(false));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const to = writing ? 1 : 0;
    if (reduceMotion) {
      write.setValue(to);
      return;
    }
    Animated.timing(write, {
      toValue: to,
      duration: WRITE_DURATION,
      // 빠르게 출발해 부드럽게 멈춘다 — 손가락을 뗀 뒤 따라오는 느낌.
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [writing, reduceMotion, write]);

  /** 접히는 윗부분 — 높이·투명도·살짝 위로. 다 재고 나서야 높이를 묶는다. */
  const collapseStyle = {
    height: topHeight ? write.interpolate({ inputRange: [0, 1], outputRange: [topHeight, 0] }) : undefined,
    // 자리보다 **먼저** 사라진다 — 반쯤 접힌 글자가 보이면 지저분하다.
    opacity: write.interpolate({ inputRange: [0, 0.55], outputRange: [1, 0], extrapolate: 'clamp' }),
    transform: [{ translateY: write.interpolate({ inputRange: [0, 1], outputRange: [0, -14] }) }],
  };

  /** 쓰기 모드 상단 바 — 윗부분이 거의 접힌 뒤에 떠오른다(스치듯 겹치게). */
  const writeBarStyle = {
    height: write.interpolate({ inputRange: [0, 1], outputRange: [0, WRITE_BAR_HEIGHT] }),
    opacity: write.interpolate({ inputRange: [0.45, 1], outputRange: [0, 1], extrapolate: 'clamp' }),
    transform: [{ translateY: write.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
  };

  /**
   * 입력란 높이.
   *
   * 처음엔 "접힌 높이만큼 키운다"로 짰는데 **버튼이 화면 밖으로 밀렸다**(웹에서 발견).
   * 접힌 양과 실제로 남는 공간은 다르다 — 키보드가 얼마를 먹는지는 접힌 양과 무관하다.
   * 그래서 **남는 공간에서 역산한다**: 스크롤 영역 높이에서 상단 바·액션·여백을 빼면
   * 그게 글에 줄 수 있는 전부다. 키보드가 올라오면 KeyboardAvoidingView가 스크롤 영역을
   * 줄여 주므로, 이 값이 키보드 유무에 저절로 맞는다.
   */
  const { height: windowHeight } = useWindowDimensions();
  const small = windowHeight < SMALL_WINDOW_H;
  const restInputHeight = small ? INPUT_HEIGHT_SMALL : INPUT_HEIGHT;
  const writingInputHeight = Math.max(
    restInputHeight,
    viewportHeight - headerHeight - WRITE_BAR_HEIGHT - actionsHeight - WRITE_RESERVED,
  );
  const inputHeightStyle = {
    height: write.interpolate({
      inputRange: [0, 1],
      outputRange: [restInputHeight, writingInputHeight],
    }),
  };

  /**
   * 카드 아래 안내·글자 수 — 글자 수가 위로 옮겨 가므로 같이 접는다.
   * **여백도 함께 접어야 한다.** height만 0으로 줄이면 marginTop·paddingTop(12+12)이
   * 그대로 남아 빈 자리가 공간을 먹고, 그만큼 액션 버튼이 화면 밖으로 밀린다(실제로 밀렸다).
   */
  const footStyle = {
    height: footHeight ? write.interpolate({ inputRange: [0, 1], outputRange: [footHeight, 0] }) : undefined,
    marginTop: write.interpolate({ inputRange: [0, 1], outputRange: [theme.spacing.s3, 0] }),
    paddingTop: write.interpolate({ inputRange: [0, 1], outputRange: [theme.spacing.s3, 0] }),
    borderTopWidth: write.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
    opacity: write.interpolate({ inputRange: [0, 0.55], outputRange: [1, 0], extrapolate: 'clamp' }),
  };

  // ─── 단어 풀을 서버에서 받아 교체 ───
  // 출처만 바뀐다 — 받아온 풀 안에서 "다시 뽑기"를 돌리는 구조는 그대로다.
  // 서버는 로그인했으면 관심사 7 : 전체 3으로 섞고, 최근 90일 안에 정의한 단어를 뺀다.
  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.token);
  // 응답이 늦게 왔을 때 "쓰는 중인가"를 보는 거울. effect 안에서 state를 읽으면
  // 마운트 시점의 빈 문자열에 갇히므로 ref로 현재 값을 들고 있는다.
  const definitionRef = useRef('');
  useEffect(() => {
    definitionRef.current = definition;
  }, [definition]);

  const writingRef = useRef(false);
  useEffect(() => {
    writingRef.current = writing;
  }, [writing]);

  // ─── 첫 단어는 한 번만 보인다 ───
  // 왜: 진입 때 폴백 풀에서 하나 뽑아 보여 주고, ~1.5초 뒤 서버 풀이 오면 **또** 뽑아
  // 매번 눈앞에서 단어가 바뀌었다(쓰려고 입력란을 누른 뒤에도). 그래서 단어는 숨겨 두고
  // 서버 풀이 오거나 HERO_HOLD_MS가 지나면 그때 오늘의 단어를 정해 떠오른다(settleHero).
  // 한 번 보인 뒤 늦게 온 풀은 눈앞 단어를 건드리지 않고 **다음 뽑기**에 쓴다(latePool).
  const [heroShown, setHeroShown] = useState(false);
  const [storedToday] = useState(readTodayWord);
  const heroShownRef = useRef(false);
  const latePool = useRef<string[] | null>(null);
  const showHero = useCallback(() => {
    if (heroShownRef.current) return;
    heroShownRef.current = true;
    setHeroShown(true);
    Animated.timing(heroOpacity, {
      toValue: 1,
      duration: reduceMotion ? 0 : theme.motion.duration.base,
      easing: theme.motion.easing.standard,
      useNativeDriver: true,
    }).start();
  }, [heroOpacity, reduceMotion, theme.motion]);

  /** 오늘의 단어를 정해 띄운다. words=null이면 폴백 풀(서버가 늦거나 실패). */
  const settleHero = useCallback(
    (words: string[] | null) => {
      storedToday.then((stored) => {
        // 이미 보였거나 쓰기 시작했으면(포커스만 해도) 눈앞 단어를 바꾸지 않는다 —
        // 바뀌면 쓰려던 단어가 사라진다. 서버 풀은 다음 뽑기에 쓴다.
        if (heroShownRef.current || writingRef.current || definitionRef.current.trim()) {
          if (words) latePool.current = words;
          showHero();
          return;
        }
        // 아직 숨어 있다 — 애니메이션 없이 정하고 바로 띄운다(바뀌는 장면이 없다).
        let list = words ?? RECOMMENDED_WORDS.map((w) => w.word);
        let idx: number;
        // 오늘의 단어를 이미 오늘 썼다면 다시 내밀지 않는다 — 열 때마다 "방금 쓴 단어"가 또 나오면
        // 할 일이 끝난 화면처럼 보인다. 새 단어를 골라 오늘의 단어로 다시 적는다.
        // (블라인드 쓰기와 무관: 고르는 단어가 바뀔 뿐, 새 단어의 이력은 아무것도 드러내지 않는다.)
        const today = formatYmd(new Date());
        const writtenToday =
          !!stored && useJournalStore.getState().entries.some((e) => e.word === stored && formatYmd(new Date(e.savedAt)) === today);
        if (stored && !writtenToday) {
          idx = list.indexOf(stored);
          if (idx < 0) {
            list = [stored, ...list];
            idx = 0;
          }
        } else {
          if (writtenToday) list = list.filter((w) => w !== stored);
          idx = Math.floor(Math.random() * list.length);
          // 실패해도 그만 — 다음에 열 때 새로 뽑힐 뿐이다.
          AsyncStorage.setItem(TODAY_WORD_KEY, JSON.stringify({ day: todayKey(), word: list[idx] })).catch(() => {});
        }
        setPool(list);
        setWordIdx(idx);
        showHero();
      });
    },
    [storedToday, showHero],
  );

  useEffect(() => {
    const t = setTimeout(() => settleHero(null), HERO_HOLD_MS);
    return () => clearTimeout(t);
  }, [settleHero]);

  useEffect(() => {
    // 토큰을 다 읽기 전에 물으면 로그인 사용자에게도 비로그인 풀이 와서 관심사가 날아간다.
    if (!hydrated) return;
    let alive = true;
    getRecommendedWords(token)
      .then((words) => {
        if (!alive || words.length === 0) return;
        settleHero(words);
      })
      .catch(() => {
        // 서버가 안 되면 폴백 풀(data/recommended-words.ts)에서 정한다. 홈은 비지 않는다.
        settleHero(null);
      });
    return () => {
      alive = false;
    };
  }, [hydrated, token, settleHero]);

  const word = pool[wordIdx];
  // 이 단어의 기존 기록 수. 쓰는 동안엔 어떤 힌트도 노출하지 않는다(블라인드 쓰기 —
  // 재정의임을 알면 일부러 다르게/같게 쓰게 되므로). 저장 후 리빌에만 사용.
  const entryCount = useEntryCountForWord(word);
  const today = useMemo(() => new Date(), []);
  // 최소 글자 수 미달이면 "기록 완료" disabled — 카운터·안내 문구가 이유와 남은 양을 말해 준다.
  const typedLength = definition.trim().length;
  const canSubmit = typedLength >= MIN_DEFINITION_LENGTH;
  const remaining = MIN_DEFINITION_LENGTH - typedLength;

  /** 글자 수 표시 — 미달이면 "n/10자"(포인트 색), 채우면 체크 뱃지로 **모양과 색이 함께** 바뀐다. */
  const counter = canSubmit ? (
    // key가 바뀌면 FadeIn이 다시 마운트돼 뱃지가 스르륵 나타난다.
    <FadeIn key="ok" offset={4} style={[styles.counterOk, { backgroundColor: theme.colors.point.p100 }]}>
      <Icon name="check" size={12} color={theme.colors.point.p700} strokeWidth={2.4} />
      <ThemedText variant="caption" style={{ color: theme.colors.point.p700, fontWeight: '600' }}>
        {definition.length}자
      </ThemedText>
    </FadeIn>
  ) : (
    <ThemedText key="short" variant="caption" style={{ color: theme.colors.point.p600 }}>
      {typedLength}/{MIN_DEFINITION_LENGTH}자
    </ThemedText>
  );

  // "N자 더 쓰면…" 안내 — 쓰기 시작했는데 아직 모자랄 때만. 자리는 늘 잡아 두고 투명도만 바꾼다
  // (나타날 때마다 높이가 바뀌면 쓰기 모드의 입력란 높이 계산이 출렁인다).
  const showNeedMore = typedLength > 0 && !canSubmit;
  const needMoreOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(needMoreOpacity, {
      toValue: showNeedMore ? 1 : 0,
      duration: reduceMotion ? 0 : theme.motion.duration.base,
      easing: theme.motion.easing.standard,
      useNativeDriver: true,
    }).start();
  }, [showNeedMore, reduceMotion, needMoreOpacity, theme.motion]);

  /**
   * "접기"/"단어 추가" 자리의 버튼이 **누르기 시작한 순간** 무엇이었는지.
   * 접기를 누르면 그 순간 입력란 포커스가 풀려(웹은 mousedown에서) writing=false가 되고,
   * 손을 떼기 전에 같은 자리 버튼이 "단어 추가"로 바뀌어 시트가 열렸다. 눌린 순간의 뜻을 붙잡아 둔다.
   */
  const sideActionRef = useRef<'fold' | 'add'>('add');
  /** 포커스가 풀린 뒤 쓰기 모드를 끄기까지의 대기(아래 onBlur 주석). */
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 현재 단어와 다른 인덱스를 랜덤 선택 (풀에 단어 1개뿐일 경우 무동작).
  // swapTo로 부드러운 트랜지션과 함께 전환.
  function drawNewWord() {
    showHero(); // 떠오르기 전에 눌렀어도 이후 늦은 풀이 단어를 바꾸지 않게
    // 늦게 온 서버 풀이 있으면 이번 뽑기부터 그 풀에서 — 지금 단어와 다른 것으로.
    const late = latePool.current;
    if (late) {
      latePool.current = null;
      const candidates = late.map((_, i) => i).filter((i) => late[i] !== word);
      if (candidates.length > 0) {
        swapTo(candidates[Math.floor(Math.random() * candidates.length)], () => late);
        return;
      }
    }
    if (pool.length < 2) return;
    let next = wordIdx;
    while (next === wordIdx) {
      next = Math.floor(Math.random() * pool.length);
    }
    swapTo(next);
  }

  /** 단어를 바꾸기 전 관문 — 쓰던 글이 있으면 먼저 묻는다(pendingSwap). */
  function guardSwap(swap: () => void) {
    if (definition.trim()) setPendingSwap(() => swap);
    else swap();
  }

  // 사용자 커스텀 단어 추가 — 이미 풀에 있으면 그 단어로 옮기고(중복 방지), 없으면 맨 앞에 넣고 swap.
  function addCustomWord(newWord: string) {
    showHero(); // 직접 고른 단어를 늦은 서버 풀이 덮지 않게
    // 이미 눈앞의 단어면 바뀌는 게 없으니 묻지 않는다 — 캡션만 "내가 고른 단어"로.
    if (newWord === word) {
      setPickedWord(newWord);
      return;
    }
    // 시트(Modal)가 닫히는 중에 확인창(또 다른 Modal)을 띄우면 iOS가 무시한다 → 확인창이 안 뜨고
    // 단어도 안 바뀐다. 닫힘 애니메이션 뒤로 미룬다(ActionSheet와 같은 200ms 규칙).
    setTimeout(() => guardSwap(() => {
      setPickedWord(newWord);
      const existing = pool.indexOf(newWord);
      if (existing >= 0) swapTo(existing);
      else swapTo(0, (prev) => [newWord, ...prev]);
    }), 200);
  }

  function confirmSwap() {
    setDefinition('');
    pendingSwap?.();
    setPendingSwap(null);
  }

  function handleSave() {
    if (!canSubmit) return;
    Keyboard.dismiss();
    // 항상 현재 시각으로 저장 (과거 날짜 기록 제거 — 현재를 기록한다).
    const savedAt = new Date();
    // 변화 노트는 쓰기 시점에 받지 않는다 — 타임라인에서 길게 눌러 사후 기록.
    addEntry(word, definition.trim(), savedAt);
    // 저장이 끝났다는 손끝의 신호. 토스트는 **일부러 넣지 않는다** — 아래 SaveConfirmation이
    // 이미 전용 완료 연출(재정의면 N번째 공개)을 맡고 있어 같은 말을 두 번 하는 꼴이 된다.
    hapticSuccess();
    setConfirmedWord(word);
    setConfirmedCount(entryCount + 1);
    setConfirmVisible(true);
    setDefinition('');
  }

  function handleConfirmDismiss() {
    setConfirmVisible(false);
    // 다음 단어 자연스럽게 이어가기 — design-source의 complete 흐름과 동일
    drawNewWord();
  }

  function openCustomWord() {
    setCustomSheetVisible(true);
  }

  return (
    <ThemedView bg="paper" style={styles.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.root}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          // 키보드가 오르내리면 이 높이가 바뀐다 — 입력란 높이를 여기서 역산한다.
          onLayout={(e) => setViewportHeight(e.nativeEvent.layout.height)}
        >
          {/* ─── 0. 앱 헤더 (탭 공통) ─── */}
          {/* 감싸서 재는 이유: 공용 컴포넌트라 제 높이와 아래 여백을 이 화면이 알 길이 없다. */}
          <View
            onLayout={(e) => {
              const h = e.nativeEvent.layout.height;
              if (h > 0 && h !== headerHeight) setHeaderHeight(h);
            }}
          >
            <AppHeader />
          </View>

          {/* ─── 1~2. 평소에만 보이는 윗부분 (날짜 + Hero 단어) ───
              쓰기 모드에서 통째로 접힌다. 높이는 onLayout으로 한 번 재서 쓴다 —
              글꼴·기기마다 달라서 숫자로 박으면 어긋난다. */}
          <Animated.View
            style={[collapseStyle, styles.collapsible]}
            onLayout={(e) => {
              const h = e.nativeEvent.layout.height;
              // 접히는 중의 높이를 다시 물면 0에 갇힌다 — 처음 한 번만 받는다.
              if (!topHeight && h > 0) setTopHeight(h);
            }}
          >
          {/* 날짜는 라벨이다 — 테두리·그림자·달력 아이콘을 빼서 누를 것처럼 보이지 않게(날짜 선택은 없다). */}
          <View style={styles.dateRow}>
            <ThemedText variant="caption" tone="secondary">
              {formatKoreanDate(today)}
            </ThemedText>
            <View style={[styles.todayBadge, { backgroundColor: theme.colors.point.p050 }]}>
              <ThemedText variant="caption" style={{ color: theme.colors.point.p600 }}>
                오늘
              </ThemedText>
            </View>
          </View>

          {/* ─── 2. Hero 단어 ─── */}
          <View style={[styles.hero, { marginTop: theme.spacing.s6 }]}>
            <ThemedText
              variant="caption"
              style={{
                color: theme.colors.point.p600,
                letterSpacing: 2,
                textTransform: 'uppercase',
              }}
            >
              {word === pickedWord ? '내가 고른 단어' : '오늘의 단어'}
            </ThemedText>
            {/* 단어 자체만 swap 애니메이션 적용. 캡션과 버튼은 고정 위치 유지. */}
            <Animated.View
              style={[
                styles.heroWordRow,
                { marginTop: theme.spacing.s3 },
                {
                  opacity: heroOpacity,
                  transform: [{ translateY: heroTranslateY }, { scale: heroScale }],
                },
              ]}
            >
              {/* 단어 자체 — 가장 큰 폰트로 강조. heroText가 크기·줄높이를 함께 들고 있다 */}
              <ThemedText style={[heroText, { letterSpacing: -1.5 }]}>{word}</ThemedText>
              {/* "이란" suffix — 흐린 톤 + 살짝 가벼운 weight */}
              <ThemedText
                style={[heroSuffix, { color: theme.colors.ink.placeholder }]}
              >
                {topicSuffix(word)}
              </ThemedText>
            </Animated.View>
            <Button
              label="새로운 단어 뽑기"
              variant="ghost"
              size="sm"
              leftIcon={<Icon name="shuffle" size={15} color={theme.colors.point.p600} />}
              onPress={() => guardSwap(drawNewWord)}
              style={{ marginTop: small ? theme.spacing.s3 : theme.spacing.s5 }}
            />
          </View>

          </Animated.View>

          {/* ─── 2'. 쓰기 모드 상단 바 ───
              단어는 작아져 왼쪽, 글자 수는 오른쪽. 윗부분이 접히는 동안 여기가 떠올라
              "줄어들며 올라간 것"처럼 읽힌다(iOS의 큰 제목이 접힐 때와 같은 수법). */}
          <Animated.View style={[writeBarStyle, styles.writeBar, { borderBottomColor: theme.colors.line.base }]}>
            <View style={styles.writeBarWord}>
              <ThemedText style={[theme.typography.display, styles.writeBarWordText]}>{word}</ThemedText>
              <ThemedText
                style={[
                  theme.typography.displaySub,
                  styles.writeBarWordText,
                  { color: theme.colors.ink.placeholder },
                ]}
              >
                {topicSuffix(word)}
              </ThemedText>
            </View>
            {/* 최소 글자 수를 넘기면 분모가 의미를 잃는다 — 그때는 체크 + 쓴 글자 수만. */}
            {counter}
          </Animated.View>

          {/* ─── 3. 입력 스테이지 ─── */}
          {/* Card 보더가 이미 있으므로 안쪽 TextInput은 borderless로. */}
          <Card
            style={{ marginTop: small ? theme.spacing.s5 : theme.spacing.s8 }}
            radius="lg"
            elevation="sm"
            padded={false}
          >
            <View style={{ padding: theme.spacing.s5 }}>
              {/* 높이는 래퍼가 들고 TextInput은 flex로 채운다 —
                  TextInput 자체에 Animated 높이를 물릴 수 없다. */}
              <Animated.View style={inputHeightStyle}>
                <TextInput
                  multiline
                  value={definition}
                  onChangeText={setDefinition}
                  // 쓰기 모드의 방아쇠. 키보드 이벤트가 아니라 포커스인 이유는 위 주석에.
                  onFocus={() => {
                    if (blurTimer.current) clearTimeout(blurTimer.current);
                    setWriting(true);
                  }}
                  // 한 박자 늦게 접는다 — 웹은 "접기"를 누르는 순간(mousedown) 포커스가 먼저 풀리고,
                  // Pressable의 onPressIn은 그보다 늦게 온다. 바로 접으면 그 사이에 버튼이 "단어 추가"로 바뀐다.
                  onBlur={() => {
                    blurTimer.current = setTimeout(() => setWriting(false), BLUR_SETTLE_MS);
                  }}
                  // 단어가 떠오르기 전엔 비워 둔다 — 여기서 먼저 단어가 바뀌는 게 보인다.
                  placeholder={heroShown ? `나에게 ${word}${topicSuffix(word)}…` : ''}
                  placeholderTextColor={theme.colors.ink.placeholder}
                  style={[
                    styles.definitionInput,
                    {
                      color: theme.colors.ink.primary,
                      fontFamily: fontFamily.sans,
                    },
                  ]}
                />
              </Animated.View>
              <Animated.View
                style={[styles.inputFoot, { borderTopColor: theme.colors.line.base }, footStyle]}
                onLayout={(e) => {
                  const h = e.nativeEvent.layout.height;
                  // 여백은 footStyle이 따로 접는다 — 여기서는 내용 높이만 잰다.
                  if (!footHeight && h > 0) setFootHeight(h);
                }}
              >
                <ThemedText variant="caption" tone="placeholder">
                  나만의 정의를 적어보세요 · {MIN_DEFINITION_LENGTH}자 이상
                </ThemedText>
                {counter}
              </Animated.View>
            </View>
          </Card>

          {/* 변화 노트 입력은 제거됨 — 재정의 여부를 쓰는 동안 알려주는 유일한 신호였고,
              인지하는 순간 기록이 오염된다(블라인드 쓰기, 2026-07-17 결정). 사후 기록은
              단어 상세 타임라인의 "변화 노트 추가"로. */}

          {/* ─── 4. 액션 ─── */}
          <View
            style={{ marginTop: theme.spacing.s4 }}
            onLayout={(e) => {
              const h = e.nativeEvent.layout.height;
              if (h > 0 && h !== actionsHeight) setActionsHeight(h);
            }}
          >
            <View style={styles.actions}>
              {/* 쓰는 중에 다른 단어로 넘어갈 일은 없다. 대신 키보드를 내릴 길을 준다 —
                  빈 곳을 탭해 내리는 건 폰에서 찾기 어렵다. 한 버튼이 라벨만 바꾸고,
                  할 일은 누르기 시작한 순간 정한다(sideActionRef 주석 참조). */}
              <Button
                label={writing ? '접기' : '단어 추가'}
                variant={writing ? 'ghost' : 'soft'}
                leftIcon={
                  writing ? undefined : <Icon name="plus" size={16} color={theme.colors.point.p700} />
                }
                onPressIn={() => {
                  sideActionRef.current = writing ? 'fold' : 'add';
                }}
                onPress={() => (sideActionRef.current === 'fold' ? Keyboard.dismiss() : openCustomWord())}
              />
              {/* 기록 완료 — 가용 너비를 채우는 강조 액션.
                  disabled 버튼은 눌림 이벤트가 없어 겉을 Pressable로 감싼다 — 모자랄 때 눌러도
                  아무 반응이 없으면 고장처럼 느껴지므로 가볍게 진동으로 "아직"이라고 답한다. */}
              <Pressable style={styles.fillerButton} disabled={canSubmit} onPress={hapticTap}>
                <Button label="기록 완료" onPress={handleSave} disabled={!canSubmit} fullWidth />
              </Pressable>
            </View>
            {/* 왜 못 누르는지 버튼 바로 아래에서 말한다. */}
            <Animated.View style={[styles.needMore, { opacity: needMoreOpacity }]}>
              <ThemedText variant="caption" style={{ color: theme.colors.point.p600 }}>
                {Math.max(remaining, 1)}자 더 쓰면 기록할 수 있어요
              </ThemedText>
            </Animated.View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* 저장 완료 연출. 재정의였다면 여기서 처음으로 공개(N번째 정의) — 탭하면 타임라인으로. */}
      <SaveConfirmation
        visible={confirmVisible}
        word={confirmedWord}
        count={confirmedCount}
        onDismiss={handleConfirmDismiss}
        onViewTimeline={() => {
          setConfirmVisible(false);
          drawNewWord();
          // from=reveal — 타임라인이 "방금 쓴 것 vs 지난 것" 비교 모드로 열린다.
          router.push({ pathname: '/journal/[word]', params: { word: confirmedWord, from: 'reveal' } });
        }}
      />

      {/* 커스텀 단어 추가 시트 — "단어 추가" 액션으로 열림. 완료 시 풀 추가 + 그 단어로 swap. */}
      <CustomWordSheet
        visible={customSheetVisible}
        onAdd={addCustomWord}
        onClose={() => setCustomSheetVisible(false)}
      />

      {/* 쓰던 글이 있을 때 단어 전환 확인 — 글을 다른 단어로 데려가지 않는다. */}
      <ConfirmDialog
        visible={!!pendingSwap}
        title="쓰던 글을 지우고 새 단어로 갈까요?"
        message="지금 쓴 글은 이 단어와 함께 사라져요."
        confirmLabel="새 단어로"
        cancelLabel="계속 쓰기"
        onConfirm={confirmSwap}
        onClose={() => setPendingSwap(null)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
  },

  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  todayBadge: {
    ...controlPresets.badge,
    borderRadius: 999,
  },

  // 접히는 동안 넘치는 내용이 삐져나오면 안 된다.
  collapsible: { overflow: 'hidden' },

  writeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    overflow: 'hidden',
  },
  writeBarWord: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  // 평소 52px인 단어가 여기서는 24px로 — 같은 글꼴 토큰에 크기만 덮어쓴다.
  writeBarWordText: { fontSize: 24, lineHeight: 32, letterSpacing: -0.5 },

  hero: { alignItems: 'center' },
  heroWordRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },

  definitionInput: {
    flex: 1, // 높이는 바깥 Animated.View가 들고 있다(쓰기 모드에서 커진다)
    fontSize: 18,
    lineHeight: 30,
    textAlignVertical: 'top', // Android 상단 정렬
  },
  inputFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
    // borderTopWidth·marginTop·paddingTop은 footStyle이 애니메이션으로 들고 있다.
  },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fillerButton: { flex: 1 }, // 기록 완료 버튼이 행의 남은 공간을 채우게
  // 안내 한 줄의 자리 — 보이지 않을 때도 높이를 유지한다(위 needMoreOpacity 주석).
  needMore: { alignItems: 'flex-end', marginTop: 6, height: 17 },
  counterOk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 999,
    ...controlPresets.badge,
  },
});
