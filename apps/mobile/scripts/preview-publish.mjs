import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!process.env.EXPO_TOKEN) {
  fail(`EXPO_TOKEN is not set.

Create an access token at https://expo.dev/settings/access-tokens
on the Expo account that will own this project. Mike has to open the update
in Expo Go while signed into that same account, or an organization that owns it.

From the repo root, without committing the token:

  export EXPO_TOKEN='...'
  npm run preview:publish

This publishes the preview channel with founder tools on.
Production and store builds keep EXPO_PUBLIC_FOUNDER_TOOLS=0.`);
}

const env = {
  ...process.env,
  EXPO_PUBLIC_FOUNDER_TOOLS: '1',
  CI: '1',
  EXPO_NO_TELEMETRY: '1',
};

function run(args) {
  const result = spawnSync('npx', args, { cwd: appRoot, env, stdio: 'inherit' });
  if (result.error) fail(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function capture(args) {
  const result = spawnSync('npx', args, { cwd: appRoot, env, encoding: 'utf8' });
  if (result.error) fail(result.error.message);
  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? '');
    process.stderr.write(result.stdout ?? '');
    process.exit(result.status ?? 1);
  }
  return result.stdout ?? '';
}

function readConfig() {
  const text = capture(['expo', 'config', '--json', '--type', 'public']);
  const start = text.indexOf('{');
  if (start < 0) fail('expo config did not return JSON');
  return JSON.parse(text.slice(start));
}

const linked = JSON.parse(readFileSync(path.join(appRoot, 'app.json'), 'utf8'));
const committedProjectId = linked.expo?.extra?.eas?.projectId;
if (!committedProjectId) {
  fail('apps/mobile/app.json is missing expo.extra.eas.projectId. This repo is linked to @mikecoers/coopr and must not create a new EAS project.');
}

console.log(`Publishing the preview channel for @${linked.expo.owner}/coopr with EXPO_PUBLIC_FOUNDER_TOOLS=1.`);
run(['--yes', 'eas-cli@latest', 'whoami', '--non-interactive']);

const config = readConfig();
const projectId = config.extra?.eas?.projectId;
if (projectId !== committedProjectId) {
  fail(`Resolved project id ${projectId ?? '(missing)'} does not match the committed id ${committedProjectId}. Refusing to run eas init.`);
}

const runtimeVersion = typeof config.runtimeVersion === 'string' ? config.runtimeVersion : 'exposdk:54.0.0';
run([
  '--yes',
  'eas-cli@latest',
  'update',
  '--channel',
  'preview',
  '--message',
  'Expo Go preview (founder tools on)',
  '--non-interactive',
]);

const qr = `https://qr.expo.dev/eas-update?projectId=${encodeURIComponent(projectId)}&runtimeVersion=${encodeURIComponent(runtimeVersion)}&channel=preview&slug=exp`;
console.log('\nExpo Go QR image (App Store Expo Go, SDK 54):');
console.log(qr);
console.log('\nSame link as a URL string:');
console.log(`${qr}&format=url`);
console.log('\nOpen that URL on the iPhone. Expo Go must be the App Store build (SDK 54), signed into the Expo account that owns this project.');
