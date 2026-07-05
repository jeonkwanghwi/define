/**
 * +html.tsx — 웹 빌드 전용 루트 HTML 커스터마이즈. (네이티브 앱에는 영향 없음)
 *
 * 왜 있나: 모바일 브라우저에서 "꾹 누르기"는 기본이 텍스트 선택(드래그 선택 + 돋보기)이라,
 * 길게 눌러 수정/삭제 같은 onLongPress UI와 충돌한다(시트가 뜨면서 텍스트가 파랗게 선택됨).
 * 네이티브 RN처럼 텍스트를 기본 비선택으로 만들어 앱과 동일한 감각을 맞춘다.
 * 입력 필드(input/textarea)는 선택·커서 동작을 유지.
 */
import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

const appLikeCss = `
body {
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
}
input, textarea {
  -webkit-user-select: text;
  user-select: text;
}
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="ko">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        {/* expo-router 기본: ScrollView가 body 스크롤 대신 자체 스크롤 쓰도록 리셋 */}
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: appLikeCss }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
