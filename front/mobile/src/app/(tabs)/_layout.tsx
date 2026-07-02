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

import { RecordTabChip } from '@/components/domain/record-tab-chip';
import { Icon, type IconName } from '@/icons';
import { useTheme } from '@/theme';

// 한 곳에서 탭 설정 관리.
// center=true인 탭은 평이한 아이콘 대신 chip 강조 (현재는 record 한 개).
const TAB_ORDER: { name: string; label: string; icon: IconName; center?: boolean }[] = [
  { name: 'plaza', label: '광장', icon: 'plaza' },
  { name: 'village', label: '마을', icon: 'village' },
  { name: 'index', label: '기록', icon: 'feather', center: true },
  { name: 'past', label: '과거의 나', icon: 'past' },
  { name: 'journal', label: '단어장', icon: 'book' },
];

export default function TabsLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
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
            tabBarIcon: tab.center
              ? ({ focused }) => <RecordTabChip focused={focused} />
              : ({ color, size }) => (
                  <Icon name={tab.icon} size={size} color={color as string} />
                ),
          }}
        />
      ))}
    </Tabs>
  );
}
