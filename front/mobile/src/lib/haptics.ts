/**
 * 햅틱(진동 피드백) 래퍼 — 호출 지점에서 한 줄로 쓰도록 플랫폼·설정 분기를 여기서 끝낸다.
 *
 * 세 가지 원칙:
 *   1. 절대 throw하지 않는다. 햅틱이 안 된다고 저장이 실패하면 안 된다 → 전부 .catch(() => {}).
 *   2. 웹에서는 즉시 return. expo-haptics는 웹에서 동작하지 않고, 이 앱은 웹에서 검증한다.
 *   3. 설정은 훅이 아니라 useSettingsStore.getState()로 읽는다 —
 *      이벤트 핸들러·React 밖(lib/attendance.ts 등)에서도 불러야 하기 때문이다.
 *
 * 왜 탭 전환에는 쓰지 않는가 (다음 사람이 추가하지 않도록 남긴다):
 *   탭은 하루 수십 번 누르는 곳이다. 거기에 진동을 깔면 손이 피로해지고,
 *   무엇보다 신호가 값싸진다 — 매번 울리는 진동은 "일이 끝났다"는 뜻을 잃는다.
 *   iOS 기본 앱들도 탭 전환에는 햅틱을 주지 않는다. 브랜드 톤("차분함·사색·여백")에도 어긋난다.
 *   햅틱은 아껴 쓸수록 강해진다 — 의미 있는 완료·되돌릴 수 없는 행동·실패에만 준다.
 */
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { useSettingsStore } from '@/store/settings-store';

/** 웹이거나 사용자가 껐으면 진동을 보내지 않는다. */
function enabled(): boolean {
  if (Platform.OS === 'web') return false;
  return useSettingsStore.getState().haptics;
}

/** 가벼운 확인 — 좋아요, 마을 이동처럼 "눌렸다"만 알리는 자리. */
export function hapticTap(): void {
  if (!enabled()) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** 의미 있는 완료 — 정의 저장, 출석 적립처럼 "일이 끝났다"를 알리는 자리. */
export function hapticSuccess(): void {
  if (!enabled()) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/** 되돌릴 수 없는 행동 직전 — 회원 탈퇴 확인 다이얼로그를 띄울 때 같은 자리. */
export function hapticWarning(): void {
  if (!enabled()) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
}

/** 실패 — 이미 화면에 에러를 그리고 있는 곳에만 더한다(새 에러 UI를 만들지 말 것). */
export function hapticError(): void {
  if (!enabled()) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}
