/**
 * ScreenHeader — 뒤로가기 화면 공용 헤더 (중앙 타이틀 패턴).
 *
 * 화면마다 제각각이던 back+타이틀 헤더를 하나로 통일:
 *   [back 40pt+hitSlop] [중앙 title(+subtitle)] [right 슬롯 | 40pt 스페이서]
 *
 * safe area: 상단 인셋(노치)을 자동 반영. 웹(인셋 0)에서는 기존 화면들의
 * paddingTop 16 룩과 동일 — Math.max(inset, 8) + 8.
 */
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/icons';
import { useTheme } from '@/theme';

export type ScreenHeaderProps = {
  title: string;
  /** 타이틀 아래 작은 보조 텍스트 (예: 회상 채팅 '생성형 AI 활용') */
  subtitle?: string;
  /** 우측 슬롯 — 미지정 시 타이틀 중앙 유지용 40pt 스페이서 */
  right?: ReactNode;
  /** 하단 구분선 — 스크롤 콘텐츠와 경계가 필요한 화면(채팅)에서만 */
  bordered?: boolean;
  /** 미지정 시 router.back() */
  onBack?: () => void;
};

export function ScreenHeader({ title, subtitle, right, bordered, onBack }: ScreenHeaderProps) {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.wrap,
        { paddingTop: Math.max(insets.top, theme.spacing.s2) + theme.spacing.s2 },
        bordered && { borderBottomWidth: 1, borderBottomColor: theme.colors.line.base },
      ]}
    >
      <Pressable
        onPress={onBack ?? (() => router.back())}
        hitSlop={4}
        style={({ pressed }) => [
          styles.iconBtn,
          { backgroundColor: pressed ? theme.colors.surface.nested : 'transparent' },
        ]}
      >
        <Icon name="back" size={22} color={theme.colors.ink.strong} />
      </Pressable>
      <View style={styles.center}>
        <ThemedText variant="h3" numberOfLines={1}>
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText variant="caption" tone="placeholder">
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      <View style={styles.right}>{right ?? <View style={styles.iconBtn} />}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { flex: 1, alignItems: 'center' },
  right: { minWidth: 40, alignItems: 'flex-end' },
});
