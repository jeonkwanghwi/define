/**
 * DateSheet — 날짜 선택 바텀시트.
 *
 * design-source의 DateSheet를 RN으로 포팅.
 *   - 월 navigation (◀ / ▶) — 다음 달이 이미 미래면 ▶ 비활성
 *   - 셀: 빈칸(이전 달) / 일자 / 오늘 강조(point 색) / 선택(point 채움) / 미래 비활성
 *   - 모든 선택은 미래 불가 (PLANNING.md 정책)
 *
 * 사용:
 *   <DateSheet
 *     visible={open}
 *     selected={date}
 *     onPick={setDate}
 *     onClose={() => setOpen(false)}
 *   />
 */
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/icons';
import { isSameDay } from '@/lib/format-date';
import { useTheme } from '@/theme';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

export type DateSheetProps = {
  visible: boolean;
  selected: Date;
  onPick: (d: Date) => void;
  onClose: () => void;
};

export function DateSheet({ visible, selected, onPick, onClose }: DateSheetProps) {
  const theme = useTheme();

  // 현재 보여주고 있는 월 (selected의 1일로 시작).
  // 시트가 다시 열릴 때마다 selected 기준으로 리셋해 사용자 기대에 맞춤.
  const [view, setView] = useState(
    () => new Date(selected.getFullYear(), selected.getMonth(), 1),
  );
  useEffect(() => {
    if (visible) {
      setView(new Date(selected.getFullYear(), selected.getMonth(), 1));
    }
  }, [visible, selected]);

  // 오늘 자정 — 미래 비교 기준 (시/분/초 영향 제거)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const year = view.getFullYear();
  const month = view.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // 그리드 셀 — 시작 요일까지 빈칸으로 채우고, 그 뒤로 1~말일 Date 객체
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  // 다음 달의 1일이 오늘 이전(혹은 같음)이어야 ▶ 활성 — 미래 달로 진입 차단
  const nextMonthFirst = new Date(year, month + 1, 1);
  const canNext = nextMonthFirst <= today;

  function handlePick(d: Date) {
    onPick(d);
    onClose();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* 외부 영역 탭 → 닫기. 시트 영역 탭은 stopPropagation 효과를 위해 별도 Pressable. */}
      <Pressable
        style={[styles.scrim, { backgroundColor: theme.colors.scrim }]}
        onPress={onClose}
      >
        <Pressable
          onPress={() => {
            /* 시트 내부 탭은 onClose가 부모로 전파되지 않게 — 빈 핸들러로 차단 */
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
          {/* 그립 — 끌어내릴 수 있다는 시각적 힌트(드래그 기능은 추후) */}
          <View
            style={[styles.grip, { backgroundColor: theme.colors.line.strong }]}
          />

          {/* 월 navigation */}
          <View style={styles.calHead}>
            <NavButton
              direction="left"
              onPress={() => setView(new Date(year, month - 1, 1))}
            />
            <ThemedText variant="h3">
              {year}년 {month + 1}월
            </ThemedText>
            <NavButton
              direction="right"
              disabled={!canNext}
              onPress={() => canNext && setView(new Date(year, month + 1, 1))}
            />
          </View>

          {/* 요일 헤더 */}
          <View style={styles.dowRow}>
            {WEEKDAYS.map((w) => (
              <View key={w} style={styles.dowCell}>
                <ThemedText variant="caption" tone="placeholder">
                  {w}
                </ThemedText>
              </View>
            ))}
          </View>

          {/* 날짜 그리드 */}
          <View style={styles.grid}>
            {cells.map((c, i) => {
              if (!c) {
                return <View key={`empty-${i}`} style={styles.cell} />;
              }
              const future = c > today;
              const isSel = isSameDay(c, selected);
              const isToday = isSameDay(c, today);

              return (
                <View key={i} style={styles.cell}>
                  <Pressable
                    disabled={future}
                    onPress={() => handlePick(c)}
                    style={[
                      styles.cellInner,
                      isSel && { backgroundColor: theme.colors.point.p600 },
                    ]}
                  >
                    <ThemedText
                      style={{
                        fontFamily: 'PretendardVariable',
                        fontSize: 14,
                        color: isSel
                          ? '#FFFFFF'
                          : isToday
                            ? theme.colors.point.p600
                            : theme.colors.ink.primary,
                        fontWeight: isSel || isToday ? '700' : '400',
                        opacity: future ? 0.3 : 1,
                      }}
                    >
                      {c.getDate()}
                    </ThemedText>
                  </Pressable>
                </View>
              );
            })}
          </View>

          <ThemedText
            variant="caption"
            tone="placeholder"
            style={{ textAlign: 'center', marginTop: 14 }}
          >
            미래 날짜는 선택할 수 없어요
          </ThemedText>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── 작은 헬퍼들 (파일 안에만 있는 컴포넌트라 분리 X) ───

function NavButton({
  direction,
  disabled,
  onPress,
}: {
  direction: 'left' | 'right';
  disabled?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={[
        styles.navBtn,
        {
          borderColor: theme.colors.line.base,
          backgroundColor: theme.colors.surface.base,
          opacity: disabled ? 0.3 : 1,
        },
      ]}
    >
      <Icon
        name={direction === 'left' ? 'chevronL' : 'chevronR'}
        size={20}
        color={theme.colors.ink.strong}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    paddingHorizontal: 24,
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
  calHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dowRow: { flexDirection: 'row', marginBottom: 6 },
  dowCell: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    padding: 2,
  },
  cellInner: {
    flex: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
