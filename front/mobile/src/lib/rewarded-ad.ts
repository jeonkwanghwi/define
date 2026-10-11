/**
 * useRewardedAd — 보상형 광고 한 편을 미리 받아 두고, 눌렀을 때 틀어 주는 훅.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ 🔴 이 훅은 잉크를 주지 않는다. 한 줄도.                                    │
 * │                                                                          │
 * │ 광고를 끝까지 봤다는 사실은 **구글이 우리 서버에 직접 전화해서**           │
 * │ (SSV 콜백) 알려준다. 앱이 보내는 "다 봤어요" 신호로 적립하면, 그 신호는    │
 * │ 누구나 만들 수 있다 — 프록시로 요청 한 줄만 쏘면 잉크가 무한히 찍힌다.     │
 * │ 그래서 광고 완료 콜백(onEarnedReward)은 **로그만** 남긴다.                 │
 * │ 적립됐는지는 화면이 서버에 **다시 물어서**(쿼터 재조회) 안다.              │
 * │ → WatchAdButton의 onClosed 참고.                                          │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * 광고 단위 ID는 EXPO_PUBLIC_ADMOB_REWARDED_ID로 주입하고, 없으면 구글 공개 테스트 단위다.
 * .env에 실 광고 단위를 **일부러 넣지 않았다** — 개발 중에 실 광고를 띄우면 우리가 우리
 * 광고를 보고 누르는 셈이고, AdMob은 그걸 무효 트래픽으로 보아 계정을 정지시킨다.
 * 실 단위(ca-app-pub-7103568935643385/9712302007)는 스토어 빌드의 환경변수로만 넣는다.
 *
 * ATT(App Tracking Transparency)는 넣지 않았다 — 개인정보처리방침에 "광고 식별자를
 * 수집하지 않는다"고 적었기 때문이다. 그 대가로 비개인화 광고만 요청한다(수익은 낮다).
 *
 * 웹 빌드에서는 이 파일 대신 rewarded-ad.web.ts가 쓰인다
 * (광고 SDK는 네이티브 모듈이라 웹에서는 import만 해도 터진다).
 */
import { useEffect, useRef } from 'react';
import mobileAds, {
  TestIds,
  useRewardedAd as useGoogleRewardedAd,
} from 'react-native-google-mobile-ads';

const REWARDED_ID = process.env.EXPO_PUBLIC_ADMOB_REWARDED_ID ?? TestIds.REWARDED;

// SDK 초기화는 앱 전체에서 한 번. 광고를 로드하기 전에 끝나 있어야 한다.
void mobileAds().initialize();

/** 'no-fill' = 지금 줄 광고가 없음(흔한 일, 고장이 아니다). 'failed' = 그 외 실패. */
export type RewardedAdError = 'no-fill' | 'failed';

export type RewardedAdState = {
  /** 광고가 손에 들어와 있다 — 지금 누르면 바로 재생된다. */
  ready: boolean;
  /** 받아오는 중이거나 재생 중. */
  loading: boolean;
  /** 실패를 인라인으로 말하기 위한 분류. 없으면 null. */
  error: RewardedAdError | null;
  /** 광고 재생. ready가 아닐 때 누르면 아무 일도 하지 않는다. */
  show: () => void;
};

export type UseRewardedAdOptions = {
  /** 로그인한 사용자 id. 이 값이 그대로 SSV 콜백의 user_id로 돌아온다. */
  userId?: string;
  /** 광고가 닫힌 직후 — 호출 측이 서버에 적립 여부를 다시 묻는 자리. */
  onClosed: () => void;
};

export function useRewardedAd({ userId, onClosed }: UseRewardedAdOptions): RewardedAdState {
  const ad = useGoogleRewardedAd({
    // userId가 없으면(비로그인) 광고를 아예 만들지 않는다 — SSV 콜백에 누구인지 적을 수
    // 없어 서버가 콜백을 받아도 줄 사람을 모른다. 보여줄 이유가 없는 광고다.
    adUnitId: userId ? REWARDED_ID : null,
    requestOptions: {
      // ATT를 넣지 않았으므로 비개인화 광고로 요청한다(위 주석 참고).
      requestNonPersonalizedAdsOnly: true,
      // 이게 없으면 서버는 "누가 광고를 봤는지" 모른다. SSV의 전부다.
      serverSideVerificationOptions: { userId },
    },
    // 기본값. 버튼을 누른 뒤 로드하면 몇 초 기다리게 되므로 미리 받아 둔다.
    autoLoad: true,
  });

  // 매 렌더의 최신 콜백을 쓰기 위해 ref로 들고 간다(effect를 다시 돌리지 않으려고).
  const onClosedRef = useRef(onClosed);
  onClosedRef.current = onClosed;

  // 광고를 끝까지 봤다 — **여기서 잉크를 주지 않는다**(파일 맨 위 상자 참고). 로그만.
  useEffect(() => {
    if (ad.earnedReward) {
      console.log('[ads] 광고 시청 완료. 적립은 서버가 구글의 SSV 콜백을 받아 처리한다.');
    }
  }, [ad.earnedReward]);

  // 닫히면: 호출 측에 알리고(= 쿼터 재조회) 다음 광고를 미리 받아 둔다.
  // 한 번 보여준 인스턴스는 다시 쓸 수 없어 destroy로 새것으로 갈아 끼운 뒤 load한다.
  const { status, destroy, load } = ad;
  useEffect(() => {
    if (status !== 'closed') return;
    onClosedRef.current();
    destroy();
    load();
  }, [status, destroy, load]);

  return {
    ready: status === 'loaded',
    loading: status === 'loading' || status === 'showing',
    error: status === 'no-fill' ? 'no-fill' : status === 'error' ? 'failed' : null,
    show: ad.show,
  };
}
