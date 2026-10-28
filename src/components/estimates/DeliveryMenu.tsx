import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { PdfViewer } from '@/components/PdfViewer';
import { ThemedText } from '@/components/themed-text';
import { Button, Input } from '@/components/ui';
import { Sheet } from '@/components/ui/Sheet';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { saveOrShare } from '@/lib/download';
import { qboEstimateUrl } from '@/lib/qboLinks';
import { errMsg, fmtDateTime, toast } from '@/lib/ui';
import { connectionsService, type ConnectionsStatus } from '@/services/connectionsService';
import { quotesService, type Quote } from '@/services/quotesService';

interface Props { quote: Quote; onQuoteChange: (q: Quote) => void }

/** Send / Download menu (QuoteDetail.tsx DeliveryMenu). Email review is a sheet, not a menu item. */
export function DeliveryMenu({ quote, onQuoteChange }: Props) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ to: string; subject: string; body: string } | null>(null);
  const [attachment, setAttachment] = useState<{ blob: Blob; filename: string } | null>(null);
  const [emailing, setEmailing] = useState(false);
  // Inline, like the web dialog's iframe: a second Modal on top of this sheet never shows on iOS.
  const [previewing, setPreviewing] = useState(false);
  const [connections, setConnections] = useState<ConnectionsStatus | null>(null);

  useEffect(() => { connectionsService.get().then(setConnections).catch(() => undefined); }, []);

  const run = async (key: string, fn: () => Promise<void>) => {
    setWorking(key);
    try { await fn(); } finally { setWorking(null); }
  };

  const refetch = async (fallback: Partial<Quote>) => {
    try {
      const { messages: _m, ...fresh } = await quotesService.get(quote.id);
      onQuoteChange(fresh);
    } catch {
      onQuoteChange({ ...quote, ...fallback });
    }
  };

  const openDraft = () => run('draft', async () => {
    try {
      const [d, blob] = await Promise.all([quotesService.emailDraft(quote.id), quotesService.proposalPdfBlob(quote.id)]);
      setOpen(false);
      setDraft(d);
      setAttachment(blob);
    } catch (e) { toast.error(errMsg(e, 'Failed to draft email')); }
  });

  const sendEmail = async () => {
    if (!draft) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.to.trim())) return toast.error('Enter a valid recipient email address');
    setEmailing(true);
    try {
      const { to } = await quotesService.emailProposal(quote.id, { ...draft, to: draft.to.trim() });
      toast.success(`Proposal sent to ${to}`);
      setDraft(null); setAttachment(null); setPreviewing(false);
    } catch (e) { toast.error(errMsg(e, 'Failed to send email')); } finally { setEmailing(false); }
  };

  const qbo = connections?.qbo;
  const connected = qbo?.connected === true;
  const completed = quote.status === 'COMPLETED';
  const qboUrl = quote.qboEstimateId && connected && qbo ? qboEstimateUrl(quote.qboEstimateId, qbo.environment) : null;
  const syncable = connected && completed;
  const ztSyncable = connections?.zt?.connected === true && !!quote.ztTicketId && completed;
  const uptickSyncable = connections?.uptick?.connected === true && !!quote.uptickTaskId && completed;
  const stSyncable = connections?.servicetrade?.connected === true && !!quote.stJobId && completed;
  // Housecall Pro also files quotes started from a customer with no job (customer_hcp link).
  const hcpSyncable = connections?.hcp?.connected === true && !!(quote.hcpJobId || quote.hcpCustomerId) && completed;
  const retry = 'The last send failed — this retries it.';

  const items: { key: string; icon: keyof typeof Ionicons.glyphMap; title: string; subtitle?: string; onPress: () => void }[] = [
    { key: 'draft', icon: 'mail-outline', title: 'Send via Email', subtitle: 'Drafts it for you to review — nothing sends until you confirm.', onPress: openDraft },
    { key: 'docx', icon: 'download-outline', title: 'Download (.docx)', subtitle: "The full bid proposal in your company's own format.",
      onPress: () => run('docx', async () => { try { await quotesService.downloadProposalDocx(quote.id); setOpen(false); } catch (e) { toast.error(errMsg(e, 'Download failed')); } }) },
  ];
  if (qboUrl) items.push({ key: 'qbo-open', icon: 'open-outline', title: 'Open in QuickBooks', onPress: () => { setOpen(false); Linking.openURL(qboUrl); } });
  if (syncable) items.push({
    key: 'qbo', icon: 'refresh-outline', title: quote.qboEstimateId ? 'Re-sync to QuickBooks' : 'Sync to QuickBooks',
    subtitle: quote.qboSyncedAt ? `Last synced ${fmtDateTime(quote.qboSyncedAt)}` : 'Updates the estimate it already has — never a second copy.',
    onPress: () => run('qbo', async () => {
      try {
        const { updated, estimateId } = await quotesService.syncToQbo(quote.id);
        toast.success(updated ? 'Estimate updated in QuickBooks' : 'Estimate sent to QuickBooks');
        setOpen(false);
        await refetch({ qboEstimateId: estimateId, qboSyncError: null });
      } catch (e) { toast.error('Could not send to QuickBooks', errMsg(e)); }
    }),
  });
  const crm = (key: string, title: string, subtitle: string, fn: () => Promise<unknown>, label: string) =>
    items.push({ key, icon: 'refresh-outline', title, subtitle, onPress: () => run(key, async () => {
      try { const q = await fn(); toast.success(`Estimate sent to ${label}`); setOpen(false); if (q && typeof q === 'object' && 'id' in (q as object)) onQuoteChange(q as Quote); else await refetch({}); }
      catch (e) { toast.error(`Could not send to ${label}`, errMsg(e)); }
    }) });
  if (ztSyncable) crm('zt', quote.ztEstimateId ? 'Re-sync to ZenTrades' : 'Sync to ZenTrades',
    quote.ztSyncError ? retry : quote.ztSyncedAt ? `Last synced ${fmtDateTime(quote.ztSyncedAt)}` : `Files it against ZenTrades job ${quote.ztTicketId} — never a second copy.`,
    () => quotesService.syncToZt(quote.id), 'ZenTrades');
  if (uptickSyncable) crm('uptick', quote.uptickQuoteId ? 'Re-sync to Uptick' : 'Sync to Uptick',
    quote.uptickSyncError ? retry : quote.uptickSyncedAt ? `Last synced ${fmtDateTime(quote.uptickSyncedAt)}${quote.uptickQuoteRef ? ` as ${quote.uptickQuoteRef}` : ''}` : "Creates a draft defect quote on the job's property and attaches the proposal PDF to the job.",
    () => quotesService.syncToUptick(quote.id), 'Uptick');
  if (stSyncable) crm('st', quote.stQuoteId ? 'Re-sync to ServiceTrade' : 'Sync to ServiceTrade',
    quote.stSyncError ? retry : quote.stSyncedAt ? `Last synced ${fmtDateTime(quote.stSyncedAt)}${quote.stQuoteRef ? ` as quote ${quote.stQuoteRef}` : ''}` : "Creates a draft quote on the job's location and attaches the proposal PDF to the job.",
    () => quotesService.syncToServicetrade(quote.id), 'ServiceTrade');
  if (hcpSyncable) crm('hcp', quote.hcpSyncedAt ? 'Re-sync to Housecall Pro' : 'Sync to Housecall Pro',
    quote.hcpSyncError ? retry : quote.hcpSyncedAt ? `${quote.hcpEstimateRef ? `Estimate #${quote.hcpEstimateRef} · ` : ''}Last synced ${fmtDateTime(quote.hcpSyncedAt)}` : "Creates an estimate in Housecall Pro for the job's customer and attaches the proposal PDF.",
    () => quotesService.syncToHcp(quote.id), 'Housecall Pro');

  return (
    <>
      <Button size="sm" variant="secondary" onPress={() => setOpen(true)} loading={!!working} icon="chevron-down" iconPosition="right">
        Send / Download
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Send / Download" maxWidth={420}>
        {items.map((it) => (
          <Pressable key={it.key} disabled={!!working} onPress={it.onPress}
            style={({ pressed }) => [styles.item, pressed && { backgroundColor: colors.backgroundSecondary }]}>
            {working === it.key ? <ActivityIndicator size="small" color={colors.icon} /> : <Ionicons name={it.icon} size={20} color={colors.icon} />}
            <View style={{ flex: 1 }}>
              <ThemedText style={{ fontWeight: '500' }}>{it.title}</ThemedText>
              {it.subtitle && <ThemedText type="caption">{it.subtitle}</ThemedText>}
            </View>
          </Pressable>
        ))}
      </Sheet>
      <Sheet open={!!draft} onClose={() => { setDraft(null); setAttachment(null); setPreviewing(false); }} title="Review email before sending"
        description="Edit anything below. The bid-proposal PDF will be attached." maxWidth={720}>
        {draft && (
          <>
            <Input label="To:" value={draft.to} onChangeText={(to) => setDraft({ ...draft, to })} credentialType="email" editable={!emailing} placeholder="Recipient" />
            <Input label="Subject:" value={draft.subject} onChangeText={(subject) => setDraft({ ...draft, subject })} editable={!emailing} placeholder="Subject" />
            <ThemedText type="label">Email body:</ThemedText>
            <TextInput
              value={draft.body}
              onChangeText={(body) => setDraft({ ...draft, body })}
              multiline
              editable={!emailing}
              style={[styles.body, { color: colors.inputText, backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}
            />
            {attachment && (
              <View style={[styles.attachment, { borderColor: colors.border }]}>
                <Ionicons name="document-text-outline" size={22} color={colors.textSecondary} />
                <View style={{ flex: 1 }}>
                  <ThemedText numberOfLines={1}>{attachment.filename}</ThemedText>
                  <ThemedText type="caption">PDF · {Math.max(1, Math.round(attachment.blob.size / 1024))} KB</ThemedText>
                </View>
                <Button size="sm" variant="ghost" icon={previewing ? 'eye-off-outline' : 'eye-outline'} onPress={() => setPreviewing((p) => !p)}>{previewing ? 'Hide' : 'View'}</Button>
                <Button size="sm" variant="ghost" icon="download-outline" onPress={() => saveOrShare(attachment.blob, attachment.filename, 'application/pdf').catch((e) => toast.error(errMsg(e)))}>
                  Download
                </Button>
              </View>
            )}
            {previewing && attachment && <PdfViewer blob={attachment.blob} filename={attachment.filename} style={{ height: 420 }} />}
            <View style={styles.row}>
              <Button variant="secondary" style={{ flex: 1 }} onPress={() => { setDraft(null); setAttachment(null); }} disabled={emailing}>Back</Button>
              <Button style={{ flex: 1 }} onPress={sendEmail} loading={emailing} icon="mail-outline">Send</Button>
            </View>
          </>
        )}
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, paddingHorizontal: Spacing.sm, borderRadius: 10 },
  body: { minHeight: 200, borderWidth: 1, borderRadius: 10, padding: Spacing.md, fontSize: 15, textAlignVertical: 'top' },
  attachment: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderWidth: 1, borderRadius: 10, padding: Spacing.sm },
  row: { flexDirection: 'row', gap: Spacing.md },
});
