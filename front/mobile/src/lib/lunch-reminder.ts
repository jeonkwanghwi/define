/**
 * 점심 알림 — 매일 낮 12:30에 "한 줄 쓰기"를 권하는 **로컬 알림**.
 *
 * 서버가 보내는 푸시가 아니라 폰이 스스로 띄운다(스케줄을 OS에 맡김). 그래서 서버·토큰이 필요 없고,
 * 앱이 꺼져 있어도 울린다. 대신 앱을 지웠다 깔면 스케줄도 사라진다 → 앱 시작 때 syncLunchReminder로
 * 설정값과 실제 스케줄을 맞춘다.
 *
 * 권한: iOS 권한 창은 한 번 거절하면 다시 못 띄운다(설정 앱에서만 켤 수 있음). 그래서 이 파일은
 * 묻지 않고, 화면이 먼저 "받아볼까요?"로 의사를 확인한 뒤에만 enableLunchReminder를 부른다.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/** 같은 ID로 다시 예약하면 덮어쓴다 — 몇 번을 불러도 알림은 하나(멱등). */
const ID = 'lunch-reminder';
const HOUR = 12;
const MINUTE = 30;

// 앱을 보고 있는 중에 12:30이 와도 배너를 띄운다(기본값은 앱이 켜져 있으면 조용히 삼킨다).
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

async function schedule(): Promise<void> {
  // 안드로이드 8+는 채널이 있어야 알림이 뜬다.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: '점심 알림',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  await Notifications.scheduleNotificationAsync({
    identifier: ID,
    content: {
      title: 'define',
      body: '점심 맛있게 드셨나요? 짧은 한줄로 마음을 정돈해봐요.',
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: HOUR, minute: MINUTE, channelId: 'default' },
  });
}

/**
 * 권한을 받고 예약한다. 허락받지 못하면 false — 화면이 "설정에서 켜 주세요"를 안내한다.
 * 웹은 로컬 알림이 없으므로 항상 false.
 */
export async function enableLunchReminder(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  let { granted, canAskAgain } = await Notifications.getPermissionsAsync();
  if (!granted && canAskAgain) ({ granted } = await Notifications.requestPermissionsAsync());
  if (!granted) return false;
  await schedule();
  return true;
}

export async function disableLunchReminder(): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.cancelScheduledNotificationAsync(ID);
}

/**
 * 앱 시작 때 한 번 — 설정이 켜져 있으면 다시 예약(재설치·OS 정리로 사라졌을 수 있다).
 * 권한 창은 띄우지 않는다: 이미 허락된 경우에만 예약하고, 설정에서 꺼 버렸다면 조용히 둔다.
 */
export async function syncLunchReminder(on: boolean): Promise<void> {
  if (Platform.OS === 'web') return;
  if (!on) return disableLunchReminder();
  const { granted } = await Notifications.getPermissionsAsync();
  if (granted) await schedule();
}
