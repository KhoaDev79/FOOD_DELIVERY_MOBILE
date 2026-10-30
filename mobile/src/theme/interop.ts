// Đăng ký className cho thành phần bên thứ ba (theo hướng dẫn "Third-party components" của NativeWind v4).
// Chỉ đăng ký ở một nơi, import một lần tại App.tsx.
import { cssInterop } from 'nativewind';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

cssInterop(SafeAreaProvider, { className: 'style' });
cssInterop(SafeAreaView, { className: 'style' });
