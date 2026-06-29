/**
 * UserEntity — 우리 앱이 생각하는 "가입 사용자 한 명".
 * passwordHash까지 들고 있는 내부 도메인 객체 (로그인 비교에 필요).
 * 바깥(응답)으로는 절대 그대로 나가지 않는다 — AuthResponse로 추려서 내보냄.
 */
export class UserEntity {
  id: string;
  email: string;
  passwordHash: string;
  nickname: string | null;
  birthYear: number | null;
  gender: string | null; // 'male' | 'female' | null
  interests: string[]; // 미완성이면 빈 배열
  balance: number; // 잉크 잔액(중립어). 신규/익명 0.
  recallConsentAt: Date | null; // tab3 회상 동의 시각. null=미동의.
  createdAt: Date;
}
