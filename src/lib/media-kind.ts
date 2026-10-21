/** Classify admin gallery assets for filters and pickers. */

export type MediaKind = 'photo' | 'video' | 'audio';

const PHOTO_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'bmp', 'svg']);
const VIDEO_EXT = new Set(['mp4', 'webm', 'mov', 'm4v', 'avi', 'mkv']);
const AUDIO_EXT = new Set(['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'wma']);

export function extensionOf(nameOrUrl: string): string {
  const clean = nameOrUrl.split('?')[0].split('#')[0];
  const base = clean.split('/').pop() || '';
  const dot = base.lastIndexOf('.');
  return dot >= 0 ? base.slice(dot + 1).toLowerCase() : '';
}

export function mediaKindOf(item: {
  mimeType?: string | null;
  filename?: string | null;
  url?: string | null;
  relativePath?: string | null;
}): MediaKind {
  const mime = String(item.mimeType || '').toLowerCase();
  if (mime.startsWith('image/')) return 'photo';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';

  const ext =
    extensionOf(item.filename || '') ||
    extensionOf(item.url || '') ||
    extensionOf(item.relativePath || '');

  if (VIDEO_EXT.has(ext)) return 'video';
  if (AUDIO_EXT.has(ext)) return 'audio';
  if (PHOTO_EXT.has(ext) || !ext) return 'photo';
  return 'photo';
}

export function isPhotoMedia(item: {
  mimeType?: string | null;
  filename?: string | null;
  url?: string | null;
  relativePath?: string | null;
}): boolean {
  return mediaKindOf(item) === 'photo';
}

export function isVideoMedia(item: Parameters<typeof mediaKindOf>[0]): boolean {
  return mediaKindOf(item) === 'video';
}

export function isAudioMedia(item: Parameters<typeof mediaKindOf>[0]): boolean {
  return mediaKindOf(item) === 'audio';
}

export const MEDIA_KIND_LABELS: Record<MediaKind, string> = {
  photo: 'Фото',
  video: 'Видео',
  audio: 'Аудио',
};
