/**
 * 앱 설정 — 환경변수(.env)를 타입 있는 객체로 모아준다.
 * ConfigModule이 이 함수를 읽어 ConfigService로 주입 가능하게 만든다.
 * (지금은 단순하지만, 설정이 늘면 여기 한 곳에서 관리.)
 */

/**
 * 필수 환경변수 읽기 — 없으면 부팅을 실패시킨다.
 * 폴백을 두면 배포에서 빼먹었을 때 조용히 약한 기본값으로 굴러가므로(예: 고정 JWT 시크릿 = 토큰 위조 가능),
 * 차라리 앱이 안 뜨게 해서 즉시 알아채는 편이 안전하다.
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`필수 환경변수 ${name}가 없습니다. back/.env(로컬) 또는 배포 환경변수에 설정하세요.`);
  }
  return value;
}

export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  databaseUrl: requireEnv('DATABASE_URL'),
  jwt: {
    secret: requireEnv('JWT_SECRET'),
    expiresIn: process.env.JWT_EXPIRES_IN ?? '90d',
  },
  openai: { apiKey: process.env.OPENAI_API_KEY ?? '' },
});
