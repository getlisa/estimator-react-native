import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Input } from '@/components/ui';
import { Sheet } from '@/components/ui/Sheet';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { errMsg, toast } from '@/lib/ui';
import { customersService, type CustomerOption } from '@/services/connectionsService';

/** Choose the customer an estimate bills to — existing, or created on the spot (QboCustomerPicker.tsx). */
export function CustomerPicker({ open, onClose, linkedId, qboConnected, seed, onPicked }: {
  open: boolean; onClose: () => void; linkedId: number | null; qboConnected: boolean;
  seed?: { name?: string | null; email?: string | null; phone?: string | null; address?: string | null };
  onPicked: (c: { customerId: number; name: string }) => void;
}) {
  const { colors } = useTheme();
  const qbo = qboConnected;
  const [mode, setMode] = useState<'search' | 'create'>('search');
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<CustomerOption[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '' });
  const [parent, setParent] = useState<CustomerOption | null>(null);
  const [parentTerm, setParentTerm] = useState('');
  const [parentResults, setParentResults] = useState<CustomerOption[] | null>(null);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(0);
  const runSearch = useCallback((q: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const seq = ++latest.current;
      setSearching(true);
      try { const rows = await customersService.search(q); if (seq === latest.current) setResults(rows); }
      catch { if (seq === latest.current) setResults((p) => p ?? []); }
      finally { if (seq === latest.current) setSearching(false); }
    }, 250);
  }, []);
  const parentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const parentLatest = useRef(0);
  const runParentSearch = useCallback((q: string) => {
    if (parentTimer.current) clearTimeout(parentTimer.current);
    if (!q.trim()) return setParentResults(null);
    parentTimer.current = setTimeout(async () => {
      const seq = ++parentLatest.current;
      try { const rows = await customersService.search(q); if (seq === parentLatest.current) setParentResults(rows); }
      catch { if (seq === parentLatest.current) setParentResults((p) => p ?? []); }
    }, 250);
  }, []);

  useEffect(() => {
    if (!open) return;
    setMode('search'); setTerm('');
    setForm({ name: seed?.name?.trim() ?? '', email: seed?.email?.trim() ?? '', phone: seed?.phone?.trim() ?? '', address: seed?.address?.trim() ?? '' });
    setParent(null); setParentTerm(''); setParentResults(null);
    runSearch('');
    return () => { if (timer.current) clearTimeout(timer.current); if (parentTimer.current) clearTimeout(parentTimer.current); latest.current++; parentLatest.current++; };
  }, [open, runSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  const create = async () => {
    const name = form.name.trim();
    if (!name) return toast.error('A customer name is required');
    setSaving(true);
    try {
      const created = await customersService.create({ name, email: form.email.trim() || undefined, phone: form.phone.trim() || undefined, address: form.address.trim() || undefined, parentId: parent?.id });
      const LABELS: Record<string, string> = { line1: 'street address', city: 'city', state: 'state', postalCode: 'ZIP code' };
      const gaps = (created.addressMissing ?? []).map((k) => LABELS[k] ?? k);
      const under = parent ? `Added under ${parent.name}. ` : '';
      const desc = qbo && gaps.length ? `${under}Address is missing the ${gaps.join(', ')} — add it in QuickBooks when you can.` : under.trim();
      toast.success(`${created.qboId ? `${created.name} added to QuickBooks` : `${created.name} added`}${desc ? ` — ${desc}` : ''}`);
      onPicked({ customerId: created.customerId, name: created.name });
      onClose();
    } catch (e) {
      toast.error('Could not add the customer', errMsg(e));
    } finally { setSaving(false); }
  };

  return (
    <Sheet open={open} onClose={onClose} title={mode === 'search' ? 'Customer' : 'New customer'}
      description={mode === 'search' ? 'Pick who this estimate bills to, or add someone new.' : qbo ? 'Saved here, and created in QuickBooks too.' : undefined}>
      {mode === 'search' ? (
        <>
          <Input autoFocus value={term} onChangeText={(t) => { setTerm(t); runSearch(t); }} placeholder="Search customers" leftIcon="search" />
          <View style={{ maxHeight: 320 }}>
            {results === null || (searching && !results.length) ? (
              <ActivityIndicator color={colors.tint} style={{ paddingVertical: Spacing.xl }} />
            ) : results.length === 0 ? (
              (term || qbo) ? (
                <ThemedText type="caption" style={{ textAlign: 'center', paddingVertical: Spacing.xl }}>
                  {term ? 'No customer matches that name.' : 'No customers yet. Add one here, or sync QuickBooks from Settings.'}
                </ThemedText>
              ) : null
            ) : (
              results.map((c) => (
                <Pressable key={c.id} onPress={() => { onPicked({ customerId: c.id, name: c.name }); onClose(); }}
                  style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.backgroundSecondary }]}>
                  <Ionicons name="business-outline" size={18} color={colors.textSecondary} />
                  <View style={{ flex: 1 }}>
                    <ThemedText style={{ fontWeight: '500' }} numberOfLines={1}>{c.name}</ThemedText>
                    {c.fullyQualifiedName && <ThemedText type="caption" numberOfLines={1}>{c.fullyQualifiedName}</ThemedText>}
                    {(c.email || c.phone) && <ThemedText type="caption" numberOfLines={1}>{[c.email, c.phone].filter(Boolean).join(' · ')}</ThemedText>}
                  </View>
                  {c.id === linkedId && <Ionicons name="checkmark" size={18} color={colors.success} />}
                </Pressable>
              ))
            )}
          </View>
          <Button variant="secondary" icon="person-add-outline" fullWidth onPress={() => { setForm((f) => ({ ...f, name: f.name || term.trim() })); setMode('create'); }}>
            Add a new customer
          </Button>
        </>
      ) : (
        <>
          {qbo && (
            <View style={{ gap: 6 }}>
              <ThemedText type="label">Part of an existing customer? (optional)</ThemedText>
              {parent ? (
                <View style={[styles.parent, { borderColor: colors.border }]}>
                  <ThemedText style={{ flex: 1 }} numberOfLines={1}>Under <ThemedText style={{ fontWeight: '600' }}>{parent.name}</ThemedText></ThemedText>
                  <Button size="sm" variant="ghost" onPress={() => setParent(null)}>Clear</Button>
                </View>
              ) : (
                <>
                  <Input placeholder="Search a parent customer" value={parentTerm} onChangeText={(t) => { setParentTerm(t); runParentSearch(t); }} />
                  {parentTerm.trim() !== '' && (
                    <View style={[styles.parentList, { borderColor: colors.border }]}>
                      {parentResults === null ? (
                        <ActivityIndicator color={colors.tint} style={{ padding: Spacing.sm }} />
                      ) : parentResults.filter((c) => c.qboId).length === 0 ? (
                        <ThemedText type="caption" style={{ padding: Spacing.md }}>No synced customer matches. Only customers already in QuickBooks can be a parent — sync from Settings first.</ThemedText>
                      ) : (
                        parentResults.filter((c) => c.qboId).map((c) => (
                          <Pressable key={c.id} onPress={() => { setParent(c); setParentTerm(''); }} style={({ pressed }) => [styles.parentRow, pressed && { backgroundColor: colors.backgroundSecondary }]}>
                            <ThemedText numberOfLines={1}>{c.fullyQualifiedName ?? c.name}</ThemedText>
                          </Pressable>
                        ))
                      )}
                    </View>
                  )}
                </>
              )}
            </View>
          )}
          <Input label="Name" autoFocus value={form.name} onChangeText={(name) => setForm({ ...form, name })}
            hint={qbo ? 'QuickBooks shares names with vendors and employees, so a name already in use elsewhere will be rejected.' : undefined} />
          <Input label="Email" value={form.email} onChangeText={(email) => setForm({ ...form, email })} credentialType="email" />
          <Input label="Phone" value={form.phone} onChangeText={(phone) => setForm({ ...form, phone })} keyboardType="phone-pad" />
          <Input label="Address" value={form.address} onChangeText={(address) => setForm({ ...form, address })} />
          <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
            <Button style={{ flex: 1 }} onPress={create} loading={saving} icon="add">Save</Button>
            <Button variant="secondary" onPress={() => setMode('search')} disabled={saving}>Back</Button>
          </View>
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm, borderRadius: 8, minHeight: 48 },
  parent: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderWidth: 1, borderRadius: 8, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
  parentList: { borderWidth: 1, borderRadius: 8, maxHeight: 160 },
  parentRow: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
});
