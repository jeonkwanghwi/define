/**
 * StreakChip — 헤더의 연속 기록 칩(달력 아이콘 + "N일"). 잉크 칩 왼쪽에 같은 pill 모양으로 놓인다. 누르면 달력(/streak).
 * "연속"이라는 글자는 뺐다 — 360pt 폭 폰에서 잉크 칩·마이페이지와 나란히 서면 헤더가 넘쳤다.
 * 아이콘은 달력 — 불꽃은 앱 감성에 안 맞았고(사용자 피드백), 단순한 불꽃은 옆 잉크 칩의 물방울과
 * 구분이 안 됐다. 누르면 달력이 열리니 뜻도 맞는다. 화면 읽기에는 "연속 N일"로 읽힌다.
 *
 * 오늘 이미 썼으면 숫자를 포인트색으로, 아직이면 차분한 색으로 — 경고(루비)는 쓰지 않는다.
 * 끊기기 직전이라고 다그치지 않는 게 이 앱의 톤이다(달력 화면이 "오늘 한 줄이면 이어져요"라고만 말한다).
 */
import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import { PressableScale } from '@/components/primitives';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/icons';
import { useJournalStreak } from '@/store/journal-store';
import { controlPresets, radii, useTheme } from '@/theme';

export function StreakChip() {
  const theme = useTheme();
  const router = useRouter();
  const { currentStreak, writtenToday } = useJournalStreak();
  const color = writtenToday ? theme.colors.point.p600 : theme.colors.ink.secondary;

  return (
    <PressableScale
      onPress={() => router.push('/streak')}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={`연속 ${currentStreak}일 · 기록 달력 보기`}
      style={[
        styles.chip,
        {
          backgroundColor: theme.colors.surface.nested,
          borderWidth: StyleSheet.hairlineWidth * 2,
          borderColor: theme.colors.line.base,
        },
      ]}
    >
      <Icon name="calendar" size={14} color={color} />
      <ThemedText variant="sm" numberOfLines={1} style={{ color, fontWeight: '700' }}>
        {currentStreak}일
      </ThemedText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    ...controlPresets.pill,
    borderRadius: radii.pill,
  },
});
