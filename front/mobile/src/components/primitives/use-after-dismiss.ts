/**
 * useAfterDismiss — Modal이 **완전히 사라진 뒤에** 다음 동작을 실행한다.
 *
 * 왜: iOS는 한 Modal이 닫히는 애니메이션 중에 다른 Modal을 띄우라고 하면(present) 조용히 무시한다.
 *   예전엔 setTimeout(…, 200)으로 "대충 다 닫혔겠지" 기다렸는데, 기기가 느리면 아직 닫히는 중이라
 *   두 번째 창(삭제 확인·신고 시트 등)이 안 뜨는 일이 있었다.
 * 어떻게: RN Modal의 onDismiss(iOS 전용 — 정말 다 닫혔을 때 불린다)에서 실행한다.
 *   onDismiss가 없는 안드로이드/웹은 타이머로 대신한다. iOS도 혹시 onDismiss를 못 받는 경우
 *   (부모가 Modal을 통째로 언마운트 등)에 대비해 넉넉한 타이머를 같이 걸고, 먼저 오는 쪽 한 번만 실행.
 *
 * 사용:
 *   const after = useAfterDismiss();
 *   <Modal onDismiss={after.onDismiss} …>
 *   onPress={() => { after.schedule(next); onClose(); }}
 */
import { useRef } from 'react';
import { Platform } from 'react-native';

import { motion } from '@/theme';

export function useAfterDismiss() {
  const pending = useRef<(() => void) | null>(null);

  function run() {
    const fn = pending.current;
    pending.current = null; // 한 번만 — onDismiss와 타이머 중 늦게 온 쪽은 아무것도 안 한다
    fn?.();
  }

  function schedule(fn: () => void) {
    pending.current = fn;
    // 안드로이드/웹: 닫힘(fade) 시간만큼. iOS: onDismiss가 정상 경로, 이건 안전망이라 넉넉히.
    setTimeout(run, Platform.OS === 'ios' ? 800 : motion.duration.base);
  }

  return { schedule, onDismiss: run };
}
