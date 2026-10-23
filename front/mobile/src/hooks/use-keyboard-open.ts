/**
 * 키보드가 열려 있는가. 화면 아래 여백을 "키보드가 닫혔을 때만" 홈 인디케이터만큼 띄우는 데 쓴다 —
 * 열려 있으면 키보드가 그 자리를 덮으므로 인셋까지 더하면 키보드 위에 빈 띠가 생긴다.
 * iOS는 will 이벤트라 키보드가 움직이기 시작할 때 같이 바뀐다(did면 한 박자 늦게 튄다).
 */
import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setOpen(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return open;
}
