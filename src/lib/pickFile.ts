import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

import { filenameFromUri, type PickedFile } from '@/lib/upload';

/** One document (pricebook, .docx, .html…) via the OS picker; null when cancelled. */
export async function pickDocument(mimeTypes: string[] = ['*/*']): Promise<PickedFile | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: mimeTypes, copyToCacheDirectory: true, multiple: false });
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  return { uri: a.uri, name: a.name, type: a.mimeType ?? 'application/octet-stream', size: a.size, file: a.file };
}

/** One image from the photo library (logos). */
export async function pickImage(): Promise<PickedFile | null> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  return { uri: a.uri, name: a.fileName ?? filenameFromUri(a.uri, 'logo.png'), type: a.mimeType ?? 'image/png', size: a.fileSize, file: a.file };
}

export const MIME = {
  pricebook: ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/pdf', 'text/comma-separated-values'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  docxOrPdf: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/pdf'],
  html: ['text/html'],
};
