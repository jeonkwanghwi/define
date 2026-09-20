/**
 * 마을 (Village) — 좌2 탭. 아바타 마을 = 광장 컨셉2("사람 → 단어").
 *
 * 이웃(=다른 사용자)의 집을 거닐며 그 사람의 정의를 들여다보는 공간.
 * 가입 필요 탭 — 로그아웃 시 AuthGate가 가입 유도 화면을 보여준다.
 *
 * 이 파일이 "상태 주인"이다: 지금 어느 맵인지, 아바타가 어디 서 있는지, 어디로 걷는 중인지,
 * 어느 집에 누가 사는지. 그리기는 VillageScene, 길 찾기는 village-path, 맵 데이터는 village-zones.
 * (설계: docs/superpowers/specs/2026-09-20-village-v1-design.md)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/domain/app-header';
import { AuthGate } from '@/components/domain/auth-gate';
import { FadeIn, PressableScale } from '@/components/primitives';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { NeighborSheet, type SheetNeighbor } from '@/components/village/neighbor-sheet';
import { VillageScene, zoneAspect } from '@/components/village/village-scene';
import { entryPoint, ZONES, type Point, type Zone, type ZoneId } from '@/data/village-zones';
import { WALK_GRIDS } from '@/data/village-grid';
import { Icon } from '@/icons';
import { findWalkRoute, snapToPath } from '@/lib/village-path';
import { getNeighbors, type VillageNeighbor } from '@/services/village-api';
import { useAuthStore } from '@/store/auth-store';
import { motion, useTheme } from '@/theme';

/** 이웃을 꽂는 순서 — 받은 목록을 이 순서의 슬롯에 차례로 배정한다. */
const ZONE_ORDER: ZoneId[] = ['center', 'east', 'south', 'west', 'north'];
const TOTAL_SLOTS = ZONE_ORDER.reduce((n, id) => n + ZONES[id].slots.length, 0);

/** 이만큼 안으로 도착하면 전환 지점에 닿은 것으로 본다(탭 지점이 길 위로 끌려와 노드와 미세하게 어긋난다). */
const EXIT_RADIUS = 0.05;

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

/** 걷기가 끝난 뒤에 할 일 — 도착해서야 집에 들어가거나 옆 맵으로 넘어간다. */
type Arrival =
  | { kind: 'slot'; slotId: string }
  | { kind: 'exit'; to: ZoneId }
  | null;

function VillageMap() {
  const theme = useTheme();
  const token = useAuthStore((s) => s.token);

  const [zoneId, setZoneId] = useState<ZoneId>('center');
  const zone = ZONES[zoneId];
  const [at, setAt] = useState<Point>(
    () => snapToPath(WALK_GRIDS.center, ZONES.center.spawn) ?? ZONES.center.spawn,
  );
  const [walk, setWalk] = useState<{ route: Point[]; then: Arrival } | null>(null);
  const [bySlot, setBySlot] = useState<Record<string, VillageNeighbor>>({});
  const [sheet, setSheet] = useState<SheetNeighbor | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);

  const fade = useRef(new Animated.Value(1)).current;
  const grid = WALK_GRIDS[zoneId];
  // 걷는 중·전환 중엔 탭을 받지 않는다(경로를 도중에 갈아끼우면 아바타가 순간이동한다).
  const busy = walk !== null || switching;

  const load = useCallback(() => {
    if (!token) return;
    getNeighbors(token, TOTAL_SLOTS)
      .then((list) => setBySlot(assign(list)))
      .catch(() => {
        /* 비치명적 — 이웃을 못 받아도 마을은 걸어다닐 수 있어야 한다(집 탭 시 안내만). */
      });
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  function tapGround(p: Point) {
    if (busy) return;
    setNotice(null);
    const route = findWalkRoute(grid, at, p);
    if (route.length === 0) return; // 길이 아예 없는 곳(맵 밖·물 위)을 누른 경우
    setWalk({ route, then: exitAt(zone, route[route.length - 1]) });
  }

  function tapSlot(slotId: string) {
    if (busy) return;
    setNotice(null);
    const slot = zone.slots.find((sl) => sl.id === slotId);
    if (!slot) return;
    const route = findWalkRoute(grid, at, slot.door);
    if (route.length === 0) return;
    setWalk({ route, then: { kind: 'slot', slotId } });
  }

  function arrive() {
    if (!walk) return;
    const end = walk.route[walk.route.length - 1];
    if (end) setAt(end);
    const then = walk.then;
    setWalk(null);
    if (then?.kind === 'slot') {
      const neighbor = bySlot[then.slotId];
      if (neighbor) setSheet({ nickname: neighbor.nickname, words: neighbor.words });
      else setNotice('아직 이웃이 없어요');
    } else if (then?.kind === 'exit') {
      switchZone(then.to);
    }
  }

  /** 맵 교체는 페이드아웃 → 갈아끼우기 → 페이드인. 중간에 보이면 화면이 툭 끊긴다. */
  function switchZone(to: ZoneId) {
    setSwitching(true);
    const step = (toValue: number) =>
      Animated.timing(fade, {
        toValue,
        duration: motion.duration.base,
        easing: motion.easing.standard,
        useNativeDriver: true,
      });
    step(0).start(() => {
      setZoneId(to);
      // 들어온 문 자리에 세운다. 데이터가 반 칸 어긋나도 걷기가 막히지 않게 길 위로 붙인다.
      const entry = entryPoint(zoneId, to);
      setAt(snapToPath(WALK_GRIDS[to], entry) ?? entry);
      step(1).start(() => setSwitching(false));
    });
  }

  return (
    <ThemedView bg="paper" style={styles.root}>
      <View style={styles.headerWrap}>
        <AppHeader />
        <View style={styles.bar}>
          <ThemedText variant="bodyMd" tone="strong">
            {zone.title}
          </ThemedText>
          <PressableScale
            onPress={() => {
              setNotice(null);
              load();
            }}
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
        <VillageScene
          zone={zone}
          at={at}
          route={walk?.route ?? null}
          onArrive={arrive}
          onTapGround={tapGround}
          onTapSlot={tapSlot}
        />
        {notice ? (
          <View pointerEvents="none" style={styles.noticeWrap}>
            <FadeIn>
              <View
                style={[
                  styles.notice,
                  {
                    backgroundColor: theme.colors.surface.base,
                    borderColor: theme.colors.line.base,
                    borderRadius: theme.radii.md,
                  },
                ]}
              >
                <ThemedText variant="caption" tone="secondary">
                  {notice}
                </ThemedText>
              </View>
            </FadeIn>
          </View>
        ) : null}
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

/** 도착 지점이 전환 지점 코앞이면 그 출구. */
function exitAt(zone: Zone, p: Point | undefined): Arrival {
  if (!p) return null;
  for (const exit of zone.exits) {
    if (Math.hypot(exit.at.x - p.x, exit.at.y - p.y) <= EXIT_RADIUS) {
      return { kind: 'exit', to: exit.to };
    }
  }
  return null;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerWrap: { paddingHorizontal: 24, paddingTop: 24 },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12 },
  refresh: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  board: { flex: 1 },
  noticeWrap: { position: 'absolute', left: 0, right: 0, bottom: 20, alignItems: 'center' },
  notice: { borderWidth: 1, paddingVertical: 8, paddingHorizontal: 14 },
});
