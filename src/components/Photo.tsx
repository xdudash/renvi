import { Image, type ImageProps } from 'expo-image';

/**
 * Remote photo (signed Storage URL). expo-image keeps decoded images in memory and on disk, so a face seen once
 * opens instantly next time; a short fade replaces the blank flash of the old <Image>.
 */
export function Photo(props: ImageProps) {
  return <Image cachePolicy="memory-disk" contentFit="cover" transition={150} {...props} />;
}

/** Download photos ahead of time (next cards in the feed) so they are on disk before they are shown. */
export function prefetchPhotos(urls: string[]) {
  if (urls.length) Image.prefetch(urls, 'memory-disk').catch(() => {});
}
