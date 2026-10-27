import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

export const VOICE_MIME = Platform.OS === 'web' ? 'audio/webm' : 'audio/m4a';

/** One mic session: start, then stop() gives the clip as base64 for POST /voice/transcribe. */
export function useVoiceRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder);

  const start = async (): Promise<boolean> => {
    const { granted } = await AudioModule.requestRecordingPermissionsAsync();
    if (!granted) return false;
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    return true;
  };

  const stop = async (): Promise<{ audioBase64: string; mimeType: string } | null> => {
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    const uri = recorder.uri;
    if (!uri) return null;
    if (Platform.OS === 'web') {
      const blob = await (await fetch(uri)).blob();
      const audioBase64 = await blobToBase64(blob);
      return { audioBase64, mimeType: blob.type || VOICE_MIME };
    }
    const audioBase64 = await new File(uri).base64();
    return { audioBase64, mimeType: VOICE_MIME };
  };

  return { start, stop, isRecording: state.isRecording, durationMillis: state.durationMillis };
}

const blobToBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.readAsDataURL(blob);
  });
