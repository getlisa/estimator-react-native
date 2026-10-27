import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConnectionsCard } from '@/components/profile/ConnectionsCard';
import { CompanyCard, PasswordCard, PersonalCard } from '@/components/profile/ProfileCards';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/lib/ui';
import { useLayout } from '@/lib/useLayout';
import { usersService, type User } from '@/services/usersService';

/** My Profile (web MyProfileTab + ConnectionsCard). Two-column card grid from tablet width up. */
export default function ProfileScreen() {
  const { user: authUser, logout } = useAuth();
  const { colors } = useTheme();
  const { wide, scale } = useLayout();
  const [self, setSelf] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  const load = useCallback(() => {
    usersService.getSelfUser().then(setSelf).catch(() => undefined).finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const user = self ?? (authUser as unknown as User | null);
  const col = wide ? { flex: 1, minWidth: 360 } : undefined;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView contentContainerStyle={[styles.content, wide && styles.wide]} keyboardShouldPersistTaps="handled">
        <ThemedText type="title" style={{ fontSize: 24 * scale }}>My Profile</ThemedText>
        <View style={[styles.grid, wide && { flexDirection: 'row', flexWrap: 'wrap' }]}>
          <View style={[styles.col, col]}>
            <PersonalCard user={user} loading={loading} onSaved={load} />
            <CompanyCard companyId={user?.company_id ?? authUser?.company_id} role={user?.role ?? authUser?.role} />
            <PasswordCard userId={user?.id ?? authUser?.id} />
            <Button variant="danger" icon="log-out-outline" loading={loggingOut} fullWidth
              onPress={async () => { setLoggingOut(true); try { await logout(); toast.success('Logged out successfully'); } catch { toast.error('Failed to logout'); } finally { setLoggingOut(false); } }}>
              Log Out
            </Button>
          </View>
          <View style={[styles.col, col]}>
            <ConnectionsCard />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: Spacing['3xl'] },
  wide: { maxWidth: 1200, width: '100%', alignSelf: 'center' },
  grid: { gap: Spacing.lg },
  col: { gap: Spacing.lg },
});
