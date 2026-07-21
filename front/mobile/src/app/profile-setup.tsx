/**
 * /profile-setup — 가입/로그인 후 프로필(출생연도·성별·관심사) 완성 화면.
 * 인증 방식과 무관하게 미완성이면 여기를 통과(설계: 단일 프로필 게이트).
 * token은 auth-store에서 읽음 → 시크릿 파라미터 없음. 완료 시 기록 탭(홈)으로 replace.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { YearPickerSheet } from '@/components/domain/year-picker-sheet';
import { Button, PressableScale } from '@/components/primitives';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { INTERESTS } from '@/constants/interests';
import { Icon } from '@/icons';
import type { ApiError } from '@/services/api-client';
import { useAuthStore } from '@/store/auth-store';
import { useTheme } from '@/theme';

export default function ProfileSetupScreen() {
  const theme = useTheme();
  const router = useRouter();
  const updateProfile = useAuthStore((s) => s.updateProfile);

  const [year, setYear] = useState<number | null>(null);
  const [yearSheetOpen, setYearSheetOpen] = useState(false);
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
    // 연도는 드롭다운 선택이라 범위 검증 불필요 — 선택 여부만 확인.
    if (year == null) return '출생연도를 선택해 주세요.';
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
      await updateProfile({ birthYear: year!, gender: gender!, interests: selected });
      // 가입 → 프로필 완성 후에도 로그인과 동일하게 기록 탭(홈)으로.
      router.replace('/');
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
        {/* 직접 입력 대신 드롭다운 — TextField와 같은 시각 언어의 선택 필드 */}
        <PressableScale
          onPress={() => setYearSheetOpen(true)}
          style={[
            styles.yearField,
            {
              backgroundColor: theme.colors.surface.nested,
              borderColor: theme.colors.line.base,
              borderRadius: theme.radii.md,
            },
          ]}
        >
          <ThemedText
            variant="body"
            style={{ color: year ? theme.colors.ink.primary : theme.colors.ink.placeholder }}
          >
            {year ?? '연도를 선택해 주세요'}
          </ThemedText>
          <Icon name="chevronD" size={18} color={theme.colors.ink.placeholder} />
        </PressableScale>

        {/* 성별 */}
        <ThemedText variant="h3" style={[styles.label, { marginTop: theme.spacing.s6 }]}>
          성별
        </ThemedText>
        <View style={styles.genderRow}>
          {(['male', 'female'] as const).map((g) => {
            const on = gender === g;
            return (
              <PressableScale
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
              </PressableScale>
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
              <PressableScale
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
              </PressableScale>
            );
          })}
        </View>

        {error ? (
          <ThemedText variant="sm" style={{ color: theme.colors.ruby.base, marginTop: theme.spacing.s4 }}>
            {error}
          </ThemedText>
        ) : null}

        <Button
          label="시작하기"
          onPress={handleSubmit}
          loading={submitting}
          fullWidth
          style={{ marginTop: theme.spacing.s6 }}
        />
      </ScrollView>

      {/* 출생연도 선택 시트 */}
      <YearPickerSheet
        visible={yearSheetOpen}
        current={year}
        onSelect={setYear}
        onClose={() => setYearSheetOpen(false)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 32 },
  label: { marginBottom: 12 },
  // TextField(base) 시각 규약과 맞춤: 1.5px 보더 + 14/16 패딩
  yearField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  genderRow: { flexDirection: 'row', gap: 12 },
  genderBtn: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
  },
});
