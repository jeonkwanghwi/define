/**
 * 광장 (Plaza) — 같은 단어에 대한 타인의 정의를 구경하는 공간.
 *
 * 핵심 규칙(PLANNING.md): 상호주의 — 내 생각을 공유해야 다른 사람의 생각을 볼 수 있음.
 * 본격 구현은 Task #6 이후 별도 단계에서 진행.
 */
import { ScreenPlaceholder } from '@/components/domain/screen-placeholder';

export default function PlazaScreen() {
  return (
    <ScreenPlaceholder
      iconName="plaza"
      title="광장"
      subtitle="같은 단어, 저마다 다른 정의들"
      note="화면 구현은 추후 진행"
    />
  );
}
