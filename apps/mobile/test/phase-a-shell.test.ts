import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));

describe('first run and the beta shell', () => {
  it('asks for your entry, opens foursome games, and locks light mode', () => {
    const onboard = readFileSync(join(here, '../app/onboard.tsx'), 'utf8');
    expect(onboard).toContain('Your entry');
    expect(onboard.toLowerCase()).not.toContain('official');
    expect(onboard).toContain('Skip');
    const home = readFileSync(join(here, '../app/index.tsx'), 'utf8');
    expect(home).toContain("router.push('/games')");
    expect(home).not.toContain('Coming to the TestFlight build.');
    expect(home).not.toMatch(/founderTools \? \(\s*<Pressable accessibilityRole="button" accessibilityLabel="Foursome games"/);
    expect(home).toContain("router.replace('/onboard')");
    const config = readFileSync(join(here, '../app.config.js'), 'utf8');
    expect(config).toContain("userInterfaceStyle: 'light'");
    expect(config).toContain("UIUserInterfaceStyle: 'Light'");
    const app = readFileSync(join(here, '../app.json'), 'utf8');
    expect(app).not.toContain('expo-notifications');
    expect(app).toContain('"userInterfaceStyle": "light"');
  });
});
