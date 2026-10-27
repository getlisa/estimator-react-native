import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddRow } from '@/components/estimates/AddRow';
import { CustomerPicker } from '@/components/estimates/CustomerPicker';
import { CommitField } from '@/components/estimates/Fields';
import { LineRow } from '@/components/estimates/LineRow';
import { Photos } from '@/components/estimates/Photos';
import { TaxSheet } from '@/components/estimates/TaxSheet';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { errMsg, toast } from '@/lib/ui';
import { connectionsService, type QboConnectionStatus, type QboItem } from '@/services/connectionsService';
import { money, quotesService, type ApiError, type Quote, type QuoteLineItem, type QuoteOptionTotal } from '@/services/quotesService';

interface Props { quote: Quote; onQuoteChange: (q: Quote) => void }

const isBaseScope = (i: QuoteLineItem) => !i.optionGroup;
const bySortOrder = (a: QuoteLineItem, b: QuoteLineItem) => a.sortOrder - b.sortOrder;
const sumTotals = (items: QuoteLineItem[]) => items.reduce((s, i) => s + (i.totalPrice ?? 0), 0);

/**
 * The Estimate tab (QuoteInvoiceTab.tsx): customer, markup, Materials / Labor / option groups,
 * option totals, tax, photos, QBO status, pinned totals bar. No money arithmetic beyond section
 * subtotals — every figure arrives from the server with markup and tax already applied.
 */
export function EstimateTab({ quote, onQuoteChange }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [searchingIds, setSearchingIds] = useState<ReadonlySet<string>>(new Set());
  const [optionPrompt, setOptionPrompt] = useState<QuoteOptionTotal[] | null>(null);
  const [chosenOption, setChosenOption] = useState('');
  const [openLineId, setOpenLineId] = useState<string | null>(null);
  const [addingTo, setAddingTo] = useState<'material' | 'labor' | null>(null);
  const [taxSheetOpen, setTaxSheetOpen] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [qboItems, setQboItems] = useState<QboItem[] | null>(null);
  const [connection, setConnection] = useState<QboConnectionStatus | null>(null);
  const autoSearched = useRef<Set<string>>(new Set());
  const frozen = quote.status === 'COMPLETED';

  useEffect(() => {
    connectionsService.qboItems().then(setQboItems).catch(() => setQboItems(null));
    connectionsService.get().then((s) => setConnection(s.qbo)).catch(() => setConnection(null));
  }, []);

  // Unpriced lines search the catalog themselves — all at once; one fresh read settles it.
  useEffect(() => {
    if (frozen || searchingIds.size > 0) return;
    const targets = quote.lineItems.filter((i) => i.flags.includes('unmatched') && !autoSearched.current.has(i.id));
    if (targets.length === 0) return;
    targets.forEach((t) => autoSearched.current.add(t.id));
    setSearchingIds(new Set(targets.map((t) => t.id)));
    Promise.allSettled(
      targets.map((t) => quotesService.priceItem(quote.id, t.id).then((q) => {
        setSearchingIds((prev) => { const n = new Set(prev); n.delete(t.id); return n; });
        onQuoteChange(q);
      }))
    )
      .then(() => quotesService.get(quote.id))
      .then(onQuoteChange)
      .catch(() => {})
      .finally(() => setSearchingIds(new Set()));
  }, [quote, frozen, searchingIds, onQuoteChange]);

  const run = useCallback(async (fn: () => Promise<Quote>) => {
    setBusy(true);
    try { onQuoteChange(await fn()); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }, [onQuoteChange]);

  const patchItem = (itemId: string, patch: Parameters<typeof quotesService.updateItem>[2]) => {
    autoSearched.current.delete(itemId);
    return run(() => quotesService.updateItem(quote.id, itemId, patch));
  };

  const tryComplete = async (chosen?: string) => {
    setBusy(true);
    try {
      onQuoteChange(await quotesService.complete(quote.id, chosen));
      setOptionPrompt(null);
      setAddingTo(null);
    } catch (e) {
      const err = e as ApiError;
      if (err.code === 'OPTION_CHOICE_REQUIRED' && err.options?.length) {
        setOptionPrompt(err.options);
        setChosenOption(err.options[0].name);
      } else if (err.code === 'TAX_RATE_UNAVAILABLE') {
        toast.error('Pick another sales-tax rate', err.message);
        setTaxSheetOpen(true);
      } else {
        toast.error(err.message ?? 'Something went wrong');
      }
    } finally { setBusy(false); }
  };

  const pickTax = async (salesTaxId: number | null) => {
    setBusy(true);
    try {
      onQuoteChange(await quotesService.updateQuote(quote.id, { salesTaxId }));
      toast.success(salesTaxId == null ? 'This estimate is now untaxed' : 'Sales tax updated for this estimate');
      setTaxSheetOpen(false);
    } catch (e) { toast.error('Could not change the rate', errMsg(e)); } finally { setBusy(false); }
  };

  const { materials, labor, optionGroups } = useMemo(() => {
    const base = quote.lineItems.filter(isBaseScope);
    const groups = new Map<string, QuoteLineItem[]>();
    for (const item of quote.lineItems) {
      if (isBaseScope(item)) continue;
      const key = item.optionGroup as string;
      groups.has(key) ? groups.get(key)!.push(item) : groups.set(key, [item]);
    }
    return {
      materials: base.filter((i) => !i.isLabor).sort(bySortOrder),
      labor: base.filter((i) => i.isLabor).sort(bySortOrder),
      optionGroups: [...groups.entries()].map(([name, items]) => ({ name, items: items.sort(bySortOrder) })),
    };
  }, [quote.lineItems]);

  const lineRow = (item: QuoteLineItem) => (
    <LineRow key={item.id} item={item} allItems={quote.lineItems} open={openLineId === item.id}
      onToggle={() => setOpenLineId(openLineId === item.id ? null : item.id)} frozen={frozen} busy={busy}
      searching={searchingIds.has(item.id)} qboItems={qboItems}
      onPatch={(patch) => patchItem(item.id, patch)} onRemove={() => run(() => quotesService.removeItem(quote.id, item.id))} />
  );

  const taxed = quote.taxRatePercent != null;
  const total = quote.totalWithTax ?? quote.total;
  const linked = quote.customerId != null;
  const customerDetail = [quote.customerAddress, quote.customerPhone, quote.customerEmail].filter(Boolean).join(' · ');
  const qboConnected = connection?.connected === true;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {frozen ? (
          <View style={[styles.banner, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
            <ThemedText style={{ fontWeight: '500' }}>This estimate is Completed and frozen — no line item can be added, removed, or edited. Move it back to Draft to make changes.</ThemedText>
          </View>
        ) : quote.blockingFlagCount > 0 ? (
          <View style={[styles.banner, { borderColor: colors.warning, backgroundColor: colors.warningLight }]}>
            <ThemedText style={{ fontWeight: '500' }}>{quote.blockingFlagCount} of {quote.lineItems.length} line item(s) need attention.</ThemedText>
          </View>
        ) : null}

        {/* Customer record (EstimateCustomerRow.tsx) */}
        {!(frozen && !linked && !quote.customerName) && (
          <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
            <Ionicons name="person-outline" size={18} color={colors.textSecondary} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <ThemedText type="label">Customer record</ThemedText>
              {quote.customerName ? <ThemedText type="defaultSemiBold" numberOfLines={1}>{quote.customerName}</ThemedText> : <ThemedText style={{ color: colors.textSecondary }}>Not chosen yet</ThemedText>}
              {!!customerDetail && <ThemedText type="caption">{customerDetail}</ThemedText>}
            </View>
            {!frozen && <Button size="sm" variant="secondary" disabled={busy} onPress={() => setCustomerOpen(true)}>{linked ? 'Change' : 'Choose or add'}</Button>}
          </View>
        )}
        {!frozen && (
          <CustomerPicker open={customerOpen} onClose={() => setCustomerOpen(false)} linkedId={quote.customerId} qboConnected={qboConnected}
            seed={{ name: quote.customerName, email: quote.customerEmail, phone: quote.customerPhone, address: quote.customerAddress }}
            onPicked={(c) => run(() => quotesService.updateQuote(quote.id, { customerId: c.customerId }))} />
        )}

        {!frozen && (
          <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
            <Ionicons name="pricetag-outline" size={18} color={colors.textSecondary} />
            <View style={{ flex: 1 }}>
              <ThemedText style={{ fontWeight: '500' }}>Markup</ThemedText>
              <ThemedText type="caption">Materials only</ThemedText>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <CommitField style={{ width: 80 }} value={String(quote.markupPercent)} disabled={busy}
                onCommit={(v) => { const n = parseFloat(v.replace(/[%\s,]/g, '')); if (!isNaN(n)) run(() => quotesService.updateQuote(quote.id, { markupPercent: n })); }} />
              <ThemedText type="caption">%</ThemedText>
            </View>
          </View>
        )}

        {quote.lineItems.length === 0 && (
          <View style={[styles.empty, { borderColor: colors.border }]}><ThemedText type="caption" style={{ textAlign: 'center' }}>No line items yet.</ThemedText></View>
        )}

        <Section title="Materials" subtotal={materials.length ? sumTotals(materials) : null} note={quote.markupPercent ? `includes ${quote.markupPercent}% markup` : null}
          addLabel="Add material item" onAdd={frozen || addingTo === 'labor' ? undefined : () => setAddingTo('material')}>
          {materials.map(lineRow)}
          {!frozen && addingTo === 'material' && <AddRow quote={quote} isLabor={false} qboItems={qboItems} busy={busy} onQuoteChange={onQuoteChange} onDone={() => setAddingTo(null)} />}
        </Section>
        <Section title="Labor" subtotal={labor.length ? sumTotals(labor) : null} addLabel="Add labor item" onAdd={frozen || addingTo === 'material' ? undefined : () => setAddingTo('labor')}>
          {labor.map(lineRow)}
          {!frozen && addingTo === 'labor' && <AddRow quote={quote} isLabor qboItems={qboItems} busy={busy} onQuoteChange={onQuoteChange} onDone={() => setAddingTo(null)} />}
        </Section>
        {optionGroups.map((g) => (
          <Section key={g.name} title={g.name} subtotal={sumTotals(g.items)} note={quote.chosenOptionGroup === g.name ? 'chosen by the customer' : 'alternative'}>
            {g.items.map(lineRow)}
          </Section>
        ))}

        {(quote.optionTotals?.length ?? 0) > 0 && (
          <View style={[styles.options, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
            <ThemedText type="label">If the customer picks</ThemedText>
            {quote.optionTotals!.map((o) => (
              <View key={o.name} style={styles.between}>
                <ThemedText numberOfLines={1} style={{ flex: 1 }}>{o.name} + base scope</ThemedText>
                <ThemedText type="defaultSemiBold">{money(taxed ? o.combinedTotalWithTax ?? o.combinedTotal : o.combinedTotal)}</ThemedText>
              </View>
            ))}
          </View>
        )}

        {quote.lineItems.length > 0 && (
          <Pressable disabled={frozen} onPress={() => setTaxSheetOpen(true)} style={({ pressed }) => [styles.taxRow, pressed && { backgroundColor: colors.backgroundSecondary }]}>
            <Ionicons name="receipt-outline" size={16} color={colors.textSecondary} />
            <ThemedText type="caption" style={{ flex: 1 }} numberOfLines={1}>Sales tax{quote.taxableSubtotal > 0 ? ` · on ${money(quote.taxableSubtotal)}` : ''}</ThemedText>
            <ThemedText type="defaultSemiBold">{taxed ? `${quote.taxRatePercent}%` : 'No tax'}</ThemedText>
            {!frozen && <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />}
          </Pressable>
        )}

        <Photos quote={quote} frozen={frozen} />

        {quote.status === 'COMPLETED' && quote.qboSyncError && (
          <View style={[styles.banner, { borderColor: colors.warning, backgroundColor: colors.warningLight, gap: 4 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="warning-outline" size={14} color={colors.warning} />
              <ThemedText type="caption" style={{ fontWeight: '600' }}>This estimate did not reach QuickBooks</ThemedText>
            </View>
            <ThemedText type="caption">{quote.qboSyncError}</ThemedText>
            <ThemedText type="caption">{qboConnected ? 'Retry it from Send / Download → Sync to QuickBooks.' : 'Reconnect QuickBooks in My Profile → Connections, then retry it from Send / Download.'}</ThemedText>
          </View>
        )}
      </ScrollView>

      {/* Pinned totals + the one primary action (EstimateTotals.tsx EstimateTotalsBar) */}
      <View style={[styles.bar, { borderTopColor: colors.border, backgroundColor: colors.cardBackground, paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
        {optionPrompt && (
          <View style={[styles.banner, { borderColor: colors.warning, backgroundColor: colors.warningLight, gap: Spacing.sm }]}>
            <ThemedText style={{ fontWeight: '500' }}>This estimate offers alternatives — which option did the customer choose?</ThemedText>
            {optionPrompt.map((o) => (
              <Pressable key={o.name} onPress={() => setChosenOption(o.name)} style={styles.radioRow} accessibilityRole="radio" accessibilityState={{ checked: chosenOption === o.name }}>
                <Ionicons name={chosenOption === o.name ? 'radio-button-on' : 'radio-button-off'} size={20} color={colors.primary} />
                <ThemedText>{o.name} — {money(o.combinedTotalWithTax ?? o.combinedTotal)} total</ThemedText>
              </Pressable>
            ))}
            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
              <Button style={{ flex: 1 }} size="sm" disabled={busy || !chosenOption} onPress={() => tryComplete(chosenOption)}>Confirm & Complete</Button>
              <Button style={{ flex: 1 }} size="sm" variant="secondary" disabled={busy} onPress={() => setOptionPrompt(null)}>Cancel</Button>
            </View>
          </View>
        )}
        {taxed && (
          <View style={styles.between}>
            <ThemedText type="caption">Subtotal {money(quote.total)}</ThemedText>
            <ThemedText type="caption">Tax ({quote.taxRatePercent}%) {money(quote.taxAmount ?? 0)}</ThemedText>
          </View>
        )}
        <View style={styles.between}>
          <ThemedText type="defaultSemiBold">Total</ThemedText>
          <ThemedText style={{ fontSize: 24, fontWeight: '700' }}>{money(total)}</ThemedText>
        </View>
        {frozen ? (
          <Button variant="secondary" size="lg" fullWidth loading={busy} onPress={() => run(() => quotesService.reopen(quote.id))}>Move back to Draft</Button>
        ) : (
          <>
            <Button size="lg" fullWidth loading={busy} disabled={busy || !!optionPrompt || quote.lineItems.length === 0} onPress={() => tryComplete()}>Mark as completed</Button>
            {quote.blockingFlagCount > 0 && <ThemedText type="caption" style={{ textAlign: 'center' }}>Resolve every flagged item above to enable this. Manually-edited items don't block.</ThemedText>}
          </>
        )}
      </View>

      <TaxSheet open={taxSheetOpen} onClose={() => setTaxSheetOpen(false)} currentSalesTaxId={quote.salesTaxId}
        currentRateLabel={quote.taxRatePercent != null ? `Current rate — ${quote.taxRatePercent}%` : null} taxableSubtotal={quote.taxableSubtotal} onPick={pickTax} />
    </View>
  );
}

function Section({ title, subtotal, note, addLabel, onAdd, children }: {
  title: string; subtotal: number | null; note?: string | null; addLabel?: string; onAdd?: () => void; children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: Spacing.sm }}>
      <View style={styles.between}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm, flex: 1 }}>
          <ThemedText type="defaultSemiBold">{title}</ThemedText>
          {note && <ThemedText type="caption">{note}</ThemedText>}
        </View>
        {subtotal != null && <ThemedText type="defaultSemiBold">{money(subtotal)}</ThemedText>}
      </View>
      {children}
      {onAdd && addLabel && (
        <Pressable onPress={onAdd} style={({ pressed }) => [styles.add, { borderColor: colors.border }, pressed && { backgroundColor: colors.backgroundSecondary }]}>
          <Ionicons name="add" size={16} color={colors.textSecondary} />
          <ThemedText type="caption">{addLabel}</ThemedText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: Spacing['2xl'] },
  banner: { borderWidth: 2, borderRadius: 12, padding: Spacing.md },
  card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderWidth: 1, borderRadius: 12, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  empty: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, padding: Spacing.xl },
  options: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, padding: Spacing.md, gap: 4 },
  between: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: Spacing.sm },
  taxRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.xs, borderRadius: 8 },
  bar: { borderTopWidth: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, gap: Spacing.sm },
  radioRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  add: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderStyle: 'dashed', borderRadius: 12 },
});
