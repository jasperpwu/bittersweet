// Learn more https://docs.expo.io/guides/customizing-metro
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const { withNativeWind } = require('nativewind/metro');

/** @type {import('expo/metro-config').MetroConfig} */

const config = getDefaultConfig(__dirname);

// Fix: Supabase uses Node.js built-ins (ws, stream) that fail with package exports enabled
config.resolver.unstable_enablePackageExports = false;

// With package exports disabled (above, for Supabase), Metro can't resolve
// @posthog/core's exports-only subpaths — e.g. "@posthog/core/surveys" physically
// lives at dist/surveys/index.js and is only reachable via the package's "exports"
// map. Redirect those subpath specifiers to their real dist paths so we keep
// exports off globally while still resolving PostHog.
const posthogCoreDist = path.dirname(require.resolve('@posthog/core'));
const baseResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('@posthog/core/')) {
    const subpath = moduleName.slice('@posthog/core/'.length);
    // The "./vendor/*" export is a file glob (no /index); everything else is a dir.
    const filePath = subpath.startsWith('vendor/')
      ? path.join(posthogCoreDist, `${subpath}.js`)
      : path.join(posthogCoreDist, subpath, 'index.js');
    return { type: 'sourceFile', filePath };
  }
  return (baseResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
