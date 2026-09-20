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

import { ZONE_BACKGROUNDS } from '@/data/village-backgrounds';
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
  const src = assetSize(ZONE_BACKGROUNDS[zone.id]);
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
  const background = ZONE_BACKGROUNDS[zone.id];
  const fit = useMemo(() => coverFit(background, box.w, box.h), [background, box.w, box.h]);

  /**
   * 걷기는 **경로 전체를 한 번의 애니메이션**으로 돌린다.
   * 격자 길찾기는 점이 수십 개씩 나오는데 구간마다 따로 애니메이션을 걸면
   * 구간 전환 지연이 쌓여 아바타가 기어간다(실제로 그랬다).
   * progress 0→1 하나를 누적 거리로 보간하면 점이 몇 개든 등속으로 미끄러진다.
   */
  const progress = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  const facing = useRef(new Animated.Value(1)).current;

  const onArriveRef = useRef(onArrive);
  useEffect(() => {
    onArriveRef.current = onArrive;
  });

  /** 경로를 화면 px 좌표와 누적거리(0~1)로 미리 펴둔다. */
  const plan = useMemo(() => {
    if (!route || route.length < 2 || fit.dispW === 0) return null;
    const px = route.map((p) => ({ x: fit.offX + p.x * fit.dispW, y: fit.offY + p.y * fit.dispH }));
    const cum = [0];
    for (let i = 1; i < px.length; i += 1) {
      cum.push(cum[i - 1] + Math.hypot(px[i].x - px[i - 1].x, px[i].y - px[i - 1].y));
    }
    const total = cum[cum.length - 1];
    if (total < 1) return null;
    // 같은 거리(=같은 입력값)가 연달아 오면 interpolate가 죽는다 → 미세하게 벌려준다.
    const input = cum.map((d, i) => Math.min(1, d / total + i * 1e-6));
    return { px, input, total };
  }, [route, fit.offX, fit.offY, fit.dispW, fit.dispH]);

  useEffect(() => {
    if (!route) return;
    if (!plan) {
      // 한 점짜리 경로(이미 그 자리)거나 레이아웃 전 — 레이아웃이 잡히면 다시 들어온다.
      if (route.length < 2 && fit.dispW > 0) onArriveRef.current();
      return;
    }

    progress.setValue(0);
    const bobLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: BOB_MS, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: BOB_MS, easing: Easing.linear, useNativeDriver: true }),
      ]),
    );
    bobLoop.start();

    // 왼쪽으로 갈 땐 뒤집어 방향감을 준다(스프라이트가 한 방향뿐이라).
    const sub = progress.addListener(({ value }) => {
      const d = value * plan.total;
      let i = 1;
      while (i < plan.input.length - 1 && plan.input[i] * plan.total < d) i += 1;
      const dx = plan.px[i].x - plan.px[i - 1].x;
      if (Math.abs(dx) > 0.5) facing.setValue(dx < 0 ? -1 : 1);
    });

    const anim = Animated.timing(progress, {
      toValue: 1,
      // 등속 — 걷기엔 가감속이 없어야 자연스럽다(ease-out은 UI 전환용 규칙).
      duration: Math.max(200, (plan.total / WALK_PX_PER_SEC) * 1000),
      easing: Easing.linear,
      useNativeDriver: true,
    });
    anim.start(({ finished }) => {
      if (finished) onArriveRef.current();
    });

    return () => {
      anim.stop();
      bobLoop.stop();
      bob.setValue(0);
      progress.removeListener(sub);
    };
  }, [route, plan, fit.dispW, progress, bob, facing]);

  /**
   * 보드 크기·화면상 위치를 직접 잰다.
   * ⚠️ 웹에서는 onLayout이 아예 오지 않는 경우가 있다(실제로 보드가 0×0으로 남아
   * 배경도 안 그려지고 탭도 죽었다). 렌더 뒤 한 번 재서 채운다. 값이 같으면 state를
   * 안 건드리므로 렌더 루프는 생기지 않는다.
   */
  useEffect(() => {
    const id = setTimeout(() => {
      boardRef.current?.measureInWindow((x, y, w, h) => {
        origin.current = { x, y };
        if (w > 0 && h > 0) setBox((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
      });
    }, 0);
    return () => clearTimeout(id);
  });

  const avatarH = Math.round(AVATAR_BASE_H * zone.avatarScale);
  const avatarW = Math.round(avatarH * AVATAR_RATIO);
  const shadowW = Math.round(avatarW * 0.9);
  const shadowH = Math.max(4, Math.round(shadowW * 0.34));

  // transform만 쓰므로 네이티브 드라이버 사용 가능(interpolate도 네이티브에서 계산된다).
  // 걷는 중이면 경로를 따라, 아니면 서 있는 자리에 고정.
  const standX = fit.offX + at.x * fit.dispW;
  const standY = fit.offY + at.y * fit.dispH;
  const translateX = plan
    ? progress.interpolate({ inputRange: plan.input, outputRange: plan.px.map((p) => p.x) })
    : standX;
  const translateY = plan
    ? progress.interpolate({ inputRange: plan.input, outputRange: plan.px.map((p) => p.y) })
    : standY;
  const bobY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -BOB_PX] });

  function handleLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setBox((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }));
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
        source={background}
        style={{ position: 'absolute', left: fit.offX, top: fit.offY, width: fit.dispW, height: fit.dispH }}
        resizeMode="stretch"
      />

      {/* 빈 땅 — 아래 깔고, 집 탭 영역을 그 위에 얹는다. */}
      <Pressable style={StyleSheet.absoluteFill} onPress={handleGround} />

      {zone.slots.map((slot) => {
        const door = slot.door;
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
