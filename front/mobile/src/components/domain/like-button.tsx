/**
 * LikeButton — 광장 정의 공감 버튼.
 * 누름 = PressableScale(살짝 눌림). 공감이 켜지는 순간 = 하트가 꽉 차며 살짝 커졌다 돌아오는 펄스
 * (§2 마이크로 인터랙션). 취소엔 펄스 없음. 오버슛 없는 절제된 연출.
 * 켜짐은 색이 아니라 **모양**(빈 하트 → 찬 하트)으로 말한다 — 색만 바뀌면 놓친다.
 * 숫자는 0이어도 늘 보인다 — 누르면 0→1로 무언가 바뀌어야 하고, 알약 폭도 튀지 않는다.
 * 토글 로직(optimistic·서버 확정)은 호출부가 담당 — 여기선 onToggle만 부른다.
 */
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';

import { PressableScale } from '@/components/primitives';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/icons';
import { controlPresets, motion, radii, spacing, useTheme } from '@/theme';

export type LikeButtonProps = { liked: boolean; count: number; onToggle: () => void };

export function LikeButton({ liked, count, onToggle }: LikeButtonProps) {
  const theme = useTheme();
  const pulse = useRef(new Animated.Value(1)).current;
  const prevLiked = useRef(liked);

  useEffect(() => {
    const was = prevLiked.current;
    prevLiked.current = liked;
    if (liked && !was) {
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.15, duration: motion.duration.fast, easing: motion.easing.standard, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: motion.duration.base, easing: motion.easing.standard, useNativeDriver: true }),
      ]).start();
    }
  }, [liked, pulse]);

  return (
    <PressableScale
      onPress={onToggle}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityState={{ selected: liked }}
      accessibilityLabel={liked ? `공감 취소, 공감 ${count}` : `공감하기, 공감 ${count}`}
      style={[
        styles.btn,
        {
          // 비선택도 line.strong·secondary로 — line.base·placeholder는 다크에서 배경과 동화되어 버튼이 안 보였음
          borderColor: liked ? theme.colors.point.p300 : theme.colors.line.strong,
          backgroundColor: liked ? theme.colors.point.p100 : 'transparent',
        },
      ]}
    >
      <Animated.View style={{ transform: [{ scale: pulse }] }}>
        <Icon
          name="heart"
          size={16}
          filled={liked}
          color={liked ? theme.colors.point.p600 : theme.colors.ink.secondary}
        />
      </Animated.View>
      <ThemedText variant="caption" style={{ color: liked ? theme.colors.point.p700 : theme.colors.ink.secondary }}>
        {count}
      </ThemedText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  btn: {
    marginTop: spacing.s3,
    // 카드 오른쪽 아래에 둔다 — 오른손 엄지가 닿는 자리이고, 글은 왼쪽에서 읽기 시작해
    // 오른쪽에서 끝나므로 다 읽은 지점에 버튼이 있다.
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    ...controlPresets.pill,
    borderWidth: 1,
    borderRadius: radii.pill,
  },
});
