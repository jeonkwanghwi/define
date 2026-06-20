/**
 * /profile-setup — 가입/로그인 후 프로필(출생연도·성별·관심사) 완성 화면.
 * 인증 방식과 무관하게 미완성이면 여기를 통과(설계: 단일 프로필 게이트).
 * token은 auth-store에서 읽음 → 시크릿 파라미터 없음. 완료 시 router.back().
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button, TextField } from '@/components/primitives';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { INTERESTS } from '@/constants/interests';
import type { ApiError } from '@/services/api-client';
import { useAuthStore } from '@/store/auth-store';
import { useTheme } from '@/theme';

const THIS_YEAR = 2026;

export default function ProfileSetupScreen() {
  const theme = useTheme();
  const router = useRouter();
  const updateProfile = useAuthStore((s) => s.updateProfile);

  const [year, setYear] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleInterest(item: string) {
    setSelected((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item],
    );
  }

  function validate(): string | null {
    const y = Number(year);
    if (!/^\d{4}$/.test(year) || y < 1900 || y > THIS_YEAR) return '출생연도를 4자리로 입력해 주세요.';
    if (!gender) return '성별을 선택해 주세요.';
    if (selected.length === 0) return '관심사를 1개 이상 골라 주세요.';
    return null;
  }

  async function handleSubmit() {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await updateProfile({ birthYear: Number(year), gender: gender!, interests: selected });
      router.back();
    } catch (e) {
      const err = e as Partial<ApiError>;
      setError(err?.message ?? '연결이 불안정해요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ThemedView bg="paper" style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ThemedText variant="h1">조금만 더{'\n'}알려주세요</ThemedText>
        <ThemedText variant="body" tone="secondary" style={{ marginTop: theme.spacing.s2 }}>
          이웃을 추천하고 마을을 채우는 데 쓰여요.
        </ThemedText>

        {/* 출생연도 */}
        <ThemedText variant="h3" style={[styles.label, { marginTop: theme.spacing.s8 }]}>
          출생연도
        </ThemedText>
        <TextField
          value={year}
          onChangeText={(t) => setYear(t.replace(/[^0-9]/g, '').slice(0, 4))}
          placeholder="예) 1996"
          keyboardType="number-pad"
          maxLength={4}
        />

        {/* 성별 */}
        <ThemedText variant="h3" style={[styles.label, { marginTop: theme.spacing.s6 }]}>
          성별
        </ThemedText>
        <View style={styles.genderRow}>
          {(['male', 'female'] as const).map((g) => {
            const on = gender === g;
            return (
              <Pressable
                key={g}
                onPress={() => setGender(g)}
                style={[
                  styles.genderBtn,
                  {
                    borderColor: on ? theme.colors.point.p600 : theme.colors.line.base,
                    backgroundColor: on ? theme.colors.point.p050 : theme.colors.surface.base,
                    borderRadius: theme.radii.md,
                  },
                ]}
              >
                <ThemedText
                  variant="bodyMd"
                  style={{ color: on ? theme.colors.point.p600 : theme.colors.ink.primary }}
                >
                  {g === 'male' ? '남성' : '여성'}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        {/* 관심사 */}
        <ThemedText variant="h3" style={[styles.label, { marginTop: theme.spacing.s6 }]}>
          관심사 <ThemedText variant="sm" tone="placeholder">· 1개 이상</ThemedText>
        </ThemedText>
        <View style={styles.chips}>
          {INTERESTS.map((item) => {
            const on = selected.includes(item);
            return (
              <Pressable
                key={item}
                onPress={() => toggleInterest(item)}
                style={[
                  styles.chip,
                  {
                    borderColor: on ? theme.colors.point.p600 : theme.colors.line.base,
                    backgroundColor: on ? theme.colors.point.p050 : theme.colors.surface.base,
                    borderRadius: theme.radii.pill,
                  },
                ]}
              >
                <ThemedText
                  variant="sm"
                  style={{ color: on ? theme.colors.point.p600 : theme.colors.ink.primary }}
                >
                  {item}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        {error ? (
          <ThemedText variant="sm" style={{ color: theme.colors.ruby.base, marginTop: theme.spacing.s4 }}>
            {error}
          </ThemedText>
        ) : null}

        <Button
          label={submitting ? '저장 중…' : '시작하기'}
          onPress={handleSubmit}
          disabled={submitting}
          fullWidth
          style={{ marginTop: theme.spacing.s6 }}
        />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 40 },
  label: { marginBottom: 12 },
  genderRow: { flexDirection: 'row', gap: 12 },
  genderBtn: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
  },
});
