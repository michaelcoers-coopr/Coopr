// Canonical units. Store everything in these; convert only at the display edge.
// Distance: yards. Speed: mph. Spin: rpm. Angles: degrees. Temperature: Fahrenheit.

export const YARDS_PER_METER = 1.09361;

export function metersToYards(m: number): number {
  return m * YARDS_PER_METER;
}
export function yardsToMeters(y: number): number {
  return y / YARDS_PER_METER;
}
export function celsiusToFahrenheit(c: number): number {
  return c * 9 / 5 + 32;
}
export function fahrenheitToCelsius(f: number): number {
  return (f - 32) * 5 / 9;
}
