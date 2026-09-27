/**
 * AuthResponse — signup/login/profile 성공 응답. passwordHash는 절대 포함하지 않는다.
 * email이 null일 수 있다 = 소셜 로그인으로만 가입한 사용자(카카오는 이메일을 주지 않는다).
 */
export class AuthResponse {
  token: string;
  user: {
    id: string;
    email: string | null;
    nickname: string | null;
    birthYear: number | null;
    gender: string | null;
    interests: string[];
    profileCompleted: boolean;
    balance: number;
    recallConsented: boolean;
  };
}
