import { Ionicons } from '@expo/vector-icons';
import { BottomTabBar } from 'expo-router/build/react-navigation/bottom-tabs';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet } from 'react-native';

import { TopNav } from '@/components/TopNav';
import { useTheme } from '@/contexts/ThemeContext';
import { useLayout } from '@/lib/useLayout';

export default function TabLayout() {
  const { colors } = useTheme();
  const { wide } = useLayout();

  return (
    <Tabs
      tabBar={(props) =>
        wide ? (
          <TopNav {...props} />
        ) : (
          <BottomTabBar {...props} />
        )
      }
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.tint,
        tabBarInactiveTintColor: colors.tabIconDefault,
        tabBarHideOnKeyboard: true,
        tabBarStyle: [styles.tabBar, { backgroundColor: colors.background, borderTopColor: colors.border }],
        tabBarLabelStyle: styles.tabBarLabel,
        // Wide layouts: navbar across the top, in normal flow above the scene.
        tabBarPosition: wide ? 'top' : 'bottom',
      }}>
      <Tabs.Screen
        name="estimates"
        options={{
          title: 'Estimates',
          tabBarIcon: ({ color, size }) => <Ionicons name="document-text" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: { borderTopWidth: 1, ...(Platform.OS === 'web' ? { height: 60 } : {}) },
  tabBarLabel: { fontSize: 11, fontWeight: '500' },
});
