/**
 * LoadFailed — 광장 화면들이 데이터를 못 받았을 때 보여주는 한 가지 모양.
 *
 * 전엔 광장 목록(가운데 정렬)과 단어 상세(위쪽 정렬, 글자만)가 서로 달라
 * 같은 실패가 다른 일처럼 보였다. 아이콘 + 무엇이 / 왜 + 복구 버튼을 한 벌로 묶는다.
 * 위치(가운데 정렬)는 호출부가 감싸는 컨테이너가 맡는다 — 이 안은 내용만.
 */
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/primitives';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/icons';
import { useTheme } from '@/theme';

export function LoadFailed({ onRetry, retrying }: { onRetry: () => void; retrying?: boolean }) {
  const theme = useTheme();
  return (
    <View style={styles.wrap}>
      <Icon name="plaza" size={40} color={theme.colors.ink.placeholder} />
      <ThemedText variant="bodyMd" tone="strong" style={{ marginTop: theme.spacing.s4 }}>
        불러오지 못했어요
      </ThemedText>
      <ThemedText variant="sm" tone="secondary" style={{ marginTop: theme.spacing.s1 }}>
        인터넷 연결을 확인해 주세요
      </ThemedText>
      {/* 실패 화면엔 리스트가 없어 당겨서 새로고침을 찾을 수 없다 — 이 버튼이 유일한 복구 수단. */}
      <Button
        label="다시 시도"
        variant="soft"
        size="sm"
        loading={retrying}
        onPress={onRetry}
        style={{ marginTop: theme.spacing.s4 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
});
