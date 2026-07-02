/**
 * LikeButton — 광장 정의 좋아요(추천) 버튼.
 * 누름 = PressableScale(살짝 눌림). "좋아요"로 켜지는 순간 = 하트가 통통 튀는 확인 펄스
 * (§2 마이크로 인터랙션). 취소(un-like)엔 펄스 없음. 오버슛 없는 절제된 연출.
 * 토글 로직(optimistic·서버 확정)은 호출부가 담당 — 여기선 onToggle만 부른다.
 */
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';

import { PressableScale } from '@/components/primitives';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/icons';
import { motion, useTheme } from '@/theme';

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
        Animated.timing(pulse, { toValue: 1.25, duration: motion.duration.fast, easing: motion.easing.standard, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: motion.duration.base, easing: motion.easing.standard, useNativeDriver: true }),
      ]).start();
    }
  }, [liked, pulse]);

  return (
    <PressableScale
      onPress={onToggle}
      hitSlop={8}
      style={[
        styles.btn,
        {
          borderColor: liked ? theme.colors.point.p300 : theme.colors.line.base,
          backgroundColor: liked ? theme.colors.point.p100 : 'transparent',
        },
      ]}
    >
      <Animated.View style={{ transform: [{ scale: pulse }] }}>
        <Icon name="heart" size={16} color={liked ? theme.colors.point.p600 : theme.colors.ink.placeholder} />
      </Animated.View>
      {count > 0 ? (
        <ThemedText variant="caption" style={{ color: liked ? theme.colors.point.p700 : theme.colors.ink.secondary }}>
          {count}
        </ThemedText>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  btn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 999,
  },
});
