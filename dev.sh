#!/usr/bin/env bash
# define 로컬 개발: 백엔드(:3000) + 프론트(Expo)를 한 번에 실행한다.
#
#   사용법:  ./dev.sh          (레포 루트에서)
#   종료:    Ctrl+C            → 백엔드도 같이 종료됨
#
# 백엔드는 백그라운드로, 프론트(Expo)는 포그라운드로 띄운다.
# 그래야 Expo QR 코드가 화면에 남아서 아이폰 Expo Go로 스캔할 수 있다.

set -uo pipefail

# 이 스크립트가 어디서 실행되든 레포 루트를 기준으로 동작
cd "$(dirname "$0")"

echo "▶ 백엔드 시작 (NestJS watch, http://localhost:3000) …"
( cd back && npm run start:dev ) &
BACK_PID=$!

# 스크립트가 끝나면(=Expo 종료 or Ctrl+C) 백엔드도 함께 정리
trap 'echo; echo "■ 종료 중…"; kill "$BACK_PID" 2>/dev/null || true' EXIT

echo "▶ 프론트 시작 (Expo). 아이폰 Expo Go 앱으로 아래 QR을 스캔하세요."
cd front/mobile && npx expo start
