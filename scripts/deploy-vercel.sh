#!/usr/bin/env bash
#
# GitHub 없이 이 폴더를 그대로 Vercel 에 올린다.
#
#   1) 먼저 한 번만:  npx vercel login
#   2) 그다음:        bash scripts/deploy-vercel.sh
#
# .env.local 의 값을 Vercel 환경변수로 올린 뒤 프로덕션 배포까지 한다.
# 두 번째부터는 이 스크립트만 다시 돌리면 된다.

set -euo pipefail

PROJECT_NAME="${VERCEL_PROJECT_NAME:-smoc-prayer}"
ENV_FILE=".env.local"

if [ ! -f "$ENV_FILE" ]; then
  echo "$ENV_FILE 이 없습니다. DATABASE_URL 과 SESSION_SECRET 이 필요합니다." >&2
  exit 1
fi

if ! npx --yes vercel whoami >/dev/null 2>&1; then
  echo "Vercel 에 로그인되어 있지 않습니다. 먼저 실행해 주세요:" >&2
  echo "" >&2
  echo "  npx vercel login" >&2
  exit 1
fi

echo "▸ 프로젝트 연결 ($PROJECT_NAME)"
npx --yes vercel link --yes --project "$PROJECT_NAME" >/dev/null

# .env.local 의 값을 Vercel 로 옮긴다.
# 이미 있으면 지우고 다시 넣는다 — 값이 바뀌었을 때도 그대로 반영되도록.
push_env() {
  local key="$1" env="$2" value
  value="$(grep -E "^${key}=" "$ENV_FILE" | head -1 | cut -d= -f2-)"

  if [ -z "$value" ]; then
    echo "  · $key 없음 — 건너뜀"
    return
  fi

  npx --yes vercel env rm "$key" "$env" --yes >/dev/null 2>&1 || true
  printf '%s' "$value" | npx --yes vercel env add "$key" "$env" >/dev/null
  echo "  · $key → $env"
}

echo "▸ 환경변수 올리기"
for env in production preview development; do
  push_env DATABASE_URL "$env"
  push_env SESSION_SECRET "$env"
  push_env SIGNUP_PASSPHRASE "$env"
  push_env CRON_SECRET "$env"
  push_env RESEND_API_KEY "$env"
done

echo "▸ 프로덕션 배포"
npx --yes vercel --prod

echo ""
echo "끝났습니다. 위에 나온 주소로 접속해 로그인해 보세요."
echo "가입 문구는 .env.local 의 SIGNUP_PASSPHRASE 값입니다."
