/**
 * 과거의 나 (Past Self) — 과거 정의를 바탕으로 만든 "그 시절의 나"와 대화.
 *
 * 가입 필요 탭 — 로그아웃 시 AuthGate가 가입 유도 화면을 보여준다.
 * GPT API 연동 유료 기능 후보. 본격 구현은 추후 단계.
 */
import { AuthGate } from '@/components/domain/auth-gate';
import { ScreenPlaceholder } from '@/components/domain/screen-placeholder';

export default function PastScreen() {
  return (
    <AuthGate
      icon="past"
      title="과거의 나"
      description="과거의 정의로 '그때의 나'와 대화해요. 가입하면 만날 수 있어요."
    >
      <ScreenPlaceholder
        iconName="past"
        title="과거의 나"
        subtitle="그 시절의 나와 대화해 보세요"
        note="화면 구현은 추후 진행"
      />
    </AuthGate>
  );
}
