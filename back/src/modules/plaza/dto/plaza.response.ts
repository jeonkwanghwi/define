/**
 * 광장 응답 형태. read-only라 클래스 대신 타입으로 단순화.
 */
export type PlazaWordResponse = { word: string; count: number };

export type PlazaDefinitionResponse = {
  id: string;
  nickname: string; // 없으면 '익명'
  text: string;
  savedAt: string; // ISO
  isMine: boolean;
};

export type PlazaWordDetailResponse = {
  word: string;
  definitions: PlazaDefinitionResponse[];
};
