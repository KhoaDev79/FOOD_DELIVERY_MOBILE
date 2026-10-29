import Constants from 'expo-constants';
import { Platform } from 'react-native';

function getApiBaseUrl(): string {
  // 1. Ưu tiên đọc biến môi trường Expo nếu được cung cấp
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // 2. Môi trường Web: gọi trực tiếp hostname của trình duyệt
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const hostname = window.location.hostname || 'localhost';
    return `http://${hostname}:3000/api/v1`;
  }

  // 3. Thiết bị di động thật (chạy Expo Go trên cùng mạng WiFi với máy tính)
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost ||
    (Constants as any).manifest?.debuggerHost;

  if (hostUri) {
    const host = hostUri.split(':')[0];
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return `http://${host}:3000/api/v1`;
    }
  }

  // 4. Giả lập Android (10.0.2.2 trỏ về localhost máy tính)
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000/api/v1';
  }

  // 5. Mặc định cho iOS Simulator hoặc local fallback
  return 'http://localhost:3000/api/v1';
}

export const API_BASE_URL = getApiBaseUrl();
export const SOCKET_URL = API_BASE_URL.replace(/\/api\/v1\/?$/, '');

export const DEFAULT_COORDS = {
  latitude: 10.7769,
  longitude: 106.7009,
};
