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

echo "■ 기존 :3000 / :8081 프로세스 정리…"
lsof -ti tcp:3000 | xargs kill -9 2>/dev/null || true
lsof -ti tcp:8081 | xargs kill -9 2>/dev/null || true

echo "▶ 백엔드 시작 (NestJS watch, http://localhost:3000) …"
( cd back && npm run start:dev ) &
BACK_PID=$!

# Expo 종료(=Ctrl+C)되면 백엔드도 함께 정리. 자식 프로세스까지 잡히도록 포트로 한 번 더.
trap 'echo; echo "■ 종료 중…"; kill "$BACK_PID" 2>/dev/null || true; lsof -ti tcp:3000 | xargs kill -9 2>/dev/null || true' EXIT

echo "▶ 프론트(웹) 시작 http://localhost:8081 …"
cd front/mobile && npx expo start --web --port 8081
