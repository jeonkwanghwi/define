/**
 * 지원·약관·방침 문서를 앱 안 브라우저로 여는 도우미.
 * 마이페이지와 가입 화면(약관 동의 문구) 두 곳에서 쓴다 — 주소가 한 곳에만 있어야 어긋나지 않는다.
 */
import * as WebBrowser from 'expo-web-browser';

import type { useTheme } from '@/theme';

type Theme = ReturnType<typeof useTheme>;

/**
 * 지원·방침 문서가 사는 곳. API 주소에서 끌어 쓰지 않고 **브랜드 도메인을 박는다.**
 *
 * 앱 안 브라우저 시트는 상단에 도메인을 보여준다. 거기 'd2kejc3sjm91mt.cloudfront.net'이
 * 뜨면 방침 문서가 미덥지 않아 보인다 — 하필 신뢰를 보여줘야 하는 자리다.
 * 스토어에 적은 지원·방침 URL과도 같은 주소가 된다(같은 CloudFront가 서빙한다).
 *
 * 앱↔서버 통신 주소(API_BASE)는 그대로 둔다 — 카카오 콘솔에 등록된 redirect URI가
 * 그 주소라 바꾸면 카카오 로그인이 깨진다.
 */
export const DOCS_ORIGIN = 'https://defineink.com';

/**
 * 지원·방침 문서를 **앱 안에서** 연다(iOS: SFSafariViewController가 시트로 올라온다).
 *
 * 전에는 Linking.openURL로 Safari를 띄웠다 — 앱 밖으로 튕겨 나가고, 돌아오려면
 * 앱 전환을 해야 했다. 방침을 한 번 확인하려다 쓰던 흐름이 끊긴다.
 *
 * 문서 자체를 앱에 넣지 않는 이유: privacy.html·support.html은 **웹 빌드와 함께
 * 배포돼 앱 업데이트 없이 고칠 수 있다.** 앱 안에 복사해 두면 문구 한 줄 고치는 데
 * 심사를 받아야 하고, 스토어에 적은 URL과 앱 안 내용이 **어긋날 수 있다**
 * (방침이 두 벌 생기는 건 그 자체로 위험하다).
 */
export function openDoc(url: string, theme: Theme) {
  void WebBrowser.openBrowserAsync(url, {
    // 전체 화면이 아니라 시트로 — "잠깐 보고 덮는 것"이라는 뜻이 모양에 있어야 한다.
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    toolbarColor: theme.colors.paper.base,
    controlsColor: theme.colors.point.p600,
    dismissButtonStyle: 'close',
  }).catch(() => {
    // 브라우저를 못 띄우는 건 사실상 없다. 떠도 조용히 넘긴다 — 여기서 막을 일이 아니다.
  });
}
