import bag from './sample_bag.json';
import profiles from './sample_profiles.json';

export interface SampleClubRecord {
  id: string;
  slot: string;
  in_play: boolean;
  brand: string | null;
  model: string | null;
  type: string;
  loft: number | null;
  flex: string | null;
  set?: string;
  note?: string;
}

export interface SampleBagFile {
  _label: string;
  clubs: SampleClubRecord[];
  types_user_picked: Record<string, string>;
}

export interface SampleProfileRecord {
  name: string;
  handicap_index: number;
  handicap_quality: string;
  driver_speed_mph: number;
  speed_quality: string;
}

export interface SampleProfilesFile {
  _label: string;
  A: SampleProfileRecord;
  B: SampleProfileRecord;
}

/** Present only when founder tools are on. Metro swaps this file for the empty stub otherwise. */
export const SAMPLE_BAG: SampleBagFile | null = bag as SampleBagFile;
export const SAMPLE_PROFILES: SampleProfilesFile | null = profiles as SampleProfilesFile;
export const SAMPLE_DATA_ENABLED = true;
