import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/contexts/ThemeContext';
import { useToasts } from '@/lib/ui';

/** Mount once in the root layout. Stacks at the top; never blocks input. */
export function ToastHost() {
  const toasts = useToasts();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  if (toasts.length === 0) return null;
  return (
    <View pointerEvents="none" style={[styles.host, { top: insets.top + 8 }]}>
      {toasts.map((t) => (
        <View
          key={t.id}
          style={[
            styles.toast,
            { backgroundColor: t.kind === 'error' ? colors.error : t.kind === 'success' ? colors.success : colors.backgroundElevated,
              borderColor: colors.border },
          ]}>
          <Text style={[styles.text, { color: t.kind === 'info' ? colors.text : '#fff' }]}>{t.text}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: 8, zIndex: 1000 },
  toast: { maxWidth: 520, marginHorizontal: 16, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  text: { fontSize: 14, fontWeight: '500' },
});
