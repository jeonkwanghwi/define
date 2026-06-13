/**
 * 마을 (Village) — 좌2 탭. 아바타 마을 = 광장 컨셉2("사람 → 단어").
 *
 * 이웃(=다른 사용자)의 집을 거닐며 그 사람의 정의를 들여다보는 공간.
 * 가입 필요 탭 — 로그아웃 시 AuthGate가 가입 유도 화면을 보여준다.
 *
 * 현재 실제 마을 화면은 2D 픽셀아트 목업(`/village-demo` dev 라우트)으로 별도 존재.
 * 2D/3D 렌더링 방향 확정(DEVELOPMENT.md §6) 후 이 탭에 본격 연결 예정.
 * 그때까지 children은 placeholder.
 */
import { AuthGate } from '@/components/domain/auth-gate';
import { ScreenPlaceholder } from '@/components/domain/screen-placeholder';

export default function VillageScreen() {
  return (
    <AuthGate
      icon="village"
      title="마을"
      description="이웃들의 마을을 거닐며 다른 사람의 정의를 만나는 공간이에요. 가입해두면 가장 먼저 만나요."
    >
      <ScreenPlaceholder
        iconName="village"
        title="마을"
        subtitle="이웃의 집을 거닐며 그 사람의 정의를 보는 공간"
        note="준비 중 — 2D/3D 방향 확정 후 진행"
      />
    </AuthGate>
  );
}
