/**
 * define line icon set — 24×24 viewBox, 1.7px stroke, 라운드 캡.
 *
 * design-source/app/icons.jsx에서 RN으로 포팅. 한 컴포넌트 + name prop으로 모든 아이콘 접근.
 * react-native-svg를 사용해 iOS/Android/Web 모두 동작.
 *
 * 사용:
 *   <Icon name="plaza" />                                  // 24px, 자동 ink.primary 색
 *   <Icon name="feather" size={28} />                      // 크기 변경
 *   <Icon name="ruby" color={theme.colors.ruby.base} />    // 색 명시
 *
 * 새 아이콘 추가:
 *   1) IconName 유니온에 이름 추가
 *   2) renderIcon switch에 case 추가
 *   3) (선택) 그룹 주석으로 의미 표기
 */
import { Circle, Path, Rect, Svg, type SvgProps } from 'react-native-svg';

import { useTheme } from '@/theme';

export type IconName =
  // 탭바 — 5개 메인 탭
  | 'plaza' // 광장 (사람들)
  | 'mood' // 회고/구상중 (sparkle/seed)
  | 'village' // 마을 (좌2 탭, 집)
  | 'feather' // 기록 (만년필) — 중앙 메인 탭
  | 'past' // 과거의 나 (시계 + 화살표)
  | 'book' // 단어장
  // 기록 화면 액션
  | 'calendar'
  | 'shuffle' // 새 단어 뽑기
  | 'plus'
  | 'check'
  // 네비게이션
  | 'chevronR'
  | 'chevronL'
  | 'chevronD'
  | 'back' // chevronL의 의미적 별칭
  | 'close'
  // 상태/액션
  | 'lock' // 광장 비공개
  | 'send'
  | 'settings'
  | 'bell'
  | 'ruby' // 재화
  | 'ink' // 재화 "잉크" (잉크방울) — ruby를 대체하는 표시용
  | 'sun' // 라이트 모드
  | 'moon' // 다크 모드
  | 'user'
  | 'arrowUp'
  | 'edit'
  | 'search'
  | 'sparkle'
  | 'heart'; // 광장 좋아요(추천)

export type IconProps = Omit<SvgProps, 'width' | 'height' | 'viewBox'> & {
  name: IconName;
  /** 한 변 픽셀 크기 (기본 24) */
  size?: number;
  /** 선 색. 미지정 시 useTheme의 ink.primary 자동 사용 */
  color?: string;
  /** 선 굵기 (기본 1.7 — define 아이콘 셋 표준) */
  strokeWidth?: number;
};

export function Icon({ name, size = 24, color, strokeWidth = 1.7, ...rest }: IconProps) {
  const theme = useTheme();
  const resolvedColor = color ?? theme.colors.ink.primary;

  // 모든 path/circle/rect가 공유하는 stroke 속성 — 한 곳에서 일관 관리
  const stroke = {
    fill: 'none',
    stroke: resolvedColor,
    strokeWidth,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  } as const;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...rest}>
      {renderIcon(name, stroke)}
    </Svg>
  );
}

// react-native-svg의 stroke 공통 props 타입을 그대로 사용 (좁힘 위해 위와 동일 shape)
type StrokeProps = {
  fill: string;
  stroke: string;
  strokeWidth: number;
  strokeLinecap: 'round';
  strokeLinejoin: 'round';
};

/**
 * 27개 아이콘 path를 한 곳에 모아 둠.
 * 각 case는 design-source/app/icons.jsx의 항목과 1:1 대응.
 * SVG path 좌표는 모두 24×24 viewBox 기준.
 */
function renderIcon(name: IconName, p: StrokeProps) {
  switch (name) {
    case 'plaza':
      // 광장 — 여러 사람(가운데 + 양옆 작은 둘). "각자의 정의가 오가는 곳".
      return (
        <>
          <Circle cx="12" cy="8.2" r="2.7" {...p} />
          <Path d="M7.8 17.6a4.2 4.2 0 0 1 8.4 0" {...p} />
          <Circle cx="5.2" cy="10.2" r="1.9" {...p} />
          <Path d="M2.4 17.6a3 3 0 0 1 4.1-1.8" {...p} />
          <Circle cx="18.8" cy="10.2" r="1.9" {...p} />
          <Path d="M21.6 17.6a3 3 0 0 0-4.1-1.8" {...p} />
        </>
      );
    case 'mood':
      return (
        <>
          <Path d="M12 4c.6 3 2.4 4.8 5.4 5.4-3 .6-4.8 2.4-5.4 5.4-.6-3-2.4-4.8-5.4-5.4 3-.6 4.8-2.4 5.4-5.4z" {...p} />
          <Circle cx="18" cy="18" r="1.4" {...p} />
        </>
      );
    case 'feather':
      // 만년필 — 대각선 몸통 + 촉 + 캡밴드 + 촉 슬릿.
      return (
        <>
          <Path d="M16.4 4.2 19.8 7.6 10.6 16.8 7.2 13.4Z" {...p} />
          <Path d="M7.2 13.4 10.6 16.8 5 19Z" {...p} />
          <Path d="M14.2 6.4 17.6 9.8" {...p} />
          <Path d="M8.6 14.6 7.4 15.8" {...p} />
        </>
      );
    case 'village':
      return (
        <>
          <Path d="M4 11l8-6 8 6" {...p} />
          <Path d="M6 9.7V20h12V9.7" {...p} />
          <Path d="M10 20v-4.5h4V20" {...p} />
        </>
      );
    case 'past':
      return (
        <>
          <Path d="M3.5 12a8.5 8.5 0 105-7.7" {...p} />
          <Path d="M3.5 4.5v3.2h3.2" {...p} />
          <Path d="M12 8.5V12l2.4 1.4" {...p} />
        </>
      );
    case 'book':
      return (
        <>
          <Path d="M5 4.5h11a2 2 0 012 2V19a1.5 1.5 0 00-1.5-1.5H5z" {...p} />
          <Path d="M5 4.5v14.5a1.5 1.5 0 001.5 1.5H17" {...p} />
          <Path d="M9 9h6M9 12h4" {...p} />
        </>
      );
    case 'calendar':
      return (
        <>
          <Rect x="4" y="5" width="16" height="15" rx="2.5" {...p} />
          <Path d="M4 9.5h16M8 3.5v3M16 3.5v3" {...p} />
        </>
      );
    case 'shuffle':
      return (
        <Path d="M4 7h3.2c1.2 0 2.3.6 3 1.6l3.6 5.8c.7 1 1.8 1.6 3 1.6H20M16.5 4.5L20 7l-3.5 2.5M4 17h3.2c1.2 0 2.3-.6 3-1.6M20 17l-3.5 2.5M16.5 14.5L20 17" {...p} />
      );
    case 'plus':
      return <Path d="M12 5v14M5 12h14" {...p} />;
    case 'check':
      return <Path d="M5 12.5l4.5 4.5L19 7" {...p} />;
    case 'chevronR':
      return <Path d="M9 5l7 7-7 7" {...p} />;
    case 'chevronL':
    case 'back':
      return <Path d="M15 5l-7 7 7 7" {...p} />;
    case 'chevronD':
      return <Path d="M5 9l7 7 7-7" {...p} />;
    case 'close':
      return <Path d="M6 6l12 12M18 6L6 18" {...p} />;
    case 'lock':
      return (
        <>
          <Rect x="5" y="11" width="14" height="9" rx="2.5" {...p} />
          <Path d="M8 11V8a4 4 0 018 0v3" {...p} />
        </>
      );
    case 'send':
      return <Path d="M5 12l15-7-7 15-2.5-5.5L5 12z" {...p} />;
    case 'settings':
      return (
        <>
          <Circle cx="12" cy="12" r="3" {...p} />
          <Path d="M12 3v2.5M12 18.5V21M21 12h-2.5M5.5 12H3M18 6l-1.8 1.8M7.8 16.2 6 18M18 18l-1.8-1.8M7.8 7.8 6 6" {...p} />
        </>
      );
    case 'bell':
      return (
        <>
          <Path d="M6.5 10a5.5 5.5 0 0111 0c0 4 1.5 5.5 1.5 5.5H5s1.5-1.5 1.5-5.5z" {...p} />
          <Path d="M10 18.5a2 2 0 004 0" {...p} />
        </>
      );
    case 'ruby':
      return (
        <>
          <Path d="M7 4h10l3.5 5L12 20.5 3.5 9z" {...p} />
          <Path d="M3.5 9h17M9 4l-2 5 5 11.5M15 4l2 5-5 11.5" {...p} />
        </>
      );
    case 'ink':
      return (
        <>
          <Path d="M12 3.5c3 3.9 5.5 7 5.5 10a5.5 5.5 0 11-11 0c0-3 2.5-6.1 5.5-10z" {...p} />
          <Path d="M9.5 14a2.5 2.5 0 002.5 2.5" {...p} />
        </>
      );
    case 'sun':
      return (
        <>
          <Circle cx="12" cy="12" r="4" {...p} />
          <Path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4 4.2 19.8M19.8 4.2l-1.4 1.4" {...p} />
        </>
      );
    case 'moon':
      return <Path d="M20 14.5A8 8 0 119.5 4a6.5 6.5 0 0010.5 10.5z" {...p} />;
    case 'user':
      return (
        <>
          <Circle cx="12" cy="8" r="3.5" {...p} />
          <Path d="M5.5 20a6.5 6.5 0 0113 0" {...p} />
        </>
      );
    case 'arrowUp':
      return <Path d="M12 19V5M6 11l6-6 6 6" {...p} />;
    case 'edit':
      return (
        <>
          <Path d="M4 20h4L18.5 9.5a2 2 0 00-3-3L5 17v3z" {...p} />
          <Path d="M14 7l3 3" {...p} />
        </>
      );
    case 'search':
      return (
        <>
          <Circle cx="11" cy="11" r="6.5" {...p} />
          <Path d="M16 16l4 4" {...p} />
        </>
      );
    case 'heart':
      return (
        <Path d="M12 20s-6.6-4.2-9-8.3C1.4 8.9 3 5.5 6.2 5.5c1.9 0 3.1 1.1 3.8 2.2.7-1.1 1.9-2.2 3.8-2.2 3.2 0 4.8 3.4 3.2 6.2-2.4 4.1-9 8.3-9 8.3z" {...p} />
      );
    case 'sparkle':
      return <Path d="M12 4l1.8 5.2L19 11l-5.2 1.8L12 18l-1.8-5.2L5 11l5.2-1.8z" {...p} />;
  }
}
