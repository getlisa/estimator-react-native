import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Switch, View } from 'react-native';

import { Actions, Hint, RecordCard, useAction } from '@/components/admin/common';
import { ThemedText } from '@/components/themed-text';
import { Badge, Button, Input } from '@/components/ui';
import { Select } from '@/components/ui/Select';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { MIME, pickDocument } from '@/lib/pickFile';
import { confirm, toast } from '@/lib/ui';
import type { PickedFile } from '@/lib/upload';
import { adminService, type AdminCompanyDetail, type AdminTemplate } from '@/services/adminService';

/** The placeholders templateData() provides — keep in sync with templates.ts. */
const TEMPLATE_PLACEHOLDERS = ['{companyName}', '{companyAddress}', '{companyPhone}', '{companyEmail}', '{licenseNumber}', '{website}', '{footerTerms}', '{date}', '{status}', '{total}'];

export function PricingTab({ companyId }: { companyId: number }) {
  const { colors } = useTheme();
  const [detail, setDetail] = useState<AdminCompanyDetail | null>(null);
  const [templates, setTemplates] = useState<AdminTemplate[]>([]);
  const [newName, setNewName] = useState('');
  const [newFile, setNewFile] = useState<PickedFile | null>(null);
  const { busy, run } = useAction();

  const reload = useCallback(async () => {
    const [d, t] = await Promise.all([adminService.getCompany(companyId), adminService.listTemplates(companyId)]);
    setDetail(d); setTemplates(t);
  }, [companyId]);
  useEffect(() => { void reload().catch(() => toast.error('Could not load pricing config')); }, [reload]);

  if (!detail) return <ActivityIndicator color={colors.tint} />;
  const active = templates.find((t) => t.isActive);

  return (
    <>
      <RecordCard>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
          <View style={{ flex: 1 }}>
            <ThemedText type="defaultSemiBold">Home Depot fallback pricing</ThemedText>
            <Hint>Off (default): quotes price only from this company's pricebooks; misses stay unmatched. On: a pricebook miss triggers a live Home Depot lookup, flagged for technician confirmation.</Hint>
          </View>
          <Switch value={detail.hdFallbackEnabled} disabled={busy} trackColor={{ true: colors.primary }}
            onValueChange={(checked) => run(async () => { setDetail(await adminService.patchConfig(companyId, { hdFallbackEnabled: checked })); toast.success(`Fallback ${checked ? 'enabled' : 'disabled'}`); })} />
        </View>
      </RecordCard>
      <RecordCard>
        <ThemedText type="defaultSemiBold">Active quote template</ThemedText>
        <Hint>Applies to quotes created AFTER the change — existing quotes keep the template they were created with. No selection = the default branded invoice.</Hint>
        <Select value={active ? String(active.id) : 'default'}
          options={[{ value: 'default', label: 'Default invoice (built-in)' }, ...templates.map((t) => ({ value: String(t.id), label: `${t.name} (${t.renderer})` }))]}
          onChange={(v) => run(async () => { await adminService.patchConfig(companyId, { activeTemplateId: v === 'default' ? null : Number(v) }); await reload(); toast.success('Template assignment saved'); })} />
        {templates.map((t) => (
          <Actions key={t.id}>
            <ThemedText style={{ flex: 1 }}>{t.name} <ThemedText type="caption">({t.renderer})</ThemedText></ThemedText>
            {t.isActive && <Badge size="sm" variant="primary">active</Badge>}
            <Button size="sm" variant="ghost" icon="trash-outline" disabled={busy} onPress={() => run(async () => {
              if (!(await confirm(`Delete template "${t.name}"?`))) return;
              await adminService.deleteTemplate(t.id); await reload(); toast.success('Template deleted');
            })}>Delete</Button>
          </Actions>
        ))}
      </RecordCard>
      <RecordCard>
        <ThemedText type="defaultSemiBold">Upload a custom template (.docx)</ThemedText>
        <Hint>A Word document using these placeholders (filled per quote at download time):</Hint>
        <ThemedText type="caption" style={{ fontFamily: 'monospace' }}>{TEMPLATE_PLACEHOLDERS.join('  ')}</ThemedText>
        <Hint>Line items repeat between {'{#lineItems}'} and {'{/lineItems}'} (put them in a table row), with {'{description} {quantity} {unit} {unitPrice} {totalPrice}'} inside. Bad placeholders are rejected at upload. Uploading does not activate it — pick it in the selector above when ready.</Hint>
        <Input placeholder="Template name" value={newName} onChangeText={setNewName} />
        <Actions>
          <Button size="sm" variant="secondary" icon="document-outline" onPress={() => pickDocument(MIME.docx).then(setNewFile)}>{newFile ? newFile.name : 'Choose .docx'}</Button>
          <Button size="sm" icon="cloud-upload-outline" loading={busy} onPress={() => run(async () => {
            if (!newFile || !newName.trim()) return toast.error('A name and a .docx file are both required');
            await adminService.uploadTemplate(companyId, newFile, newName.trim());
            setNewName(''); setNewFile(null); await reload(); toast.success('Template uploaded — activate it in the selector above');
          })}>Upload template</Button>
        </Actions>
      </RecordCard>
    </>
  );
}
