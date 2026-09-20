/**
 * VillageJoystick — 마을에서 아바타를 직접 움직이는 아날로그 스틱.
 *
 * 8방향이 아니라 기울인 방향 그대로 나간다(벡터를 그대로 넘긴다).
 * 손가락이 바깥으로 나가도 스틱은 원 안에서만 움직이고, 방향은 계속 따라간다.
 *
 * ⚠️ 하단 탭바 바로 위에 놓이므로 제스처가 탭바로 새지 않게
 *   화면 쪽에서 위치를 잡고 여기선 자기 영역만 책임진다.
 */
import { useMemo, useRef } from 'react';
import { Animated, PanResponder, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

/** 스틱이 움직일 수 있는 반경(dp). 엄지 한 마디 정도. */
const RADIUS = 44;
const KNOB = 44;

export type VillageJoystickProps = {
  /** 방향 벡터(-1~1). 놓으면 {x:0,y:0}. 길이가 세기(0~1)다. */
  onChange: (dir: { x: number; y: number }) => void;
};

export function VillageJoystick({ onChange }: VillageJoystickProps) {
  const theme = useTheme();
  const knob = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        // 탭바·보드가 이 제스처를 가로채지 않게 한다.
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_, g) => {
          const len = Math.hypot(g.dx, g.dy);
          const clamped = len > RADIUS ? RADIUS / len : 1;
          const x = g.dx * clamped;
          const y = g.dy * clamped;
          knob.setValue({ x, y });
          onChangeRef.current({ x: x / RADIUS, y: y / RADIUS });
        },
        onPanResponderRelease: () => {
          Animated.spring(knob, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
            speed: 20,
            bounciness: 4,
          }).start();
          onChangeRef.current({ x: 0, y: 0 });
        },
        onPanResponderTerminate: () => {
          knob.setValue({ x: 0, y: 0 });
          onChangeRef.current({ x: 0, y: 0 });
        },
      }),
    [knob],
  );

  return (
    <View
      {...responder.panHandlers}
      style={[
        styles.base,
        { backgroundColor: theme.colors.ink.strong + '1A', borderColor: theme.colors.ink.strong + '26' },
      ]}
    >
      <Animated.View
        style={[
          styles.knob,
          {
            backgroundColor: theme.colors.paper.base,
            borderColor: theme.colors.ink.strong + '33',
            transform: knob.getTranslateTransform(),
          },
          theme.shadows.sm,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    width: RADIUS * 2 + KNOB,
    height: RADIUS * 2 + KNOB,
    borderRadius: RADIUS + KNOB / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  knob: { width: KNOB, height: KNOB, borderRadius: KNOB / 2, borderWidth: 1 },
});
