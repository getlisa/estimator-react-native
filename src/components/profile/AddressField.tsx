import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Input } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import type { Address } from '@/services/companyService';
import { googleMapsService, type GoogleMapsPlace } from '@/services/googleMapsService';

/** Build the backend Address from a Google place (MyProfileTab.tsx:212-222). */
export const placeToAddress = (place: GoogleMapsPlace): Address => ({
  formatted_address: place.formatted_address,
  country: place.address?.country || '',
  line1: place.address?.line1 || undefined,
  line2: place.address?.line2 || undefined,
  city: place.address?.city || undefined,
  state: place.address?.state || undefined,
  postal_code: place.address?.postal_code || undefined,
  lat: place.geometry.location.lat,
  lng: place.geometry.location.lng,
});

/** Address search box: debounced GET /google-maps/search once more than 2 chars are typed. */
export function AddressField({ label, value, onPick, disabled }: { label?: string; value: string; onPick: (place: GoogleMapsPlace) => void; disabled?: boolean }) {
  const { colors } = useTheme();
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<GoogleMapsPlace[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => setQuery(value), [value]);
  useEffect(() => {
    if (!open || query.length <= 2) { setResults(null); return; }
    let live = true;
    setLoading(true);
    const t = setTimeout(() => {
      googleMapsService.searchPlaces({ q: query })
        .then((r) => live && setResults(r.results))
        .catch(() => live && setResults([]))
        .finally(() => live && setLoading(false));
    }, 300);
    return () => { live = false; clearTimeout(t); };
  }, [query, open]);

  return (
    <View style={{ gap: 4 }}>
      <Input label={label} value={query} editable={!disabled} placeholder="Search for address..." leftIcon="location-outline"
        onChangeText={(t) => { setQuery(t); setOpen(t.length > 2); }} onFocus={() => setOpen(query.length > 2)} />
      {open && query.length > 2 && (
        <View style={[styles.list, { borderColor: colors.border, backgroundColor: colors.backgroundElevated }]}>
          {loading && !results ? (
            <ActivityIndicator color={colors.tint} style={{ padding: Spacing.md }} />
          ) : results && results.length > 0 ? (
            results.slice(0, 6).map((p) => (
              <Pressable key={p.place_id} onPress={() => { onPick(p); setQuery(p.formatted_address); setOpen(false); }}
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.backgroundSecondary }]}>
                <ThemedText style={{ fontWeight: '500' }} numberOfLines={1}>{p.name}</ThemedText>
                <ThemedText type="caption" numberOfLines={2}>{p.formatted_address}</ThemedText>
              </Pressable>
            ))
          ) : (
            <ThemedText type="caption" style={{ padding: Spacing.md }}>No addresses found</ThemedText>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { borderWidth: 1, borderRadius: 10, overflow: 'hidden' },
  row: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
});
