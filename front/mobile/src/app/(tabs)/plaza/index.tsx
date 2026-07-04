/**
 * 광장 (Plaza) 리스트 — 정의가 쌓인 단어들. 누르면 /plaza/[word] 상세로 push.
 *
 * 가입 필요 탭 — AuthGate가 로그아웃 사용자에게 가입 유도 화면을 보여준다.
 * 로그인 사용자에겐 서버에서 단어 목록을 받아 표시(시드 + 내 정의).
 */
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/domain/app-header';
import { AuthGate } from '@/components/domain/auth-gate';
import { FadeIn, PressableScale } from '@/components/primitives';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getPlazaWords, type PlazaWord } from '@/services/plaza-api';
import { useAuthStore } from '@/store/auth-store';
import { useTheme } from '@/theme';

export default function PlazaScreen() {
  return (
    <AuthGate
      icon="plaza"
      title="광장"
      description="다른 사람들은 이 단어를 어떻게 정의했을까요? 가입하고 내 정의를 나누면 광장이 열려요."
    >
      <PlazaWordList />
    </AuthGate>
  );
}

function PlazaWordList() {
  const theme = useTheme();
  const router = useRouter();
  const token = useAuthStore((s) => s.token);

  const [words, setWords] = useState<PlazaWord[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    setFailed(false);
    getPlazaWords(token)
      .then((w) => {
        if (alive) setWords(w);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [token]);

  if (failed) return <CenterMessage text="광장을 불러오지 못했어요." />;
  if (words === null) return <CenterMessage text="불러오는 중…" />;
  if (words.length === 0) return <CenterMessage text="아직 정의된 단어가 없어요." />;

  return (
    <ThemedView bg="paper" style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <AppHeader />
        <ThemedText variant="h1">광장</ThemedText>
        <ThemedText variant="body" tone="secondary" style={{ marginTop: theme.spacing.s2 }}>
          남들은 이 단어를 어떻게 정의했을까요
        </ThemedText>

        <View style={[styles.list, { marginTop: theme.spacing.s6 }]}>
          {words.map((w, i) => (
            <FadeIn key={w.word} delay={Math.min(i, 8) * 40}>
              <PressableScale
                onPress={() => router.push({ pathname: '/plaza/[word]', params: { word: w.word } })}
                style={[
                  styles.row,
                  {
                    backgroundColor: theme.colors.surface.base,
                    borderColor: theme.colors.line.base,
                    borderRadius: theme.radii.lg,
                  },
                  theme.shadows.sm,
                ]}
              >
                <ThemedText variant="h3" style={{ flex: 1 }} numberOfLines={1}>
                  {w.word}
                </ThemedText>
                <ThemedText variant="caption" tone="placeholder">
                  {w.count}개의 정의
                </ThemedText>
              </PressableScale>
            </FadeIn>
          ))}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function CenterMessage({ text }: { text: string }) {
  return (
    <ThemedView bg="paper" style={styles.center}>
      <ThemedText variant="body" tone="secondary">
        {text}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32 },
  list: { gap: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
});
