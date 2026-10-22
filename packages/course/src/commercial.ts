import type { CourseDataProvider } from '@coopr/domain';

/**
 * No vendor contract is assumed. iGolf, Golf Intelligence, and any equivalent
 * stay behind this adapter until a license exists. It returns no geometry.
 */
export function commercialCourseStub(): CourseDataProvider {
  return {
    id: 'commercial-stub',
    state: 'partner_required',
    datasetClass: 'proprietary',
    async search() {
      return [];
    },
    async loadScorecard() {
      return null;
    },
    async loadGeometry() {
      return [];
    },
  };
}
