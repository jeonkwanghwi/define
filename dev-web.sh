#!/usr/bin/env bash
# define 로컬 개발(웹): 백엔드(:3000) + Expo 웹(:8081)을 한 번에 띄운다.
#
#   사용법:  ./dev-web.sh     (레포 루트에서)
#   종료:    Ctrl+C           → 백엔드도 함께 종료됨
#
# 기존에 떠 있던 :3000 / :8081 프로세스를 먼저 정리하고 새로 시작한다.
# (폰/Expo Go로 붙을 때는 QR이 나오는 dev.sh를 쓴다.)

set -uo pipefail
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

echo "■ 기존 :3000 / :8081 프로세스 정리…"
lsof -ti tcp:3000 | xargs kill -9 2>/dev/null || true
lsof -ti tcp:8081 | xargs kill -9 2>/dev/null || true

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

# Expo 종료(=Ctrl+C)되면 백엔드도 함께 정리. 자식 프로세스까지 잡히도록 포트로 한 번 더.
trap 'echo; echo "■ 종료 중…"; kill "$BACK_PID" 2>/dev/null || true; lsof -ti tcp:3000 | xargs kill -9 2>/dev/null || true' EXIT

echo "▶ 프론트(웹) 시작 http://localhost:8081 …"
cd front/mobile && npx expo start --web --port 8081
