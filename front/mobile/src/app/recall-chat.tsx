/**
 * /recall-chat — 과거의 나와 ephemeral 채팅. 탭 밖 풀스크린.
 * mode='free'면 사용자 먼저, mode='question'면 과거의 내가 먼저 질문(마운트 시 자동).
 * 질문모드는 focusWord를 "다시 정의" 버튼으로 즉시 재정의(새 엔트리).
 */
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { InkBalanceChip } from '@/components/domain/ink-balance-chip';
import { RedefineSheet } from '@/components/domain/redefine-sheet';
import { ScreenHeader } from '@/components/domain/screen-header';
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
  if (err.status === 503) return '지금 과거의 나를 부를 수 없어요. 잠시 후 다시 시도해 주세요.';
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

  const filter: RecallFilter = params.age
    ? { age: Number(params.age) }
    : { periodStart: params.periodStart, periodEnd: params.periodEnd };

  // 질문모드: 마운트 시 과거의 내가 먼저 질문(messages:[]).
  useEffect(() => {
    if (mode !== 'question' || startedRef.current || !token) return;
    startedRef.current = true;
    setSending(true);
    setError(null);
    recallChat(token, { filter, messages: [], isNewConversation: true, mode: 'question', focusWord })
      .then((res) => {
        setBalance(res.balance);
        setMessages([{ role: 'assistant', content: res.message }]);
      })
      .catch((e) => {
        startedRef.current = false; // 실패 → 재시도 여지
        setError(mapError(e));
      })
      .finally(() => setSending(false));
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
    try {
      const res = await recallChat(token, {
        filter,
        messages: next,
        isNewConversation: !startedRef.current,
        mode,
        focusWord,
      });
      startedRef.current = true;
      setBalance(res.balance);
      setMessages((m) => [...m, { role: 'assistant', content: res.message }]);
    } catch (e) {
      setMessages((m) => m.slice(0, -1));
      setInput(text);
      setError(mapError(e));
    } finally {
      setSending(false);
    }
  };

  const handleRedefine = (text: string) => {
    if (focusWord) addEntry(focusWord, text);
  };

  return (
    <ThemedView bg="paper" style={{ flex: 1 }}>
      <ScreenHeader
        title={params.label ?? '과거의 나'}
        subtitle="생성형 AI 활용"
        bordered
        right={<InkBalanceChip balance={balance} />}
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          data={messages}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View
              style={[
                styles.bubble,
                item.role === 'user'
                  ? { alignSelf: 'flex-end', backgroundColor: theme.colors.point.p600 }
                  : { alignSelf: 'flex-start', backgroundColor: theme.colors.surface.nested },
              ]}
            >
              <ThemedText
                variant="body"
                style={{ color: item.role === 'user' ? theme.colors.paper.base : theme.colors.ink.primary, lineHeight: 22 }}
              >
                {item.content}
              </ThemedText>
            </View>
          )}
          ListEmptyComponent={
            <ThemedText variant="body" tone="placeholder" style={{ textAlign: 'center', marginTop: 40, lineHeight: 24 }}>
              {mode === 'question' ? '과거의 내가 곧 말을 걸어요…' : '그 시절의 나에게 말을 걸어보세요.'}
            </ThemedText>
          }
        />

        {sending && (
          <View style={styles.sendingRow}>
            <ActivityIndicator color={theme.colors.point.p600} />
            <ThemedText variant="caption" tone="placeholder" style={{ marginLeft: 8 }}>
              과거의 나가 생각하는 중…
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
          <Pressable
            onPress={() => setRedefineOpen(true)}
            style={[styles.redefineBar, { borderTopColor: theme.colors.line.base }]}
          >
            <Icon name="edit" size={16} color={theme.colors.point.p600} />
            <ThemedText variant="bodyMd" style={{ color: theme.colors.point.p600, fontWeight: '700' }}>
              '{focusWord}' 지금 다시 정의하기
            </ThemedText>
          </Pressable>
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
          <Pressable
            onPress={send}
            disabled={sending || input.trim().length === 0}
            style={[styles.sendBtn, { backgroundColor: input.trim().length === 0 ? theme.colors.surface.nested : theme.colors.point.p600 }]}
          >
            <Icon name="send" size={20} color={input.trim().length === 0 ? theme.colors.ink.placeholder : theme.colors.paper.base} />
          </Pressable>
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
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 10 },
  bubble: { maxWidth: '82%', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 18 },
  sendingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingBottom: 8 },
  redefineBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderTopWidth: 1 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12, borderTopWidth: 1 },
  input: { flex: 1, minHeight: 44, maxHeight: 120, borderRadius: 22, borderWidth: 1, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
