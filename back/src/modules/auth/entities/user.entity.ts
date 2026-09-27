/**
 * UserEntity — 우리 앱이 생각하는 "가입 사용자 한 명".
 * passwordHash까지 들고 있는 내부 도메인 객체 (로그인 비교에 필요).
 * 바깥(응답)으로는 절대 그대로 나가지 않는다 — AuthResponse로 추려서 내보냄.
 *
 * email·passwordHash가 null일 수 있다 = 소셜 로그인으로만 가입한 사용자.
 * 그래서 로그인 시 "비밀번호가 틀렸다"와 "애초에 비밀번호가 없다"를 구분해 다뤄야 한다.
 */
export class UserEntity {
  id: string;
  email: string | null;
  passwordHash: string | null;
  nickname: string | null;
  birthYear: number | null;
  gender: string | null; // 'male' | 'female' | null
  interests: string[]; // 미완성이면 빈 배열
  balance: number; // 잉크 잔액(중립어). 신규/익명 0.
  recallConsentAt: Date | null; // tab3 회상 동의 시각. null=미동의.
  createdAt: Date;
}
