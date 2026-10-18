/**
 * WatchAdButton — "광고 보고 잉크 N개 받기" 버튼 + 오늘 남은 횟수 한 줄.
 *
 * 두 자리에서 같은 컴포넌트를 쓴다:
 *   ① 마이페이지 "내 잉크" 아래 — 평소에 모으는 자리
 *   ② 회상에서 잉크가 모자라 막혔을 때 — 가장 필요한 순간
 *
 * 🔴 적립을 이 컴포넌트가 하지 않는다.
 *   광고가 닫히면 **서버에 쿼터를 다시 묻는다.** remaining이 줄어 있으면 서버가 구글의
 *   SSV 콜백을 받아 적립을 기록했다는 뜻이고, 그게 유일한 증거다.
 *   앱이 "봤어요"라고 말해서 잉크를 받는 길은 만들지 않았다(→ lib/rewarded-ad.ts).
 *
 * 비동기 3종:
 *   진행 중 — 광고 로드/재생 중 + 적립 확인 중 → 버튼 loading(스피너)
 *   실패   — 광고 없음/재생 실패는 버튼 아래 한 줄로(인라인). 토스트는 성공 전용이다.
 *   성공   — hapticSuccess() + 토스트 "잉크 N개가 쌓였어요"
 *
 * 쿼터 조회가 실패하면 **아무것도 그리지 않는다.** 쿼터를 못 읽는다는 건 서버의 광고
 * 기능이 아직 없다는 뜻이고, 그러면 SSV 적립도 일어나지 않는다. 지키지 못할 약속
 * ("광고 보면 잉크 줄게")을 버튼으로 내걸지 않는다.
 */
import { useEffect, useState } from 'react';
import { Platform, type StyleProp, View, type ViewStyle } from 'react-native';

import { Button, useToast } from '@/components/primitives';
import { ThemedText } from '@/components/themed-text';
import { hapticSuccess } from '@/lib/haptics';
import { useRewardedAd } from '@/lib/rewarded-ad';
import { getAdQuota, type AdQuota } from '@/services/ads-api';
import { useAuthStore } from '@/store/auth-store';
import { useTheme } from '@/theme';

/**
 * SSV 콜백은 광고가 닫힌 뒤 수 초 늦게 올 수 있다 — 구글 → 우리 서버 경로라
 * 앱이 기다릴 수밖에 없다. 1초 뒤, 안 됐으면 2초 더, 다시 3초 더 묻는다(합 6초).
 */
const RECHECK_DELAYS_MS = [1000, 2000, 3000];

export type WatchAdButtonProps = {
  /** 바깥 여백 등 배치 스타일. 두 진입점의 간격이 달라 호출 측이 정한다. */
  style?: StyleProp<ViewStyle>;
};

export function WatchAdButton({ style }: WatchAdButtonProps) {
  const theme = useTheme();
  const { show: showToast } = useToast();
  const token = useAuthStore((s) => s.token);
  const userId = useAuthStore((s) => s.user?.id);
  const setBalance = useAuthStore((s) => s.setBalance);

  const [quota, setQuota] = useState<AdQuota | null>(null);
  /** 적립 확인 중(광고는 닫혔고 서버 기록을 기다린다). */
  const [checking, setChecking] = useState(false);
  /** 끝내 반영이 안 보일 때의 안내. 실패가 아니라 "조금 늦는다"는 말이다. */
  const [pending, setPending] = useState<string | null>(null);

  // 쿼터 첫 조회. 실패는 조용히 둔다 — quota가 null이면 아래에서 아무것도 그리지 않는다.
  useEffect(() => {
    if (!token) return;
    getAdQuota(token)
      .then(setQuota)
      .catch(() => setQuota(null));
  }, [token]);

  /**
   * 광고가 닫힌 뒤 — 적립됐는지 서버에 다시 묻는다.
   * "remaining이 줄었다" = 서버가 SSV 콜백을 받아 지급을 기록했다. 이것만 성공으로 센다.
   */
  async function handleClosed() {
    if (!token || !quota) return;
    const before = quota.remaining;
    setChecking(true);
    setPending(null);
    for (const delay of RECHECK_DELAYS_MS) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      const next = await getAdQuota(token).catch(() => null);
      if (!next) continue;
      setQuota(next);
      if (next.remaining < before) {
        // 서버가 이미 적립을 기록했다. 화면의 잔액 숫자를 그 사실에 맞춰 따라가게 한다.
        // 진짜 잔액의 주인은 서버다 — 다음 서버 응답(출석·회상·로그인)이 이 값을 덮어쓴다.
        // 여기서 숫자를 더해도 서버 잔액은 1도 변하지 않으므로 조작의 통로가 아니다.
        setBalance((useAuthStore.getState().user?.balance ?? 0) + next.amount);
        hapticSuccess();
        showToast(`잉크 ${next.amount}개가 쌓였어요`);
        setChecking(false);
        return;
      }
    }
    setChecking(false);
    setPending('잉크가 곧 반영돼요');
  }

  const ad = useRewardedAd({ userId, onClosed: handleClosed });

  // 쿼터를 못 읽었으면(= 비로그인이거나 조회 실패) 이 기능은 없는 것처럼 둔다.
  // 웹엔 광고 SDK가 없다 — 영영 누를 수 없는 버튼을 걸어 두지 않는다.
  if (!token || !quota || Platform.OS === 'web') return null;

  const soldOut = quota.remaining === 0;
  // 광고가 아직 손에 없지만 실패도 아니다 = 받아오는 중. 회색 비활성이 아니라 스피너로 말한다
  // (회색 버튼 밑에 "N번 더 받을 수 있어요"가 붙어 있으면 앞뒤가 안 맞는다).
  const preparing = !soldOut && !ad.ready && !ad.error;
  const busy = ad.loading || checking || preparing;
  const adMessage =
    ad.error === 'no-fill'
      ? '지금은 광고가 없어요. 잠시 후 다시 불러와 주세요'
      : ad.error === 'failed'
        ? '광고를 불러오지 못했어요. 잠시 후 다시 불러와 주세요'
        : null;
  // 실패하면 버튼이 "다시 불러오기"가 된다. 전엔 회색으로 죽어 화면을 나갔다 와도 그대로였다
  // (SDK는 실패 뒤 스스로 다시 받지 않는다 — rewarded-ad.ts).
  const failed = !soldOut && !!ad.error && !busy;
  // "N번 더"는 지금 누를 수 있을 때만 — 못 누르는데 횟수를 말하면 약속처럼 읽힌다.
  const caption = soldOut
    ? '오늘은 다 받았어요 · 내일 다시 받을 수 있어요'
    : preparing && !checking
      ? '광고를 준비하고 있어요…'
      : ad.ready && !busy
        ? `오늘 ${quota.remaining}번 더 받을 수 있어요`
        : null;

  return (
    <View style={style}>
      <Button
        label={failed ? '광고 다시 불러오기' : `광고 보고 잉크 ${quota.amount}개 받기`}
        variant="soft"
        fullWidth
        loading={busy}
        // 다 받았으면 누를 수 없다. 실패했으면 다시 불러오기로 누를 수 있다.
        disabled={soldOut || (!ad.ready && !busy && !failed)}
        onPress={() => {
          setPending(null);
          if (failed) ad.retry();
          else ad.show();
        }}
      />
      {caption ? (
        <ThemedText
          variant="caption"
          tone="placeholder"
          style={{ marginTop: theme.spacing.s2, textAlign: 'center' }}
        >
          {caption}
        </ThemedText>
      ) : null}
      {adMessage ? (
        <ThemedText
          variant="caption"
          style={{
            color: theme.colors.ruby.base,
            textAlign: 'center',
            marginTop: theme.spacing.s1,
          }}
        >
          {adMessage}
        </ThemedText>
      ) : null}
      {pending ? (
        <ThemedText
          variant="caption"
          tone="secondary"
          style={{ textAlign: 'center', marginTop: theme.spacing.s1 }}
        >
          {pending}
        </ThemedText>
      ) : null}
    </View>
  );
}
