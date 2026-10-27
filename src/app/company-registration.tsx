import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, CardBody, Input } from '@/components/ui';
import { CheckRow } from '@/components/ui/Select';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { pickImage } from '@/lib/pickFile';
import { errMsg, toast } from '@/lib/ui';
import { appendFiles, type PickedFile } from '@/lib/upload';
import { useLayout } from '@/lib/useLayout';
import { COPILOT_API_BASE } from '@/services/copilotChatService';

/**
 * Hidden company registration page (web /company-registration): public, unlinked from any nav.
 * Creates the companies row that quote/proposal branding is read from, plus the admin account.
 */
const API = `${COPILOT_API_BASE}/companies`;

const FIELDS = [
  { name: 'phone', label: 'Phone', placeholder: '208-776-7611' },
  { name: 'email', label: 'Email', placeholder: 'office@company.com', email: true },
  { name: 'licenseNumber', label: 'Contractor license number', placeholder: '070113' },
] as const;
const BILLING = [
  { name: 'address', label: 'Street address', placeholder: '123 Main St' },
  { name: 'city', label: 'City', placeholder: 'Pocatello' },
  { name: 'state', label: 'State', placeholder: 'ID' },
  { name: 'postalCode', label: 'ZIP / Postal code', placeholder: '83204' },
  { name: 'country', label: 'Country', placeholder: 'USA' },
] as const;
const SERVICE = [
  { name: 'serviceAddress', label: 'Street address', placeholder: '456 Shop Rd' },
  { name: 'serviceCity', label: 'City', placeholder: 'Pocatello' },
  { name: 'serviceState', label: 'State', placeholder: 'ID' },
  { name: 'servicePostalCode', label: 'ZIP / Postal code', placeholder: '83204' },
  { name: 'serviceCountry', label: 'Country', placeholder: 'USA' },
] as const;

interface Tech { key: number; firstName: string; lastName: string; email: string; password: string; learner: boolean }

export default function CompanyRegistration() {
  const { colors } = useTheme();
  const { wide } = useLayout();
  const router = useRouter();
  const [form, setForm] = useState<Record<string, string>>({});
  const [logo, setLogo] = useState<PickedFile | null>(null);
  const [technicians, setTechnicians] = useState<Tech[]>([]);
  const [nextKey, setNextKey] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<{ id: number; name: string; technicians?: { email: string; learner: boolean }[] } | null>(null);
  const set = (k: string) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const patchTech = (key: number, patch: Partial<Tech>) => setTechnicians((l) => l.map((t) => (t.key === key ? { ...t, ...patch } : t)));

  const submit = async () => {
    if (!(form.name ?? '').trim()) return toast.error('Company name is required');
    const password = form.password ?? '';
    if (password.length < 8) return toast.error('Password must be at least 8 characters');
    if (password !== (form.confirmPassword ?? '')) return toast.error('Passwords do not match');
    for (const [i, t] of technicians.entries()) {
      if (!t.firstName.trim() || !t.lastName.trim() || !t.email.trim()) return toast.error(`Technician ${i + 1}: name and email are required`);
      if (t.password.length < 8) return toast.error(`Technician ${i + 1}: password must be at least 8 characters`);
    }
    const fd = new FormData();
    for (const [k, v] of Object.entries(form)) if (k !== 'confirmPassword') fd.append(k, v);
    fd.append('technicians', JSON.stringify(technicians.map(({ firstName, lastName, email, password: p, learner }) => ({ firstName, lastName, email, password: p, learner }))));
    if (logo) await appendFiles(fd, 'logo', [logo]);
    setSubmitting(true);
    try {
      const res = await fetch(API, { method: 'POST', body: fd });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
      setCreated(body.data);
    } catch (e) { toast.error(errMsg(e, 'Registration failed')); } finally { setSubmitting(false); }
  };

  const cell = wide ? { flexBasis: '48%' as const, flexGrow: 1 } : undefined;

  if (created) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.wrap}>
            <Ionicons name="checkmark-circle" size={56} color={colors.success} />
            <ThemedText type="title">Company registered</ThemedText>
            <ThemedText>
              <ThemedText style={{ fontWeight: '700' }}>{created.name}</ThemedText> was created with ID <ThemedText style={{ fontWeight: '700' }}>{created.id}</ThemedText>, along with its admin account. You can now log in with that email and password — quotes, proposals, and emails will carry this company's branding.
            </ThemedText>
            {!!created.technicians?.length && created.technicians.map((t) => (
              <View key={t.email} style={styles.between}><ThemedText>{t.email}</ThemedText><ThemedText type="caption">{t.learner ? 'learning technician' : 'technician'}</ThemedText></View>
            ))}
            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
              <Button onPress={() => router.replace('/login')}>Go to login</Button>
              <Button variant="secondary" onPress={() => { setCreated(null); setForm({}); setLogo(null); setTechnicians([]); }}>Register another</Button>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.wrap}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
            <Ionicons name="business" size={26} color={colors.primary} />
            <ThemedText type="title" style={{ fontSize: 24 }}>Register a company</ThemedText>
          </View>
          <ThemedText type="caption">These details appear on the company's bid proposals, quotes, and customer emails.</ThemedText>

          <Section title="Company">
            <Input label="Company name *" value={form.name ?? ''} onChangeText={set('name')} placeholder="Three Peaks Electric, LLC" />
            <ThemedText type="label">Logo</ThemedText>
            {logo ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
                <Image source={{ uri: logo.uri }} style={{ width: 64, height: 64, borderRadius: 8 }} />
                <Button size="sm" variant="ghost" icon="close" onPress={() => setLogo(null)}>Remove</Button>
              </View>
            ) : (
              <Button size="sm" variant="secondary" icon="image-outline" onPress={() => pickImage().then((f) => f && setLogo(f)).catch((e) => toast.error(errMsg(e)))}>Choose logo (PNG or JPG)</Button>
            )}
            <Grid wide={wide}>{FIELDS.map((f) => <View key={f.name} style={cell}><Input label={f.label} value={form[f.name] ?? ''} onChangeText={set(f.name)} placeholder={f.placeholder} credentialType={'email' in f ? 'email' : undefined} /></View>)}</Grid>
          </Section>
          <Section title="Billing address" hint="The company's billing / mailing address.">
            <Grid wide={wide}>{BILLING.map((f) => <View key={f.name} style={cell}><Input label={f.label} value={form[f.name] ?? ''} onChangeText={set(f.name)} placeholder={f.placeholder} /></View>)}</Grid>
          </Section>
          <Section title="Service address" hint="Where service is performed from, if different. Leave blank to use the billing address.">
            <Grid wide={wide}>{SERVICE.map((f) => <View key={f.name} style={cell}><Input label={f.label} value={form[f.name] ?? ''} onChangeText={set(f.name)} placeholder={f.placeholder} /></View>)}</Grid>
          </Section>
          <Section title="Admin account" hint="The first login for this company — you'll sign in with this email and password.">
            <Grid wide={wide}>
              <View style={cell}><Input label="First name *" value={form.firstName ?? ''} onChangeText={set('firstName')} placeholder="Jolene" /></View>
              <View style={cell}><Input label="Last name *" value={form.lastName ?? ''} onChangeText={set('lastName')} placeholder="Bates" /></View>
            </Grid>
            <Input label="Account email *" value={form.accountEmail ?? ''} onChangeText={set('accountEmail')} placeholder="you@company.com" credentialType="email" />
            <Grid wide={wide}>
              <View style={cell}><Input label="Password *" value={form.password ?? ''} onChangeText={set('password')} placeholder="Min. 8 characters" credentialType="newPassword" /></View>
              <View style={cell}><Input label="Confirm password *" value={form.confirmPassword ?? ''} onChangeText={set('confirmPassword')} placeholder="Repeat password" credentialType="newPassword" /></View>
            </Grid>
          </Section>
          <Section title="Technician accounts" hint="Optional. Each technician signs in with their own email and password. A learning technician teaches the estimator: prices they enter for products not in the pricebook are remembered and auto-filled for everyone in the company. Only Clara staff can change this later.">
            {technicians.map((t, i) => (
              <View key={t.key} style={[styles.tech, { borderColor: colors.border }]}>
                <View style={styles.between}>
                  <ThemedText type="defaultSemiBold">Technician {i + 1}</ThemedText>
                  <Button size="sm" variant="ghost" icon="trash-outline" onPress={() => setTechnicians((l) => l.filter((x) => x.key !== t.key))}>Remove</Button>
                </View>
                <Grid wide={wide}>
                  <View style={cell}><Input placeholder="First name" value={t.firstName} onChangeText={(v) => patchTech(t.key, { firstName: v })} /></View>
                  <View style={cell}><Input placeholder="Last name" value={t.lastName} onChangeText={(v) => patchTech(t.key, { lastName: v })} /></View>
                  <View style={cell}><Input placeholder="tech@company.com" value={t.email} onChangeText={(v) => patchTech(t.key, { email: v })} credentialType="email" /></View>
                  <View style={cell}><Input placeholder="Password (min. 8 characters)" value={t.password} onChangeText={(v) => patchTech(t.key, { password: v })} credentialType="newPassword" /></View>
                </Grid>
                <CheckRow checked={t.learner} onChange={(v) => patchTech(t.key, { learner: v })} label="Learning technician — their prices teach the organization's price memory" />
              </View>
            ))}
            <Button size="sm" variant="secondary" icon="add" onPress={() => { setTechnicians((l) => [...l, { key: nextKey, firstName: '', lastName: '', email: '', password: '', learner: false }]); setNextKey(nextKey + 1); }}>Add technician</Button>
          </Section>
          <Button size="lg" loading={submitting} onPress={submit} fullWidth>Register company</Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <Card variant="elevated"><CardBody>
      <ThemedText type="subtitle" style={{ fontSize: 18 }}>{title}</ThemedText>
      {hint && <ThemedText type="caption" style={{ marginBottom: Spacing.md }}>{hint}</ThemedText>}
      <View style={{ gap: Spacing.md }}>{children}</View>
    </CardBody></Card>
  );
}
const Grid = ({ wide, children }: { wide: boolean; children: React.ReactNode }) => (
  <View style={[styles.grid, wide && { flexDirection: 'row', flexWrap: 'wrap' }]}>{children}</View>
);

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, paddingBottom: Spacing['3xl'] },
  wrap: { width: '100%', maxWidth: 760, alignSelf: 'center', gap: Spacing.lg },
  grid: { gap: Spacing.md },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  tech: { borderWidth: 1, borderRadius: 12, padding: Spacing.md, gap: Spacing.md },
});
