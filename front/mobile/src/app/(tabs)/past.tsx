/**
 * 과거의 나 (Past Self) — 과거 정의를 바탕으로 만든 "그 시절의 나"와 대화.
 *
 * GPT API 연동 유료 기능 후보. 본격 구현은 추후 단계.
 */
import { ScreenPlaceholder } from '@/components/domain/screen-placeholder';

export default function PastScreen() {
  return (
    <ScreenPlaceholder
      iconName="past"
      title="과거의 나"
      subtitle="그 시절의 나와 대화해 보세요"
      note="화면 구현은 추후 진행"
    />
  );
}
