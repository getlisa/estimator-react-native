import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Input } from '@/components/ui';
import { Sheet } from '@/components/ui/Sheet';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { salesTaxService, type SalesTaxRate } from '@/services/connectionsService';
import { money } from '@/services/quotesService';

/** Picks the sales-tax rate for THIS estimate from the company's own rates (EstimateTaxSheet.tsx). */
export function TaxSheet({ open, onClose, currentSalesTaxId, currentRateLabel, taxableSubtotal, onPick }: {
  open: boolean; onClose: () => void; currentSalesTaxId: number | null; currentRateLabel?: string | null;
  taxableSubtotal: number; onPick: (salesTaxId: number | null) => Promise<void>;
}) {
  const { colors } = useTheme();
  const [rates, setRates] = useState<SalesTaxRate[] | null>(null);
  const [search, setSearch] = useState('');
  const [taxSource, setTaxSource] = useState('manual');
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!open) return;
    setRates(null); setFailed(false); setSearch('');
    salesTaxService.list()
      .then((s) => { setRates(s.rates.filter((r) => r.isActive && r.usable)); setTaxSource(s.taxSource); })
      .catch(() => { setFailed(true); setRates([]); });
  }, [open, reloadKey]);

  const choose = async (id: number | null) => { setBusy(true); try { await onPick(id); } finally { setBusy(false); } };

  const needle = search.trim().toLowerCase();
  const filtered = (rates ?? []).filter((r) => !needle || r.name.toLowerCase().includes(needle) || String(r.ratePercent).includes(needle));
  const shown = filtered.slice(0, 100);

  return (
    <Sheet open={open} onClose={onClose} title="Sales tax on this estimate"
      description={`Applies to this estimate only — your company default is unchanged.${taxableSubtotal > 0 ? ` Tax applies to ${money(taxableSubtotal)} of it.` : ''}`}>
      {rates === null ? (
        <ActivityIndicator color={colors.tint} style={{ paddingVertical: Spacing['2xl'] }} />
      ) : (
        <View style={{ gap: 2 }}>
          {failed && (
            <View style={{ padding: Spacing.md, gap: Spacing.sm }}>
              <ThemedText type="caption">Couldn't load your tax rates just now.</ThemedText>
              <Button size="sm" variant="secondary" onPress={() => setReloadKey((k) => k + 1)}>Try again</Button>
            </View>
          )}
          {!failed && rates.length === 0 && (
            <ThemedText type="caption" style={{ padding: Spacing.md }}>
              No rates are available.{' '}
              {taxSource === 'zentrades' ? 'Sync ZenTrades from My Profile to import them.'
                : taxSource === 'servicetrade' ? 'Sync ServiceTrade from My Profile to import them.'
                : taxSource === 'quickbooks' ? 'Add one in Settings → Tax settings, or sync QuickBooks.'
                : 'Add one in Settings → Tax settings.'}
            </ThemedText>
          )}
          {!failed && rates.length > 8 && <Input value={search} onChangeText={setSearch} placeholder={`Search ${rates.length} rates…`} leftIcon="search" />}
          {!failed && currentSalesTaxId != null && !rates.some((r) => r.id === currentSalesTaxId) && (
            <TaxRow label={currentRateLabel ?? "This estimate's rate"} trailing="inactive" selected disabled onPress={() => {}} />
          )}
          {needle && filtered.length === 0 && <ThemedText type="caption" style={{ padding: Spacing.md }}>No rates match “{search}”.</ThemedText>}
          {shown.map((r) => (
            <TaxRow key={r.id} label={r.name} trailing={`${r.ratePercent}%`} selected={r.id === currentSalesTaxId} disabled={busy} onPress={() => choose(r.id)} />
          ))}
          {filtered.length > shown.length && (
            <ThemedText type="caption" style={{ textAlign: 'center', padding: Spacing.sm }}>Showing {shown.length} of {filtered.length} — keep typing to narrow.</ThemedText>
          )}
          {!failed && <TaxRow label="No sales tax on this job" selected={currentSalesTaxId == null} disabled={busy} onPress={() => choose(null)} />}
        </View>
      )}
    </Sheet>
  );
}

function TaxRow({ label, trailing, selected, disabled, onPress }: { label: string; trailing?: string; selected: boolean; disabled: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.row, (selected || pressed) && { backgroundColor: colors.backgroundSecondary }, disabled && !selected && { opacity: 0.6 }]}>
      <ThemedText style={{ flex: 1, fontWeight: selected ? '600' : '400' }} numberOfLines={1}>{label}</ThemedText>
      {trailing && <ThemedText type="caption">{trailing}</ThemedText>}
      {selected && <Ionicons name="checkmark" size={20} color={colors.primary} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.md, borderRadius: 12 },
});
