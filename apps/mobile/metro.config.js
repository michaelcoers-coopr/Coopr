// Metro config for the npm-workspace monorepo: watch the repo root so the
// @coopr/* workspace packages (engine, core, tokens) resolve from source.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);
// Watch the repo root so the @coopr/* workspace packages resolve from source, and let
// Metro also look in the root node_modules. Hierarchical lookup stays ON so Metro can
// find Expo's nested transitive deps (expo-asset, expo-linking, etc.).
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;
