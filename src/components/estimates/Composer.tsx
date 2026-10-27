import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useVoiceRecorder } from '@/lib/audio';
import { filenameFromUri, type PickedFile } from '@/lib/upload';
import { toast } from '@/lib/ui';
import { copilotChatService } from '@/services/copilotChatService';

interface Props {
  onSend: (text: string) => void;
  /** Camera/gallery photos — the caller decides where they go (quote images). */
  onPhotos: (files: PickedFile[]) => void;
  busy: boolean;
  placeholder?: string;
}

const MAX_FILES = 4;
const MAX_BYTES = 8 * 1024 * 1024;

const toPicked = (assets: ImagePicker.ImagePickerAsset[]): PickedFile[] =>
  assets.map((a) => ({
    uri: a.uri,
    name: a.fileName ?? filenameFromUri(a.uri, 'photo.jpg'),
    type: a.mimeType ?? 'image/jpeg',
    size: a.fileSize,
    file: a.file,
  }));

/** Text + mic + camera + gallery. Voice is batch: record, transcribe, send the text as a message. */
export function Composer({ onSend, onPhotos, busy, placeholder }: Props) {
  const { colors } = useTheme();
  const [text, setText] = useState('');
  const [transcribing, setTranscribing] = useState(false);
  const recorder = useVoiceRecorder();
  const disabled = busy || transcribing;

  const send = () => {
    const t = text.trim();
    if (!t || disabled) return;
    setText('');
    onSend(t);
  };

  const pick = async (source: 'camera' | 'gallery') => {
    try {
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted && Platform.OS !== 'web') return toast.error('Camera access denied');
      }
      const res =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 })
          : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: MAX_FILES, quality: 0.85 });
      if (res.canceled) return;
      const files = toPicked(res.assets);
      const tooBig = files.filter((f) => (f.size ?? 0) > MAX_BYTES);
      if (tooBig.length) toast.error(`${tooBig.length} photo(s) over 8 MB were skipped`);
      const ok = files.filter((f) => !((f.size ?? 0) > MAX_BYTES)).slice(0, MAX_FILES);
      if (ok.length) onPhotos(ok);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not pick a photo');
    }
  };

  const toggleMic = async () => {
    if (recorder.isRecording) {
      setTranscribing(true);
      try {
        const clip = await recorder.stop();
        if (!clip) return;
        const { text: transcript } = await copilotChatService.transcribeVoice(clip);
        if (transcript?.trim()) onSend(transcript.trim());
        else toast.error('Transcription failed', 'Nothing was heard — try again.');
      } catch {
        toast.error('Transcription failed', 'Could not transcribe audio. Please try again.');
      } finally {
        setTranscribing(false);
      }
      return;
    }
    const ok = await recorder.start().catch(() => false);
    if (!ok) toast.error('Microphone access denied');
  };

  return (
    <View style={[styles.wrap, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={recorder.isRecording ? 'Listening… tap the mic to stop' : placeholder}
        placeholderTextColor={colors.inputPlaceholder}
        multiline
        editable={!disabled && !recorder.isRecording}
        style={[styles.input, { color: colors.inputText }]}
        onKeyPress={(e) => {
          // Web: Enter sends, Shift+Enter inserts a newline.
          if (Platform.OS === 'web' && (e.nativeEvent as any).key === 'Enter' && !(e.nativeEvent as any).shiftKey) {
            (e as any).preventDefault?.();
            send();
          }
        }}
      />
      <View style={styles.actions}>
        <Pressable onPress={() => pick('camera')} disabled={disabled} hitSlop={8} accessibilityLabel="Take photo">
          <Ionicons name="camera-outline" size={22} color={colors.icon} />
        </Pressable>
        <Pressable onPress={() => pick('gallery')} disabled={disabled} hitSlop={8} accessibilityLabel="Pick photos">
          <Ionicons name="images-outline" size={22} color={colors.icon} />
        </Pressable>
        <Pressable onPress={toggleMic} disabled={busy} hitSlop={8} accessibilityLabel={recorder.isRecording ? 'Stop recording' : 'Record voice'}
          style={[styles.mic, recorder.isRecording && { backgroundColor: colors.error }]}>
          <Ionicons name={recorder.isRecording ? 'stop' : 'mic-outline'} size={22} color={recorder.isRecording ? '#fff' : colors.icon} />
        </Pressable>
        {recorder.isRecording && (
          <ThemedText type="caption" style={{ color: colors.error }}>{Math.floor(recorder.durationMillis / 1000)}s</ThemedText>
        )}
        <View style={{ flex: 1 }} />
        <Pressable onPress={send} disabled={disabled || !text.trim()} hitSlop={8} accessibilityLabel="Send"
          style={[styles.send, { backgroundColor: disabled || !text.trim() ? colors.buttonDisabled : colors.primary }]}>
          <Ionicons name={transcribing ? 'hourglass-outline' : 'send'} size={18} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderWidth: 1, borderRadius: 16, padding: Spacing.sm, gap: Spacing.xs },
  input: { minHeight: 40, maxHeight: 140, fontSize: 15, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg, paddingHorizontal: Spacing.xs },
  mic: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  send: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
