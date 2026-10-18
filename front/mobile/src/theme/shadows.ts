/**
 * define 디자인 토큰 — 섀도우.
 *
 * RN의 섀도우는 플랫폼마다 표현이 달라 두 속성을 같이 정의:
 *   - iOS:     shadowColor / shadowOffset / shadowOpacity / shadowRadius
 *   - Android: elevation (위 속성은 무시되고 elevation만 적용)
 *   - Web:     RN-web이 위 속성을 CSS box-shadow로 변환
 *
 * 라이트/다크는 그림자의 강도가 달라 두 페어로 분리.
 *
 * 사용: <View style={[styles.card, theme.shadows.md]} />
 */
import type { ViewStyle } from 'react-native';

// 섀도우 shape — 라이트/다크 페어가 같은 키를 가지도록 강제
export type Shadows = {
  sm: ViewStyle;
  md: ViewStyle;
  lg: ViewStyle;
  point: ViewStyle; // 포인트 색 글로우 — 강조 액션(예: 메인 기록 버튼)
};

export const lightShadows: Shadows = {
  /**
   * 카드·칩이 거의 다 이 값을 쓴다. 전에는 0.04/y1/r3이라 **있으나 마나였다.**
   *
   * 카드 배경(#FFFEFB)과 페이지(#FCFAF6)의 대비가 1.03:1 — 색으로는 구분되지 않는다.
   * 보더도 1.22:1이라 거들지 못한다. 셋 다 한계선에 걸쳐 셋을 합쳐야 겨우 보였다.
   * **종이가 종이 위에 놓이면 생기는 건 색 차이가 아니라 그림자다** — 색은 하나도
   * 건드리지 않고 그림자만 제값을 하게 뒀다.
   */
  sm: {
    shadowColor: '#211E1A',
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 18,
    elevation: 3,
  },
  // sm이 올라간 만큼 같이 올린다 — 사다리(sm < md < lg)가 뒤집히면 토큰이 거짓말을 한다.
  md: {
    shadowColor: '#211E1A',
    shadowOpacity: 0.085,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 28,
    elevation: 4,
  },
  lg: {
    shadowColor: '#211E1A',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 18 },
    shadowRadius: 48,
    elevation: 6,
  },
  point: {
    shadowColor: '#000000', // 자리표시 — useTheme()가 고른 팔레트의 p600으로 덮어쓴다(index.ts)
    shadowOpacity: 0.28,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 30,
    elevation: 4,
  },
};

// 다크는 검정 베이스 + 더 진한 opacity
export const darkShadows: Shadows = {
  // 라이트와 같은 이유로 올렸다. 다크는 배경이 이미 어두워 radius를 더 벌려야 보인다.
  sm: {
    shadowColor: '#000000',
    shadowOpacity: 0.34,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 18,
    elevation: 3,
  },
  md: {
    shadowColor: '#000000',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 28,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000000',
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 20 },
    shadowRadius: 50,
    elevation: 6,
  },
  point: {
    shadowColor: '#000000', // 다크: 포인트색 글로우는 밝은 버튼 밑에서 푸른 안개처럼 번졌다
    shadowOpacity: 0.45,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 30,
    elevation: 4,
  },
};
