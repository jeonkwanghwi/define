/**
 * VillageScene — 배경 그림 위에 아바타를 얹고 탭을 받는 렌더러 층.
 *
 * 상태는 화면(village.tsx)이 소유한다. 여기선 "받은 좌표를 어디에 그릴지"와
 * "받은 경로를 어떻게 걷게 할지"만 책임진다. 렌더 방식(2D→3D)이 바뀌어도
 * 이 파일만 갈아끼우면 되도록 데이터·로직(village-zones / village-path)과 분리.
 *
 * ⚠️ 좌표 환산이 핵심: 0~1 비율 좌표는 "배경 그림" 기준이다. 그림이 놓인 사각형
 * (offX/offY + dispW/dispH)을 거쳐야 길·집 위치가 화면과 맞는다.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type ImageSourcePropType,
  type LayoutChangeEvent,
} from 'react-native';

import type { Point, Zone } from '@/data/village-zones';

const AVATAR = require('../../../assets/village/avatar.png');

/** avatar.png 원본 — 비율 유지용(투명 배경, 발끝이 바닥에 닿아 있는 그림). */
// 스프라이트 원본 비율은 파일에서 읽는다 — 아바타 그림을 갈아끼워도 가로가 안 찌그러진다.
const AVATAR_RATIO = (() => {
  const s = assetSize(AVATAR);
  return s ? s.width / s.height : 55 / 156;
})();
/** 중앙 맵(avatarScale 1) 기준 아바타 높이(dp). 맵별 줌 차이는 zone.avatarScale이 보정. */
const AVATAR_BASE_H = 52;

/** 걷는 속도(화면 px/초). 구간 길이에 비례한 시간을 줘서 등속으로 보이게 한다. */
const WALK_PX_PER_SEC = 150;
/** 들썩임 — 한쪽 방향 한 걸음 시간(ms)과 폭(px). 과하면 통통 튀어 보인다(톤 가드). */
const BOB_MS = 170;
const BOB_PX = 2;

/** 집 문 앞 탭 영역 지름(dp). 집 그림은 배경에 있으니 문 앞만 누를 수 있으면 된다. */
const SLOT_SIZE = 56;

type CoverFit = { dispW: number; dispH: number; offX: number; offY: number };

/**
 * 배경 원본 크기(px). 네이티브는 `Image.resolveAssetSource`로 얻지만,
 * **RN Web에는 그 함수가 없다**(호출하면 그대로 터진다). 웹에선 번들러가
 * require(png)를 `{ uri, width, height }` 객체로 내주므로 그걸 직접 읽는다.
 */
function assetSize(src: ImageSourcePropType): { width: number; height: number } | null {
  const resolve = (Image as unknown as { resolveAssetSource?: (s: ImageSourcePropType) => unknown })
    .resolveAssetSource;
  const resolved = (typeof resolve === 'function' ? resolve(src) : src) as
    | { width?: number; height?: number }
    | undefined;
  return resolved?.width && resolved?.height
    ? { width: resolved.width, height: resolved.height }
    : null;
}

/**
 * 그림 전체가 박스 안에 들어오도록 배치(contain) — 남는 자리는 여백.
 *
 * 꽉 채우면(cover) 기기 비율에 따라 그림이 잘리는데, 하필 **잘리는 가장자리에
 * 맵 전환 지점이 있다**. 폰(세로로 긴 화면)에선 좌우가 15%씩 잘려 옆 마을로 가는 길에
 * 아예 닿을 수 없었다. 마을은 "전체를 보고 돌아다니는" 화면이라 여백이 낫다.
 */
function coverFit(background: ImageSourcePropType, boxW: number, boxH: number): CoverFit {
  const src = assetSize(background);
  // 원본 크기를 못 얻으면(번들러 차이) 박스에 그대로 맞춘다 — 좌표가 조금 늘어나도 화면은 산다.
  if (!src?.width || !src?.height) return { dispW: boxW, dispH: boxH, offX: 0, offY: 0 };
  const scale = Math.min(boxW / src.width, boxH / src.height);
  const dispW = src.width * scale;
  const dispH = src.height * scale;
  return { dispW, dispH, offX: (boxW - dispW) / 2, offY: (boxH - dispH) / 2 };
}

/**
 * 거리 계산용 종횡비 — village-path의 aspect 인자에 그대로 넘긴다.
 * 비율 1은 가로로 dispW px, 세로로 dispH px이라 세로가 더 멀다.
 * dispH/dispW = 원본 h/w라 박스 크기와 무관하고, 레이아웃 전에도 구할 수 있다.
 */
export function zoneAspect(zone: Zone): number {
  const src = assetSize(zone.background);
  return src ? src.height / src.width : 1;
}

export type VillageSceneProps = {
  zone: Zone;
  /** 아바타가 서 있는 지점(0~1 비율). route가 없을 때의 위치. */
  at: Point;
  /** 걸어갈 꺾은선. null이면 정지. 새 배열이 들어오면 그 경로를 처음부터 걷는다. */
  route: Point[] | null;
  /** 경로 끝에 도착했을 때(경로가 한 점 이하면 즉시). */
  onArrive: () => void;
  /** 빈 땅 탭 — 누른 지점을 비율 좌표로. */
  onTapGround: (p: Point) => void;
  onTapSlot: (slotId: string) => void;
};

export function VillageScene({ zone, at, route, onArrive, onTapGround, onTapSlot }: VillageSceneProps) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  // 보드의 화면상 원점 — 웹에서 탭 좌표를 만들 때 쓴다(아래 handleGround 주석 참고).
  const boardRef = useRef<View>(null);
  const origin = useRef({ x: 0, y: 0 });
  const fit = useMemo(() => coverFit(zone.background, box.w, box.h), [zone.background, box.w, box.h]);

  // 아바타 위치는 "비율"로 들고 있다가 그릴 때 px로 편다 — 레이아웃이 바뀌어도 걷는 중에 안 어긋난다.
  const ax = useRef(new Animated.Value(at.x)).current;
  const ay = useRef(new Animated.Value(at.y)).current;
  const bob = useRef(new Animated.Value(0)).current;
  const facing = useRef(new Animated.Value(1)).current;

  // 경로 도중에 콜백 identity가 바뀌어도 걷기가 끊기지 않게 ref로 최신값만 본다.
  const onArriveRef = useRef(onArrive);
  useEffect(() => {
    onArriveRef.current = onArrive;
  });

  // 걷지 않을 때(맵 전환 직후 등)는 넘어온 위치로 바로 세운다.
  useEffect(() => {
    if (route) return;
    ax.setValue(at.x);
    ay.setValue(at.y);
  }, [at, route, ax, ay]);

  useEffect(() => {
    if (!route) return;
    // 레이아웃 전이면 구간 시간을 못 구한다 — 측정되면 이 effect가 다시 들어온다.
    if (fit.dispW === 0) return;
    if (route.length < 2) {
      onArriveRef.current();
      return;
    }

    // 경로 첫 점 = 현재 위치를 길 위로 끌어올린 지점. 이미 길 위라 눈에 띄는 점프는 없다.
    ax.setValue(route[0].x);
    ay.setValue(route[0].y);

    const bobLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: BOB_MS, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: BOB_MS, easing: Easing.linear, useNativeDriver: true }),
      ]),
    );
    bobLoop.start();

    let cancelled = false;
    let i = 1;
    const step = () => {
      if (cancelled) return;
      if (i >= route.length) {
        bobLoop.stop();
        bob.setValue(0);
        onArriveRef.current();
        return;
      }
      const a = route[i - 1];
      const b = route[i];
      // 왼쪽으로 가면 뒤집어 방향감을 준다(스프라이트가 한 방향뿐이라).
      if (b.x !== a.x) facing.setValue(b.x < a.x ? -1 : 1);
      // 등속 — 걷기엔 가감속이 없어야 자연스럽다(ease-out은 UI 전환용 규칙).
      const px = Math.hypot((b.x - a.x) * fit.dispW, (b.y - a.y) * fit.dispH);
      const timing = { duration: Math.max(60, (px / WALK_PX_PER_SEC) * 1000), easing: Easing.linear, useNativeDriver: true };
      Animated.parallel([
        Animated.timing(ax, { toValue: b.x, ...timing }),
        Animated.timing(ay, { toValue: b.y, ...timing }),
      ]).start(({ finished }) => {
        if (!finished || cancelled) return;
        i += 1;
        step();
      });
    };
    step();

    return () => {
      cancelled = true;
      bobLoop.stop();
      bob.setValue(0);
    };
  }, [route, fit.dispW, fit.dispH, ax, ay, bob, facing]);

  const avatarH = Math.round(AVATAR_BASE_H * zone.avatarScale);
  const avatarW = Math.round(avatarH * AVATAR_RATIO);
  const shadowW = Math.round(avatarW * 0.9);
  const shadowH = Math.max(4, Math.round(shadowW * 0.34));

  // transform만 쓰므로 네이티브 드라이버 사용 가능(interpolate도 네이티브에서 계산된다).
  const translateX = ax.interpolate({ inputRange: [0, 1], outputRange: [fit.offX, fit.offX + fit.dispW] });
  const translateY = ay.interpolate({ inputRange: [0, 1], outputRange: [fit.offY, fit.offY + fit.dispH] });
  const bobY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -BOB_PX] });

  function handleLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setBox({ w: width, h: height });
    boardRef.current?.measureInWindow((x, y) => {
      origin.current = { x, y };
    });
  }

  function handleGround(e: GestureResponderEvent) {
    if (fit.dispW === 0) return;
    // ⚠️ RN Web의 Pressable은 locationX/Y를 주지 않는다(null) — 그대로 쓰면 탭이 전부 무시된다.
    // 웹에선 pageX/Y에서 보드의 화면상 원점을 빼서 보드 기준 좌표를 만든다.
    const ne = e.nativeEvent as unknown as {
      locationX?: number | null;
      locationY?: number | null;
      pageX?: number;
      pageY?: number;
    };
    const lx = ne.locationX ?? (ne.pageX ?? 0) - origin.current.x;
    const ly = ne.locationY ?? (ne.pageY ?? 0) - origin.current.y;
    // px → 비율 (그릴 때의 역산)
    onTapGround({ x: (lx - fit.offX) / fit.dispW, y: (ly - fit.offY) / fit.dispH });
  }

  return (
    <View ref={boardRef} style={styles.board} onLayout={handleLayout}>
      {/*
        cover에 맡기지 않고 우리가 계산한 사각형에 직접 그린다.
        좌표 환산(coverFit)과 그림의 실제 위치가 한 곳에서 나와야 어긋나지 않는다.
      */}
      <Image
        source={zone.background}
        style={{ position: 'absolute', left: fit.offX, top: fit.offY, width: fit.dispW, height: fit.dispH }}
        resizeMode="stretch"
      />

      {/* 빈 땅 — 아래 깔고, 집 탭 영역을 그 위에 얹는다. */}
      <Pressable style={StyleSheet.absoluteFill} onPress={handleGround} />

      {zone.slots.map((slot) => {
        const door = zone.nodes[slot.door];
        if (!door) return null;
        return (
          <Pressable
            key={slot.id}
            onPress={() => onTapSlot(slot.id)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="집 들어가기"
            style={[
              styles.slot,
              {
                left: fit.offX + door.x * fit.dispW - SLOT_SIZE / 2,
                top: fit.offY + door.y * fit.dispH - SLOT_SIZE / 2,
              },
            ]}
          />
        );
      })}

      {/* 아바타 — 앵커(발끝)가 좌표에 오도록 자식들을 음수 오프셋으로 매단다. 탭은 가리지 않는다. */}
      <Animated.View pointerEvents="none" style={[styles.anchor, { transform: [{ translateX }, { translateY }] }]}>
        <View
          style={[
            styles.shadow,
            { width: shadowW, height: shadowH, left: -shadowW / 2, top: -shadowH / 2, borderRadius: shadowH / 2 },
          ]}
        />
        <Animated.Image
          source={AVATAR}
          resizeMode="contain"
          style={[
            styles.avatar,
            {
              width: avatarW,
              height: avatarH,
              left: -avatarW / 2,
              top: -avatarH,
              transform: [{ translateY: bobY }, { scaleX: facing }],
            },
          ]}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  board: { flex: 1, overflow: 'hidden' },
  slot: { position: 'absolute', width: SLOT_SIZE, height: SLOT_SIZE, borderRadius: SLOT_SIZE / 2 },
  anchor: { position: 'absolute', left: 0, top: 0, width: 0, height: 0, overflow: 'visible' },
  shadow: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.18)' },
  avatar: { position: 'absolute' },
});
