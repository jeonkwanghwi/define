/**
 * ReportSheet — 광장 정의를 신고할 **사유**를 고르는 시트.
 *
 * ActionSheet 하나를 감싼 얇은 껍데기다. 왜 그래도 파일을 따로 두는가:
 * 라벨(사람 말)과 서버 값(@IsIn 목록)의 짝을 한 곳에만 두고 싶기 때문이다 —
 * 호출부에 흩어지면 사유가 추가될 때 한쪽만 고치는 사고가 난다.
 *
 * 비동기 3종은 호출부의 몫이다. ActionSheet는 누른 직후 스스로 닫히므로
 * 이 안에는 진행 중·실패를 그릴 자리가 없다 — 고른 사유만 돌려주고 끝낸다.
 *
 * 사용:
 *   <ReportSheet visible={target !== null} onSelect={send} onClose={...} />
 */
import { ActionSheet } from '@/components/primitives';
import type { ReportReason } from '@/services/plaza-api';

/** 라벨은 사람 말로, 값은 서버 DTO가 받는 그대로. 순서 = 신고가 잦은 쪽부터. */
const REASONS: { label: string; reason: ReportReason }[] = [
  { label: '혐오·차별', reason: 'hate' },
  { label: '성적인 내용', reason: 'sexual' },
  { label: '폭력·위협', reason: 'violence' },
  { label: '스팸·광고', reason: 'spam' },
  { label: '기타', reason: 'other' },
];

export type ReportSheetProps = {
  visible: boolean;
  /** 사유를 고른 순간 호출된다 — 확인 단계를 또 두지 않는다(신고는 되돌릴 게 없다). */
  onSelect: (reason: ReportReason) => void;
  onClose: () => void;
  /** 누구의 글을 신고하는지 — 제목에 박아 "어느 카드였지?"를 없앤다. */
  nickname?: string;
};

export function ReportSheet({ visible, onSelect, onClose, nickname }: ReportSheetProps) {
  return (
    <ActionSheet
      visible={visible}
      title={nickname ? `${nickname}님의 정의 · 신고 사유를 골라주세요` : '신고 사유를 골라주세요'}
      items={REASONS.map((r) => ({
        label: r.label,
        onPress: () => onSelect(r.reason),
      }))}
      onClose={onClose}
    />
  );
}
