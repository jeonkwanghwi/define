/**
 * Toast — "일이 끝났다"를 한 줄로 알리는 종이 쪽지.
 *
 * 왜 이 모양인가(톤이 전부다):
 *  - **성공 전용**이다. 실패는 이미 각 화면의 인라인 문구가 맡고 있으므로 토스트로
 *    두 번 말하지 않는다. 그래서 성공/실패를 색으로 구분하는 variant도 없다.
 *  - **종이 위에 찍힌 잉크 자국**이다. 글자색과 배경색을 맞바꿔 쓴다
 *    (라이트: 먹색 바탕에 종이색 글자 / 다크: 그 반대). 새 색을 들이지 않고
 *    대비만 최대로 가져가는 방법이라, 브랜드가 "종이와 잉크"인 이 앱에 정확히 맞는다.
 *  - 쌓지 않는다. 새 토스트가 오면 타이머를 다시 시작하고 문구만 바꾼다 — 여백이 우선.
 *
 * 전에는 surface(#FFFEFB)를 paper(#FCFAF6) 위에 올리고 그림자도 없앴다. 톤은 지켰지만
 * **보이지 않았다** — 피드백이 보이지 않으면 피드백이 아니다. 조용한 것과 안 보이는 것은
 * 다르다. 색은 그대로 두고 대비·그림자·시간만 고쳤다.
 *
 * 사용:
 *   const { show } = useToast();
 *   show('이름을 바꿨어요');
 */
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { motion, useTheme } from '@/theme';

/**
 * 표시 시간(ms). 1500이면 손이 화면 아래에 있다가 눈을 올리는 사이에 사라졌다.
 * 한 줄을 **놓친 뒤 다시 찾아 읽을** 여유까지 준다.
 */
const VISIBLE_MS = 2400;
/** 들어올 때 아래에서 올라오는 거리(px). 화면 밖에서 들어오는 느낌을 주는 최소값. */
const RISE = 16;
/** 들어올 때의 시작 크기. 0에서 키우면 허공에서 튀어나온 것처럼 보인다 — 0.96이면 '놓였다'가 된다. */
const ENTER_SCALE = 0.96;
/** 나갈 때는 들어올 때보다 빠르게. 사용자는 이미 읽었고, 남아 있으면 길을 막는다. */
const EXIT_MS = 150;
/** 탭바 높이. (tabs)/_layout.tsx의 tabBarStyle(76 + insets.bottom)과 같은 값. */
const TAB_BAR_HEIGHT = 76;

export type ToastApi = {
  /** 완료 문구를 한 줄로. 이미 떠 있으면 문구만 갈아 끼우고 타이머를 다시 시작한다. */
  show: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

/**
 * useToast — 호출 지점에서 한 줄로 쓰는 훅.
 * Provider 밖에서 부르면 조용히 no-op 하지 않고 바로 터뜨린다(연결을 잊은 걸 알려야 한다).
 */
export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) {
    throw new Error('useToast()는 ToastProvider 안에서만 쓸 수 있습니다 (_layout.tsx 확인).');
  }
  return api;
}

export type ToastProviderProps = {
  children?: ReactNode;
};

export function ToastProvider({ children }: ToastProviderProps) {
  // seq는 "몇 번째 토스트인가". 같은 문구가 연달아 와도 다시 보이게 하는 유일한 장치다.
  const [toast, setToast] = useState({ message: '', seq: 0 });

  const api = useMemo<ToastApi>(
    () => ({ show: (message) => setToast((prev) => ({ message, seq: prev.seq + 1 })) }),
    [],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast.seq > 0 ? <ToastView message={toast.message} seq={toast.seq} /> : null}
    </ToastContext.Provider>
  );
}

/**
 * 사라진 뒤에도 언마운트하지 않는다 — opacity 0 + pointerEvents none이라 보이지도,
 * 닿지도 않는다. 퇴장 애니메이션 종료 콜백으로 상태를 되돌리는 배선을 없애려는 선택.
 */
function ToastView({ message, seq }: { message: string; seq: number }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const enter = Animated.timing(progress, {
      toValue: 1,
      duration: motion.duration.base,
      easing: motion.easing.standard,
      useNativeDriver: true,
    });
    enter.start();

    // seq가 바뀌면 이 effect가 다시 돌며 타이머도 처음부터 — 그래서 쌓이지 않는다.
    const timer = setTimeout(() => {
      Animated.timing(progress, {
        toValue: 0,
        // 들어올 때보다 빠르게 — 읽은 뒤에도 남아 있으면 화면을 가린다.
        duration: EXIT_MS,
        easing: motion.easing.standard,
        useNativeDriver: true,
      }).start();
    }, VISIBLE_MS);

    return () => {
      clearTimeout(timer);
      enter.stop();
    };
  }, [seq, progress]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [RISE, 0] });
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [ENTER_SCALE, 1] });

  return (
    // pointerEvents none: 토스트가 탭바나 아래 버튼의 터치를 가로채면 안 된다.
    <View
      pointerEvents="none"
      style={[
        styles.layer,
        {
          // 탭바에서 한 뼘 더 띄운다 — 바로 위에 붙으면 아이콘 다섯 개와 눈이 경쟁한다.
          bottom: TAB_BAR_HEIGHT + insets.bottom + theme.spacing.s6,
          paddingHorizontal: theme.spacing.s4,
        },
      ]}
    >
      <Animated.View
        style={[
          // 그림자가 종이에서 들어 올린다. 색을 바꾸지 않고 "위에 있다"를 말하는 방법.
          theme.shadows.lg,
          { opacity: progress, transform: [{ translateY }, { scale }] },
        ]}
      >
        <View
          style={{
            // 글자색을 바탕으로, 바탕색을 글자로 — 종이에 찍힌 잉크 자국.
            backgroundColor: theme.colors.ink.primary,
            borderRadius: theme.radii.md,
            paddingVertical: theme.spacing.s3,
            paddingHorizontal: theme.spacing.s5,
          }}
        >
          <ThemedText variant="sm" style={{ color: theme.colors.paper.base }}>
            {message}
          </ThemedText>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
});

