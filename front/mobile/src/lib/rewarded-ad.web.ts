/**
 * 웹용 useRewardedAd — 아무것도 하지 않는다.
 *
 * 광고 SDK(react-native-google-mobile-ads)는 네이티브 TurboModule이라 웹에서는
 * **import만 해도** 터진다. Metro가 웹 빌드에서 rewarded-ad.ts 대신 이 파일을 고른다
 * (hooks/use-color-scheme.web.ts와 같은 방식).
 *
 * 그래서 웹에서는 ready=false로 버튼이 비활성이고, 쿼터 표시와 상태 전환만 확인할 수 있다.
 * 광고 재생과 실제 적립은 실기기에서만 확인된다.
 */
import type { RewardedAdState, UseRewardedAdOptions } from './rewarded-ad';

export type { RewardedAdError, RewardedAdState, UseRewardedAdOptions } from './rewarded-ad';

export function useRewardedAd(_options: UseRewardedAdOptions): RewardedAdState {
  return { ready: false, loading: false, error: null, show: () => {} };
}
