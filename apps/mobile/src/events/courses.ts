import { AUBURN_ADDRESS, AUBURN_KEY, AUBURN_NAME, AUBURN_PARS, HIGH_CEDARS_KEY, HIGH_CEDARS_NAME, HIGH_CEDARS_PARS } from './types';

export interface EventCourse {
  key: string;
  name: string;
  address: string;
  pars: readonly number[];
}

/** Cards we can score. A name with no card is not offered. */
export const EVENT_COURSES: readonly EventCourse[] = [
  { key: AUBURN_KEY, name: AUBURN_NAME, address: AUBURN_ADDRESS, pars: AUBURN_PARS },
  { key: HIGH_CEDARS_KEY, name: HIGH_CEDARS_NAME, address: '', pars: HIGH_CEDARS_PARS },
];

export function searchCourses(query: string): EventCourse[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...EVENT_COURSES];
  return EVENT_COURSES.filter((course) => course.name.toLowerCase().includes(needle) || course.address.toLowerCase().includes(needle));
}

export function courseByKey(key: string): EventCourse | null {
  return EVENT_COURSES.find((course) => course.key === key) ?? null;
}
