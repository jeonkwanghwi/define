/**
 * /recall-chat — 과거의 나와 ephemeral 채팅. 탭 밖 풀스크린.
 * mode='free'면 사용자 먼저, mode='question'면 과거의 내가 먼저 질문(마운트 시 자동).
 * 질문모드는 focusWord를 "다시 정의" 버튼으로 즉시 재정의(새 엔트리).
 */
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { InkBalanceChip } from '@/components/domain/ink-balance-chip';
import { ConfirmDialog } from '@/components/primitives/confirm-dialog';
import { RedefineSheet } from '@/components/domain/redefine-sheet';
import { ScreenHeader } from '@/components/domain/screen-header';
import { WatchAdButton } from '@/components/domain/watch-ad-button';
import { Button, FadeIn, Loading, PressableScale, useToast } from '@/components/primitives';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { RECALL_COST } from '@/constants/recall';
import { Icon } from '@/icons';
import { hapticSuccess } from '@/lib/haptics';
import { userFacingMessage } from '@/services/api-client';
import { recallChat, type RecallFilter, type RecallMessage } from '@/services/recall-api';
import { useAuthStore } from '@/store/auth-store';
import { useJournalStore } from '@/store/journal-store';
import { useKeyboardOpen } from '@/hooks/use-keyboard-open';
import { useTheme } from '@/theme';

type ApiError = { status: number; message: string };

/** 회상 대화 메시지 1개 상한 — 서버(2000자)보다 짧게 잡아 사용자가 400을 볼 일이 없게. */
const MESSAGE_MAX = 1000;
/** 한 요청에 실을 수 있는 대화 이력 상한(서버 DTO와 같은 값). 넘기면 서버가 이유 없이 400을 준다. */
const HISTORY_MAX = 40;
const CONVERSATION_DONE = '이 대화는 여기까지예요 · 새 대화를 시작해 주세요';

/**
 * 질문모드 자동 시작 표(start 파라미터)를 한 번만 쓴다. 이미 쓴 표면 false.
 * 왜: 웹에서 새로고침·뒤로 갔다 앞으로 오면 같은 주소로 화면이 다시 열려 첫 질문을 또 받았다 —
 * 새 대화라 잉크 30개가 또 빠졌다. 웹은 새로고침에도 남도록 sessionStorage에도 적는다.
 */
const usedStarts = new Set<string>();
function takeStart(start: string | undefined): boolean {
  if (!start || usedStarts.has(start)) return false;
  usedStarts.add(start);
  if (Platform.OS === 'web') {
    try {
      const key = `recall-start-${start}`;
      if (sessionStorage.getItem(key)) return false;
      sessionStorage.setItem(key, '1');
    } catch {
      // 저장소를 못 쓰면 메모리 기록만으로 — 새로고침 방어만 약해진다
    }
  }
  return true;
}

function mapError(e: unknown): string {
  const err = e as ApiError;
  if (err.status === 402) return `잉크 ${RECALL_COST}개가 필요해요 · 출석으로 모아보세요`;
  if (err.status === 503) return '과거의 내가 지금은 대답할 수 없어요. 잠시 후 다시 시도해 주세요.';
  if (err.status === 403) return '회상을 시작하려면 동의가 필요해요. 이전 화면에서 다시 시작해 주세요.';
  // 429 = 한 대화의 턴 상한 / 하루 상한. 서버가 어느 쪽인지 한국어로 말해 주므로 그대로 보여 준다.
  if (err.status === 429) return userFacingMessage(e) ?? CONVERSATION_DONE;
  // 그 밖(네트워크 끊김·응답 지연 등) — api-client가 붙인 한국어 문구가 있으면 그것을.
  return userFacingMessage(e) ?? '전송하지 못했어요. 다시 시도해 주세요.';
}

export default function RecallChatScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const keyboardOpen = useKeyboardOpen();
  const params = useLocalSearchParams<{
    label?: string;
    age?: string;
    periodStart?: string;
    periodEnd?: string;
    mode?: string;
    focusWord?: string;
    start?: string;
  }>();
  const token = useAuthStore((s) => s.token);
  const balance = useAuthStore((s) => s.user?.balance ?? 0);
  const setBalance = useAuthStore((s) => s.setBalance);
  const { show } = useToast();
  const addEntry = useJournalStore((s) => s.addEntry);

  const mode: 'free' | 'question' = params.mode === 'question' ? 'question' : 'free';
  const focusWord = params.focusWord;

  const [messages, setMessages] = useState<RecallMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redefineOpen, setRedefineOpen] = useState(false);
  // 이번 대화에서 이미 다시 정의했는가 — 막대를 완료 상태로 바꿔 같은 정의가 두 번 저장되지 않게.
  const [redefined, setRedefined] = useState(false);
  // 잉크가 모자라 막혔는가(402). 에러 문구만으로는 "광고로 채울 수 있다"를 보여줄 수 없어
  // 별 상태로 둔다 — 이 자리에 광고 버튼을 더하려면 이유를 알아야 한다.
  const [needInk, setNeedInk] = useState(false);
  const startedRef = useRef(false); // 첫 요청 = 새 대화(차감)
  const conversationTokenRef = useRef<string | undefined>(undefined); // 서버 발급 이어하기 토큰
  const listRef = useRef<FlatList<RecallMessage>>(null);

  // 나가기 확인 — 잉크를 쓴 대화(ephemeral)라 실수로 나가면 통째로 사라짐.
  // usePreventRemove로 모든 나가기 경로(헤더 back·스와이프·하드웨어 back)를 가로챈다.
  // 왜 beforeRemove 리스너가 아니라 이 훅인가: native-stack은 iOS 뒤로 스와이프를 **미리 알아야**
  // 막을 수 있다. 리스너는 이미 스와이프가 끝난 뒤에 불려 화면만 사라지고 확인창은 못 띄웠다.
  const navigation = useNavigation();
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  // 대화가 생겼는가(= 서버가 대화 토큰을 줬다 = 잉크를 썼다). 훅에 넘기려고 state로 둔다.
  const [hasConversation, setHasConversation] = useState(false);
  // 액션 타입은 dispatch 시그니처에서 유도.
  const pendingExitRef = useRef<Parameters<typeof navigation.dispatch>[0] | null>(null);

  usePreventRemove(hasConversation, ({ data }) => {
    pendingExitRef.current = data.action;
    setExitConfirmOpen(true);
  });

  // 막혔던 그 액션을 그대로 다시 보내면 훅이 통과시킨다(react-navigation 계약).
  const confirmExit = () => {
    if (pendingExitRef.current) navigation.dispatch(pendingExitRef.current);
  };

  const filter: RecallFilter = params.age
    ? { age: Number(params.age) }
    : { periodStart: params.periodStart, periodEnd: params.periodEnd };

  // 질문모드: 과거의 내가 먼저 질문(messages:[]). 마운트 시 자동, 실패하면 "다시 시도"로 다시 부른다.
  const askFirst = () => {
    if (mode !== 'question' || startedRef.current || !token) return;
    startedRef.current = true;
    setSending(true);
    setError(null);
    recallChat(token, { filter, messages: [], conversationToken: conversationTokenRef.current, mode: 'question', focusWord })
      .then((res) => {
        applyBalance(res.balance, res.conversationToken);
        setMessages([{ role: 'assistant', content: res.message }]);
      })
      .catch((e) => {
        startedRef.current = false; // 실패 → 재시도 여지
        setError(mapError(e));
        setNeedInk((e as ApiError).status === 402);
      })
      .finally(() => {
        setSending(false);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 120);
      });
  };
  // 자동 시작은 회상 화면에서 막 들어왔을 때 한 번만. 아니면(새로고침 등) 버튼으로 직접 시작한다.
  const [needsStart, setNeedsStart] = useState(false);
  useEffect(() => {
    if (mode !== 'question' || startedRef.current) return;
    if (takeStart(params.start)) askFirst();
    else setNeedsStart(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * 서버가 준 잔액으로 갈아 끼운다. 잔액이 줄었으면(= 이번 응답에서 대화 값이 빠졌다) 말해 준다 —
   * 헤더 숫자만 조용히 바뀌면 30잉크가 어디로 갔는지 모른다.
   * "첫 응답"을 따로 세지 않고 실제 차감을 기준으로 삼는다: 서버가 안 뺐는데 뺐다고 말하지 않게.
   */
  function applyBalance(next: number, newToken: string) {
    // 서버는 새 대화(= 새 토큰 발급)일 때만 잉크를 뺀다. 기기 잔액끼리 비교하면 다른 기기에서 쓴 만큼
    // 줄어든 것도 "썼어요"로 오해한다 → 토큰이 바뀌었는지로 판정한다.
    const charged = newToken !== conversationTokenRef.current;
    conversationTokenRef.current = newToken;
    setHasConversation(true);
    setBalance(next);
    if (charged) show(`잉크 ${RECALL_COST}개를 썼어요`);
  }

  const send = async () => {
    const text = input.trim();
    if (!text || sending || !token) return;
    const next: RecallMessage[] = [...messages, { role: 'user', content: text }];
    // 서버는 한 대화를 20왕복까지만 받는다 — 보내 봐야 거절될 요청은 보내지 않고 이유를 말한다.
    if (next.length > HISTORY_MAX) {
      setError(CONVERSATION_DONE);
      return;
    }
    setMessages(next);
    setInput('');
    setSending(true);
    setError(null);
    setNeedInk(false);
    // 내가 보낸 메시지도 즉시 맨 아래로 — "생각하는 중"이 동시에 뜨며 어긋나지 않게 보정.
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
    try {
      const res = await recallChat(token, {
        filter,
        messages: next,
        conversationToken: conversationTokenRef.current,
        mode,
        focusWord,
      });
      startedRef.current = true;
      applyBalance(res.balance, res.conversationToken);
      setMessages((m) => [...m, { role: 'assistant', content: res.message }]);
    } catch (e) {
      setMessages((m) => m.slice(0, -1));
      setInput(text);
      setError(mapError(e));
      setNeedInk((e as ApiError).status === 402);
    } finally {
      setSending(false);
      // "생각하는 중" 표시가 사라지며 레이아웃이 바뀌어 onContentSizeChange 스크롤이
      // 중간에 어긋날 수 있음 → 정착 후 한 번 더 맨 아래로(긴 답장도 끝까지 보이게).
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 120);
    }
  };

  /**
   * 저장은 로컬 즉시 기록이라 실패 경로가 없다 → 성공을 분명히 말한다.
   * 전엔 시트만 내려가고 막대가 그대로라, 저장됐는지 몰라 한 번 더 눌러 중복 저장이 생겼다.
   */
  const handleRedefine = (text: string) => {
    if (!focusWord || redefined) return;
    addEntry(focusWord, text);
    setRedefined(true);
    hapticSuccess();
    show(`'${focusWord}' 새 정의를 단어장에 담았어요`);
  };

  // 과거의 나 말풍선 = 빛바랜 종이(sepia) 톤.
  const sepiaBg = theme.mode === 'dark' ? '#332C22' : '#EFE4CF';
  const sepiaBorder = theme.mode === 'dark' ? '#463C2C' : '#E4D5BB';

  return (
    <ThemedView bg="paper" style={{ flex: 1 }}>
      <ScreenHeader
        title={params.label ?? '회상'}
        subtitle="생성형 AI 활용"
        bordered
        right={<InkBalanceChip balance={balance} />}
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          ref={listRef}
          // flex:1로 리스트 자체가 스크롤 뷰포트가 돼야 scrollToEnd가 먹는다.
          // (없으면 리스트가 내용만큼 늘어나 페이지가 스크롤되고, scrollToEnd는 무효)
          style={styles.fill}
          data={messages}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={styles.list}
          // 새 메시지로 콘텐츠가 길어질 때마다 최신 말풍선까지 스르륵 스크롤(항상 부드럽게).
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => {
            const isUser = item.role === 'user';
            const bubble = (
              <View
                style={[
                  styles.bubble,
                  isUser
                    ? { alignSelf: 'flex-end', backgroundColor: theme.colors.point.p600 }
                    : {
                        alignSelf: 'flex-start',
                        backgroundColor: sepiaBg,
                        borderColor: sepiaBorder,
                        borderWidth: 1,
                      },
                ]}
              >
                <ThemedText
                  variant="body"
                  // 마음에 드는 답변을 복사할 수 있게 — 길게 눌러 선택/복사(RN Text 기본은 선택 불가).
                  selectable
                  style={{ color: isUser ? theme.colors.paper.base : theme.colors.ink.primary }}
                >
                  {item.content}
                </ThemedText>
              </View>
            );
            // 과거의 나(assistant) 답변은 통째로 스르륵 등장. 내가 친 말(user)은 즉시.
            return isUser ? bubble : <FadeIn>{bubble}</FadeIn>;
          }}
          ListEmptyComponent={
            <ThemedText variant="body" tone="placeholder" style={{ textAlign: 'center', marginTop: 40 }}>
              {mode !== 'question'
                ? '그 시절의 나에게 말을 걸어보세요.'
                : needsStart
                  ? '과거의 내가 질문을 건넬 준비를 하고 있어요.'
                  : '과거의 내가 곧 말을 걸어요…'}
            </ThemedText>
          }
        />

        {sending && (
          <View style={styles.sendingRow}>
            <Loading message="과거의 내가 생각하는 중…" inline />
          </View>
        )}
        {error && (
          <ThemedText variant="caption" style={{ color: theme.colors.ruby.base, textAlign: 'center', paddingHorizontal: 16, paddingBottom: 8 }}>
            {error}
          </ThemedText>
        )}
        {/* 질문모드 첫 질문을 받을 버튼 — 실패했을 때(보낼 입력이 없어 다시 시도할 길이 없었다)와
            자동 시작을 하지 않은 재진입(새로고침 등) 때. 누르면 새 대화라 잉크가 든다고 미리 말한다. */}
        {(error || needsStart) && !needInk && !sending && mode === 'question' && messages.length === 0 && (
          <View style={styles.retryRow}>
            <Button
              label={error ? '다시 시도' : `질문 받기 · 잉크 ${RECALL_COST}개`}
              variant="ghost"
              onPress={askFirst}
            />
          </View>
        )}
        {/* 잉크가 모자라 막힌 자리 — 가장 필요한 순간에 바로 채울 수 있게.
            위 문구("잉크 30개가 필요해요 · 출석으로 모아보세요")를 대체하지 않고 더한다. */}
        {needInk && <WatchAdButton style={styles.watchAd} />}

        {/* 질문모드: 그 단어 다시 정의. 저장 뒤엔 누를 수 없는 완료 표시로 바뀐다
            (기록 화면 글자 수 체크 뱃지와 같은 p100 바탕·p700 글자 — "됐다"의 같은 말). */}
        {focusWord && redefined && (
          <FadeIn key="redefined" offset={4} style={[styles.redefineBar, styles.redefineDone, { borderTopColor: theme.colors.line.base }]}>
            <View style={[styles.doneBadge, { backgroundColor: theme.colors.point.p100 }]}>
              <Icon name="check" size={14} color={theme.colors.point.p700} strokeWidth={2.4} />
              <ThemedText variant="bodyMd" style={{ color: theme.colors.point.p700, fontWeight: '700' }}>
                다시 정의했어요
              </ThemedText>
            </View>
          </FadeIn>
        )}
        {focusWord && !redefined && (
          <PressableScale
            onPress={() => setRedefineOpen(true)}
            style={[styles.redefineBar, { borderTopColor: theme.colors.line.base }]}
          >
            <Icon name="edit" size={16} color={theme.colors.point.p600} />
            <ThemedText variant="bodyMd" style={{ color: theme.colors.point.p600, fontWeight: '700' }}>
              '{focusWord}' 지금 다시 정의하기
            </ThemedText>
          </PressableScale>
        )}

        <View
          style={[
            styles.inputRow,
            // 키보드가 닫혀 있으면 홈 인디케이터만큼 띄운다 — 안 띄우면 입력칸이 화면 끝에 붙어 누르기 불편했다.
            // 열려 있으면 키보드가 그 자리를 덮으니 기본 여백만(인셋까지 더하면 키보드 위에 빈 띠가 생긴다).
            { borderTopColor: theme.colors.line.base, paddingBottom: keyboardOpen ? 12 : Math.max(16, insets.bottom + 8) },
          ]}
        >
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="메시지 입력…"
            placeholderTextColor={theme.colors.ink.placeholder}
            style={[styles.input, { backgroundColor: theme.colors.surface.base, borderColor: theme.colors.line.base, color: theme.colors.ink.primary }]}
            multiline
            maxLength={MESSAGE_MAX}
            editable={!sending}
          />
          <PressableScale
            onPress={send}
            disabled={sending || input.trim().length === 0}
            accessibilityRole="button"
            accessibilityLabel="보내기"
            // 비활성인 이유까지 읽히게 — 낭독기는 색을 보지 못한다.
            accessibilityState={{ disabled: sending || input.trim().length === 0 }}
            style={[styles.sendBtn, { backgroundColor: input.trim().length === 0 ? theme.colors.surface.nested : theme.colors.point.p600 }]}
          >
            <Icon name="send" size={20} color={input.trim().length === 0 ? theme.colors.ink.placeholder : theme.colors.paper.base} />
          </PressableScale>
        </View>
      </KeyboardAvoidingView>

      {focusWord && (
        <RedefineSheet
          visible={redefineOpen}
          word={focusWord}
          onSave={handleRedefine}
          onClose={() => setRedefineOpen(false)}
        />
      )}

      <ConfirmDialog
        visible={exitConfirmOpen}
        title="회상을 끝낼까요?"
        message={`이 대화는 사라져요.\n다시 하려면 잉크 ${RECALL_COST}개가 필요해요.`}
        confirmLabel="나가기"
        cancelLabel="계속 대화"
        onConfirm={confirmExit}
        onClose={() => setExitConfirmOpen(false)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  list: { padding: 16, gap: 10 },
  bubble: { maxWidth: '82%', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 18 },
  watchAd: { paddingHorizontal: 16, paddingBottom: 10 },
  retryRow: { alignItems: 'center', paddingBottom: 8 },
  sendingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingBottom: 8 },
  // 뱃지 높이만큼 위아래 여백을 줄여 막대 전체 높이를 유지(완료로 바뀔 때 입력창이 밀리지 않게).
  redefineDone: { paddingVertical: 6 },
  doneBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 12, borderRadius: 999 },
  redefineBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderTopWidth: 1 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12, borderTopWidth: 1 },
  input: { flex: 1, minHeight: 44, maxHeight: 120, borderRadius: 22, borderWidth: 1, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
