/**
 * VillageBoard — 마을의 "2D 렌더러" (교체 가능한 얇은 층).
 *
 * 직접 생성한 픽셀아트 스프라이트(assets/village/*.png)로 탑다운 RPG 룩을 그린다.
 * 그리기와 탭 보고만 담당하고, 걷기/상태 로직은 화면(app/village.tsx)이 소유.
 * → 나중에 3D로 가면 이 파일만 갈아끼우면 됨.
 */
import { useRef } from 'react';
import { Animated, Image, type ImageSourcePropType, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { HouseSprite, Neighbor } from '@/data/village-mock';
import { useTheme } from '@/theme';

// 스프라이트는 PNG 네이티브 크기 그대로 표시(1:1)해야 픽셀이 안 뭉개짐.
const GRASS = require('../../../assets/village/grass.png');
const TREE = require('../../../assets/village/tree.png');
const FLOWER = require('../../../assets/village/flower.png');
const CHAR = require('../../../assets/village/char.png');
const HOUSES: Record<HouseSprite, ImageSourcePropType> = {
  'house-warm': require('../../../assets/village/house-warm.png'),
  'house-forest': require('../../../assets/village/house-forest.png'),
  'house-gold': require('../../../assets/village/house-gold.png'),
  'house-violet': require('../../../assets/village/house-violet.png'),
};

const GRASS_TILE = 48; // grass.png 표시 크기 (네이티브 48px = 1:1 크리스프)
const GRASS_BASE = '#86BA5C'; // 잔디 베이스색 — 타일 깔리기 전/틈새 폴백
const HOUSE_W = 96;
const HOUSE_H = 90;
const TREE_W = 48;
const TREE_H = 54;
const CHAR_W = 42;
const CHAR_H = 54;
const FLOWER_SZ = 24;

// 순수 장식(나무·꽃) 위치 — 0~1 비율. 렌더러 소유(월드 데이터 아님).
const TREES = [
  { x: 0.07, y: 0.16 }, { x: 0.92, y: 0.15 },
  { x: 0.05, y: 0.86 }, { x: 0.93, y: 0.88 }, { x: 0.5, y: 0.08 },
];
const FLOWERS = [
  { x: 0.48, y: 0.46 }, { x: 0.2, y: 0.74 }, { x: 0.64, y: 0.8 }, { x: 0.42, y: 0.93 }, { x: 0.8, y: 0.4 },
];

type Props = {
  neighbors: Neighbor[];
  avatarPos: Animated.ValueXY;
  onMeasure: (size: { w: number; h: number }) => void;
  onTapGround: (x: number, y: number) => void;
  onTapHouse: (n: Neighbor) => void;
  size: { w: number; h: number } | null;
};

export function VillageBoard({ neighbors, avatarPos, onMeasure, onTapGround, onTapHouse, size }: Props) {
  const theme = useTheme();
  const boardRef = useRef<View>(null);

  // 탭 지점을 보드 기준 로컬 좌표로 환산.
  // ⚠️ nativeEvent.locationX/Y는 react-native-web에서 undefined라 빈 땅 탭이 죽는다.
  // 양 플랫폼 공통으로 신뢰 가능한 pageX/pageY + 보드의 화면 위치(measureInWindow)로 계산.
  function handleGroundPress(pageX: number, pageY: number) {
    boardRef.current?.measureInWindow((bx, by) => {
      onTapGround(pageX - bx, pageY - by);
    });
  }

  return (
    <View
      ref={boardRef}
      style={[styles.board, { borderColor: theme.colors.line.base, borderRadius: theme.radii.xl }]}
      onLayout={(e) => onMeasure({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {/* 잔디 바닥 — grass.png를 격자로 깔아 타일링 (resizeMode repeat은 웹에서 안 먹어 직접 타일).
          맨 아래 + 탭 통과(pointerEvents none). */}
      {size ? (
        <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
          {Array.from({ length: Math.ceil(size.h / GRASS_TILE) }).map((_, r) =>
            Array.from({ length: Math.ceil(size.w / GRASS_TILE) }).map((__, c) => (
              <Image
                key={`g${r}-${c}`}
                source={GRASS}
                style={{ position: 'absolute', left: c * GRASS_TILE, top: r * GRASS_TILE, width: GRASS_TILE, height: GRASS_TILE }}
              />
            )),
          )}
        </View>
      ) : null}

      {/* 빈 땅 탭 레이어 (투명) — 누른 지점으로 걸어감. */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={(e) => handleGroundPress(e.nativeEvent.pageX, e.nativeEvent.pageY)}
      />

      {/* 장식(나무·꽃) — 탭 통과(pointerEvents none). */}
      {size ? (
        <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
          {FLOWERS.map((f, i) => (
            <Image
              key={`f${i}`}
              source={FLOWER}
              style={{ position: 'absolute', left: f.x * size.w - FLOWER_SZ / 2, top: f.y * size.h - FLOWER_SZ / 2, width: FLOWER_SZ, height: FLOWER_SZ }}
            />
          ))}
          {TREES.map((t, i) => (
            <Image
              key={`t${i}`}
              source={TREE}
              style={{ position: 'absolute', left: t.x * size.w - TREE_W / 2, top: t.y * size.h - TREE_H / 2, width: TREE_W, height: TREE_H }}
            />
          ))}
        </View>
      ) : null}

      {/* 집들 — 탭 가능. 비율→픽셀 환산해 배치. */}
      {size
        ? neighbors.map((n) => (
            <Pressable
              key={n.id}
              onPress={() => onTapHouse(n)}
              style={[styles.house, { left: n.x * size.w - HOUSE_W / 2, top: n.y * size.h - HOUSE_H / 2 }]}
            >
              <Image source={HOUSES[n.house]} style={{ width: HOUSE_W, height: HOUSE_H }} />
              <ThemedText variant="caption" tone="strong" numberOfLines={1} style={styles.houseLabel}>
                {n.name}
              </ThemedText>
            </Pressable>
          ))
        : null}

      {/* 아바타 — 맨 위, 탭 통과. */}
      <Animated.View
        style={[
          styles.avatar,
          {
            pointerEvents: 'none',
            transform: [
              { translateX: Animated.subtract(avatarPos.x, CHAR_W / 2) },
              { translateY: Animated.subtract(avatarPos.y, CHAR_H / 2) },
            ],
          },
        ]}
      >
        <Image source={CHAR} style={{ width: CHAR_W, height: CHAR_H }} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  board: { flex: 1, borderWidth: 1, overflow: 'hidden', backgroundColor: GRASS_BASE },
  house: { position: 'absolute', width: HOUSE_W, alignItems: 'center' },
  houseLabel: {
    marginTop: -6,
    maxWidth: HOUSE_W + 30,
    textAlign: 'center',
    textShadowColor: 'rgba(255,255,255,0.8)',
    textShadowRadius: 3,
  },
  avatar: { position: 'absolute', left: 0, top: 0 },
});
