import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import React from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CountBadge } from './Badge';
import { cn } from './cn';
import { Gradient } from './Gradient';
import { Icon, IconName } from './Icon';

export interface TabMeta {
  label: string;
  icon: IconName;
  iconActive: IconName;
}

/** Khoảng đệm dưới cho nội dung cuộn để không bị thanh tab nổi che. */
export const TAB_BAR_CLEARANCE = 'pb-28';

/**
 * Thanh tab nổi dạng viên thuốc + nút giỏ hàng tròn (ảnh mẫu 1, 7, 8, 9).
 * Chỉ có icon như mẫu; nhãn đầy đủ được đọc bởi trình đọc màn hình.
 */
export const FloatingTabBar: React.FC<
  BottomTabBarProps & { meta: Record<string, TabMeta>; cartCount?: number; onCartPress?: () => void }
> = ({ state, navigation, meta, cartCount = 0, onCartPress }) => (
  <SafeAreaView edges={['bottom']} pointerEvents="box-none" className="absolute bottom-0 left-0 right-0">
    {/* SafeAreaView tự đặt padding theo vùng an toàn và bỏ qua padding ngang trong className, nên bố cục nằm ở View con. */}
    <View pointerEvents="box-none" className="flex-row items-center gap-3 px-4 pb-2">
      <View
        accessibilityRole="tablist"
        className="h-tabbar flex-1 flex-row items-center rounded-full bg-surface px-1.5 shadow-float"
      >
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const m = meta[route.name];
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          };
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityLabel={m.label}
              accessibilityState={{ selected: focused }}
              onPress={onPress}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              className="h-full flex-1 items-center justify-center active:opacity-70"
            >
              {focused ? (
                <Gradient
                  preset="brandPill"
                  className="h-12 w-full max-w-24 items-center justify-center rounded-full shadow-glow"
                >
                  <Icon name={m.iconActive} size="lg" tone="inverse" />
                </Gradient>
              ) : (
                <Icon name={m.icon} size="lg" tone="secondary" />
              )}
            </Pressable>
          );
        })}
      </View>
      {/* Nút giỏ hàng chỉ hiện khi có onCartPress (thanh tab của chủ quán không có giỏ). */}
      {onCartPress && (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={cartCount > 0 ? `Giỏ hàng, ${cartCount} món` : 'Giỏ hàng'}
        onPress={onCartPress}
        className="active:opacity-80"
      >
        <Gradient preset="brandPill" className="h-fab w-fab items-center justify-center rounded-full shadow-glow">
          <Icon name="cart-outline" size={28} tone="inverse" />
        </Gradient>
        <CountBadge count={cartCount} className={cn('absolute -right-0.5 -top-0.5')} />
      </Pressable>
      )}
    </View>
  </SafeAreaView>
);
