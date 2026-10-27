import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AddressField, placeToAddress } from '@/components/profile/AddressField';
import { ThemedText } from '@/components/themed-text';
import { Badge, Button, Card, CardBody, Input } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { isAdminRole } from '@/lib/roles';
import { errMsg, toast } from '@/lib/ui';
import { companyService, type Address, type Company, type UpdateCompanyRequest } from '@/services/companyService';
import { usersService, type User } from '@/services/usersService';

function CardHeader({ title, subtitle, editing, onToggle, canEdit }: { title: string; subtitle: string; editing?: boolean; onToggle?: () => void; canEdit?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <ThemedText type="subtitle" style={{ fontSize: 18 }}>{title}</ThemedText>
        <ThemedText type="caption">{subtitle}</ThemedText>
      </View>
      {canEdit && onToggle && (
        <Pressable onPress={onToggle} hitSlop={10} accessibilityLabel={editing ? 'Cancel' : 'Edit'}>
          <Ionicons name={editing ? 'close' : 'pencil'} size={20} color={colors.icon} />
        </Pressable>
      )}
    </View>
  );
}

function Row({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value?: string | null }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <View style={[styles.iconBox, { backgroundColor: colors.backgroundSecondary }]}><Ionicons name={icon} size={18} color={colors.icon} /></View>
      <View style={{ flex: 1 }}>
        <ThemedText type="label">{label}</ThemedText>
        <ThemedText>{value || '—'}</ThemedText>
      </View>
    </View>
  );
}

/** Personal Information card (MyProfileTab.tsx): view + edit name/email/phone/address. */
export function PersonalCard({ user, loading, onSaved }: { user: User | null; loading: boolean; onSaved: () => void }) {
  const { colors } = useTheme();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', address: null as Address | null });
  // phone_number is not returned by /users/self; keep the last saved value in memory (web does the same).
  const [phone, setPhone] = useState('');

  const reset = () => {
    if (!user) return;
    const address = user.address && typeof user.address === 'object' ? (user.address as Address) : null;
    const p = user.phone_number || (user.address as any)?.phone_number || phone || '';
    setForm({ firstName: user.first_name || '', lastName: user.last_name || '', email: user.email || '', phone: p, address });
  };
  useEffect(reset, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (!user?.id) return toast.error('User ID not found');
    setSaving(true);
    try {
      await usersService.updateUser(user.id, { first_name: form.firstName, last_name: form.lastName, email: form.email, phone_number: form.phone, address: form.address ?? undefined });
      setPhone(form.phone);
      toast.success('Profile updated');
      setEditing(false);
      onSaved();
    } catch (e) { toast.error(errMsg(e, 'Could not save profile')); } finally { setSaving(false); }
  };

  const initials = user ? `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.toUpperCase() || 'U' : 'U';
  const roleLabel = user?.role ? user.role.split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ') : 'Field Technician';
  const addressText = form.address?.formatted_address || (typeof user?.address === 'string' ? user.address : '');

  return (
    <Card variant="elevated">
      <CardBody>
        <CardHeader title="Personal Information" subtitle="Your account details" canEdit editing={editing} onToggle={() => { if (editing) reset(); setEditing(!editing); }} />
        {loading && !user ? <ActivityIndicator color={colors.tint} style={{ padding: Spacing.xl }} /> : (
          <View style={{ gap: Spacing.lg }}>
            <View style={styles.avatarRow}>
              <View style={[styles.avatar, { backgroundColor: colors.tint }]}><ThemedText style={{ color: '#fff', fontSize: 22, fontWeight: '600' }}>{initials}</ThemedText></View>
              <View style={{ flex: 1, gap: 4 }}>
                {editing ? (
                  <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                    <Input containerStyle={{ flex: 1 }} value={form.firstName} onChangeText={(firstName) => setForm({ ...form, firstName })} placeholder="First Name" />
                    <Input containerStyle={{ flex: 1 }} value={form.lastName} onChangeText={(lastName) => setForm({ ...form, lastName })} placeholder="Last Name" />
                  </View>
                ) : (
                  <ThemedText type="defaultSemiBold" style={{ fontSize: 18 }}>{user ? `${user.first_name} ${user.last_name}` : 'User'}</ThemedText>
                )}
                <Badge size="sm" variant={user?.role === 'admin' ? 'error' : user?.role === 'service_manager' ? 'warning' : 'primary'} style={{ alignSelf: 'flex-start' }}>{roleLabel}</Badge>
              </View>
            </View>
            {editing ? (
              <>
                <Input label="Email" value={form.email} onChangeText={(email) => setForm({ ...form, email })} credentialType="email" leftIcon="mail-outline" />
                <Input label="Phone" value={form.phone} onChangeText={(p) => setForm({ ...form, phone: p })} keyboardType="phone-pad" leftIcon="call-outline" />
                <AddressField label="Address" value={addressText} onPick={(place) => setForm({ ...form, address: placeToAddress(place) })} />
                <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                  <Button size="sm" loading={saving} onPress={save} icon="checkmark">Save</Button>
                  <Button size="sm" variant="secondary" disabled={saving} onPress={() => { reset(); setEditing(false); }}>Cancel</Button>
                </View>
              </>
            ) : (
              <>
                <Row icon="mail-outline" label="Email" value={user?.email} />
                <Row icon="call-outline" label="Phone" value={form.phone} />
                <Row icon="location-outline" label="Address" value={addressText} />
                {user?.job_title && <Row icon="briefcase-outline" label="Job Title" value={user.job_title} />}
              </>
            )}
          </View>
        )}
      </CardBody>
    </Card>
  );
}

/** Company Information card — admins and service managers edit (lib/roles). */
export function CompanyCard({ companyId, role }: { companyId?: number; role?: string }) {
  const { colors } = useTheme();
  const isAdmin = isAdminRole(role);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<UpdateCompanyRequest>({});

  const fromCompany = (c: Company): UpdateCompanyRequest => ({
    name: c.name || '', city: c.city, state: c.state, country: c.country, postal_code: c.postal_code, geocoded_lat: c.geocoded_lat, geocoded_lng: c.geocoded_lng, address: c.address ?? undefined,
  });
  const load = () => {
    if (!companyId) { setLoading(false); return; }
    companyService.getCompanyById(companyId).then((c) => { setCompany(c); setForm(fromCompany(c)); }).catch(() => undefined).finally(() => setLoading(false));
  };
  useEffect(load, [companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (!companyId) return toast.error('Company ID not found');
    setSaving(true);
    try {
      const updated = await companyService.updateCompany(companyId, form);
      setCompany(updated); setForm(fromCompany(updated));
      toast.success('Company updated');
      setEditing(false);
    } catch (e) { toast.error(errMsg(e, 'Could not save company')); } finally { setSaving(false); }
  };

  return (
    <Card variant="elevated">
      <CardBody>
        <CardHeader title="Company Information" subtitle="Your organization details" canEdit={isAdmin} editing={editing}
          onToggle={() => { if (editing && company) setForm(fromCompany(company)); setEditing(!editing); }} />
        {loading ? <ActivityIndicator color={colors.tint} style={{ padding: Spacing.xl }} /> : editing ? (
          <View style={{ gap: Spacing.md }}>
            <Input label="Company name" value={form.name ?? ''} onChangeText={(name) => setForm({ ...form, name })} leftIcon="business-outline" />
            <AddressField label="Address" value={form.address?.formatted_address ?? ''}
              onPick={(place) => { const a = placeToAddress(place); setForm({ ...form, address: a, geocoded_lat: a.lat ?? null, geocoded_lng: a.lng ?? null, city: a.city ?? null, state: a.state ?? null, country: a.country || null, postal_code: a.postal_code ?? null }); }} />
            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
              <Button size="sm" loading={saving} onPress={save} icon="checkmark">Save</Button>
              <Button size="sm" variant="secondary" disabled={saving} onPress={() => { if (company) setForm(fromCompany(company)); setEditing(false); }}>Cancel</Button>
            </View>
          </View>
        ) : (
          <View style={{ gap: Spacing.md }}>
            <Row icon="business-outline" label="Company" value={company?.name} />
            <Row icon="location-outline" label="Location" value={company?.address?.formatted_address || company?.city} />
          </View>
        )}
      </CardBody>
    </Card>
  );
}

/** Settings card: change password (min 8 chars) via PUT /users/:id {password, oldPassword}. */
export function PasswordCard({ userId }: { userId?: string }) {
  const [open, setOpen] = useState(false);
  const [oldPassword, setOld] = useState('');
  const [newPassword, setNew] = useState('');
  const [saving, setSaving] = useState(false);
  const change = async () => {
    if (!userId) return toast.error('User ID not found');
    if (!oldPassword || !newPassword) return toast.error('Please fill in both old and new password fields');
    if (newPassword.length < 8) return toast.error('New password must be at least 8 characters long');
    setSaving(true);
    try {
      await usersService.updateUser(userId, { password: newPassword, oldPassword });
      toast.success('Password changed');
      setOpen(false); setOld(''); setNew('');
    } catch (e) { toast.error(errMsg(e, 'Could not change password')); } finally { setSaving(false); }
  };
  return (
    <Card variant="elevated">
      <CardBody>
        <CardHeader title="Settings" subtitle="Security" />
        {open ? (
          <View style={{ gap: Spacing.md }}>
            <Input label="Current password" value={oldPassword} onChangeText={setOld} credentialType="password" placeholder="Enter your current password" leftIcon="lock-closed-outline" />
            <Input label="New password" value={newPassword} onChangeText={setNew} credentialType="newPassword" placeholder="Enter your new password" leftIcon="key-outline" />
            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
              <Button size="sm" loading={saving} disabled={!oldPassword || !newPassword} onPress={change}>Change Password</Button>
              <Button size="sm" variant="secondary" disabled={saving} onPress={() => { setOpen(false); setOld(''); setNew(''); }}>Cancel</Button>
            </View>
          </View>
        ) : (
          <Button variant="secondary" icon="lock-closed-outline" onPress={() => setOpen(true)}>Change Password</Button>
        )}
      </CardBody>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, marginBottom: Spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  iconBox: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
});
