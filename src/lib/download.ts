import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

/**
 * "Download" a binary the server produced: the browser saves it, native writes it to the cache
 * and opens the share sheet (the user then saves to Files / Drive / mail).
 */
export async function saveOrShare(blob: Blob, filename: string, mimeType?: string): Promise<void> {
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  const file = await blobToCacheFile(blob, filename);
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: filename });
}

/** React Native's Blob implements neither arrayBuffer() nor text(); FileReader is the way in. */
export const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'));
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.readAsDataURL(blob);
  });

/** Write a blob into the cache directory and return the File (for viewers and share sheets). */
export async function blobToCacheFile(blob: Blob, filename: string): Promise<File> {
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.create();
  file.write(await blobToBytes(blob));
  return file;
}

async function blobToBytes(blob: Blob): Promise<Uint8Array> {
  const base64 = await blobToBase64(blob);
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
