/**
 * /profile-setup — 가입/로그인 후 프로필(출생연도·성별·관심사) 완성 화면.
 * 인증 방식과 무관하게 미완성이면 여기를 통과(설계: 단일 프로필 게이트).
 * token은 auth-store에서 읽음 → 시크릿 파라미터 없음. 완료 시 기록 탭(홈)으로 replace.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChoiceChip } from '@/components/domain/choice-chip';
import { YearPickerSheet } from '@/components/domain/year-picker-sheet';
import { Button, ConfirmDialog, FadeIn, PressableScale, useToast } from '@/components/primitives';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { INTERESTS } from '@/constants/interests';
import { Icon } from '@/icons';
import { type ApiError, userFacingMessage } from '@/services/api-client';
import { useAuthStore } from '@/store/auth-store';
import { useTheme } from '@/theme';

export default function ProfileSetupScreen() {
  // 자체 헤더가 없는 화면이라 상태표시줄 인셋을 직접 더한다(ScreenHeader·AppHeader가 없음).
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  const cancelSignup = useAuthStore((st) => st.cancelSignup);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  /** 가입 취소 — 서버 계정만 지우고 기록 탭으로. 실패하면 남은 계정이 있으니 말해 준다. */
  async function handleCancelSignup() {
    setCancelling(true);
    try {
      await cancelSignup();
      show('가입을 취소했어요');
      router.replace('/');
    } catch {
      show('가입을 취소하지 못했어요. 잠시 후 다시 시도해 주세요', { tone: 'error' });
    } finally {
      setCancelling(false);
    }
  }
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const { show } = useToast();

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

  // 아직 안 고른 항목 — 누르고 나서 에러를 하나씩 맞는 대신, 버튼 위에 남은 걸 미리 보여주고
  // 다 고르기 전엔 버튼을 잠근다. (연도는 드롭다운이라 범위 검증 불필요 — 선택 여부만.)
  const missing = [
    year == null && '출생연도',
    !gender && '성별',
    selected.length === 0 && '관심사',
  ].filter(Boolean);

  async function handleSubmit() {
    if (missing.length > 0) return;
    setError(null);
    setSubmitting(true);
    try {
      await updateProfile({ birthYear: year!, gender: gender!, interests: selected });
      // 토스트는 루트 Provider에 떠 있어 화면이 바뀐 뒤에도 남는다 — 홈에서 보인다.
      show('프로필을 저장했어요');
      // 가입 → 프로필 완성 후에도 로그인과 동일하게 기록 탭(홈)으로.
      router.replace('/');
    } catch (e) {
      setError(userFacingMessage(e) ?? '연결이 불안정해요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ThemedView bg="paper" style={styles.root}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: styles.scroll.paddingTop + insets.top }]} showsVerticalScrollIndicator={false}>
        <ThemedText variant="h1">조금만 더{'\n'}알려주세요</ThemedText>
        <ThemedText variant="body" tone="secondary" style={{ marginTop: theme.spacing.s2 }}>
          관심사에 맞는 단어를 골라 드릴게요.
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
        {/* 목록엔 가입 가능한 해만 있다 — 자기 해가 없는 아이가 "왜 없지?"를 바로 알 수 있게. */}
        <ThemedText variant="caption" tone="secondary" style={{ marginTop: theme.spacing.s2 }}>
          만 14세 이상부터 가입할 수 있어요
        </ThemedText>

        {/* 성별 */}
        <ThemedText variant="h3" style={[styles.label, { marginTop: theme.spacing.s6 }]}>
          성별
        </ThemedText>
        <View style={styles.genderRow}>
          {/* 관심사·회상 시절 칩과 같은 모양 — 같은 "고르기"는 같은 생김새로. */}
          {(['male', 'female'] as const).map((g) => (
            <ChoiceChip
              key={g}
              grow
              label={g === 'male' ? '남성' : '여성'}
              selected={gender === g}
              onPress={() => setGender(g)}
            />
          ))}
        </View>

        {/* 관심사 */}
        <ThemedText variant="h3" style={[styles.label, { marginTop: theme.spacing.s6 }]}>
          관심사 <ThemedText variant="sm" tone="placeholder">· 1개 이상</ThemedText>
        </ThemedText>
        <View style={styles.chips}>
          {INTERESTS.map((item) => (
            <ChoiceChip
              key={item}
              label={item}
              selected={selected.includes(item)}
              onPress={() => toggleInterest(item)}
            />
          ))}
        </View>

        {error ? (
          <ThemedText variant="sm" style={{ color: theme.colors.ruby.base, marginTop: theme.spacing.s4 }}>
            {error}
          </ThemedText>
        ) : null}

        {missing.length > 0 ? (
          <FadeIn key={missing.join()} style={{ marginTop: theme.spacing.s6 }}>
            <ThemedText variant="sm" tone="secondary" style={{ textAlign: 'center' }}>
              {/* 조사는 마지막 항목 받침에 맞춘다 — 받침 있는 건 '성별'뿐. */}
              {missing.join('·')}
              {missing[missing.length - 1] === '성별' ? '을' : '를'} 골라주세요
            </ThemedText>
          </FadeIn>
        ) : null}

        <Button
          label="시작하기"
          onPress={handleSubmit}
          loading={submitting}
          disabled={missing.length > 0}
          fullWidth
          style={{ marginTop: missing.length > 0 ? theme.spacing.s3 : theme.spacing.s6 }}
        />

        {/* 출구 — 이 단계는 건너뛸 수 없으니(ProfileGate) 그만두는 길이 꼭 있어야 한다.
            만 14세 미만은 여기서 끝낼 수 없어 이 버튼으로 나간다. 폰의 기록은 그대로 남는다. */}
        <Button
          label="가입 취소"
          variant="ghost"
          size="sm"
          onPress={() => setCancelOpen(true)}
          disabled={cancelling}
          style={{ marginTop: theme.spacing.s3, alignSelf: 'center' }}
        />
      </ScrollView>

      <ConfirmDialog
        visible={cancelOpen}
        title="가입을 취소할까요?"
        message={'계정을 지우고 가입 전처럼 돌아가요.\n이 폰에 쓴 기록은 그대로 남아요.'}
        confirmLabel={cancelling ? '취소 중…' : '가입 취소'}
        destructive
        onConfirm={handleCancelSignup}
        onClose={() => setCancelOpen(false)}
      />

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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});
