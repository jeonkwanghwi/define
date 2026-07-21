/**
 * 단어장 탭의 자체 Stack — 리스트(/journal) ↔ 단어 상세(/journal/[word]) 사이의 push 전환.
 *
 * 부모(탭) 레이아웃은 BottomTabNavigator이므로,
 * 이 폴더 안에서 별도 Stack을 두지 않으면 동적 라우트로의 push가 동작하지 않음.
 * headerShown: false — 화면이 자체 헤더(back 버튼 + 단어)를 그리기 때문.
 */
import { Stack } from 'expo-router';

// 딥링크·타 탭에서 상세(/journal/[word])로 바로 진입해도 리스트를 스택 아래에 깔아,
// 뒤로가기가 탭 내비게이터로 새지 않게(첫 탭=광장으로 튀던 버그) 한다.
export const unstable_settings = { initialRouteName: 'index' };

export default function JournalStackLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />;
}
