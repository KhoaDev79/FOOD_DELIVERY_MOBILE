import { create } from 'zustand';
import { appStorage } from '../utils/storage';

const OWNER_ALERT_SETTINGS_KEY = 'owner_order_alert_settings';

export interface OwnerAlertSettings {
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  autoStopSeconds: number;
}

interface OwnerSettingsState extends OwnerAlertSettings {
  isLoaded: boolean;
  setSoundEnabled: (enabled: boolean) => Promise<void>;
  setVibrationEnabled: (enabled: boolean) => Promise<void>;
  loadSettings: () => Promise<void>;
}

export const useOwnerSettingsStore = create<OwnerSettingsState>((set, get) => ({
  soundEnabled: true,
  vibrationEnabled: true,
  autoStopSeconds: 120, // Tối đa 2 phút theo chuẩn nghiệp vụ
  isLoaded: false,

  loadSettings: async () => {
    try {
      const raw = await appStorage.getItem(OWNER_ALERT_SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        set({
          soundEnabled: typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : true,
          vibrationEnabled: typeof parsed.vibrationEnabled === 'boolean' ? parsed.vibrationEnabled : true,
          autoStopSeconds: typeof parsed.autoStopSeconds === 'number' ? parsed.autoStopSeconds : 120,
          isLoaded: true,
        });
        return;
      }
    } catch {
      // Dùng cấu hình mặc định nếu đọc storage lỗi
    }
    set({ isLoaded: true });
  },

  setSoundEnabled: async (soundEnabled: boolean) => {
    set({ soundEnabled });
    const current = get();
    await appStorage.setItem(
      OWNER_ALERT_SETTINGS_KEY,
      JSON.stringify({
        soundEnabled,
        vibrationEnabled: current.vibrationEnabled,
        autoStopSeconds: current.autoStopSeconds,
      }),
    );
  },

  setVibrationEnabled: async (vibrationEnabled: boolean) => {
    set({ vibrationEnabled });
    const current = get();
    await appStorage.setItem(
      OWNER_ALERT_SETTINGS_KEY,
      JSON.stringify({
        soundEnabled: current.soundEnabled,
        vibrationEnabled,
        autoStopSeconds: current.autoStopSeconds,
      }),
    );
  },
}));

