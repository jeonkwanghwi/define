/**
 * 폰트 패밀리 — **역할로 나눠 쓴다.**
 *
 *   serif(나눔명조) = 읽는 글. 제목과 본문.
 *     define은 사전이고 기록이다. 명조의 획 끝 돌기가 그 정체성과 붙고,
 *     산세리프만 쓰던 화면의 "밋밋함"이 여기서 풀린다.
 *   sans(Pretendard) = 조작하는 글. 14px 이하 라벨·캡션·숫자.
 *     명조는 그 크기에서 획이 뭉개져 읽기 힘들다. 크기가 아니라 **역할**로 가른 이유다.
 *
 * 한글 폰트는 두께 하나당 ~3MB다. 그래서 명조는 **400/700 두 개만** 싣는다
 * (800 ExtraBold는 뺐다 — 52px Bold로도 충분히 강하다).
 * 정적 폰트라 fontWeight로 두께를 고르지 못한다 → 두께마다 패밀리 이름이 다르다.
 *
 * 실제 로드는 _layout.tsx의 useFonts가 앱 시작 시 1회.
 */
export const fontFamily = {
  sans: 'PretendardVariable',
  serif: 'NanumMyeongjo_400Regular',
  serifBold: 'NanumMyeongjo_700Bold',
} as const;
