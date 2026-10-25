export const CROP_LINE = 'Cropping to the clubhead';
export const ON_PHONE = 'On this phone. Nothing is uploaded.';
export const PHOTOS_STAY = 'Photos stay on this phone.';
export const CATALOG_LINE = 'Catalog is not on this phone yet. Type the club.';
export const STARTING_POINT = 'A starting point, not a fitting. Handicap is never the whole story.';
export const NO_SIGNALS = 'NO SIGNALS YET. 0 independent sources for this club. We show nothing before we show a guess.';
export const SIGNALS_HELP = 'Help fill it in: log 20 shots with this club, then rate it.';
export const CUSTOM_ONLY = 'We only know what you typed.';
export const AI_RENDER = 'AI RENDER';
export const PHOTO_CLUBFACE = 'Photo your clubface';
export const RENDER_FOOTER = 'Pictures are AI renders by club type, not your clubs.';
export const CAMERA_WEB = 'Camera needs the phone. Use Library or Type it.';
export const HOLD_HEADLINE = 'HOLD UP A SEC.';
export const KEEP_ANYWAY = 'KEEP IT ANYWAY';
export const FITS_EMPTY = 'No offers loaded. Catalog is not on this phone yet.';
export const SPONSORED_EMPTY = 'No sponsored club is loaded. This row is not inside Good, Great, or Best.';
export const COMMISSION_BLIND =
  'Good, Great, and Best do not read a commission or a sponsorship. A sponsored club can only sit in its own labeled row.';
export const NOT_A_FITTING = 'COOPR is a smart starting point, not a launch monitor.';
export const AI_ATTRIBUTION =
  'Club pictures marked AI RENDER are generated illustrations of a generic club type, not photographs of any product. Brand and model names belong to their owners and are used only to describe the clubs you own. COOPR is not affiliated with any golf equipment maker.';
export const EMPTY_BAG = 'No clubs in the bag yet. Add one in Setup. Nothing was filled in for you.';

export const VERDICT_LABEL = {
  GOOD: 'Good fit',
  OKAY: 'Okay',
  PROBABLY_NOT: 'Probably not your club',
  CANT_TELL: "Can't tell yet",
} as const;

export const TYPE_CHOICES: { id: 'driver' | 'fairway wood' | 'hybrid' | 'iron' | 'wedge' | 'putter'; label: string }[] = [
  { id: 'driver', label: 'DRIVER' },
  { id: 'fairway wood', label: 'FAIRWAY' },
  { id: 'hybrid', label: 'HYBRID' },
  { id: 'iron', label: 'IRON' },
  { id: 'wedge', label: 'WEDGE' },
  { id: 'putter', label: 'PUTTER' },
];

export const BUILD_CHOICES: { id: 'game-improvement' | 'players-distance' | 'players-cb' | 'blade' | null; label: string }[] = [
  { id: 'game-improvement', label: 'GAME-IMPROVEMENT' },
  { id: 'players-distance', label: 'PLAYERS DISTANCE' },
  { id: 'players-cb', label: 'PLAYERS CAVITY-BACK' },
  { id: 'blade', label: 'BLADE' },
  { id: null, label: 'NOT SURE' },
];

export const FLEX_CHOICES: { id: 'L' | 'A' | 'R' | 'S' | 'X' | null; label: string }[] = [
  { id: 'L', label: 'L' },
  { id: 'A', label: 'A' },
  { id: 'R', label: 'R' },
  { id: 'S', label: 'S' },
  { id: 'X', label: 'X' },
  { id: null, label: 'NOT SURE' },
];
