/**
 * YearPickerSheet — 출생연도를 고르는 바텀시트 드롭다운.
 *
 * NicknameSheet와 동일한 UX 규약(슬라이드업 + scrim 탭 닫기 + grip).
 * 직접 입력 대신 리스트에서 탭 한 번으로 선택 — 프로필 설정의 입력 마찰 줄이기.
 *
 * 리스트는 최신 연도부터 내림차순(1900~올해). 열릴 때 현재 선택(없으면 1996) 근처로
 * 스크롤해 시작 — 4자리 타이핑보다 빠르게 자기 연도에 닿는 게 목적.
 *
 * 사용:
 *   <YearPickerSheet visible={open} current={year} onSelect={setYear} onClose={...} />
 */
import { useMemo } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/icons';
import { useTheme } from '@/theme';

const THIS_YEAR = 2026; // 백엔드 검증(1900~현재)과 동일. 매년 갱신 또는 추후 동적 계산.
const MIN_YEAR = 1900;
const YEARS = Array.from({ length: THIS_YEAR - MIN_YEAR + 1 }, (_, i) => THIS_YEAR - i);

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
            style={styles.list}
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
                    variant="bodyMd"
                    style={{
                      color: on ? theme.colors.point.p600 : theme.colors.ink.primary,
                      fontWeight: on ? '700' : '400',
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
