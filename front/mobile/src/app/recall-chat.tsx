/**
 * /recall-chat — 과거의 나와 ephemeral 채팅. 탭 밖 풀스크린(mypage 패턴).
 * 대화는 컴포넌트 state로만 보유(나가면 소멸). 첫 전송 isNewConversation:true → 30잉크 차감.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
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

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { RECALL_COST } from '@/constants/recall';
import { Icon } from '@/icons';
import { recallChat, type RecallFilter, type RecallMessage } from '@/services/recall-api';
import { useAuthStore } from '@/store/auth-store';
import { useTheme } from '@/theme';

type ApiError = { status: number; message: string };

export default function RecallChatScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{
    label?: string;
    age?: string;
    periodStart?: string;
    periodEnd?: string;
  }>();
  const token = useAuthStore((s) => s.token);
  const balance = useAuthStore((s) => s.user?.balance ?? 0);
  const setBalance = useAuthStore((s) => s.setBalance);

  const [messages, setMessages] = useState<RecallMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false); // 첫 전송 = 새 대화(차감)

  const filter: RecallFilter = params.age
    ? { age: Number(params.age) }
    : { periodStart: params.periodStart, periodEnd: params.periodEnd };

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
        mode: 'free',
      });
      startedRef.current = true;
      setBalance(res.balance);
      setMessages((m) => [...m, { role: 'assistant', content: res.message }]);
    } catch (e) {
      const err = e as ApiError;
      // 전송 실패 → 방금 보낸 user 메시지 롤백(다시 시도 가능)
      setMessages((m) => m.slice(0, -1));
      setInput(text);
      if (err.status === 402) {
        setError(`잉크 ${RECALL_COST}개가 필요해요 · 출석으로 모아보세요`);
      } else if (err.status === 503) {
        setError('지금 과거의 나를 부를 수 없어요. 잠시 후 다시 시도해 주세요.');
      } else {
        setError('전송하지 못했어요. 다시 시도해 주세요.');
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <ThemedView bg="paper" style={{ flex: 1 }}>
      {/* 헤더 */}
      <View style={[styles.header, { borderBottomColor: theme.colors.line.base }]}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Icon name="back" size={24} color={theme.colors.ink.strong} />
        </Pressable>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <ThemedText variant="bodyMd" style={{ fontWeight: '700' }}>
            {params.label ?? '과거의 나'}
          </ThemedText>
          <ThemedText variant="caption" tone="placeholder">
            생성형 AI 활용
          </ThemedText>
        </View>
        <View style={styles.inkChip}>
          <Icon name="ruby" size={14} color={theme.colors.ruby.base} />
          <ThemedText variant="sm" style={{ color: theme.colors.ink.secondary, fontWeight: '700' }}>
            {balance}
          </ThemedText>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
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
            <ThemedText
              variant="body"
              tone="placeholder"
              style={{ textAlign: 'center', marginTop: 40, lineHeight: 24 }}
            >
              그 시절의 나에게 말을 걸어보세요.
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
          <ThemedText
            variant="caption"
            style={{ color: theme.colors.ruby.base, textAlign: 'center', paddingHorizontal: 16, paddingBottom: 8 }}
          >
            {error}
          </ThemedText>
        )}

        {/* 입력 */}
        <View style={[styles.inputRow, { borderTopColor: theme.colors.line.base }]}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="메시지 입력…"
            placeholderTextColor={theme.colors.ink.placeholder}
            style={[
              styles.input,
              { backgroundColor: theme.colors.surface.base, borderColor: theme.colors.line.base, color: theme.colors.ink.primary },
            ]}
            multiline
            editable={!sending}
          />
          <Pressable
            onPress={send}
            disabled={sending || input.trim().length === 0}
            style={[
              styles.sendBtn,
              { backgroundColor: input.trim().length === 0 ? theme.colors.surface.nested : theme.colors.point.p600 },
            ]}
          >
            <Icon name="send" size={20} color={input.trim().length === 0 ? theme.colors.ink.placeholder : theme.colors.paper.base} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, borderBottomWidth: 1 },
  inkChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999 },
  list: { padding: 16, gap: 10 },
  bubble: { maxWidth: '82%', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 18 },
  sendingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingBottom: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12, borderTopWidth: 1 },
  input: { flex: 1, minHeight: 44, maxHeight: 120, borderRadius: 22, borderWidth: 1, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
