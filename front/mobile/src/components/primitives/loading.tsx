/**
 * Loading — 기다리는 동안 보여주는 단 하나의 표시.
 *
 * 왜 공통으로 묶는가: 같은 "기다림"을 화면마다 다르게 보여주고 있었다 —
 * 광장은 텍스트만, 회상은 스피너+문구, 마을은 아무것도 없고, 단어장 상세는 빈 화면.
 * 사용자는 같은 상태를 매번 다른 모양으로 만나게 된다.
 *
 * 기준은 회상 채팅의 패턴이다: **작은 스피너 + 한 줄 설명**.
 * 스피너만 있으면 "뭘 기다리는지" 모르고, 텍스트만 있으면 멈춘 건지 도는 건지 모른다.
 *
 * 사용:
 *   <Loading message="광장을 불러오고 있어요" />        // 화면 전체(세로 중앙)
 *   <Loading message="과거의 내가 생각하는 중…" inline />  // 콘텐츠 흐름 안에 한 줄
 */
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/theme';

export type LoadingProps = {
  /** 무엇을 기다리는지 한 줄로. 비우면 스피너만. */
  message?: string;
  /**
   * true면 콘텐츠 흐름 안에 가로 한 줄(스피너 옆에 문구),
   * false(기본)면 남은 공간을 채워 세로 중앙 정렬.
   */
  inline?: boolean;
};

export function Loading({ message, inline = false }: LoadingProps) {
  const theme = useTheme();
  const spinner = <ActivityIndicator size="small" color={theme.colors.point.p600} />;

  if (inline) {
    return (
      <View style={styles.inline}>
        {spinner}
        {message ? (
          <ThemedText variant="caption" tone="placeholder" style={{ marginLeft: 8 }}>
            {message}
          </ThemedText>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.center}>
      {spinner}
      {message ? (
        <ThemedText
          variant="sm"
          tone="secondary"
          style={{ marginTop: theme.spacing.s3, textAlign: 'center' }}
        >
          {message}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  inline: { flexDirection: 'row', alignItems: 'center' },
});
