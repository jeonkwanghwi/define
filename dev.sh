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

# npm이 PATH에 없으면(nvm 미활성 셸에서 실행된 경우) nvm에서 직접 로드
if ! command -v npm >/dev/null 2>&1; then
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
fi
# 그래도 없으면 설치된 최신 node의 bin을 PATH에 직접 추가 (nvm 셸 함수 실패 대비)
if ! command -v npm >/dev/null 2>&1; then
  NODE_BIN=$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null | sort -V | tail -1)
  [ -n "${NODE_BIN:-}" ] && export PATH="$NODE_BIN:$PATH"
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "✗ npm을 찾지 못했습니다. nvm/node 설치를 확인하세요." >&2
  exit 1
fi

# docker가 PATH에 없으면(Docker Desktop이 사용자 설치라 /usr/local/bin 링크가 없는 경우) 직접 추가
if ! command -v docker >/dev/null 2>&1 && [ -x "$HOME/.docker/bin/docker" ]; then
  export PATH="$HOME/.docker/bin:$PATH"
fi

echo "▶ Postgres 컨테이너 확인 (back/docker-compose.yml) …"
if ! ( cd back && docker compose up -d ); then
  echo "✗ Postgres를 띄우지 못했습니다. Docker Desktop이 실행 중인지 확인하세요." >&2
  exit 1
fi

echo "▶ 백엔드 시작 (NestJS watch, http://localhost:3000) …"
( cd back && npm run start:dev ) &
BACK_PID=$!

# 스크립트가 끝나면(=Expo 종료 or Ctrl+C) 백엔드도 함께 정리
trap 'echo; echo "■ 종료 중…"; kill "$BACK_PID" 2>/dev/null || true' EXIT

echo "▶ 프론트 시작 (Expo). 아이폰 Expo Go 앱으로 아래 QR을 스캔하세요."
cd front/mobile && npx expo start
