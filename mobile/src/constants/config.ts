import { Platform } from 'react-native';

function getApiBaseUrl(): string {
  // Ưu tiên đọc biến môi trường Expo
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // Môi trường Web
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const hostname = window.location.hostname || 'localhost';
    return `http://${hostname}:3000/api/v1`;
  }

  // Môi trường giả lập Android (10.0.2.2 là máy chủ host của máy ảo Android Studio)
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000/api/v1';
  }

  // Mặc định cho iOS Simulator hoặc local
  return 'http://localhost:3000/api/v1';
}

export const API_BASE_URL = getApiBaseUrl();
export const SOCKET_URL = API_BASE_URL.replace(/\/api\/v1\/?$/, '');

export const DEFAULT_COORDS = {
  latitude: 10.7769,
  longitude: 106.7009,
};
