/**
 * foreground-sync — 앱이 포그라운드로 돌아올 때 서버 단어장 변경을 로컬로 당겨온다.
 *
 * 왜: 다운로드(서버→로컬)는 로그인/가입 순간에만 일어난다(reconcileForUser).
 * 이미 로그인된 기기는 다른 기기에서 추가한 단어를 영영 못 받는 문제가 있었다
 * (노트북에서 31개 → 데탑은 24개 그대로). 여기서 포그라운드 복귀마다 다운로드를 트리거해 해결.
 *
 * 트리거:
 *   - 웹: window 'focus' + document 'visibilitychange'(visible) — 다른 탭 갔다 돌아옴
 *   - 네이티브: AppState 'active' — 백그라운드에서 복귀
 * 앱 시작 시 1회 다운로드는 _layout이 토큰 준비 시점에 담당(하이드레이션 타이밍).
 *
 * 다운로드만 한다(업로드는 auto-sync). 비로그인이면 pullRemoteJournal이 알아서 no-op.
 */
import { AppState, Platform } from 'react-native';

import { useAuthStore } from '@/store/auth-store';

/** 포그라운드 복귀 구독 시작. 반환값 = 해제 함수(_layout 언마운트 시 호출). */
export function startForegroundSync(): () => void {
  const pull = () => {
    void useAuthStore.getState().pullRemoteJournal();
  };

  if (Platform.OS === 'web') {
    // 웹: 탭 포커스 복귀 / 숨김→보임 전환
    const onFocus = () => pull();
    const onVisible = () => {
      if (document.visibilityState === 'visible') pull();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }

  // 네이티브: 백그라운드 → 활성 복귀
  const sub = AppState.addEventListener('change', (next) => {
    if (next === 'active') pull();
  });
  return () => sub.remove();
}
