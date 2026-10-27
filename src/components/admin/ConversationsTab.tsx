import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { Actions, Empty, Hint, RecordCard, useAction } from '@/components/admin/common';
import { ThemedText } from '@/components/themed-text';
import { Badge, Button } from '@/components/ui';
import { CheckRow } from '@/components/ui/Select';
import { confirm, fmtDateTime, toast } from '@/lib/ui';
import { adminService, type AdminConversation } from '@/services/adminService';

export function ConversationsTab({ companyId }: { companyId: number }) {
  const [conversations, setConversations] = useState<AdminConversation[]>([]);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const { busy, run } = useAction();
  const reload = useCallback(async () => { setConversations(await adminService.listConversations(companyId)); setSelected(new Set()); }, [companyId]);
  useEffect(() => { void reload().catch(() => toast.error('Could not load conversations')); }, [reload]);

  const toggle = (id: string) => { const n = new Set(selected); n.has(id) ? n.delete(id) : n.add(id); setSelected(n); };
  const selectable = conversations.filter((c) => includeCompleted || c.status !== 'COMPLETED').map((c) => c.quoteId);
  const deleteSelected = () => run(async () => {
    const ids = [...selected];
    if (!(await confirm(`Permanently delete ${ids.length} conversation(s) and their quotes? This cannot be undone.`))) return;
    const { deleted } = await adminService.deleteConversations(companyId, ids, includeCompleted);
    toast.success(`Deleted ${deleted} conversation(s)`); await reload();
  });

  return (
    <>
      <Hint>Estimate chats for this company. Deleting a conversation permanently removes its messages, its quote, and all line items.</Hint>
      <Actions>
        <CheckRow label="Select all" checked={selectable.length > 0 && selectable.every((id) => selected.has(id))} onChange={(v) => setSelected(v ? new Set(selectable) : new Set())} />
        <CheckRow label="Include completed quotes" checked={includeCompleted} onChange={(v) => {
          setIncludeCompleted(v);
          if (!v) setSelected(new Set([...selected].filter((id) => conversations.find((c) => c.quoteId === id)?.status !== 'COMPLETED')));
        }} />
        <Button size="sm" variant="danger" icon="trash-outline" disabled={busy || selected.size === 0} onPress={deleteSelected}>Delete selected ({selected.size})</Button>
      </Actions>
      {conversations.length === 0 && <Empty>No estimate conversations for this company.</Empty>}
      {conversations.map((c) => {
        const disabled = c.status === 'COMPLETED' && !includeCompleted;
        return (
          <RecordCard key={c.quoteId} dim={disabled}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <CheckRow label={fmtDateTime(c.createdAt)} checked={selected.has(c.quoteId)} disabled={disabled} onChange={() => toggle(c.quoteId)} />
              </View>
              <Badge size="sm" variant={c.status === 'COMPLETED' ? 'primary' : 'default'}>{c.status}</Badge>
              <ThemedText type="caption">{c.lineItemCount} items</ThemedText>
            </View>
            <ThemedText type="caption" numberOfLines={2}>{c.firstMessage ?? '—'}</ThemedText>
          </RecordCard>
        );
      })}
    </>
  );
}
