import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { FieldLabel } from '@/components/estimates/Fields';
import { ThemedText } from '@/components/themed-text';
import { Input } from '@/components/ui';
import { Sheet } from '@/components/ui/Sheet';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import type { QboItem } from '@/services/connectionsService';

/** Which QuickBooks item a line bills against; null = auto (EstimateQboItemSelect.tsx). */
export function QboItemSelect({ autoName, value, qboItems, disabled, onChange }: {
  autoName: string; value: string | null; qboItems: QboItem[]; disabled: boolean;
  onChange: (picked: { id: string; name: string } | null) => void;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const autoMatch = qboItems.find((i) => i.name.toLowerCase() === autoName.toLowerCase());
  const autoLabel = autoName ? (autoMatch ? `Auto — ${autoMatch.name}` : `Auto — will create "${autoName}"`) : 'Auto — matched from the description';
  const current = value ? qboItems.find((i) => i.id === value)?.name ?? value : autoLabel;
  const shown = qboItems.filter((i) => !q.trim() || i.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 200);
  return (
    <View style={{ gap: 4 }}>
      <FieldLabel>QuickBooks item</FieldLabel>
      <Pressable disabled={disabled} onPress={() => setOpen(true)}
        style={[styles.select, { borderColor: colors.inputBorder, backgroundColor: colors.inputBackground }, disabled && { opacity: 0.6 }]}>
        <ThemedText numberOfLines={1} style={{ flex: 1 }}>{current}</ThemedText>
        <Ionicons name="chevron-down" size={16} color={colors.icon} />
      </Pressable>
      <Sheet open={open} onClose={() => setOpen(false)} title="QuickBooks item">
        {qboItems.length > 8 && <Input value={q} onChangeText={setQ} placeholder="Search items…" leftIcon="search" />}
        <Row label={autoLabel} selected={!value} onPress={() => { onChange(null); setOpen(false); }} />
        {shown.map((i) => (
          <Row key={i.id} label={i.name} selected={i.id === value} onPress={() => { onChange({ id: i.id, name: i.name }); setOpen(false); }} />
        ))}
      </Sheet>
    </View>
  );
}

function Row({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, (pressed || selected) && { backgroundColor: colors.backgroundSecondary }]}>
      <ThemedText style={{ flex: 1, fontWeight: selected ? '600' : '400' }} numberOfLines={1}>{label}</ThemedText>
      {selected && <Ionicons name="checkmark" size={18} color={colors.primary} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  select: { minHeight: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: 10 },
});
