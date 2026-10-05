/**
 * EmailCodeForm — 이메일로 받은 6자리 인증번호 입력. presentational(네트워크·전역상태 없음).
 *
 * 가입(auth.tsx)과 비밀번호 재설정이 이 한 화면을 공유한다 — 코드 규칙(6자리·10분·60초 쿨다운)이
 * 두 흐름에서 똑같아서 각자 만들면 한쪽만 고치는 사고가 난다.
 * 발송·확인은 전부 부모의 몫이고, 여기는 입력·카운트다운·에러 표시만 한다.
 *
 * 비동기 3종은 부모가 넘기는 props로 전부 화면에 나온다:
 *   진행 중 → submitting(확인 버튼 스피너) · resending("보내는 중…")
 *   실패    → error (입력칸 아래 인라인 문구 — TextField의 error가 그린다)
 *   성공    → 부모가 화면을 넘기거나(확인) cooldownFrom을 갱신한다(재전송 = 카운트다운 재시작)
 */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, FadeIn, PressableScale, TextField } from '@/components/primitives';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/theme';

/** 재전송 쿨다운(초). 서버의 60초 제한과 같은 값 — 다르면 눌리는 버튼이 429만 받아온다. */
const RESEND_COOLDOWN_SEC = 60;

export type EmailCodeFormProps = {
  /** 코드를 보낸 주소. 화면에 그대로 보여준다("...로 보냈어요"). */
  email: string;
  /** 6자리가 채워져 사용자가 확인을 누름(6자리가 차면 자동으로도 한 번 호출된다). */
  onSubmit: (code: string) => void;
  /** 재전송 요청. 성공하면 부모가 cooldownFrom을 바꿔 카운트다운을 다시 시작시킨다. */
  onResend: () => void;
  /** 코드 확인 진행 중 — 확인 버튼이 스피너가 되고 자동 제출이 막힌다. */
  submitting?: boolean;
  /** 재전송 발송 진행 중 — 중복 발송을 막고 "보내는 중…"을 보여준다. */
  resending?: boolean;
  /** 화면에 그릴 실패 사유. null이면 안 그린다. */
  error?: string | null;
  /** 바뀔 때마다 60초 카운트다운을 재시작하는 신호(발송 시각). */
  cooldownFrom: number;
};

/** 발송 시각으로부터 남은 쿨다운 초. 0이면 다시 보낼 수 있다. */
function remainingSec(from: number): number {
  if (!from) return 0;
  return Math.max(0, RESEND_COOLDOWN_SEC - Math.floor((Date.now() - from) / 1000));
}

export function EmailCodeForm({
  email,
  onSubmit,
  onResend,
  submitting,
  resending,
  error,
  cooldownFrom,
}: EmailCodeFormProps) {
  const theme = useTheme();
  const [code, setCode] = useState('');
  const [left, setLeft] = useState(() => remainingSec(cooldownFrom));

  // cooldownFrom이 바뀌면(= 방금 발송됐다) 카운트다운을 처음부터 다시 돌린다.
  useEffect(() => {
    setLeft(remainingSec(cooldownFrom));
    const id = setInterval(() => {
      const next = remainingSec(cooldownFrom);
      setLeft(next);
      if (next === 0) clearInterval(id); // 다 세고 나면 더 돌릴 이유가 없다
    }, 1000);
    return () => clearInterval(id);
  }, [cooldownFrom]);

  // 숫자만 남긴다 — 메일에서 붙여넣으면 공백·줄바꿈이 섞여 들어와 6자리 검사가 조용히 틀린다.
  function handleChange(text: string) {
    const digits = text.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    // 6자리가 차면 바로 확인 — 번호를 다 넣고 버튼을 또 찾게 하지 않는다.
    if (digits.length === 6 && !submitting) onSubmit(digits);
  }

  return (
    <View style={[styles.container, { paddingHorizontal: theme.spacing.s6 }]}>
      <FadeIn style={{ marginTop: theme.spacing.s8 }}>
        <ThemedText variant="h1">{'인증번호를\n입력해 주세요'}</ThemedText>
        <ThemedText variant="body" tone="secondary" style={{ marginTop: theme.spacing.s3 }}>
          {`${email}로\n6자리 번호를 보냈어요.`}
        </ThemedText>

        <TextField
          value={code}
          onChangeText={handleChange}
          placeholder="인증번호 6자리"
          keyboardType="number-pad"
          maxLength={6}
          // iOS가 메일에서 코드를 읽어 자동 채움 — 앱을 떠나지 않게 하는 가장 큰 편의.
          textContentType="oneTimeCode"
          autoFocus
          error={error ?? undefined}
          style={[styles.codeInput, { marginTop: theme.spacing.s6 }]}
        />

        <Button
          label="확인"
          onPress={() => onSubmit(code)}
          loading={submitting}
          disabled={code.length !== 6}
          fullWidth
          style={{ marginTop: theme.spacing.s5 }}
        />

        {/* 재전송 — 잠긴 동안은 남은 초만 보여준다(눌려도 서버가 429를 줄 뿐이다). */}
        <View style={[styles.resend, { marginTop: theme.spacing.s5 }]}>
          {left > 0 ? (
            // key로 두 상태를 갈라 FadeIn이 전환마다 다시 재생되게 한다(툭 바뀌지 않도록).
            <FadeIn key="locked">
              <ThemedText variant="sm" tone="secondary">
                {`${left}초 뒤에 다시 보낼 수 있어요`}
              </ThemedText>
            </FadeIn>
          ) : (
            <FadeIn key="open">
              <PressableScale onPress={onResend} disabled={resending} hitSlop={8}>
                <ThemedText
                  variant="sm"
                  style={{ color: theme.colors.point.p600, fontWeight: '700' }}
                >
                  {resending ? '보내는 중…' : '인증번호 다시 받기'}
                </ThemedText>
              </PressableScale>
            </FadeIn>
          )}
        </View>
      </FadeIn>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  // 6자리 숫자는 가운데 정렬이 읽기 쉽다(치수·색은 TextField 토큰 그대로).
  codeInput: { textAlign: 'center' },
  resend: { alignItems: 'center' },
});
