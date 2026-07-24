/**
 * EmailDomainDropdown — 가입 이메일 도메인을 도메인 박스 바로 아래로 펼치는 앵커드 드롭다운.
 *
 * 바텀시트(EmailDomainSheet)와 달리 필드에 붙어 "스르륵" 내려온다(FadeIn offset 음수).
 * 부모가 position:relative + 충분한 zIndex를 주고, 이 컴포넌트를 절대배치 style로 앉힌다.
 * 흔한 도메인은 탭 한 번(오타 0), 목록 밖은 도메인 칸에 직접 입력.
 *
 * 사용:
 *   <EmailDomainDropdown visible={open} current={domain} onSelect={setDomain}
 *     onClose={...} style={styles.emailDropdown} />
 */
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { FadeIn } from '@/components/primitives';
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

export type EmailDomainDropdownProps = {
  visible: boolean;
  current: string;
  onSelect: (domain: string) => void;
  /** "직접 입력" 선택 — 부모가 도메인 칸을 편집 모드로 전환. */
  onCustom: () => void;
  onClose: () => void;
  /** 부모 기준 절대배치(top/left/right) — 도메인 박스 바로 아래로. */
  style?: StyleProp<ViewStyle>;
};

export function EmailDomainDropdown({
  visible,
  current,
  onSelect,
  onCustom,
  onClose,
  style,
}: EmailDomainDropdownProps) {
  const theme = useTheme();
  if (!visible) return null;

  return (
    <FadeIn
      offset={-6}
      style={[
        styles.card,
        theme.shadows.md,
        {
          backgroundColor: theme.colors.surface.base,
          borderColor: theme.colors.line.base,
          borderRadius: theme.radii.lg,
        },
        style,
      ]}
    >
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
            {on ? <Icon name="check" size={16} color={theme.colors.point.p600} /> : null}
          </Pressable>
        );
      })}

      {/* 목록 밖 도메인(회사·학교 등) — 편집 모드로 전환. */}
      <View style={[styles.divider, { backgroundColor: theme.colors.line.base }]} />
      <Pressable
        onPress={() => {
          onCustom();
          onClose();
        }}
        style={({ pressed }) => [
          styles.item,
          pressed && { backgroundColor: theme.colors.surface.nested },
        ]}
      >
        <ThemedText variant="bodyMd" style={{ color: theme.colors.point.p600, fontWeight: '600' }}>
          직접 입력
        </ThemedText>
        <Icon name="chevronR" size={16} color={theme.colors.point.p600} />
      </Pressable>
    </FadeIn>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    paddingVertical: 6,
    overflow: 'hidden',
  },
  item: {
    height: 46,
    marginHorizontal: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  divider: {
    height: 1,
    marginVertical: 4,
    marginHorizontal: 12,
  },
});
