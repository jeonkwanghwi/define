/**
 * 앱 설정 — 환경변수(.env)를 타입 있는 객체로 모아준다.
 * ConfigModule이 이 함수를 읽어 ConfigService로 주입 가능하게 만든다.
 * (지금은 단순하지만, 설정이 늘면 여기 한 곳에서 관리.)
 */
export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  databaseUrl: process.env.DATABASE_URL ?? 'file:./dev.db',
});
