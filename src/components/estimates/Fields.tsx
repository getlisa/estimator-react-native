import { useEffect, useState } from 'react';
import { StyleSheet, Switch, TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';

/** Small uppercase label used across the estimate editor. */
export const FieldLabel = ({ children }: { children: string }) => <ThemedText type="label">{children}</ThemedText>;

/**
 * Commit-on-blur input: the server re-prices on every write, so a field publishes only when
 * editing ends and only when the value changed (web `CellInput`/`LabeledField`).
 */
export function CommitField({
  label, value, onCommit, disabled, highlight, placeholder, inputMode = 'decimal', style,
}: {
  label?: string;
  value: string;
  onCommit: (v: string) => void;
  disabled?: boolean;
  highlight?: boolean;
  placeholder?: string;
  inputMode?: TextInputProps['inputMode'];
  style?: object;
}) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => { if (draft !== value) onCommit(draft); };
  return (
    <View style={[{ gap: 4, minWidth: 0 }, style]}>
      {label && <FieldLabel>{label}</FieldLabel>}
      <TextInput
        value={draft}
        onChangeText={setDraft}
        onBlur={commit}
        onSubmitEditing={commit}
        editable={!disabled}
        placeholder={placeholder}
        placeholderTextColor={colors.inputPlaceholder}
        inputMode={inputMode}
        style={[
          styles.input,
          { color: colors.inputText, backgroundColor: colors.inputBackground, borderColor: highlight ? colors.warning : colors.inputBorder },
          disabled && { opacity: 0.6 },
        ]}
      />
    </View>
  );
}

/** Plain controlled input for draft forms (nothing reaches the server until a button). */
export function DraftField({ label, value, onChange, disabled, placeholder, inputMode = 'decimal', autoFocus, onSubmit }: {
  label?: string; value: string; onChange: (v: string) => void; disabled?: boolean; placeholder?: string;
  inputMode?: TextInputProps['inputMode']; autoFocus?: boolean; onSubmit?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 4, flex: 1, minWidth: 0 }}>
      {label && <FieldLabel>{label}</FieldLabel>}
      <TextInput
        value={value}
        onChangeText={onChange}
        editable={!disabled}
        placeholder={placeholder}
        placeholderTextColor={colors.inputPlaceholder}
        inputMode={inputMode}
        autoFocus={autoFocus}
        onSubmitEditing={onSubmit}
        style={[styles.input, { color: colors.inputText, backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }, disabled && { opacity: 0.6 }]}
      />
    </View>
  );
}

export function SwitchRow({ label, value, onChange, disabled }: { label: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={styles.switchRow}>
      <ThemedText style={{ fontWeight: '500' }}>{label}</ThemedText>
      <Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: colors.primary }} />
    </View>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: Spacing.md, fontSize: 15 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
});
