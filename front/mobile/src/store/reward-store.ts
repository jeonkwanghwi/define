/**
 * reward-store — auto-sync가 비동기로 받은 "기록 연속 보너스"를 _layout 토스트로 넘기는 다리.
 * (auto-sync는 React 밖이라 직접 토스트를 못 띄움 → 여기 push, _layout이 구독·표시.)
 */
import { create } from 'zustand';

export type RecordReward = { streak: number; amount: number };

type RewardState = {
  pending: RecordReward | null;
  push: (r: RecordReward) => void;
  clear: () => void;
};

export const useRewardStore = create<RewardState>((set) => ({
  pending: null,
  push: (r) => set({ pending: r }),
  clear: () => set({ pending: null }),
}));
