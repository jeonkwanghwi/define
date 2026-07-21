/**
 * 탭 그룹 레이아웃 — 하단 5탭 + 공통 옵션.
 *
 * Expo Router의 file-based routing: 같은 폴더 안의 .tsx가 각 탭 화면.
 *   - index.tsx  → 기록 (중앙, 메인)
 *   - plaza.tsx  → 광장
 *   - village.tsx → 마을 (아바타 마을 = 광장 컨셉2, "사람 → 단어")
 *   - past.tsx   → 과거의 나
 *   - journal.tsx → 단어장
 *
 * Expo Router 5.x의 `(tabs)`처럼 괄호로 묶인 폴더는 URL에는 안 들어가는 그룹.
 * 따라서 라우트 경로는 /, /plaza, /village, /past, /journal.
 *
 * 좌→우 순서 (배열 첫 항목이 왼쪽): plaza · village · index(기록) · past · journal.
 * 중앙 강조(칩 형태)는 Task #6 이후 별도 단계에서 추가 예정. 지금은 표준 탭바.
 */
import { Tabs } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';

import { Icon, type IconName } from '@/icons';
import { useTheme } from '@/theme';

// 한 곳에서 탭 설정 관리. 5개 탭 모두 동일 규칙 — 선택 시 진한 알약, 비선택 시 아이콘만.
const TAB_ORDER: { name: string; label: string; icon: IconName }[] = [
  { name: 'plaza', label: '광장', icon: 'plaza' },
  { name: 'village', label: '마을', icon: 'village' },
  { name: 'index', label: '기록', icon: 'feather' },
  { name: 'past', label: '회상', icon: 'past' },
  { name: 'journal', label: '단어장', icon: 'book' },
];

export default function TabsLayout() {
  const theme = useTheme();

  return (
    <Tabs
      // GO_BACK이 탭까지 버블되면(예: 타 탭에서 단어 상세로 바로 push 후 뒤로)
      // 기본 backBehavior('firstRoute')는 첫 탭=광장(비로그인 잠금 화면)으로 보낸다
      // → "뒤로 눌렀더니 가입 유도가 뜨는" 오동작. 초기 탭(기록)으로 지정.
      initialRouteName="index"
      backBehavior="initialRoute"
      screenOptions={{
        headerShown: false,
        // 좌우 슬라이드(책장 넘김 느낌). 헤더가 화면 안에 있어 같이 넘어가지만,
        // 모든 탭에서 동일해 "러닝 헤더"처럼 자연스럽다. (완전 고정하려면 상세에 바 2줄)
        animation: 'shift',
        tabBarActiveTintColor: theme.colors.point.p600,
        tabBarInactiveTintColor: theme.colors.ink.placeholder,
        // 라벨은 항상 아이콘 아래로. (넓은 뷰포트/웹에선 기본이 beside-icon이 되어
        //  중앙 기록 chip과 "기록" 라벨이 옆으로 겹친다 → below-icon으로 고정.)
        tabBarLabelPosition: 'below-icon',
        tabBarStyle: {
          backgroundColor: theme.colors.surface.base,
          borderTopColor: theme.colors.line.base,
          borderTopWidth: 1,
          height: 76,
          paddingTop: 8,
          paddingBottom: 14,
        },
        tabBarLabelStyle: {
          fontFamily: 'PretendardVariable',
          fontSize: 11,
          fontWeight: '500',
          marginTop: 4,
        },
      }}
    >
      {TAB_ORDER.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.label,
            // 중앙 탭은 chip 컨테이너로 강조. 나머지는 평범한 아이콘.
            // color/size는 React Navigation이 자동 주입(active/inactive 색 분기).
            // color는 ColorValue(string | OpaqueColorValue)지만 실제로는 항상 string이라 캐스트.
            tabBarIcon: ({ focused }) => <TabIcon name={tab.icon} focused={focused} />,
          }}
        />
      ))}
    </Tabs>
  );
}

/**
 * TabIcon — 비중앙 탭 아이콘 + 활성 시 옅은 알약(p100) 배경.
 * 색만 바뀌던 활성 표시를 중앙 칩과 같은 "칩" 언어로 또렷하게.
 * 배경만 페이드(아이콘은 불투명 유지), footprint는 활성/비활성 동일해 탭이 안 흔들림.
 */
/** #RRGGBB → rgba 문자열. 알약 배경을 투명→불투명으로 부드럽게 보간할 때 사용. */
function withAlpha(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * TabIcon — 5개 탭 공통. 선택 시 진한 p600 알약 + 흰 아이콘, 비선택 시 배경 없이 회색 아이콘만.
 * 배경(투명→p600)과 아이콘 크로스페이드(회색↔흰색)를 t 하나로 동기화해 깜빡임이 없다.
 * 알약 배경은 컨테이너에 직접 칠해 항상 아이콘 뒤(웹의 absolute 오버셋 문제 회피).
 */
function TabIcon({ name, focused }: { name: IconName; focused: boolean }) {
  const theme = useTheme();
  const t = useRef(new Animated.Value(focused ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(t, { toValue: focused ? 1 : 0, duration: 180, useNativeDriver: false }).start();
  }, [focused, t]);

  const backgroundColor = t.interpolate({
    inputRange: [0, 1],
    outputRange: [withAlpha(theme.colors.point.p600, 0), withAlpha(theme.colors.point.p600, 1)],
  });
  const grayOpacity = t.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  return (
    <Animated.View style={[styles.tabPill, { backgroundColor }]}>
      {/* 비선택 회색 아이콘 — 아래 레이어 */}
      <Animated.View style={{ opacity: grayOpacity }}>
        <Icon name={name} size={22} color={theme.colors.ink.placeholder} />
      </Animated.View>
      {/* 선택 흰색 아이콘 — 위에 겹쳐 배경과 함께 페이드인 */}
      <Animated.View style={[styles.iconLayer, { opacity: t }]}>
        <Icon name={name} size={22} color="#FFFFFF" />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tabPill: {
    width: 46,
    height: 30,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  iconLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
