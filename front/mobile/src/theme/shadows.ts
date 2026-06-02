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
  sm: {
    shadowColor: '#211E1A',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: '#211E1A',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 16,
    elevation: 3,
  },
  lg: {
    shadowColor: '#211E1A',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 18 },
    shadowRadius: 48,
    elevation: 6,
  },
  point: {
    shadowColor: '#2E3192',
    shadowOpacity: 0.28,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 30,
    elevation: 4,
  },
};

// 다크는 검정 베이스 + 더 진한 opacity
export const darkShadows: Shadows = {
  sm: {
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 18,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000000',
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 20 },
    shadowRadius: 50,
    elevation: 6,
  },
  point: {
    shadowColor: '#2E3192',
    shadowOpacity: 0.45,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 30,
    elevation: 4,
  },
};
