import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/contexts/ThemeContext';
import { Spacing } from '@/constants/theme';
import { useLayout } from '@/lib/useLayout';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  /** Dialog width on wide screens. */
  maxWidth?: number;
  scroll?: boolean;
}

/** Bottom sheet on phones, centred dialog on everything wider. */
export function Sheet({ open, onClose, title, description, children, maxWidth = 560, scroll = true }: Props) {
  const { colors } = useTheme();
  const { wide, height } = useLayout();
  const Body = scroll ? ScrollView : View;
  return (
    <Modal visible={open} transparent animationType={wide ? 'fade' : 'slide'} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        pointerEvents="box-none"
        style={[styles.wrap, wide ? styles.center : styles.bottom]}>
        <View
          style={[
            styles.panel,
            { backgroundColor: colors.backgroundElevated, borderColor: colors.border, maxHeight: height * 0.9 },
            wide ? { maxWidth, width: '100%', borderRadius: 16 } : { borderTopLeftRadius: 18, borderTopRightRadius: 18 },
          ]}>
          {(title || description) && (
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                {title && <ThemedText type="defaultSemiBold">{title}</ThemedText>}
                {description && <ThemedText type="caption">{description}</ThemedText>}
              </View>
              <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
                <Ionicons name="close" size={22} color={colors.icon} />
              </Pressable>
            </View>
          )}
          <Body style={{ flexGrow: 0 }} contentContainerStyle={scroll ? styles.content : undefined} keyboardShouldPersistTaps="handled">
            {scroll ? children : <View style={styles.content}>{children}</View>}
          </Body>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)' },
  wrap: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  bottom: { justifyContent: 'flex-end' },
  panel: { borderWidth: 1, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, padding: Spacing.lg, paddingBottom: Spacing.sm },
  content: { padding: Spacing.lg, paddingTop: Spacing.sm, gap: Spacing.md },
});
