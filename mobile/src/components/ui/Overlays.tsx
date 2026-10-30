import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, ReduceMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from './Button';
import { cn } from './cn';
import { Icon, IconName, IconTone } from './Icon';
import { Text } from './Text';

/* ------------------------------ Bảng trượt ------------------------------ */

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/** Bảng trượt từ dưới lên (ảnh mẫu 7): tay kéo, bo 24, tôn trọng vùng an toàn, đẩy lên khi có bàn phím. */
export const BottomSheet: React.FC<BottomSheetProps> = ({ visible, onClose, title, children, footer }) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-end">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Đóng"
        onPress={onClose}
        className="absolute inset-0 bg-scrim"
      />
      <SafeAreaView edges={['bottom']} className="max-h-[90%] rounded-t-2xl bg-surface shadow-float">
        <View className="items-center pb-1 pt-2">
          <View className="h-1 w-10 rounded-full bg-line" />
        </View>
        {!!title && (
          <Text variant="headline" accessibilityRole="header" className="px-4 pb-2 pt-1">
            {title}
          </Text>
        )}
        <View className="flex-shrink px-4">{children}</View>
        {footer && <View className="border-t border-line-subtle px-4 pt-3">{footer}</View>}
      </SafeAreaView>
    </KeyboardAvoidingView>
  </Modal>
);

/* ---------------------------- Hộp xác nhận ---------------------------- */

export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  visible,
  title,
  message,
  confirmLabel = 'Đồng ý',
  cancelLabel = 'Huỷ',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
    <View className="flex-1 items-center justify-center bg-scrim px-6">
      <View accessibilityViewIsModal className="w-full max-w-sm gap-2 rounded-xl bg-surface p-5 shadow-float">
        <Text variant="headline" accessibilityRole="header">
          {title}
        </Text>
        {!!message && (
          <Text variant="body" tone="secondary">
            {message}
          </Text>
        )}
        <View className="mt-3 flex-row gap-3">
          <Button
            label={cancelLabel}
            variant="outline"
            size="md"
            className="flex-1"
            onPress={onCancel}
            disabled={loading}
          />
          <Button
            label={confirmLabel}
            variant={destructive ? 'danger' : 'primary'}
            size="md"
            className="flex-1"
            loading={loading}
            onPress={onConfirm}
          />
        </View>
      </View>
    </View>
  </Modal>
);

/* -------------------------------- Toast -------------------------------- */

type ToastTone = 'default' | 'success' | 'error';
interface ToastState {
  id: number;
  message: string;
  tone: ToastTone;
}
const ToastContext = createContext<(message: string, tone?: ToastTone) => void>(() => {});

const TOAST_ICON: Record<ToastTone, { name: IconName; tone: IconTone }> = {
  default: { name: 'information-circle', tone: 'inverse' },
  success: { name: 'checkmark-circle', tone: 'success' },
  error: { name: 'alert-circle', tone: 'danger' },
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string, tone: ToastTone = 'default') => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: Date.now(), message, tone });
    timer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <SafeAreaView edges={['bottom']} pointerEvents="none" className="absolute bottom-24 left-0 right-0">
          <View pointerEvents="none" className="items-center px-4">
            <Animated.View
              key={toast.id}
              entering={FadeInDown.duration(200).reduceMotion(ReduceMotion.System)}
              exiting={FadeOutDown.duration(150).reduceMotion(ReduceMotion.System)}
              accessibilityLiveRegion="polite"
              accessibilityRole="alert"
              className="max-w-sm flex-row items-center gap-2 rounded-full bg-ink px-4 py-3 shadow-float"
            >
              <Icon name={TOAST_ICON[toast.tone].name} size="md" tone={TOAST_ICON[toast.tone].tone} />
              <Text variant="body" weight="medium" tone="inverse" numberOfLines={2} className="flex-shrink">
                {toast.message}
              </Text>
            </Animated.View>
          </View>
        </SafeAreaView>
      )}
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);

/* --------------------------- Mảnh dùng chung --------------------------- */

export const SheetHandle: React.FC<{ className?: string }> = ({ className }) => (
  <View className={cn('items-center py-2', className)}>
    <View className="h-1 w-10 rounded-full bg-line" />
  </View>
);
