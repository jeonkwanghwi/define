/**
 * 광장 탭의 자체 Stack — 리스트(/plaza) ↔ 단어 상세(/plaza/[word]) push 전환.
 * journal 탭과 동일 패턴. 화면이 자체 헤더를 그리므로 headerShown:false.
 */
import { Stack } from 'expo-router';

export default function PlazaStackLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
