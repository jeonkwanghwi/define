/**
 * plaza-api — 광장 조회. GET /api/plaza/* (Bearer 필요).
 * 단어는 한글이라 path에 encodeURIComponent.
 */
import { apiRequest } from './api-client';

export type PlazaWord = { word: string; count: number };

export type PlazaDefinition = {
  id: string;
  nickname: string;
  text: string;
  savedAt: string;
  isMine: boolean;
};

export type PlazaWordDetail = {
  word: string;
  definitions: PlazaDefinition[];
};

/** GET /api/plaza/words */
export function getPlazaWords(token: string): Promise<PlazaWord[]> {
  return apiRequest<PlazaWord[]>('/plaza/words', { method: 'GET', token });
}

/** GET /api/plaza/words/:word */
export function getPlazaWord(token: string, word: string): Promise<PlazaWordDetail> {
  return apiRequest<PlazaWordDetail>(`/plaza/words/${encodeURIComponent(word)}`, {
    method: 'GET',
    token,
  });
}
