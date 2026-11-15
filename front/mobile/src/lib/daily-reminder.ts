/**
 * 하루 한 줄 알림 — 사용자가 고른 시각(기본 12:30)에 매일 "한 줄 쓰기"를 권하는 **로컬 알림**.
 *
 * 서버가 보내는 푸시가 아니라 폰이 스스로 띄운다(스케줄을 OS에 맡김). 그래서 서버·토큰이 필요 없고,
 * 앱이 꺼져 있어도 울린다. 대신 앱을 지웠다 깔면 스케줄도 사라진다 → 앱 시작 때 syncDailyReminder로
 * 설정값과 실제 스케줄을 맞춘다.
 *
 * 권한: iOS 권한 창은 한 번 거절하면 다시 못 띄운다(설정 앱에서만 켤 수 있음). 그래서 이 파일은
 * 묻지 않고, 화면이 먼저 "받아볼까요?"로 의사를 확인한 뒤에만 enableDailyReminder를 부른다.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export type ReminderTime = { hour: number; minute: number };
export const DEFAULT_REMINDER_TIME: ReminderTime = { hour: 12, minute: 30 };

/** 같은 ID로 다시 예약하면 덮어쓴다 — 몇 번을 불러도, 시간을 바꿔도 알림은 하나(멱등). */
const ID = 'daily-reminder';
/** 시간이 바뀌어도 어색하지 않은 공통 문구(아침이든 밤이든). */
const BODY = '오늘의 짧은 한줄로 마음을 정돈해봐요.';

// 앱을 보고 있는 중에 그 시각이 와도 배너를 띄운다(기본값은 앱이 켜져 있으면 조용히 삼킨다).
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/** "12:30", "22:05" — 24시간 표기(사용자 결정 2026-11-15). 마이페이지·안내 문구에서 같은 모양으로 쓴다. */
export function formatReminderTime({ hour, minute }: ReminderTime): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

async function schedule({ hour, minute }: ReminderTime): Promise<void> {
  // 안드로이드 8+는 채널이 있어야 알림이 뜬다.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: '하루 한 줄 알림',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  await Notifications.scheduleNotificationAsync({
    identifier: ID,
    content: { title: 'define', body: BODY },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: 'default' },
  });
}

/**
 * 권한을 받고 그 시각으로 예약한다. 허락받지 못하면 false — 화면이 "설정에서 켜 주세요"를 안내한다.
 * 이미 켜진 상태에서 시간만 바꿀 때도 이걸 부르면 된다(같은 ID라 덮어쓴다). 웹은 항상 false.
 */
export async function enableDailyReminder(time: ReminderTime): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  let { granted, canAskAgain } = await Notifications.getPermissionsAsync();
  if (!granted && canAskAgain) ({ granted } = await Notifications.requestPermissionsAsync());
  if (!granted) return false;
  await schedule(time);
  return true;
}

export async function disableDailyReminder(): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.cancelScheduledNotificationAsync(ID);
}

/**
 * 앱 시작 때 한 번 — 설정이 켜져 있으면 다시 예약(재설치·OS 정리로 사라졌을 수 있다).
 * 권한 창은 띄우지 않는다: 이미 허락된 경우에만 예약하고, 설정에서 꺼 버렸다면 조용히 둔다.
 */
export async function syncDailyReminder(on: boolean, time: ReminderTime): Promise<void> {
  if (Platform.OS === 'web') return;
  if (!on) return disableDailyReminder();
  const { granted } = await Notifications.getPermissionsAsync();
  if (granted) await schedule(time);
}
