const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;

// Public and store builds set EXPO_PUBLIC_FOUNDER_TOOLS=0 so founder history never enters the bundle.
if (process.env.EXPO_PUBLIC_FOUNDER_TOOLS === '0') {
  const stub = path.resolve(workspaceRoot, 'packages/seed/src/store-stub.ts');
  const founderOff = path.resolve(projectRoot, 'src/founder-off.tsx');
  const blockedFounderScreens = new Set([
    path.resolve(projectRoot, 'app/founder/index.tsx'),
    path.resolve(projectRoot, 'app/founder/[demo].tsx'),
  ]);
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName === '@coopr/seed') {
      return { filePath: stub, type: 'sourceFile' };
    }
    const resolved = context.resolveRequest(context, moduleName, platform);
    if (resolved && resolved.type === 'sourceFile' && blockedFounderScreens.has(resolved.filePath)) {
      return { filePath: founderOff, type: 'sourceFile' };
    }
    return resolved;
  };
}

module.exports = config;
