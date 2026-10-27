import { Platform } from 'react-native';

/** A file picked by expo-image-picker / expo-document-picker, normalised for upload. */
export interface PickedFile {
  uri: string;
  name: string;
  type: string;
  size?: number;
  /** Web only: the browser File the picker produced. */
  file?: File;
}

/**
 * Append picked files to a multipart form. Native fetch accepts `{uri, name, type}` parts; the
 * browser needs a real Blob/File (fetching the blob: URL the picker returned works too).
 */
export async function appendFiles(form: FormData, field: string, files: PickedFile[]): Promise<void> {
  for (const f of files) {
    if (Platform.OS === 'web') {
      const blob = f.file ?? (await (await fetch(f.uri)).blob());
      form.append(field, blob, f.name);
    } else {
      form.append(field, { uri: f.uri, name: f.name, type: f.type } as unknown as Blob);
    }
  }
}

export const filenameFromUri = (uri: string, fallback: string) =>
  uri.split('/').pop()?.split('?')[0] || fallback;
