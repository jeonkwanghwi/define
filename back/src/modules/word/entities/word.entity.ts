/**
 * WordEntity — 도메인 객체. "우리 앱이 생각하는 단어 한 개"의 모양.
 *
 * repository가 DB row를 이 형태로 변환해 돌려준다.
 * (DB 컬럼 그대로가 아니라, 우리가 쓰기 좋은 형태로 한 겹 분리 → DB가 바뀌어도 이건 유지.)
 */
export class WordEntity {
  id: string;
  text: string;
}
