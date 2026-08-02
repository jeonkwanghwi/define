/**
 * /recall-chat — 과거의 나와 ephemeral 채팅. 탭 밖 풀스크린.
 * mode='free'면 사용자 먼저, mode='question'면 과거의 내가 먼저 질문(마운트 시 자동).
 * 질문모드는 focusWord를 "다시 정의" 버튼으로 즉시 재정의(새 엔트리).
 */
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { InkBalanceChip } from '@/components/domain/ink-balance-chip';
import { ConfirmDialog } from '@/components/primitives/confirm-dialog';
import { RedefineSheet } from '@/components/domain/redefine-sheet';
import { ScreenHeader } from '@/components/domain/screen-header';
import { FadeIn, PressableScale } from '@/components/primitives';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { RECALL_COST } from '@/constants/recall';
import { Icon } from '@/icons';
import { recallChat, type RecallFilter, type RecallMessage } from '@/services/recall-api';
import { useAuthStore } from '@/store/auth-store';
import { useJournalStore } from '@/store/journal-store';
import { useTheme } from '@/theme';

type ApiError = { status: number; message: string };

function mapError(e: unknown): string {
  const err = e as ApiError;
  if (err.status === 402) return `잉크 ${RECALL_COST}개가 필요해요 · 출석으로 모아보세요`;
  if (err.status === 503) return '지금은 회상을 시작할 수 없어요. 잠시 후 다시 시도해 주세요.';
  if (err.status === 403) return '회상을 시작하려면 동의가 필요해요. 이전 화면에서 다시 시작해 주세요.';
  return '전송하지 못했어요. 다시 시도해 주세요.';
}

export default function RecallChatScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{
    label?: string;
    age?: string;
    periodStart?: string;
    periodEnd?: string;
    mode?: string;
    focusWord?: string;
  }>();
  const token = useAuthStore((s) => s.token);
  const balance = useAuthStore((s) => s.user?.balance ?? 0);
  const setBalance = useAuthStore((s) => s.setBalance);
  const addEntry = useJournalStore((s) => s.addEntry);

  const mode: 'free' | 'question' = params.mode === 'question' ? 'question' : 'free';
  const focusWord = params.focusWord;

  const [messages, setMessages] = useState<RecallMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redefineOpen, setRedefineOpen] = useState(false);
  const startedRef = useRef(false); // 첫 요청 = 새 대화(차감)
  const conversationTokenRef = useRef<string | undefined>(undefined); // 서버 발급 이어하기 토큰
  const listRef = useRef<FlatList<RecallMessage>>(null);

  // 나가기 확인 — 잉크를 쓴 대화(ephemeral)라 실수로 나가면 통째로 사라짐.
  // beforeRemove로 모든 나가기 경로(헤더 back·스와이프·하드웨어 back)를 가로챈다.
  const navigation = useNavigation();
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  // 액션 타입은 dispatch 시그니처에서 유도(@react-navigation/native는 직접 의존성이 아님).
  const pendingExitRef = useRef<Parameters<typeof navigation.dispatch>[0] | null>(null);
  const allowExitRef = useRef(false);

  useEffect(() => {
    return navigation.addListener('beforeRemove', (e) => {
      // 대화 시작 전(잉크 미차감)이거나 이미 확인했으면 그냥 나감.
      if (!startedRef.current || allowExitRef.current) return;
      e.preventDefault();
      pendingExitRef.current = e.data.action;
      setExitConfirmOpen(true);
    });
  }, [navigation]);

  const confirmExit = () => {
    allowExitRef.current = true;
    if (pendingExitRef.current) navigation.dispatch(pendingExitRef.current);
  };

  const filter: RecallFilter = params.age
    ? { age: Number(params.age) }
    : { periodStart: params.periodStart, periodEnd: params.periodEnd };

  // 질문모드: 마운트 시 과거의 내가 먼저 질문(messages:[]).
  useEffect(() => {
    if (mode !== 'question' || startedRef.current || !token) return;
    startedRef.current = true;
    setSending(true);
    setError(null);
    recallChat(token, { filter, messages: [], conversationToken: conversationTokenRef.current, mode: 'question', focusWord })
      .then((res) => {
        conversationTokenRef.current = res.conversationToken;
        setBalance(res.balance);
        setMessages([{ role: 'assistant', content: res.message }]);
      })
      .catch((e) => {
        startedRef.current = false; // 실패 → 재시도 여지
        setError(mapError(e));
      })
      .finally(() => {
        setSending(false);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 120);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = async () => {
    const text = input.trim();
    if (!text || sending || !token) return;
    const next: RecallMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setSending(true);
    setError(null);
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
      conversationTokenRef.current = res.conversationToken;
      setBalance(res.balance);
      setMessages((m) => [...m, { role: 'assistant', content: res.message }]);
    } catch (e) {
      setMessages((m) => m.slice(0, -1));
      setInput(text);
      setError(mapError(e));
    } finally {
      setSending(false);
      // "생각하는 중" 표시가 사라지며 레이아웃이 바뀌어 onContentSizeChange 스크롤이
      // 중간에 어긋날 수 있음 → 정착 후 한 번 더 맨 아래로(긴 답장도 끝까지 보이게).
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 120);
    }
  };

  const handleRedefine = (text: string) => {
    if (focusWord) addEntry(focusWord, text);
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
              {mode === 'question' ? '과거의 내가 곧 말을 걸어요…' : '그 시절의 나에게 말을 걸어보세요.'}
            </ThemedText>
          }
        />

        {sending && (
          <View style={styles.sendingRow}>
            <ActivityIndicator color={theme.colors.point.p600} />
            <ThemedText variant="caption" tone="placeholder" style={{ marginLeft: 8 }}>
              과거의 내가 생각하는 중…
            </ThemedText>
          </View>
        )}
        {error && (
          <ThemedText variant="caption" style={{ color: theme.colors.ruby.base, textAlign: 'center', paddingHorizontal: 16, paddingBottom: 8 }}>
            {error}
          </ThemedText>
        )}

        {/* 질문모드: 그 단어 다시 정의 */}
        {focusWord && (
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

        <View style={[styles.inputRow, { borderTopColor: theme.colors.line.base }]}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="메시지 입력…"
            placeholderTextColor={theme.colors.ink.placeholder}
            style={[styles.input, { backgroundColor: theme.colors.surface.base, borderColor: theme.colors.line.base, color: theme.colors.ink.primary }]}
            multiline
            editable={!sending}
          />
          <PressableScale
            onPress={send}
            disabled={sending || input.trim().length === 0}
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
        message={`나가면 이 대화는 사라져요.\n다시 시작하려면 잉크 ${RECALL_COST}이 필요해요.`}
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
  sendingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingBottom: 8 },
  redefineBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderTopWidth: 1 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12, borderTopWidth: 1 },
  input: { flex: 1, minHeight: 44, maxHeight: 120, borderRadius: 22, borderWidth: 1, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
