import { describe, expect, it } from 'vitest';
import { budgetAllows, budgetMonth, corsHeaders, MONTHLY_BUDGET_CENTS, secretOk, upstashAllow } from '../src/api-guard';
import { keepShot, measuredAverage, measuredLine, MIN_MEASURED_SHOTS, shouldSpeak, yardsBetween } from '../src/shots/track';

describe('shot distances', () => {
  it('measures about 122 yards for 0.001 degrees of latitude', () => {
    const yards = yardsBetween({ lat: 47.11, lon: -122.24 }, { lat: 47.111, lon: -122.24 });
    expect(yards).toBeGreaterThan(100);
    expect(yards).toBeLessThan(140);
  });

  it('drops an outlier and waits for five clean shots before a measured average', () => {
    expect(keepShot(10, [])).toBe(false);
    expect(keepShot(150, [140, 145, 150])).toBe(true);
    expect(keepShot(400, [140, 145, 150])).toBe(false);
    expect(measuredAverage([140, 145, 150, 148])).toBeNull();
    const ready = measuredAverage([140, 145, 150, 148, 142, 400]);
    expect(ready?.count).toBe(MIN_MEASURED_SHOTS);
    expect(ready?.yards).toBeGreaterThan(140);
    expect(ready?.yards).toBeLessThan(150);
    expect(measuredLine('7 iron', ready!)).toBe(`7 iron carries ${ready!.yards}, from ${ready!.count} shots.`);
  });

  it('does not speak a muted caddie', () => {
    expect(shouldSpeak(false)).toBe(true);
    expect(shouldSpeak(true)).toBe(false);
  });
});

describe('caddie server guards', () => {
  it('matches a shared secret only when one is configured', () => {
    expect(secretOk(null, undefined)).toBe(true);
    expect(secretOk('nope', 'desk-secret')).toBe(false);
    expect(secretOk('desk-secret', 'desk-secret')).toBe(true);
  });

  it('echoes an allowed origin and never a wildcard', () => {
    const headers = corsHeaders('https://play.coopr.app', 'https://play.coopr.app, http://localhost:8081');
    expect(headers['access-control-allow-origin']).toBe('https://play.coopr.app');
    expect(JSON.stringify(headers)).not.toContain('*');
    expect(corsHeaders('https://evil.example', 'https://play.coopr.app')['access-control-allow-origin']).toBeUndefined();
  });

  it('stops the month at 100 dollars', () => {
    expect(budgetAllows(0)).toBe(true);
    expect(budgetAllows(MONTHLY_BUDGET_CENTS - 1)).toBe(false);
    expect(budgetAllows(MONTHLY_BUDGET_CENTS)).toBe(false);
    expect(budgetMonth(new Date('2026-10-29T00:00:00Z'))).toBe('2026-10');
  });

  it('refuses the 21st Upstash increment', async () => {
    const calls: string[] = [];
    const fetchImpl = (async (url: string) => {
      calls.push(String(url));
      return new Response(JSON.stringify([{ result: 21 }]), { status: 200 });
    }) as typeof fetch;
    expect(await upstashAllow(fetchImpl, 'https://example.upstash.io', 'token', 'caddie:1', 20)).toBe(false);
    expect(calls[0]).toContain('/pipeline');
  });
});
