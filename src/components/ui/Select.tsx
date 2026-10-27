import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Sheet } from '@/components/ui/Sheet';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';

export interface SelectOption<T extends string> { value: T; label: string }

/** Native-friendly <select>: a field that opens a sheet of options. */
export function Select<T extends string>({ label, value, options, onChange, placeholder, disabled, compact }: {
  label?: string; value: T | null; options: SelectOption<T>[]; onChange: (v: T) => void; placeholder?: string; disabled?: boolean; compact?: boolean;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value)?.label;
  return (
    <View style={{ gap: 4, minWidth: 0 }}>
      {label && <ThemedText type="label">{label}</ThemedText>}
      <Pressable disabled={disabled} onPress={() => setOpen(true)}
        style={[styles.field, compact && { minHeight: 36 }, { borderColor: colors.inputBorder, backgroundColor: colors.inputBackground }, disabled && { opacity: 0.6 }]}>
        <ThemedText numberOfLines={1} style={{ flex: 1, color: current ? colors.inputText : colors.inputPlaceholder }}>{current ?? placeholder ?? 'Select…'}</ThemedText>
        <Ionicons name="chevron-down" size={16} color={colors.icon} />
      </Pressable>
      <Sheet open={open} onClose={() => setOpen(false)} title={label ?? placeholder}>
        {options.map((o) => (
          <Pressable key={o.value} onPress={() => { onChange(o.value); setOpen(false); }}
            style={({ pressed }) => [styles.row, (pressed || o.value === value) && { backgroundColor: colors.backgroundSecondary }]}>
            <ThemedText style={{ flex: 1, fontWeight: o.value === value ? '600' : '400' }}>{o.label}</ThemedText>
            {o.value === value && <Ionicons name="checkmark" size={18} color={colors.primary} />}
          </Pressable>
        ))}
      </Sheet>
    </View>
  );
}

/** Checkbox row (web <Checkbox> + label). */
export function CheckRow({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable disabled={disabled} onPress={() => onChange(!checked)} style={[styles.check, disabled && { opacity: 0.5 }]} accessibilityRole="checkbox" accessibilityState={{ checked }}>
      <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={22} color={checked ? colors.primary : colors.icon} />
      <ThemedText style={{ flex: 1 }}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: { minHeight: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: 10 },
  check: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: 40 },
});
