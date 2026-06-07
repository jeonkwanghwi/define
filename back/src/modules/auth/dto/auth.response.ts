/**
 * AuthResponse — signup/login 성공 응답. passwordHash는 절대 포함하지 않는다.
 */
export class AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    nickname: string | null;
  };
}
