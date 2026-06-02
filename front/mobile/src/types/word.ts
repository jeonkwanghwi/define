/**
 * 도메인 타입 — 단어 / 정의 / 단어장.
 *
 * 여러 컴포넌트·화면·데이터 소스(mock, 추후 API)가 공유하는 타입.
 * 백엔드 연동 시 services/journal-api.ts가 같은 타입을 import.
 */

export type WordEntry = {
  /** SavedEntry의 id 그대로 — 수정/삭제 액션이 정확히 가리키도록 */
  id: string;
  /** 'YYYY.MM.DD' — 표시용 절대 날짜 문자열 */
  date: string;
  /** '오늘' / '지난달' / '1년 전' / '작년' 같은 표시용 상대 라벨 */
  relativeLabel: string;
  /** 그날 적은 정의 본문 */
  text: string;
  /**
   * 이 정의를 적을 때 "이전과 무엇이 달라졌나"를 남긴 선택 메모.
   * 첫 정의(가장 오래된 entry)에는 없음 — 비교 대상이 없으므로.
   */
  changeNote?: string;
};

export type JournalWord = {
  word: string;
  /** 시간 역순 정렬 (entries[0]이 가장 최근). */
  entries: WordEntry[];
  /** 생각이 의미 있게 바뀌었는지 — 리스트의 변화 뱃지 / 상세의 change-banner 표시 */
  changed: boolean;
  /** 변화 요약 한 줄. changed=true일 때만 의미. */
  changeNote?: string;
};
