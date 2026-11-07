const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = withNativeWind(getDefaultConfig(__dirname), { input: './global.css' });

// Bản web: thay expo-status-bar bằng src/web/statusBarWeb.tsx để thanh trạng thái iPhone (khi mở từ Màn hình chính)
// đổi màu theo header của từng màn. App điện thoại vẫn dùng expo-status-bar gốc.
const STATUS_BAR_WEB = path.resolve(__dirname, 'src/web/statusBarWeb.tsx');
const upstreamResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'expo-status-bar') {
    return { type: 'sourceFile', filePath: STATUS_BAR_WEB };
  }
  return (upstreamResolve ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
