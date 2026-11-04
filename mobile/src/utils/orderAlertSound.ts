import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { Platform, Vibration } from 'react-native';

// Dùng expo-audio: expo-av đã bị gỡ khỏi Expo SDK 58 (Expo Go báo "Cannot find native module 'ExponentAV'").

let currentPlayer: AudioPlayer | null = null;
let soundIntervalTimer: ReturnType<typeof setInterval> | null = null;
let autoStopTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
let isRinging = false;

// Âm thanh chuông báo đơn mới (WAV)
const CHIME_ASSET = require('../../assets/sounds/order_chime.wav');

/** Cấu hình âm thanh hệ thống để phát ngay cả khi máy ở chế độ im lặng */
async function configureAudioMode() {
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'duckOthers',
    });
  } catch {
    // Không làm gián đoạn nếu môi trường chưa hỗ trợ
  }
}

/** Phát lại chuông từ đầu; tạo trình phát ở lần đầu. */
async function playChime(): Promise<void> {
  if (!currentPlayer) {
    currentPlayer = createAudioPlayer(CHIME_ASSET);
    currentPlayer.volume = 1.0;
  } else {
    await currentPlayer.seekTo(0);
  }
  currentPlayer.play();
}

/** Phát một lần chuông thử */
export async function playChimeOnce(): Promise<void> {
  try {
    await configureAudioMode();
    const player = createAudioPlayer(CHIME_ASSET);
    player.volume = 1.0;
    const sub = player.addListener('playbackStatusUpdate', (status) => {
      if (status.didJustFinish) {
        sub.remove();
        player.remove();
      }
    });
    player.play();
  } catch {
    // Trình duyệt chưa cho phát âm thanh (chưa có thao tác của người dùng): bỏ qua
  }
}

export interface StartOrderAlertOptions {
  soundEnabled?: boolean;
  vibrationEnabled?: boolean;
  autoStopSeconds?: number;
  onAutoStop?: () => void;
}

/**
 * Bắt đầu phát chuông báo đơn mới và rung chu kỳ
 * Lặp lại cho tới khi chủ quán bấm nhận/tắt hoặc hết thời gian tối đa (mặc định 120s)
 */
export async function startOrderAlert(options: StartOrderAlertOptions = {}): Promise<void> {
  const { soundEnabled = true, vibrationEnabled = true, autoStopSeconds = 120, onAutoStop } = options;

  // Nếu đang kêu rồi thì không tạo thêm timer trùng lặp
  if (isRinging) return;
  isRinging = true;

  // 1. Kích hoạt rung máy
  if (vibrationEnabled && Platform.OS !== 'web') {
    // Rung lặp lại: nghỉ 0ms, rung 500ms, nghỉ 300ms, rung 500ms, nghỉ 2000ms...
    Vibration.vibrate([0, 500, 300, 500, 2000], true);
  }

  // 2. Kích hoạt âm thanh chuông lặp lại
  if (soundEnabled) {
    await configureAudioMode();

    const playCycle = async () => {
      if (!isRinging) return;
      try {
        await playChime();
      } catch {
        // Không phát được (vd trình duyệt chặn tự phát): vẫn giữ rung và hộp thông báo
      }
    };

    // Phát ngay lập tức tiếng đầu tiên, rồi lặp lại mỗi 3,5 giây
    await playCycle();
    soundIntervalTimer = setInterval(playCycle, 3500);
  }

  // 3. Tự động tắt sau số giây quy định (mặc định 2 phút)
  if (autoStopSeconds > 0) {
    autoStopTimeoutTimer = setTimeout(() => {
      stopOrderAlert();
      onAutoStop?.();
    }, autoStopSeconds * 1000);
  }
}

/**
 * Dừng chuông báo đơn và tắt rung ngay lập tức
 */
export function stopOrderAlert(): void {
  isRinging = false;

  if (soundIntervalTimer) {
    clearInterval(soundIntervalTimer);
    soundIntervalTimer = null;
  }

  if (autoStopTimeoutTimer) {
    clearTimeout(autoStopTimeoutTimer);
    autoStopTimeoutTimer = null;
  }

  // Dừng rung
  if (Platform.OS !== 'web') {
    try {
      Vibration.cancel();
    } catch {}
  }

  // Dừng và giải phóng trình phát âm thanh
  if (currentPlayer) {
    try {
      currentPlayer.pause();
      currentPlayer.remove();
    } catch {}
    currentPlayer = null;
  }
}

export function isOrderAlertPlaying(): boolean {
  return isRinging;
}
