import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, TextInput, View } from 'react-native';

import { Actions, Hint, useAction } from '@/components/admin/common';
import { ThemedText } from '@/components/themed-text';
import { Button, Input } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { pickImage } from '@/lib/pickFile';
import { toast } from '@/lib/ui';
import { useLayout } from '@/lib/useLayout';
import { adminService, type AdminCompanyDetail } from '@/services/adminService';

const BRANDING_FIELDS: { key: keyof AdminCompanyDetail & string; label: string }[] = [
  { key: 'name', label: 'Business / company name' }, { key: 'phone', label: 'Phone number' }, { key: 'email', label: 'Email address' },
  { key: 'licenseNumber', label: 'License / registration number' }, { key: 'website', label: 'Website' },
  { key: 'city', label: 'City' }, { key: 'state', label: 'State' }, { key: 'postalCode', label: 'Postal code' },
];

export function BrandingTab({ companyId }: { companyId: number }) {
  const { colors } = useTheme();
  const { wide } = useLayout();
  const [detail, setDetail] = useState<AdminCompanyDetail | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const { busy, run } = useAction();

  useEffect(() => {
    adminService.getCompany(companyId).then((d) => {
      setDetail(d);
      setForm({ ...Object.fromEntries(BRANDING_FIELDS.map((f) => [f.key, String(d[f.key] ?? '')])), footerTerms: d.footerTerms ?? '' });
    }).catch(() => toast.error('Could not load company'));
  }, [companyId]);

  if (!detail) return <ActivityIndicator color={colors.tint} />;
  const hasLogo = !!detail.logoUrl && /^https?:/.test(detail.logoUrl);

  return (
    <>
      <Hint>These details brand this company's invoice-style quote documents. Anything left blank is simply omitted on the document — never a placeholder.</Hint>
      <Actions>
        {hasLogo ? <Image source={{ uri: detail.logoUrl! }} style={{ width: 96, height: 96, borderRadius: 8, resizeMode: 'contain' }} /> : (
          <View style={{ width: 96, height: 96, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}><ThemedText type="caption">no logo</ThemedText></View>
        )}
        <Button size="sm" variant="secondary" disabled={busy} onPress={() => run(async () => {
          const file = await pickImage(); if (!file) return;
          const { logoUrl } = await adminService.uploadLogo(companyId, file);
          setDetail({ ...detail, logoUrl }); toast.success('Logo updated');
        })}>Upload logo</Button>
        {detail.logoUrl && <Button size="sm" variant="ghost" disabled={busy} onPress={() => run(async () => {
          setDetail(await adminService.patchConfig(companyId, { logoUrl: null })); toast.success('Logo removed — documents will print without one');
        })}>Remove logo</Button>}
      </Actions>
      <View style={[{ gap: Spacing.md }, wide && { flexDirection: 'row', flexWrap: 'wrap' }]}>
        {BRANDING_FIELDS.map((f) => (
          <View key={f.key} style={wide ? { flexBasis: '48%', flexGrow: 1 } : undefined}>
            <Input label={f.label} value={form[f.key] ?? ''} onChangeText={(v) => setForm({ ...form, [f.key]: v })} />
          </View>
        ))}
      </View>
      <ThemedText type="label">Footer / terms text (optional)</ThemedText>
      <TextInput multiline value={form.footerTerms ?? ''} onChangeText={(v) => setForm({ ...form, footerTerms: v })}
        style={{ minHeight: 90, borderWidth: 1, borderRadius: 10, padding: Spacing.md, color: colors.inputText, backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, textAlignVertical: 'top' }} />
      <Button loading={busy} onPress={() => run(async () => { setDetail(await adminService.patchConfig(companyId, form)); toast.success('Branding saved'); })}>Save branding</Button>
    </>
  );
}
