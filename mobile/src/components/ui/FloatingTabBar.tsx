import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTabBarStore } from '../../store/useTabBarStore';
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

const styles = StyleSheet.create({
  safeArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  animatedWrap: {
    width: '100%',
  },
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 8,
    width: '100%',
  },
  tablist: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 64,
  },
  cartPressable: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});

/**
 * Thanh tab nổi dạng viên thuốc + nút giỏ hàng tròn (ảnh mẫu 1, 7, 8, 9).
 * Tự động trượt xuống ẩn khi cuộn xuống và trượt lên hiện lại khi màn hình dừng lại.
 */
export const FloatingTabBar: React.FC<
  BottomTabBarProps & {
    meta: Record<string, TabMeta>;
    cartCount?: number;
    onCartPress?: () => void;
    /** Số đếm hiển thị trên icon tab (vd. tin nhắn chưa đọc), theo tên route. */
    badges?: Record<string, number>;
  }
> = ({ state, navigation, meta, cartCount = 0, onCartPress, badges }) => {
  const isVisible = useTabBarStore((s) => s.isVisible);
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateY.value = withTiming(isVisible ? 0 : 120, { duration: 250 });
  }, [isVisible, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <SafeAreaView edges={['bottom']} pointerEvents="box-none" style={styles.safeArea}>
      <Animated.View
        pointerEvents={isVisible ? 'box-none' : 'none'}
        style={[styles.animatedWrap, animatedStyle]}
      >
        <View
          pointerEvents="box-none"
          style={styles.rowContainer}
          className="flex-row items-center gap-3 px-4 pb-2"
        >
          <View
            accessibilityRole="tablist"
            style={styles.tablist}
            className="h-tabbar flex-1 flex-row items-center rounded-full bg-surface px-1.5 shadow-float"
          >
            {state.routes.map((route, index) => {
              const focused = state.index === index;
              const m = meta[route.name];
              const badge = badges?.[route.name] ?? 0;
              const onPress = () => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
              };
              return (
                <Pressable
                  key={route.key}
                  accessibilityRole="tab"
                  accessibilityLabel={badge > 0 ? `${m.label}, ${badge} mục chưa đọc` : m.label}
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
                  {/* Số chưa đọc nằm trên icon, không đổi bố cục khi xuất hiện/biến mất */}
                  <View pointerEvents="none" className="absolute left-1/2 top-1.5 ml-1.5">
                    <CountBadge count={badge} />
                  </View>
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
              style={styles.cartPressable}
              className="active:opacity-80"
            >
              <Gradient preset="brandPill" className="h-fab w-fab items-center justify-center rounded-full shadow-glow">
                <Icon name="cart-outline" size={28} tone="inverse" />
              </Gradient>
              <CountBadge count={cartCount} className={cn('absolute -right-0.5 -top-0.5')} />
            </Pressable>
          )}
        </View>
      </Animated.View>
    </SafeAreaView>
  );
};
