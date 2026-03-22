const CLICK_SRC = '/sounds/click.mp3';
const ALARM_SRC = '/sounds/alarm.mp3';

let clickAudio: HTMLAudioElement | null = null;
let alarmAudio: HTMLAudioElement | null = null;

const getAudio = (src: string, existing: HTMLAudioElement | null) => {
  if (typeof Audio === 'undefined') {
    return null;
  }

  if (existing) {
    return existing;
  }

  const audio = new Audio(src);
  audio.preload = 'auto';
  return audio;
};

export const playClick = () => {
  clickAudio = getAudio(CLICK_SRC, clickAudio);
  if (!clickAudio) {
    return;
  }
  clickAudio.currentTime = 0;
  clickAudio.play().catch(() => {});
};

export const playAlarm = () => {
  alarmAudio = getAudio(ALARM_SRC, alarmAudio);
  if (!alarmAudio) {
    return;
  }
  alarmAudio.currentTime = 0;
  alarmAudio.play().catch(() => {});
};

export const requestNotificationPermission = () => {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
};

export const sendNotification = (title: string, body: string) => {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body });
  }
};

