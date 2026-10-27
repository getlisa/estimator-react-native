import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { Actions, Empty, Hint, RecordCard, Row, useAction } from '@/components/admin/common';
import { ThemedText } from '@/components/themed-text';
import { Button, Input } from '@/components/ui';
import { MIME, pickDocument } from '@/lib/pickFile';
import { confirm, toast } from '@/lib/ui';
import type { PickedFile } from '@/lib/upload';
import { adminService, type AdminPricebook, type IngestResult } from '@/services/adminService';

export function PricebooksTab({ companyId }: { companyId: number }) {
  const [books, setBooks] = useState<AdminPricebook[]>([]);
  const [priorities, setPriorities] = useState<Record<number, string>>({});
  const [lastIngest, setLastIngest] = useState<IngestResult | null>(null);
  const [newName, setNewName] = useState('');
  const [newPriority, setNewPriority] = useState('');
  const [newFile, setNewFile] = useState<PickedFile | null>(null);
  const { busy, run } = useAction();

  const reload = useCallback(async () => {
    const list = await adminService.listPricebooks(companyId);
    setBooks(list);
    setPriorities(Object.fromEntries(list.map((b) => [b.id, String(b.priority)])));
  }, [companyId]);
  useEffect(() => { void reload().catch(() => toast.error('Could not load pricebooks')); }, [reload]);

  const report = (prefix: string, r: IngestResult) => {
    setLastIngest(r);
    toast.success(`${prefix} ${r.ingested} rows (${r.skipped.length} skipped) — re-priced ${r.repricedDraftLines} draft lines`);
  };
  const upload = () => run(async () => {
    if (!newFile || !newName.trim() || !newPriority.trim()) return toast.error('File, name, and priority are all required');
    report('Ingested', await adminService.createPricebook(companyId, newFile, newName.trim(), Number(newPriority)));
    setNewName(''); setNewPriority(''); setNewFile(null);
    await reload();
  });
  const saveOrder = () => run(async () => {
    const orders = books.map((b) => ({ id: b.id, priority: Number(priorities[b.id]) }));
    if (orders.some((o) => !Number.isInteger(o.priority))) return toast.error('Every priority must be an integer');
    const { repricedDraftLines } = await adminService.reorderPricebooks(companyId, orders);
    toast.success(`Priorities saved — re-priced ${repricedDraftLines} draft lines`);
    await reload();
  });
  const replace = (id: number) => run(async () => {
    const file = await pickDocument(MIME.pricebook);
    if (!file) return;
    report('Replaced:', await adminService.replacePricebookFile(id, file));
    await reload();
  });
  const remove = (b: AdminPricebook) => run(async () => {
    if (!(await confirm(`Delete pricebook "${b.name}" and its ${b.itemCount} items?`))) return;
    const { repricedDraftLines } = await adminService.deletePricebook(b.id);
    toast.success(`Deleted — re-priced ${repricedDraftLines} draft lines`);
    await reload();
  });

  return (
    <>
      <Hint>Priority is the order books are checked and the tiebreaker for equal prices. When the same item appears in more than one book, the higher price wins regardless of priority. Every change here re-prices the company's open Draft quotes immediately.</Hint>
      {books.length === 0 && <Empty>No pricebooks yet — this company prices only via Home Depot fallback (if enabled) until one is uploaded.</Empty>}
      {books.map((b) => (
        <RecordCard key={b.id}>
          <ThemedText type="defaultSemiBold">{b.name}</ThemedText>
          {b.originalFilename && <ThemedText type="caption">{b.originalFilename}</ThemedText>}
          <ThemedText type="caption">{b.sourceFormat ?? '—'} · {b.itemCount} items</ThemedText>
          <Row>
            <Input label="Priority" containerStyle={{ width: 110 }} value={priorities[b.id] ?? ''} onChangeText={(v) => setPriorities({ ...priorities, [b.id]: v })} keyboardType="numeric" />
            <Button size="sm" variant="secondary" disabled={busy} onPress={() => replace(b.id)}>Replace file</Button>
            <Button size="sm" variant="ghost" icon="trash-outline" disabled={busy} onPress={() => remove(b)}>Delete</Button>
          </Row>
        </RecordCard>
      ))}
      {books.length > 1 && <Button size="sm" variant="secondary" disabled={busy} onPress={saveOrder}>Save priority order</Button>}
      <RecordCard>
        <ThemedText type="defaultSemiBold">Upload a new pricebook (CSV, Excel, or PDF)</ThemedText>
        <Input placeholder="Name" value={newName} onChangeText={setNewName} />
        <Input placeholder="Priority (1 = first)" value={newPriority} onChangeText={setNewPriority} keyboardType="numeric" />
        <Actions>
          <Button size="sm" variant="secondary" icon="document-outline" onPress={() => pickDocument(MIME.pricebook).then(setNewFile)}>{newFile ? newFile.name : 'Choose file'}</Button>
          <Button size="sm" icon="cloud-upload-outline" loading={busy} onPress={upload}>Upload</Button>
        </Actions>
      </RecordCard>
      {lastIngest && (
        <RecordCard>
          <ThemedText type="defaultSemiBold">Last ingest: {lastIngest.ingested} rows ingested, {lastIngest.skipped.length} skipped</ThemedText>
          {lastIngest.columns && (
            <ThemedText type="caption">
              Columns read — description: "{lastIngest.columns.description}", price: "{lastIngest.columns.price}"
              {lastIngest.columns.code ? `, code: "${lastIngest.columns.code}"` : ''}{lastIngest.columns.unit ? `, unit: "${lastIngest.columns.unit}"` : ''}. If the description column looks wrong, fix the sheet's headers and re-upload.
            </ThemedText>
          )}
          {lastIngest.skipped.slice(0, 20).map((s, i) => <ThemedText key={i} type="caption">line {s.line}: {s.reason}</ThemedText>)}
          {lastIngest.skipped.length > 20 && <ThemedText type="caption">…and {lastIngest.skipped.length - 20} more (all logged server-side)</ThemedText>}
        </RecordCard>
      )}
      <View />
    </>
  );
}
