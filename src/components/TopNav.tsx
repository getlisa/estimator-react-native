import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs/types';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useLayout } from '@/lib/useLayout';

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  estimates: 'document-text',
  profile: 'person',
};

/**
 * Top navbar for tablets and up: brand on the left, the tabs beside it. Rendered through Tabs'
 * `tabBar` prop with `tabBarPosition: 'top'`, so it sits in normal flow above the scene.
 */
export function TopNav({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const { scale } = useLayout();

  return (
    <View style={[styles.bar, { backgroundColor: colors.background, borderBottomColor: colors.border, height: 56 * scale }]}>
      <ThemedText type="defaultSemiBold" style={{ fontSize: 17 * scale, marginRight: Spacing.xl }}>CLARA Estimator</ThemedText>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const label = descriptors[route.key]?.options.title ?? route.name;
        const color = focused ? colors.tint : colors.tabIconDefault;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            }}
            style={({ pressed }) => [
              styles.item,
              { minHeight: 40 * scale },
              focused && { backgroundColor: colors.primaryLight },
              pressed && !focused && { backgroundColor: colors.backgroundSecondary },
            ]}>
            <Ionicons name={ICONS[route.name] ?? 'ellipse'} size={20 * scale} color={color} />
            <ThemedText style={{ color, fontSize: 15 * scale, fontWeight: focused ? '600' : '500' }}>{label as string}</ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: 10,
  },
});
