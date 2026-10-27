import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ToastHost } from '@/components/Toast';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/hooks/useAuth';
import { silentLogin } from '@/lib/silentLogin';

SplashScreen.preventAutoHideAsync().catch(() => {});

/** Routes reachable without a session (hidden pages are deliberately not linked anywhere). */
const PUBLIC_ROUTES = new Set(['login', 'company-registration', 'op-x7k2']);

function Root() {
  const { isAuthenticated, hasHydrated } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const { colors } = useTheme();

  const first = segments[0] as string | undefined;
  const isPublic = !!first && PUBLIC_ROUTES.has(first);

  useEffect(() => {
    if (!hasHydrated) return;
    SplashScreen.hideAsync().catch(() => {});
    if (isAuthenticated) {
      if (first === 'login' || !first) router.replace('/(tabs)/estimates');
      return;
    }
    if (isPublic) return;
    // No session: try the saved credentials once before showing the login form.
    silentLogin().then((token) => {
      if (!token) router.replace('/login');
    });
  }, [hasHydrated, isAuthenticated, isPublic, first, router]);

  if (!hasHydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  return (
    // ponytail: one keyboard-avoider for every screen (headers are off, so no offset needed).
    // Android resizes the window itself; Sheet renders in a Modal and keeps its own.
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      {/* Guarded screens never mount without a session, so their fetch-on-mount calls cannot
          fire unauthenticated (that surfaced as a "Missing authorization header" toast on the
          login screen). Logged-out users fall through to the first open screen: login. */}
      <Stack.Protected guard={isAuthenticated}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="estimates/[id]" />
        <Stack.Screen name="index" />
      </Stack.Protected>
      <Stack.Screen name="login" />
      <Stack.Screen name="company-registration" />
      <Stack.Screen name="op-x7k2" />
    </Stack>
    </KeyboardAvoidingView>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <Root />
        <ToastHost />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
