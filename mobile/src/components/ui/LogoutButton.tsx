import React, { useState } from 'react';
import { Pressable } from 'react-native';
import { cn } from './cn';
import { Icon } from './Icon';
import { ConfirmDialog } from './Overlays';
import { Text } from './Text';

/**
 * Nút đăng xuất dùng chung cho mọi vai trò: nền trắng như các thẻ khác, chỉ icon và chữ màu đỏ,
 * cùng vị trí (cuối trang tài khoản) và luôn hỏi xác nhận trước khi đăng xuất.
 */
export const LogoutButton: React.FC<{
  onLogout: () => void | Promise<void>;
  /** Câu nhắc riêng theo vai trò, vd "Bạn sẽ được chuyển sang ngoại tuyến…". */
  message?: string;
  className?: string;
}> = ({ onLogout, message = 'Bạn sẽ cần đăng nhập lại để tiếp tục sử dụng.', className }) => {
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Đăng xuất"
        onPress={() => setConfirm(true)}
        className={cn(
          'h-button-lg flex-row items-center justify-center gap-2 rounded-2xl bg-surface shadow-card active:bg-canvas-subtle',
          className,
        )}
      >
        <Icon name="log-out-outline" size="md" tone="danger" />
        <Text variant="body-lg" weight="bold" tone="danger">
          Đăng xuất
        </Text>
      </Pressable>
      <ConfirmDialog
        visible={confirm}
        title="Đăng xuất?"
        message={message}
        confirmLabel="Đăng xuất"
        cancelLabel="Ở lại"
        destructive
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          setConfirm(false);
          await onLogout();
        }}
      />
    </>
  );
};
