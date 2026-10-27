import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { errMsg, toast } from '@/lib/ui';

/** Wraps an async action with a busy flag and error toast (AdminConfig.tsx useAction). */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return { busy, run };
}

/** One record rendered as a bordered card — tables become card lists on every width. */
export function RecordCard({ children, dim }: { children: React.ReactNode; dim?: boolean }) {
  const { colors } = useTheme();
  return <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.cardBackground }, dim && { opacity: 0.6 }]}>{children}</View>;
}

export const Hint = ({ children }: { children: React.ReactNode }) => <ThemedText type="caption">{children}</ThemedText>;
export const Empty = ({ children }: { children: React.ReactNode }) => {
  const { colors } = useTheme();
  return <View style={[styles.empty, { borderColor: colors.border }]}><ThemedText type="caption" style={{ textAlign: 'center' }}>{children}</ThemedText></View>;
};
export const Actions = ({ children }: { children: React.ReactNode }) => <View style={styles.actions}>{children}</View>;
export const Row = ({ children }: { children: React.ReactNode }) => <View style={styles.row}>{children}</View>;

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, padding: Spacing.md, gap: Spacing.sm },
  empty: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, padding: Spacing.xl },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, alignItems: 'center' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, alignItems: 'flex-end' },
});
