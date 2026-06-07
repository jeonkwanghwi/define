/**
 * 광장 (Plaza) — 같은 단어에 대한 타인의 정의를 구경하는 공간.
 *
 * 핵심 규칙(PLANNING.md): 상호주의 — 내 생각을 공유해야 다른 사람의 생각을 볼 수 있음.
 * 가입 필요 탭 — 로그아웃 시 AuthGate가 가입 유도 화면을 보여준다.
 * 본격 구현(타인 정의 표시)은 백엔드 도입 후 별도 단계.
 */
import { AuthGate } from '@/components/domain/auth-gate';
import { ScreenPlaceholder } from '@/components/domain/screen-placeholder';

export default function PlazaScreen() {
  return (
    <AuthGate
      icon="plaza"
      title="광장"
      description="다른 사람들은 이 단어를 어떻게 정의했을까요? 가입하고 내 정의를 나누면 광장이 열려요."
    >
      <ScreenPlaceholder
        iconName="plaza"
        title="광장"
        subtitle="같은 단어, 저마다 다른 정의들"
        note="화면 구현은 추후 진행"
      />
    </AuthGate>
  );
}
