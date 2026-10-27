import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { FieldLabel } from '@/components/estimates/Fields';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { toast } from '@/lib/ui';
import { useLayout } from '@/lib/useLayout';
import { quotesService, type Quote, type QuoteImage } from '@/services/quotesService';

/** Quote-level photo attachments: shown and removable while Draft; attaching happens in the chat composer. */
export function Photos({ quote, frozen }: { quote: Quote; frozen: boolean }) {
  const { colors } = useTheme();
  const { size } = useLayout();
  const [images, setImages] = useState<QuoteImage[]>([]);
  const [busy, setBusy] = useState(false);
  const cols = size === 'compact' ? 3 : size === 'medium' ? 4 : 6;

  useEffect(() => { quotesService.listImages(quote.id).then(setImages).catch(() => {}); }, [quote.id, quote.updatedAt]);

  const remove = async (imageId: string) => {
    setBusy(true);
    try { setImages(await quotesService.removeImage(quote.id, imageId)); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Could not remove the photo'); }
    finally { setBusy(false); }
  };

  if (images.length === 0) return null;
  return (
    <View style={{ gap: Spacing.sm }}>
      <FieldLabel>Photos</FieldLabel>
      <View style={styles.grid}>
        {images.map((img) => (
          <View key={img.id} style={{ width: `${100 / cols - 1.5}%` as any, aspectRatio: 1 }}>
            <Image source={{ uri: img.url }} style={[styles.img, { borderColor: colors.border }]} accessibilityLabel={img.filename ?? 'Attached photo'} />
            {!frozen && (
              <Pressable disabled={busy} onPress={() => remove(img.id)} hitSlop={10} style={styles.remove} accessibilityLabel={`Remove ${img.filename ?? 'photo'}`}>
                <View style={[styles.removeDot, { backgroundColor: colors.backgroundElevated }]}>
                  <Ionicons name="close" size={14} color={colors.text} />
                </View>
              </Pressable>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: '2%' as any, rowGap: Spacing.sm },
  img: { width: '100%', height: '100%', borderRadius: 10, borderWidth: 1 },
  remove: { position: 'absolute', top: 2, right: 2, width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  removeDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
