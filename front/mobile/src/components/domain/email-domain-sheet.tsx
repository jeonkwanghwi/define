/**
 * EmailDomainSheet — 가입 시 이메일 도메인을 빠르게 고르는 바텀시트.
 *
 * YearPickerSheet와 동일 UX 규약(슬라이드업 + scrim 탭 닫기 + grip).
 * 자주 쓰는 도메인은 탭 한 번(오타 0). 목록에 없는 회사·학교 이메일은
 * 도메인 칸에 직접 입력 — 그래서 하드 화이트리스트가 아니라 "빠른 선택"일 뿐이다.
 *
 * 사용:
 *   <EmailDomainSheet visible={open} current={domain} onSelect={setDomain} onClose={...} />
 */
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/icons';
import { useTheme } from '@/theme';

/** 국내에서 흔한 도메인만 — 목록 밖은 직접 입력. */
export const COMMON_EMAIL_DOMAINS = [
  'naver.com',
  'gmail.com',
  'daum.net',
  'nate.com',
  'kakao.com',
  'hanmail.net',
];

const ITEM_HEIGHT = 52;

export type EmailDomainSheetProps = {
  visible: boolean;
  current: string;
  onSelect: (domain: string) => void;
  onClose: () => void;
};

export function EmailDomainSheet({ visible, current, onSelect, onClose }: EmailDomainSheetProps) {
  const theme = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        style={[styles.scrim, { backgroundColor: theme.colors.scrim }]}
        onPress={onClose}
      >
        <Pressable
          onPress={() => {
            /* 내부 탭이 scrim으로 전파되어 닫히지 않게 차단 */
          }}
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.surface.base,
              borderTopLeftRadius: theme.radii.xl,
              borderTopRightRadius: theme.radii.xl,
            },
          ]}
        >
          <View style={[styles.grip, { backgroundColor: theme.colors.line.strong }]} />
          <ThemedText variant="h3" style={{ marginBottom: theme.spacing.s1 }}>
            이메일 도메인
          </ThemedText>
          <ThemedText variant="caption" tone="placeholder" style={{ marginBottom: theme.spacing.s4 }}>
            목록에 없으면 도메인 칸에 직접 입력하세요.
          </ThemedText>

          {COMMON_EMAIL_DOMAINS.map((domain) => {
            const on = domain === current;
            return (
              <Pressable
                key={domain}
                onPress={() => {
                  onSelect(domain);
                  onClose();
                }}
                style={({ pressed }) => [
                  styles.item,
                  { borderRadius: theme.radii.md },
                  on && { backgroundColor: theme.colors.point.p050 },
                  pressed && !on && { backgroundColor: theme.colors.surface.nested },
                ]}
              >
                <ThemedText
                  variant="bodyMd"
                  style={{
                    color: on ? theme.colors.point.p600 : theme.colors.ink.primary,
                    fontWeight: on ? '700' : '400',
                  }}
                >
                  {domain}
                </ThemedText>
                {on ? <Icon name="check" size={18} color={theme.colors.point.p600} /> : null}
              </Pressable>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 28,
  },
  grip: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 18,
  },
  item: {
    height: ITEM_HEIGHT,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
