import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { DraftField, SwitchRow } from '@/components/estimates/Fields';
import { QboItemSelect } from '@/components/estimates/QboItemSelect';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { qboAutoItemName } from '@/lib/qboItemName';
import { toast } from '@/lib/ui';
import type { QboItem } from '@/services/connectionsService';
import { quotesService, type Quote } from '@/services/quotesService';

/** Adds a line by hand, inline in its section (EstimateAddRow.tsx). */
export function AddRow({ quote, isLabor, qboItems, busy, onQuoteChange, onDone }: {
  quote: Quote; isLabor: boolean; qboItems: QboItem[] | null; busy: boolean; onQuoteChange: (q: Quote) => void; onDone: () => void;
}) {
  const { colors } = useTheme();
  const [description, setDescription] = useState('');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState(isLabor ? 'hr' : '');
  const [price, setPrice] = useState('');
  const [taxable, setTaxable] = useState(!isLabor);
  const [qboItem, setQboItem] = useState<{ id: string; name: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const locked = saving || busy;

  const add = async () => {
    if (locked || !description.trim()) return;
    setSaving(true);
    try {
      const priceNum = parseFloat(price.replace(/[$,]/g, ''));
      const qtyNum = parseFloat(qty.replace(/[,\s]/g, ''));
      await quotesService.addItem(quote.id, {
        description: description.trim(),
        quantity: qty && !isNaN(qtyNum) ? qtyNum : null,
        ...(unit.trim() ? { unit: unit.trim() } : {}),
        ...(price && !isNaN(priceNum) ? { unitPrice: priceNum } : {}),
        isLabor,
        taxable,
        qboItemId: qboItem?.id ?? null,
        qboItemName: qboItem?.name ?? null,
      });
      // ponytail: web's deploy-skew corrective PATCH (EstimateAddRow.tsx:79-97) skipped — server ships these fields.
      // Full refetch: the server re-prices and re-flags the whole quote on an add.
      onQuoteChange(await quotesService.get(quote.id));
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not add item');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.card, { borderColor: colors.primary, backgroundColor: colors.cardBackground }]}>
      <DraftField value={description} onChange={setDescription} disabled={locked} autoFocus inputMode="text" onSubmit={add}
        placeholder={isLabor ? 'Labor description' : 'Item description'} />
      <View style={styles.row}>
        <DraftField label="Qty" value={qty} onChange={setQty} disabled={locked} />
        <DraftField label="Unit" value={unit} onChange={setUnit} disabled={locked} inputMode="text" />
        <DraftField label="Price" value={price} onChange={setPrice} disabled={locked} />
      </View>
      <SwitchRow label="Taxable" value={taxable} disabled={locked} onChange={setTaxable} />
      {qboItems && (
        <QboItemSelect autoName={qboAutoItemName(isLabor, null, description.trim())} value={qboItem?.id ?? null} qboItems={qboItems} disabled={locked} onChange={setQboItem} />
      )}
      <ThemedText type="caption">Leave the price blank and it goes through the same pricebook matching as a spoken item.</ThemedText>
      <View style={styles.row}>
        <Button variant="secondary" style={{ flex: 1 }} disabled={locked} onPress={onDone}>Cancel</Button>
        <Button style={{ flex: 1 }} disabled={locked || !description.trim()} loading={saving} onPress={add}>Add</Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 2, borderRadius: 12, padding: Spacing.md, gap: Spacing.md },
  row: { flexDirection: 'row', gap: Spacing.md },
});
