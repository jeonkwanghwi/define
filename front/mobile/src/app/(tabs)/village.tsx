/**
 * 마을 (Village) — 좌2 탭. 아바타 마을 = 광장 컨셉2("사람 → 단어").
 *
 * 이웃(=다른 사용자)의 집을 거닐며 그 사람의 정의를 들여다보는 공간.
 * 가입 필요 탭 — 로그아웃 시 AuthGate가 가입 유도 화면을 보여준다.
 *
 * 이 파일이 "상태 주인"이다: 지금 어느 맵인지, 아바타가 어디 있는지, 어느 집에 누가 사는지.
 * 이동은 **조이스틱으로 직접** 한다(탭해서 자동으로 가는 방식은 걷어냈다).
 * 그리기는 VillageScene, 걸을 수 있는 곳 판정은 village-grid/village-path, 맵 데이터는 village-zones.
 * (설계: docs/superpowers/specs/2026-09-20-village-v1-design.md)
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/domain/app-header';
import { AuthGate } from '@/components/domain/auth-gate';
import { FadeIn, PressableScale } from '@/components/primitives';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { NeighborSheet, type SheetNeighbor } from '@/components/village/neighbor-sheet';
import { VillageJoystick } from '@/components/village/village-joystick';
import { VillageScene } from '@/components/village/village-scene';
import { WALK_GRIDS } from '@/data/village-grid';
import { entryPoint, ZONES, ZONE_ORDER, type Point, type ZoneId } from '@/data/village-zones';
import { Icon } from '@/icons';
import { isWalkable, snapToPath } from '@/lib/village-path';
import { getNeighbors, type VillageNeighbor } from '@/services/village-api';
import { useAuthStore } from '@/store/auth-store';
import { motion, useTheme } from '@/theme';

const TOTAL_SLOTS = ZONE_ORDER.reduce((n, id) => n + ZONES[id].slots.length, 0);

/** 걷는 속도(가로 기준 화면비율/초). 세로는 그림이 길쭉해서 칸 비율로 보정한다. */
const SPEED_X = 0.2;
/** 집 문 앞 이만큼 안에 들어오면 "들어가기"가 뜬다. */
const DOOR_RADIUS = 0.05;
/** 전환 지점에 이만큼 닿으면 옆 마을로 넘어간다. */
const EXIT_RADIUS = 0.035;
/** 조이스틱을 이만큼은 기울여야 걷는다(손 떨림으로 스멀스멀 움직이지 않게). */
const DEAD_ZONE = 0.08;

export default function VillageScreen() {
  return (
    <AuthGate
      icon="village"
      title="마을"
      description="이웃들의 마을을 거닐며 다른 사람의 정의를 만나는 공간이에요. 가입해두면 가장 먼저 만나요."
    >
      <VillageMap />
    </AuthGate>
  );
}

function VillageMap() {
  const theme = useTheme();
  const token = useAuthStore((s) => s.token);

  const [zoneId, setZoneId] = useState<ZoneId>('center');
  const zone = ZONES[zoneId];
  const grid = WALK_GRIDS[zoneId];

  const [bySlot, setBySlot] = useState<Record<string, VillageNeighbor>>({});
  const [sheet, setSheet] = useState<SheetNeighbor | null>(null);
  const [nearSlot, setNearSlot] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [switching, setSwitching] = useState(false);

  // 아바타 위치: 계산은 ref(매 프레임), 그리기는 Animated — 프레임마다 리렌더하지 않기 위해.
  const posRef = useRef<Point>(snapToPath(WALK_GRIDS.center, ZONES.center.spawn) ?? ZONES.center.spawn);
  const pos = useRef(new Animated.ValueXY(posRef.current)).current;
  const facing = useRef(new Animated.Value(1)).current;
  const dir = useRef({ x: 0, y: 0 });
  const fade = useRef(new Animated.Value(1)).current;
  const switchingRef = useRef(false);

  const load = useCallback(() => {
    if (!token) return;
    getNeighbors(token, TOTAL_SLOTS)
      .then((list) => setBySlot(assign(list)))
      .catch(() => {
        /* 비치명적 — 이웃을 못 받아도 마을은 걸어다닐 수 있어야 한다. */
      });
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  /** 맵 교체는 페이드아웃 → 갈아끼우기 → 페이드인. 중간에 보이면 화면이 툭 끊긴다. */
  const switchZone = useCallback(
    (to: ZoneId) => {
      if (switchingRef.current) return;
      switchingRef.current = true;
      setSwitching(true);
      dir.current = { x: 0, y: 0 };
      const step = (toValue: number) =>
        Animated.timing(fade, {
          toValue,
          duration: motion.duration.base,
          easing: motion.easing.standard,
          useNativeDriver: true,
        });
      step(0).start(() => {
        // 들어온 문 자리에 세운다. 데이터가 반 칸 어긋나도 갇히지 않게 길 위로 붙인다.
        const entry = entryPoint(zoneId, to);
        const landing = snapToPath(WALK_GRIDS[to], entry) ?? entry;
        posRef.current = landing;
        pos.setValue(landing);
        setNearSlot(null);
        setZoneId(to);
        step(1).start(() => {
          switchingRef.current = false;
          setSwitching(false);
        });
      });
    },
    [fade, pos, zoneId],
  );

  /**
   * 이동 루프 — 조이스틱 방향으로 조금씩 나아가되, 다음 자리가 길 밖이면 막는다.
   * x·y를 따로 판정해서 **벽에 비스듬히 부딪히면 벽을 따라 미끄러진다**
   * (한 번에 판정하면 모서리에서 딱 멈춰 답답하다).
   */
  useEffect(() => {
    if (switching) return;
    // 세로는 그림이 길쭉해서 같은 비율이라도 실제 거리가 더 길다 → 칸 수로 보정.
    const aspect = grid.cols / grid.rows;
    const speedY = SPEED_X * aspect;
    let raf = 0;
    let last = Date.now();

    const tick = () => {
      const now = Date.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const d = dir.current;
      const len = Math.hypot(d.x, d.y);
      const walking = len > DEAD_ZONE;

      if (walking) {
        const p = posRef.current;
        let { x, y } = p;
        const nx = x + d.x * SPEED_X * dt;
        const ny = y + d.y * speedY * dt;
        if (isWalkable(grid, { x: nx, y })) x = nx;
        if (isWalkable(grid, { x, y: ny })) y = ny;
        if (x !== p.x || y !== p.y) {
          posRef.current = { x, y };
          pos.setValue({ x, y });
          if (Math.abs(d.x) > 0.15) facing.setValue(d.x < 0 ? -1 : 1);
        }

        // 거리 비교는 세로를 가로 기준으로 환산해서 — 안 그러면 위아래로만 판정이 후해진다.
        const dist = (a: Point) => Math.hypot(a.x - x, (a.y - y) * aspect);
        const near = zone.slots.find((s) => dist(s.door) <= DOOR_RADIUS);
        setNearSlot((prev) => (prev === (near?.id ?? null) ? prev : (near?.id ?? null)));
        const exit = zone.exits.find((e) => dist(e.at) <= EXIT_RADIUS);
        if (exit) switchZone(exit.to);
      }

      setMoving((prev) => (prev === walking ? prev : walking));
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [grid, zone, pos, facing, switchZone, switching]);

  function enterHouse() {
    if (!nearSlot) return;
    const neighbor = bySlot[nearSlot];
    if (neighbor) setSheet({ nickname: neighbor.nickname, words: neighbor.words });
  }

  const nearNeighbor = nearSlot ? bySlot[nearSlot] : undefined;

  return (
    <ThemedView bg="paper" style={styles.root}>
      <View style={styles.headerWrap}>
        <AppHeader />
        <View style={styles.bar}>
          <ThemedText variant="bodyMd" tone="strong">
            {zone.title}
          </ThemedText>
          <PressableScale
            onPress={load}
            hitSlop={10}
            style={styles.refresh}
            accessibilityRole="button"
            accessibilityLabel="이웃 새로고침"
          >
            <Icon name="shuffle" size={17} color={theme.colors.ink.secondary} />
            <ThemedText variant="caption" tone="secondary">
              새로고침
            </ThemedText>
          </PressableScale>
        </View>
      </View>

      <Animated.View style={[styles.board, { opacity: fade }]}>
        <VillageScene zone={zone} pos={pos} facing={facing} moving={moving} />

        {/* 문 앞에 서면 들어가기 — 지나가기만 할 수도 있어야 해서 자동으로 열지 않는다. */}
        {nearNeighbor ? (
          <View pointerEvents="box-none" style={styles.enterWrap}>
            <FadeIn>
              <PressableScale
                onPress={enterHouse}
                style={[
                  styles.enter,
                  {
                    backgroundColor: theme.colors.surface.base,
                    borderColor: theme.colors.line.base,
                    borderRadius: theme.radii.pill,
                  },
                  theme.shadows.sm,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${nearNeighbor.nickname}의 집 들어가기`}
              >
                <Icon name="village" size={16} color={theme.colors.point.p500} />
                <ThemedText variant="bodyMd" tone="strong">
                  {nearNeighbor.nickname}의 집
                </ThemedText>
                <ThemedText variant="caption" tone="secondary">
                  들어가기
                </ThemedText>
              </PressableScale>
            </FadeIn>
          </View>
        ) : null}

        {/* 하단 탭바 위로 띄운다 — 엄지가 탭바를 건드리지 않게. */}
        <View style={styles.stickWrap} pointerEvents="box-none">
          <VillageJoystick
            onChange={(d) => {
              dir.current = d;
            }}
          />
        </View>
      </Animated.View>

      <NeighborSheet neighbor={sheet} onClose={() => setSheet(null)} />
    </ThemedView>
  );
}

/** 받은 순서대로 맵 순서(center→east→south→west→north)의 슬롯에 꽂는다. */
function assign(list: VillageNeighbor[]): Record<string, VillageNeighbor> {
  const out: Record<string, VillageNeighbor> = {};
  let i = 0;
  for (const id of ZONE_ORDER) {
    for (const slot of ZONES[id].slots) {
      const neighbor = list[i];
      i += 1;
      if (neighbor) out[slot.id] = neighbor;
    }
  }
  return out;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerWrap: { paddingHorizontal: 24, paddingTop: 24 },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12 },
  refresh: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  board: { flex: 1 },
  enterWrap: { position: 'absolute', left: 0, right: 0, bottom: 156, alignItems: 'center' },
  enter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  stickWrap: { position: 'absolute', left: 18, bottom: 18 },
});
