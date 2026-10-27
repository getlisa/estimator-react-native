import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';

import { CommitField, SwitchRow } from '@/components/estimates/Fields';
import { QboItemSelect } from '@/components/estimates/QboItemSelect';
import { ThemedText } from '@/components/themed-text';
import { Badge, Button } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { qboAutoItemName } from '@/lib/qboItemName';
import type { QboItem } from '@/services/connectionsService';
import { money, type quotesService, type QuoteLineItem } from '@/services/quotesService';

/** Verbatim from EstimateLineRow.tsx:12-18. */
const FLAG_LABELS: Record<string, { label: string; blocking: boolean }> = {
  missing_quantity: { label: 'Missing Qty', blocking: true },
  unmatched: { label: 'Unmatched / Unpriced', blocking: true },
  ambiguous: { label: 'Ambiguous', blocking: true },
  estimated_price: { label: 'Estimated Price · Unconfirmed', blocking: true },
  manually_edited: { label: 'Manually Edited', blocking: false },
};

type Patch = Parameters<typeof quotesService.updateItem>[2];

export function LineRow({ item, allItems, open, onToggle, frozen, busy, searching, qboItems, onPatch, onRemove }: {
  item: QuoteLineItem; allItems: QuoteLineItem[]; open: boolean; onToggle: () => void; frozen: boolean; busy: boolean;
  searching: boolean; qboItems: QboItem[] | null; onPatch: (patch: Patch) => void; onRemove: () => void;
}) {
  const { colors } = useTheme();
  const isAmbiguous = item.flags.includes('ambiguous');
  // Unknown flags count as blocking (server may add keys first); `agent_suggested` is retired.
  const blocking = item.flags.filter((f) => (f as string) !== 'agent_suggested' && (FLAG_LABELS[f]?.blocking ?? true));
  const taxable = item.taxable ?? !item.isLabor;
  const disabled = frozen || busy;
  const candidates = isAmbiguous
    ? (item.ambiguousAction?.candidateItemIds ?? []).map((id) => allItems.find((i) => i.id === id)).filter((i): i is QuoteLineItem => !!i)
    : [];
  const num = (v: string, strip: RegExp) => { const n = parseFloat(v.replace(strip, '')); return isNaN(n) ? null : n; };

  return (
    <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }, blocking.length > 0 && { borderLeftWidth: 4, borderLeftColor: colors.warning }]}>
      {searching && (
        <View style={styles.overlay}>
          <ActivityIndicator color={colors.textSecondary} />
          <ThemedText type="defaultSemiBold" style={{ color: colors.textSecondary }}>Searching…</ThemedText>
        </View>
      )}
      <View style={searching && { opacity: 0.4 }} pointerEvents={searching ? 'none' : 'auto'}>
        <Pressable onPress={onToggle} style={styles.summary} accessibilityRole="button" accessibilityState={{ expanded: open }}>
          <View style={[styles.dot, { backgroundColor: item.isLabor ? colors.warning : colors.primary }]} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <ThemedText numberOfLines={open ? undefined : 1} style={[styles.desc, isAmbiguous && { fontStyle: 'italic', fontWeight: '400', color: colors.textSecondary }]}>
              {isAmbiguous ? `"${item.ambiguousAction?.referenceText || item.description}"` : item.description}
            </ThemedText>
            <View style={styles.meta}>
              {!isAmbiguous && (
                <ThemedText type="caption">{item.quantity ?? '—'}{item.unit ? ` ${item.unit}` : ''} × {item.unitPrice != null ? money(item.unitPrice) : '—'}</ThemedText>
              )}
              {blocking.length > 0 && (
                <View style={[styles.flag, { backgroundColor: colors.warningLight }]}>
                  <Ionicons name="warning-outline" size={11} color={colors.warning} />
                  <ThemedText style={{ fontSize: 11, fontWeight: '600', color: colors.warning }}>
                    {blocking.length === 1 ? FLAG_LABELS[blocking[0]]?.label ?? blocking[0] : `${blocking.length} need attention`}
                  </ThemedText>
                </View>
              )}
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <ThemedText type="defaultSemiBold">{item.totalPrice != null ? money(item.totalPrice) : '—'}</ThemedText>
            {!taxable && !isAmbiguous && <ThemedText type="caption" style={{ fontSize: 11 }}>not taxed</ThemedText>}
          </View>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.icon} />
        </Pressable>

        {open && (
          <View style={[styles.editor, { borderTopColor: colors.border }]}>
            {isAmbiguous ? (
              <View style={{ gap: Spacing.sm }}>
                <ThemedText type="caption">Which item did you mean? Tap to select — this isn't resolved by voice.</ThemedText>
                <View style={styles.wrap}>
                  {candidates.map((c) => (
                    <Button key={c.id} size="sm" variant="secondary" disabled={disabled} onPress={() => onPatch({ resolveCandidateId: c.id })}>
                      {`${c.description}${c.quantity != null ? ` — ${c.quantity}${c.unit ? ' ' + c.unit : ''}` : ''}`}
                    </Button>
                  ))}
                </View>
              </View>
            ) : (
              <>
                <CommitField label="Description" value={item.description} inputMode="text" disabled={disabled}
                  onCommit={(v) => v.trim() && onPatch({ description: v.trim() })} />
                <View style={styles.grid}>
                  <CommitField style={styles.cell} label="Qty" value={item.quantity != null ? String(item.quantity) : ''} placeholder="qty"
                    highlight={item.flags.includes('missing_quantity')} disabled={disabled}
                    onCommit={(v) => { const n = num(v, /[,\s]/g); if (n != null) onPatch({ quantity: n }); }} />
                  <CommitField style={styles.cell} label="Unit" value={item.unit ?? ''} placeholder="EA" inputMode="text" disabled={disabled}
                    onCommit={(v) => onPatch({ unit: v.trim() || null })} />
                  <CommitField style={styles.cell} label="Unit price" value={item.unitPrice != null ? item.unitPrice.toFixed(2) : ''}
                    placeholder={item.flags.includes('unmatched') ? 'no match' : 'price'} highlight={item.flags.includes('unmatched')} disabled={disabled}
                    onCommit={(v) => { const n = num(v, /[$,]/g); if (n != null) onPatch({ unitPrice: n }); }} />
                  <CommitField style={styles.cell} label="Line total" value={item.totalPrice != null ? item.totalPrice.toFixed(2) : ''} placeholder="total" disabled={disabled}
                    onCommit={(v) => { const n = num(v, /[$,]/g); if (n != null) onPatch({ totalPrice: n }); }} />
                </View>
                <SwitchRow label="Taxable" value={taxable} disabled={disabled} onChange={(v) => onPatch({ taxable: v })} />
                {blocking.length > 0 && (
                  <View style={styles.wrap}>
                    {blocking.map((f) => <Badge key={f} size="sm" variant="error">{FLAG_LABELS[f]?.label ?? f}</Badge>)}
                  </View>
                )}
                {qboItems && (
                  <QboItemSelect
                    autoName={qboAutoItemName(item.isLabor, item.searchTerm ?? null, item.description)}
                    value={item.qboItemId ?? null}
                    qboItems={qboItems}
                    disabled={disabled}
                    onChange={(picked) => onPatch({ qboItemId: picked?.id ?? null, qboItemName: picked?.name ?? null })}
                  />
                )}
                <Provenance item={item} searching={searching} frozen={frozen} />
              </>
            )}
            {!frozen && (
              <Button variant="ghost" size="sm" icon="trash-outline" disabled={busy} onPress={onRemove} textStyle={{ color: colors.error }} fullWidth>
                Remove item
              </Button>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

/** Where this line's price came from, and what to do about it (EstimateLineRow.tsx:312-405). */
function Provenance({ item, searching, frozen }: { item: QuoteLineItem; searching: boolean; frozen: boolean }) {
  const { colors } = useTheme();
  const link = (url: string, label: string) => (
    <Pressable onPress={() => Linking.openURL(url)}><ThemedText type="caption" style={{ color: colors.primary, textDecorationLine: 'underline' }}>{label}</ThemedText></Pressable>
  );
  return (
    <View style={{ gap: Spacing.sm }}>
      {item.priceEstimated && (
        <View style={[styles.wrap, { alignItems: 'center' }]}>
          <Badge size="sm" variant="warning">estimated price — not catalog verified</Badge>
          {item.estimateLink && link(item.estimateLink, item.estimateLink.includes('/p/') ? 'View on Home Depot' : 'Search Home Depot')}
        </View>
      )}
      {item.priceSource && (
        <ThemedText type="caption">Price source: <ThemedText type="caption" style={{ fontWeight: '600' }}>{item.priceSource.replace(/\s*—\s*online fallback/i, '')}</ThemedText></ThemedText>
      )}
      {item.product?.link && (
        <View style={[styles.wrap, { alignItems: 'center' }]}>
          {link(item.product.link, 'View on Home Depot')}
          {item.product.brand && <ThemedText type="caption">{item.product.brand}</ThemedText>}
          {item.product.rating != null && <ThemedText type="caption">★ {item.product.rating.toFixed(1)}</ThemedText>}
          {item.product.packageQuantity != null && item.product.packageQuantity > 1 && (
            <ThemedText type="caption">sold in packs of {item.product.packageQuantity} — price is per unit, quantity rounded to whole packs</ThemedText>
          )}
        </View>
      )}
      {item.flags.includes('missing_quantity') && <ThemedText type="caption">Enter a quantity above — same effect as if it had been spoken.</ThemedText>}
      {item.flags.includes('unmatched') && !searching && (
        <ThemedText type="caption">No catalog price found — edit the description to a product name (it searches again automatically), type a price, or remove it. No price was guessed.</ThemedText>
      )}
      {item.flags.includes('estimated_price') && !frozen && (
        <ThemedText type="caption">This price came from a web search, so it needs confirming before the estimate can be completed — type the price you want (it has to differ from the one shown), or remove the line.</ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  overlay: { ...StyleSheet.absoluteFill, zIndex: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  summary: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  dot: { width: 6, height: 6, borderRadius: 3 },
  desc: { fontSize: 15, fontWeight: '600' },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.sm, marginTop: 2 },
  flag: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 },
  editor: { borderTopWidth: 1, padding: Spacing.md, gap: Spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  cell: { flexBasis: '45%', flexGrow: 1 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
});
