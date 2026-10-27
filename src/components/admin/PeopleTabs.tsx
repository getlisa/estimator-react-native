import { useCallback, useEffect, useState } from 'react';
import { Switch, View } from 'react-native';

import { Actions, Empty, Hint, RecordCard, Row, useAction } from '@/components/admin/common';
import { ThemedText } from '@/components/themed-text';
import { Button, Input } from '@/components/ui';
import { useTheme } from '@/contexts/ThemeContext';
import { confirm, toast } from '@/lib/ui';
import { adminService, type AdminLaborRate, type AdminPriceMemory, type AdminUser } from '@/services/adminService';

const validNameRate = (name: string, rateStr: string) => {
  const rate = Number(rateStr);
  if (!name.trim() || !Number.isFinite(rate) || rate < 0) { toast.error('A name and a rate of $0 or more are required'); return null; }
  return rate;
};

export function LaborTab({ companyId }: { companyId: number }) {
  const [rates, setRates] = useState<AdminLaborRate[]>([]);
  const [drafts, setDrafts] = useState<Record<number, { name: string; rate: string }>>({});
  const [newName, setNewName] = useState('');
  const [newRate, setNewRate] = useState('');
  const { busy, run } = useAction();
  const reload = useCallback(async () => {
    const list = await adminService.listLaborRates(companyId);
    setRates(list); setDrafts(Object.fromEntries(list.map((r) => [r.id, { name: r.name, rate: String(r.hourlyRate) }])));
  }, [companyId]);
  useEffect(() => { void reload().catch(() => toast.error('Could not load labor rates')); }, [reload]);

  return (
    <>
      <Hint>Named hourly labor types the estimating agent prices labor against. $0 is a valid rate (comped/warranty work). Rate changes re-price the company's open Draft quotes immediately; technician-overridden rates are never touched.</Hint>
      {rates.length === 0 && <Empty>No labor types — the agent will ask technicians for both hours and an hourly rate directly.</Empty>}
      {rates.map((r) => (
        <RecordCard key={r.id}>
          <Row>
            <Input label="Type name" containerStyle={{ flex: 2, minWidth: 140 }} value={drafts[r.id]?.name ?? r.name} onChangeText={(v) => setDrafts({ ...drafts, [r.id]: { ...drafts[r.id], name: v } })} />
            <Input label="Hourly rate ($)" containerStyle={{ flex: 1, minWidth: 100 }} value={drafts[r.id]?.rate ?? String(r.hourlyRate)} onChangeText={(v) => setDrafts({ ...drafts, [r.id]: { ...drafts[r.id], rate: v } })} keyboardType="decimal-pad" />
          </Row>
          <Actions>
            <Button size="sm" variant="secondary" disabled={busy} onPress={() => run(async () => {
              const d = drafts[r.id]; const rate = validNameRate(d.name, d.rate); if (rate == null) return;
              await adminService.updateLaborRate(r.id, { name: d.name.trim(), hourlyRate: rate }); toast.success('Labor rate saved (open Drafts re-priced)'); await reload();
            })}>Save</Button>
            <Button size="sm" variant="ghost" icon="trash-outline" disabled={busy} onPress={() => run(async () => {
              if (!(await confirm(`Delete labor type "${r.name}"?`))) return;
              await adminService.deleteLaborRate(r.id); toast.success('Labor type deleted'); await reload();
            })}>Delete</Button>
          </Actions>
        </RecordCard>
      ))}
      <RecordCard>
        <Row>
          <Input containerStyle={{ flex: 2, minWidth: 140 }} placeholder="New type name (e.g. Standard)" value={newName} onChangeText={setNewName} />
          <Input containerStyle={{ flex: 1, minWidth: 100 }} placeholder="Rate $/hr" value={newRate} onChangeText={setNewRate} keyboardType="decimal-pad" />
          <Button loading={busy} onPress={() => run(async () => {
            const rate = validNameRate(newName, newRate); if (rate == null) return;
            await adminService.createLaborRate(companyId, newName.trim(), rate); setNewName(''); setNewRate(''); toast.success('Labor type added'); await reload();
          })}>Add</Button>
        </Row>
      </RecordCard>
    </>
  );
}

export function PriceMemoryTab({ companyId }: { companyId: number }) {
  const { colors } = useTheme();
  const [entries, setEntries] = useState<AdminPriceMemory[]>([]);
  const [drafts, setDrafts] = useState<Record<number, { name: string; rate: string }>>({});
  const { busy, run } = useAction();
  const reload = useCallback(async () => {
    const list = await adminService.listPriceMemory(companyId);
    setEntries(list); setDrafts(Object.fromEntries(list.map((e) => [e.id, { name: e.name, rate: String(e.rate) }])));
  }, [companyId]);
  useEffect(() => { void reload().catch(() => toast.error('Could not load price memory')); }, [reload]);

  return (
    <>
      <Hint>Prices learned from technicians with the learning permission (Technicians tab), for products not in the pricebook. Every technician in the company gets these auto-filled. The pricebook always wins over memory. Disabled entries stay stored but are not auto-filled. Changes here affect new line items only — existing estimates keep their prices.</Hint>
      {entries.length === 0 && <Empty>Nothing learned yet — give a technician the learning permission and have them price a product that is not in the pricebook.</Empty>}
      {entries.map((e) => (
        <RecordCard key={e.id} dim={!e.isActive}>
          <Row>
            <Input label="Product name" containerStyle={{ flex: 2, minWidth: 140 }} value={drafts[e.id]?.name ?? e.name} onChangeText={(v) => setDrafts({ ...drafts, [e.id]: { ...drafts[e.id], name: v } })} />
            <Input label="Rate ($)" containerStyle={{ flex: 1, minWidth: 100 }} value={drafts[e.id]?.rate ?? String(e.rate)} onChangeText={(v) => setDrafts({ ...drafts, [e.id]: { ...drafts[e.id], rate: v } })} keyboardType="decimal-pad" />
          </Row>
          {e.description && <ThemedText type="caption">{e.description}</ThemedText>}
          <ThemedText type="caption">{e.isLabor ? 'Labor' : 'Material'} · set by {e.setBy ?? '—'} · {new Date(e.setAt).toLocaleDateString()}</ThemedText>
          <Actions>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <ThemedText type="caption">Active</ThemedText>
              <Switch value={e.isActive} disabled={busy} trackColor={{ true: colors.primary }} onValueChange={(checked) => run(async () => {
                await adminService.updatePriceMemory(e.id, { isActive: checked }); toast.success(checked ? 'Entry re-enabled' : 'Entry disabled'); await reload();
              })} />
            </View>
            <Button size="sm" variant="secondary" disabled={busy} onPress={() => run(async () => {
              const d = drafts[e.id]; const rate = validNameRate(d.name, d.rate); if (rate == null) return;
              await adminService.updatePriceMemory(e.id, { name: d.name.trim(), rate }); toast.success('Memory entry saved'); await reload();
            })}>Save</Button>
            <Button size="sm" variant="ghost" icon="trash-outline" disabled={busy} onPress={() => run(async () => {
              if (!(await confirm(`Delete "${e.name}" from memory?`))) return;
              await adminService.deletePriceMemory(e.id); toast.success('Memory entry deleted'); await reload();
            })}>Delete</Button>
          </Actions>
        </RecordCard>
      ))}
    </>
  );
}

export function TechniciansTab({ companyId }: { companyId: number }) {
  const { colors } = useTheme();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const { busy, run } = useAction();
  const reload = useCallback(async () => setUsers(await adminService.listUsers(companyId)), [companyId]);
  useEffect(() => { void reload().catch(() => toast.error('Could not load technicians')); }, [reload]);
  return (
    <>
      <Hint>Learning permission: a technician with it ON teaches organization price memory — the prices they enter for products not in the pricebook are saved and auto-filled for everyone in the company. Off by default; only Clara staff change it.</Hint>
      {users.length === 0 && <Empty>No accounts for this company.</Empty>}
      {users.map((u) => (
        <RecordCard key={u.id}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <ThemedText type="defaultSemiBold">{u.name}</ThemedText>
              <ThemedText type="caption">{u.email} · {u.role}</ThemedText>
            </View>
            <View style={{ alignItems: 'center' }}>
              <ThemedText type="caption">Learns prices</ThemedText>
              <Switch value={u.priceMemoryLearner} disabled={busy} trackColor={{ true: colors.primary }} onValueChange={(checked) => run(async () => {
                await adminService.setPriceMemoryLearner(u.id, checked); toast.success(`${u.name}: learning ${checked ? 'on' : 'off'}`); await reload();
              })} />
            </View>
          </View>
        </RecordCard>
      ))}
    </>
  );
}
