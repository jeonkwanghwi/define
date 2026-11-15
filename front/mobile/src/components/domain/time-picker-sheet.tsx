/**
 * TimePickerSheet — 하루 한 줄 알림 시각을 고르는 시트.
 *
 * iOS: YearPickerSheet와 같은 바텀시트(슬라이드업 + scrim 탭 닫기 + grip) 안에 시스템 시간 휠.
 *   휠을 돌리는 동안은 임시 값만 바뀌고, "저장"을 눌러야 반영한다(돌리다 닫으면 그대로).
 * 안드로이드: 시스템 시간 선택 창이 이미 확인/취소를 가진 대화상자라 시트를 겹치지 않는다 —
 *   visible이 되는 순간 창을 띄우고 결과만 넘긴다.
 * 웹: 알림 자체가 없어서 이 시트를 열 일이 없다(마이페이지가 행을 숨긴다).
 *
 * 사용:
 *   <TimePickerSheet visible={open} value={{ hour: 12, minute: 30 }} onSave={...} onClose={...} />
 */
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/primitives';
import { ThemedText } from '@/components/themed-text';
import type { ReminderTime } from '@/lib/daily-reminder';
import { useTheme } from '@/theme';

export type TimePickerSheetProps = {
  visible: boolean;
  value: ReminderTime;
  onSave: (time: ReminderTime) => void;
  onClose: () => void;
};

/** 휠은 Date를 다룬다 — 오늘 날짜에 시·분만 얹는다(날짜 부분은 쓰지 않는다). */
function toDate({ hour, minute }: ReminderTime): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}

export function TimePickerSheet({ visible, value, onSave, onClose }: TimePickerSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(() => toDate(value));

  // 열 때마다 지금 설정값에서 시작한다(지난번에 돌리다 만 값이 남지 않게).
  useEffect(() => {
    if (visible) setDraft(toDate(value));
  }, [visible, value]);

  // 안드로이드는 시스템 대화상자로 — 띄우고 바로 visible을 되돌린다.
  useEffect(() => {
    if (!visible || Platform.OS !== 'android') return;
    DateTimePickerAndroid.open({
      value: toDate(value),
      mode: 'time',
      is24Hour: true,
      onChange: (event, date) => {
        if (event.type === 'set' && date) onSave({ hour: date.getHours(), minute: date.getMinutes() });
      },
    });
    onClose();
  }, [visible, value, onSave, onClose]);

  if (Platform.OS !== 'ios') return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={[styles.scrim, { backgroundColor: theme.colors.scrim }]} onPress={onClose}>
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
              paddingBottom: 24 + insets.bottom,
            },
          ]}
        >
          <View style={[styles.grip, { backgroundColor: theme.colors.line.strong }]} />
          <ThemedText variant="h3">알림 시간</ThemedText>
          <ThemedText variant="sm" tone="secondary" style={{ marginTop: theme.spacing.s2 }}>
            매일 이 시간에 짧은 한 줄을 권해 드려요
          </ThemedText>

          <DateTimePicker
            value={draft}
            mode="time"
            display="spinner"
            // 24시간 휠. iOS는 휠의 12/24시간제를 locale로 정한다 — ko-KR이면 오전/오후 칸이 생긴다.
            // en_GB는 숫자만 나오는 24시간 휠이라 글자가 영어로 바뀌는 곳도 없다.
            locale="en_GB"
            // 다크 모드에서 휠 글자가 바탕에 묻히지 않게 앱 테마를 따른다.
            themeVariant={theme.mode === 'dark' ? 'dark' : 'light'}
            onChange={(_, date) => date && setDraft(date)}
            style={styles.wheel}
          />

          <Button
            label="저장"
            fullWidth
            onPress={() => {
              onSave({ hour: draft.getHours(), minute: draft.getMinutes() });
              onClose();
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end' },
  sheet: { paddingHorizontal: 24, paddingTop: 12 },
  grip: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 16 },
  wheel: { alignSelf: 'stretch', marginVertical: 8 },
});
