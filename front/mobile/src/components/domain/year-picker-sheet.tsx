/**
 * YearPickerSheet — 출생연도를 고르는 바텀시트 드롭다운.
 *
 * NicknameSheet와 동일한 UX 규약(슬라이드업 + scrim 탭 닫기 + grip).
 * 직접 입력 대신 리스트에서 탭 한 번으로 선택 — 프로필 설정의 입력 마찰 줄이기.
 *
 * 리스트는 최신 연도부터 내림차순(1900~가입 가능한 마지막 해). 열릴 때 현재 선택(없으면 1996) 근처로
 * 스크롤해 시작 — 4자리 타이핑보다 빠르게 자기 연도에 닿는 게 목적.
 *
 * 사용:
 *   <YearPickerSheet visible={open} current={year} onSelect={setYear} onClose={...} />
 */
import { useMemo } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';

/**
 * 만 14세 미만은 가입할 수 없다(개인정보보호법 22조의2 — 법정대리인 동의가 필요해진다).
 * 연도만 받으니 생일이 지났는지 모른다 → **올해 아직 13살일 수 있는 사람까지 막는다.**
 * 올해 − 출생연도 ≥ 15 인 해만 보여준다. 백엔드 UpdateProfileDto와 같은 규칙.
 */
const MIN_AGE_GAP = 15;
// 상수로 박아 두면 해가 바뀔 때마다 고쳐야 한다 — 앱이 켜질 때의 올해로 계산.
const LATEST_YEAR = new Date().getFullYear() - MIN_AGE_GAP;
const MIN_YEAR = 1900;
const YEARS = Array.from({ length: LATEST_YEAR - MIN_YEAR + 1 }, (_, i) => LATEST_YEAR - i);

const ITEM_HEIGHT = 52;
/** 미선택 시 스크롤 시작점 — placeholder 예시와 같은 연도. */
const DEFAULT_YEAR = 1996;

export type YearPickerSheetProps = {
  visible: boolean;
  current: number | null;
  onSelect: (year: number) => void;
  onClose: () => void;
};

export function YearPickerSheet({ visible, current, onSelect, onClose }: YearPickerSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // 선택 연도(없으면 기본)가 리스트 중간쯤 오도록 시작 인덱스를 위로 2칸 당김.
  const initialIndex = useMemo(() => {
    const target = YEARS.indexOf(current ?? DEFAULT_YEAR);
    return Math.max(0, target - 2);
  }, [current]);

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
          <ThemedText variant="h3" style={{ marginBottom: theme.spacing.s4 }}>
            출생연도
          </ThemedText>

          <FlatList
            data={YEARS}
            keyExtractor={(y) => String(y)}
            initialScrollIndex={initialIndex}
            getItemLayout={(_, index) => ({
              length: ITEM_HEIGHT,
              offset: ITEM_HEIGHT * index,
              index,
            })}
            showsVerticalScrollIndicator={false}
            // 목록 끝이 홈 인디케이터에 걸리지 않게 그만큼 더 띄운다.
            style={[styles.list, { marginBottom: 24 + insets.bottom }]}
            renderItem={({ item: y }) => {
              const on = y === current;
              return (
                <Pressable
                  onPress={() => {
                    onSelect(y);
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
                    variant="label"
                    style={{
                      color: on ? theme.colors.point.p600 : theme.colors.ink.primary,
                      // 고르는 글이라 산세리프 — 명조 Bold(bodyMd)엔 굵기 차이가 먹지 않았다.
                      fontWeight: on ? '700' : '500',
                    }}
                  >
                    {y}
                  </ThemedText>
                  {on ? <Icon name="check" size={18} color={theme.colors.point.p600} /> : null}
                </Pressable>
              );
            }}
          />
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
    // 리스트가 화면을 다 덮지 않게 — 다른 시트들보다 콘텐츠가 길어 높이 상한을 둠.
    maxHeight: '55%',
  },
  grip: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 18,
  },
  list: { marginBottom: 24 },
  item: {
    height: ITEM_HEIGHT,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
