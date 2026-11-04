import { Vibration } from 'react-native';
import { isOrderAlertPlaying, startOrderAlert, stopOrderAlert } from './orderAlertSound';

jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
  createAudioPlayer: jest.fn(() => ({
    volume: 1,
    play: jest.fn(),
    pause: jest.fn(),
    remove: jest.fn(),
    seekTo: jest.fn().mockResolvedValue(undefined),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  })),
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  Vibration: {
    vibrate: jest.fn(),
    cancel: jest.fn(),
  },
}));

describe('orderAlertSound', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    stopOrderAlert();
  });

  afterEach(() => {
    stopOrderAlert();
    jest.useRealTimers();
  });

  it('bắt đầu phát chuông và rung theo chu kỳ', async () => {
    expect(isOrderAlertPlaying()).toBe(false);

    await startOrderAlert({ soundEnabled: true, vibrationEnabled: true });
    expect(isOrderAlertPlaying()).toBe(true);
    expect(Vibration.vibrate).toHaveBeenCalledWith([0, 500, 300, 500, 2000], true);
  });

  it('dừng chuông và hủy rung khi gọi stopOrderAlert', async () => {
    await startOrderAlert({ soundEnabled: true, vibrationEnabled: true });
    expect(isOrderAlertPlaying()).toBe(true);

    stopOrderAlert();
    expect(isOrderAlertPlaying()).toBe(false);
    expect(Vibration.cancel).toHaveBeenCalled();
  });

  it('tự động tắt sau thời gian autoStopSeconds (mặc định 120s)', async () => {
    const onAutoStop = jest.fn();
    await startOrderAlert({ soundEnabled: true, vibrationEnabled: true, autoStopSeconds: 5, onAutoStop });
    expect(isOrderAlertPlaying()).toBe(true);

    jest.advanceTimersByTime(5000);
    expect(isOrderAlertPlaying()).toBe(false);
    expect(onAutoStop).toHaveBeenCalled();
  });
});

