/**
 * 마을 — 아바타 마을 목업 프로토타입 (백엔드 0, 감/톤 검증용).
 *
 * 탭바에 없는 dev 라우트. 접근: expo-router로 `/village`
 *   - 웹: expo start 후 http://localhost:8081/village
 *   - 코드: router.push('/village')
 *
 * 이 화면이 "월드 상태 + 게임 로직"을 소유한다 (렌더러는 village-board가 담당):
 *   - 빈 땅 탭 → 그 지점으로 천천히 걸어감 (느린 산책 = 브랜드 톤)
 *   - 집 탭 → 그 집 앞까지 걸어간 뒤 도착하면 정의 시트 오픈
 *
 * 걷기는 RN 기본 Animated(보간)로 구현 — 앱의 기존 트랜지션 패턴과 동일, 새 의존성 0.
 * 나중에 3D로 가도 이 로직(위치·도착 콜백·시트)은 그대로 살고, 그리는 층만 교체된다.
 */
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { NeighborSheet } from '@/components/village/neighbor-sheet';
import { VillageBoard } from '@/components/village/village-board';
import { AVATAR_START, NEIGHBORS, type Neighbor } from '@/data/village-mock';
import { Icon } from '@/icons';
import { useTheme } from '@/theme';

// 집 "현관" = 집 중심에서 살짝 아래 (아바타가 문 앞에 서도록).
const DOOR_OFFSET = 52;

export default function VillageScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [active, setActive] = useState<Neighbor | null>(null);

  // 아바타 픽셀 위치 — Animated 값(렌더러에 넘겨 그림). 현재 좌표는 posRef로 추적.
  const avatarPos = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const posRef = useRef({ x: 0, y: 0 });
  const initialized = useRef(false);
  const walking = useRef<Animated.CompositeAnimation | null>(null);

  // Animated 값이 바뀔 때마다 현재 좌표를 평범한 객체로 미러링 (거리 계산용).
  useEffect(() => {
    const id = avatarPos.addListener((v) => {
      posRef.current = v;
    });
    return () => avatarPos.removeListener(id);
  }, [avatarPos]);

  // 보드 크기를 처음 알게 된 순간 아바타를 시작 위치에 놓는다.
  function handleMeasure(s: { w: number; h: number }) {
    setSize(s);
    if (!initialized.current) {
      const start = { x: AVATAR_START.x * s.w, y: AVATAR_START.y * s.h };
      avatarPos.setValue(start);
      posRef.current = start;
      initialized.current = true;
    }
  }

  // 목표 지점으로 걸어가기. 거리에 비례한 시간 → 일정한 "걷는 속도" 느낌.
  function walkTo(x: number, y: number, onArrive?: () => void) {
    walking.current?.stop(); // 이동 중 새 명령이 오면 기존 걷기 취소
    const dx = x - posRef.current.x;
    const dy = y - posRef.current.y;
    const dist = Math.hypot(dx, dy);
    const duration = Math.min(1400, Math.max(320, dist * 6)); // px당 6ms, 320~1400ms로 클램프
    const anim = Animated.timing(avatarPos, {
      toValue: { x, y },
      duration,
      useNativeDriver: false, // left/top 계열 변환이라 JS 드라이버
    });
    walking.current = anim;
    anim.start(({ finished }) => {
      if (finished && onArrive) onArrive();
    });
  }

  function handleTapGround(x: number, y: number) {
    walkTo(x, y);
  }

  function handleTapHouse(n: Neighbor) {
    if (!size) return;
    const door = { x: n.x * size.w, y: n.y * size.h + DOOR_OFFSET };
    walkTo(door.x, door.y, () => setActive(n));
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.paper.base }]}>
      {/* 헤더 */}
      <View style={styles.head}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.iconBtn}>
          <Icon name="back" size={22} color={theme.colors.ink.strong} />
        </Pressable>
        <ThemedText variant="h3" style={{ flex: 1, textAlign: 'center' }}>
          마을 <ThemedText variant="caption" tone="placeholder">(목업)</ThemedText>
        </ThemedText>
        <View style={styles.iconBtn} />
      </View>

      <ThemedText variant="caption" tone="secondary" style={styles.hint}>
        빈 곳을 누르면 걸어가고, 집을 누르면 그 사람에게 찾아가 정의를 봅니다.
      </ThemedText>

      <View style={styles.boardWrap}>
        <VillageBoard
          neighbors={NEIGHBORS}
          avatarPos={avatarPos}
          size={size}
          onMeasure={handleMeasure}
          onTapGround={handleTapGround}
          onTapHouse={handleTapHouse}
        />
      </View>

      <NeighborSheet neighbor={active} onClose={() => setActive(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 4,
  },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  hint: { textAlign: 'center', paddingHorizontal: 32, marginBottom: 12 },
  boardWrap: { flex: 1, paddingHorizontal: 20, paddingBottom: 24 },
});
