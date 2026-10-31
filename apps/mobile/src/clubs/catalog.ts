/** Ten largest golf brands in the current retail market. Approximate model names, not a live catalog. */

export const GOLF_BRANDS = ['Titleist', 'Callaway', 'TaylorMade', 'Ping', 'Cobra', 'Mizuno', 'Srixon', 'Cleveland', 'Wilson', 'PXG'] as const;

export type GolfBrand = (typeof GOLF_BRANDS)[number];

export const CATALOG_NOTE = 'Approximate. Common current and recent models. This list works offline.';

/** Models a golfer would still see in a shop or a recent model year. Names only. No lofts. */
export const MODEL_CATALOG: Record<GolfBrand, readonly string[]> = {
  Titleist: ['GT2', 'GT3', 'GT4', 'TSR2', 'TSR3', 'TSi3', 'T100', 'T150', 'T200', 'T350', 'Vokey SM10'],
  Callaway: ['Paradym Ai Smoke', 'Elyte', 'Rogue ST', 'Apex Ai200', 'Apex Pro', 'Big Bertha', 'Jaws Raw', 'Opus'],
  TaylorMade: ['Qi35', 'Qi10', 'Stealth 2', 'P790', 'P770', 'P7CB', 'Qi irons', 'Milled Grind 4'],
  Ping: ['G430', 'G440', 'G430 Max', 'i530', 'i240', 'G730', 'Blueprint S', 's159'],
  Cobra: ['Darkspeed', 'Darkspeed X', 'Aerojet', 'King Tour', 'King Tec', '3DP Tour'],
  Mizuno: ['JPX 925 Hot Metal', 'JPX 925 Forged', 'Pro 245', 'Pro 225', 'ST-Max', 'T24'],
  Srixon: ['ZX5 Mk II', 'ZX7 Mk II', 'ZXi5', 'ZXi7', 'ZX Mk II', 'RTX ZipCore'],
  Cleveland: ['Launcher XL', 'ZipCore XL', 'RTX 6', 'CBX 4', 'Halo XL'],
  Wilson: ['Dynapower', 'Staff Model', 'D9', 'Infinite', 'Staff Model ZM'],
  PXG: ['Black Ops', '0311 Gen6', '0317', '0311 XF', 'Sugar Daddy III'],
};

export function modelsFor(brand: string, query = ''): string[] {
  const known = (GOLF_BRANDS as readonly string[]).includes(brand) ? MODEL_CATALOG[brand as GolfBrand] : [];
  const needle = query.trim().toLowerCase();
  if (!needle) return [...known];
  return known.filter((model) => model.toLowerCase().includes(needle));
}

/**
 * Optional model names from the caddie route. A failure, a placeholder host, or a reply
 * without a models list returns nothing. The static catalog still stands.
 */
export async function optionalModelHints(brand: string, fetchImpl: typeof fetch = fetch): Promise<string[]> {
  const host = process.env.EXPO_PUBLIC_EXTRACT_URL;
  if (!host || host.includes('REPLACE')) return [];
  try {
    const response = await fetchImpl(`${host.replace(/\/$/, '')}/v1/caddie`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: brand, context: { hole: 1, profiles: [] } }),
    });
    if (!response.ok) return [];
    const body = (await response.json()) as { models?: unknown };
    if (!Array.isArray(body.models)) return [];
    return body.models.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim());
  } catch {
    return [];
  }
}
