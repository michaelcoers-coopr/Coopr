/** Six bundled renders, plus utility iron sharing the iron head. Unknown type stays empty. */
export const RENDER_TYPES = ['driver', 'fairway wood', 'hybrid', 'iron', 'utility iron', 'wedge', 'putter'] as const;

export type PictureKind = 'photo' | 'render' | 'empty';

export function clubPictureKind(photoUri: string | null, type: string | null): PictureKind {
  if (photoUri) return 'photo';
  if (type && (RENDER_TYPES as readonly string[]).includes(type)) return 'render';
  return 'empty';
}
