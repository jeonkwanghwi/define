# 마을 배경 원본 (PNG)

**앱에 실리는 건 `front/mobile/assets/village/*.webp`다.** 이 폴더의 PNG는 번들에 들어가지 않는다
(Metro 루트가 `front/mobile`이라 상위 폴더는 보지 않는다).

## 왜 원본을 따로 두는가

`scripts/gen-village-grid.mjs`는 **그림의 길 색을 집어 격자를 만든다.** webp는 손실 압축이라
색 경계가 미세하게 번지는데, 하필 그 색이 판정 기준이다. 실제로 webp에서 뽑아 보니
격자가 0.4~3.1% 달라졌고 east는 걸을 수 있는 칸이 9% 줄었다.

그래서 **앱 용량은 webp로 줄이되, 격자의 진실 출처는 이 PNG로 남긴다.**
원본에서 뽑은 격자가 커밋된 `village-grid.ts`와 바이트 단위로 같은 것을 확인했다(2026-10-16).

## 배경을 고쳤다면

1. 이 폴더의 PNG를 교체한다
2. `node scripts/gen-village-grid.mjs` — 격자를 다시 뽑는다
3. webp를 다시 만든다 (RGB, q90 — 알파는 전부 불투명이라 버린다):

```python
from PIL import Image
import glob, os
for f in glob.glob('front/design-source/village-art/bg-*.png'):
    out = 'front/mobile/assets/village/' + os.path.basename(f)[:-4] + '.webp'
    Image.open(f).convert('RGB').save(out, 'WEBP', quality=90, method=6)
```
