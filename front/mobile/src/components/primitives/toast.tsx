/**
 * Toast — "일이 끝났다"를 한 줄로 알리는 종이 쪽지.
 *
 * 왜 이 모양인가(톤이 전부다):
 *  - **성공 전용**이다. 실패는 이미 각 화면의 인라인 문구가 맡고 있으므로 토스트로
 *    두 번 말하지 않는다. 그래서 성공/실패를 색으로 구분하는 variant도 없다.
 *  - 아이콘·강조색·그림자 없음. 배경 surface + 1px line + 글자 한 줄.
 *    브랜드 톤이 "차분함·사색·여백"이라 게임처럼 시끄러운 배너는 금지다.
 *  - 쌓지 않는다. 새 토스트가 오면 타이머를 다시 시작하고 문구만 바꾼다 — 여백이 우선.
 *
 * 사용:
 *   const { show } = useToast();
 *   show('이름을 바꿨어요');
 */
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { motion, useTheme } from '@/theme';

/** 표시 시간(ms). 한 줄을 읽기엔 충분하고 잔상이 남지 않는 길이. */
const VISIBLE_MS = 1500;
/** 들어올 때 아래에서 올라오는 거리(px). FadeIn보다 살짝 크게 — 화면 밖에서 오는 느낌. */
const RISE = 12;
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
        duration: motion.duration.base,
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

  return (
    // pointerEvents none: 토스트가 탭바나 아래 버튼의 터치를 가로채면 안 된다.
    <View
      pointerEvents="none"
      style={[
        styles.layer,
        { bottom: TAB_BAR_HEIGHT + insets.bottom + theme.spacing.s3, paddingHorizontal: theme.spacing.s4 },
      ]}
    >
      <Animated.View style={{ opacity: progress, transform: [{ translateY }] }}>
        <ThemedView
          bg="surface"
          style={{
            borderWidth: 1,
            borderColor: theme.colors.line.base,
            borderRadius: theme.radii.md,
            paddingVertical: theme.spacing.s3,
            paddingHorizontal: theme.spacing.s4,
          }}
        >
          <ThemedText variant="sm">{message}</ThemedText>
        </ThemedView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
});

