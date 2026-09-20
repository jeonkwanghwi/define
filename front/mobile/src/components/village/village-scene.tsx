/**
 * VillageScene — 배경 그림 위에 아바타를 그리는 층.
 *
 * 움직임은 화면(village.tsx)이 조이스틱으로 계산한다. 여기선 "받은 좌표를 어디에 그릴지"만
 * 책임진다. 렌더 방식이 바뀌어도 이 파일만 갈아끼우면 되도록 데이터·판정과 분리.
 *
 * ⚠️ 좌표 환산이 핵심: 0~1 비율 좌표는 "배경 그림" 기준이다. 그림이 놓인 사각형
 * (offX/offY + dispW/dispH)을 거쳐야 길·집 위치가 화면과 맞는다.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  View,
  type ImageSourcePropType,
  type LayoutChangeEvent,
} from 'react-native';

import { ZONE_BACKGROUNDS } from '@/data/village-backgrounds';
import type { Zone } from '@/data/village-zones';

const AVATAR = require('../../../assets/village/avatar.png');

/** 스프라이트 원본 비율은 파일에서 읽는다 — 아바타 그림을 갈아끼워도 가로가 안 찌그러진다. */
const AVATAR_RATIO = (() => {
  const s = assetSize(AVATAR);
  return s ? s.width / s.height : 108 / 156;
})();
/** 중앙 맵(avatarScale 1) 기준 아바타 높이(dp). 맵별 줌 차이는 zone.avatarScale이 보정. */
const AVATAR_BASE_H = 52;

/** 걸을 때 들썩임 — 한 걸음 시간(ms)과 폭(px). 과하면 통통 튀어 보인다(톤 가드). */
const BOB_MS = 170;
const BOB_PX = 2;

type Fit = { dispW: number; dispH: number; offX: number; offY: number };

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
function containFit(background: ImageSourcePropType, boxW: number, boxH: number): Fit {
  const src = assetSize(background);
  // 원본 크기를 못 얻으면(번들러 차이) 박스에 그대로 맞춘다 — 좌표가 조금 늘어나도 화면은 산다.
  if (!src) return { dispW: boxW, dispH: boxH, offX: 0, offY: 0 };
  const scale = Math.min(boxW / src.width, boxH / src.height);
  const dispW = src.width * scale;
  const dispH = src.height * scale;
  return { dispW, dispH, offX: (boxW - dispW) / 2, offY: (boxH - dispH) / 2 };
}

export type VillageSceneProps = {
  zone: Zone;
  /** 아바타 위치(0~1 비율) — 화면이 조이스틱으로 매 프레임 갱신한다. */
  pos: Animated.ValueXY;
  /** 좌우 반전(1 또는 -1). 스프라이트가 한 방향뿐이라 뒤집어서 방향감을 준다. */
  facing: Animated.Value;
  /** 움직이는 중이면 살짝 들썩인다. */
  moving: boolean;
};

export function VillageScene({ zone, pos, facing, moving }: VillageSceneProps) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const boardRef = useRef<View>(null);
  const background = ZONE_BACKGROUNDS[zone.id];
  const fit = useMemo(() => containFit(background, box.w, box.h), [background, box.w, box.h]);
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!moving) {
      bob.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: BOB_MS, easing: Easing.linear, useNativeDriver: false }),
        Animated.timing(bob, { toValue: 0, duration: BOB_MS, easing: Easing.linear, useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      bob.setValue(0);
    };
  }, [moving, bob]);

  /**
   * 보드 크기를 직접 잰다.
   * ⚠️ 웹에서는 onLayout이 아예 오지 않는 경우가 있다(실제로 보드가 0×0으로 남아
   * 배경도 안 그려졌다). 렌더 뒤 한 번 재서 채운다. 값이 같으면 state를 안 건드리므로
   * 렌더 루프는 생기지 않는다.
   */
  useEffect(() => {
    const id = setTimeout(() => {
      boardRef.current?.measureInWindow((_x, _y, w, h) => {
        if (w > 0 && h > 0) setBox((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
      });
    }, 0);
    return () => clearTimeout(id);
  });

  const avatarH = Math.round(AVATAR_BASE_H * zone.avatarScale);
  const avatarW = Math.round(avatarH * AVATAR_RATIO);
  const shadowW = Math.round(avatarW * 0.9);
  const shadowH = Math.max(4, Math.round(shadowW * 0.34));

  const translateX = pos.x.interpolate({ inputRange: [0, 1], outputRange: [fit.offX, fit.offX + fit.dispW] });
  const translateY = pos.y.interpolate({ inputRange: [0, 1], outputRange: [fit.offY, fit.offY + fit.dispH] });
  const bobY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -BOB_PX] });

  function handleLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setBox((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }));
  }

  return (
    <View ref={boardRef} style={styles.board} onLayout={handleLayout}>
      {/*
        contain에 맡기지 않고 우리가 계산한 사각형에 직접 그린다.
        좌표 환산(containFit)과 그림의 실제 위치가 한 곳에서 나와야 어긋나지 않는다.
      */}
      <Image
        source={background}
        style={{ position: 'absolute', left: fit.offX, top: fit.offY, width: fit.dispW, height: fit.dispH }}
        resizeMode="stretch"
      />

      {/* 아바타 — 앵커(발끝)가 좌표에 오도록 자식들을 음수 오프셋으로 매단다. */}
      <Animated.View style={[styles.anchor, { transform: [{ translateX }, { translateY }] }]}>
        <View
          style={[
            styles.shadow,
            { width: shadowW, height: shadowH, left: -shadowW / 2, top: -shadowH / 2, borderRadius: shadowH / 2 },
          ]}
        />
        <Animated.Image
          source={AVATAR}
          resizeMode="contain"
          style={{
            position: 'absolute',
            width: avatarW,
            height: avatarH,
            left: -avatarW / 2,
            top: -avatarH,
            transform: [{ translateY: bobY }, { scaleX: facing }],
          }}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  board: { flex: 1, overflow: 'hidden' },
  anchor: { position: 'absolute', left: 0, top: 0, width: 0, height: 0 },
  shadow: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.18)' },
});
