import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { QuoteDetailView } from '@/components/estimates/QuoteDetailView';
import { useTheme } from '@/contexts/ThemeContext';

/** Compact-width route; wide layouts render QuoteDetailView inline beside the list. */
export default function QuoteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/estimates'));
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <QuoteDetailView id={id} onClose={back} />
    </SafeAreaView>
  );
}
