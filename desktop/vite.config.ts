import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const here = fileURLToPath(new URL('.', import.meta.url));
const sharedDir = fileURLToPath(new URL('../shared', import.meta.url));

const REQUIRED_ENV = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'];

export default defineConfig(({ mode }) => {
  // Fail the build on missing env rather than let it succeed hollow.
  //
  // `src/supabase.ts` throws when these are unset. Vite inlines
  // `import.meta.env.VITE_*` as literals, so with them missing that guard folds
  // to an unconditional `throw` — Rollup then treats the `createClient` call
  // below it as unreachable and tree-shakes all of @supabase/supabase-js out.
  // The build goes green and emits a bundle half the normal size that cannot
  // talk to anything. Checking here turns that into a loud, early failure.
  const env = loadEnv(mode, here, 'VITE_');
  const missing = REQUIRED_ENV.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing ${missing.join(', ')}.\n` +
        'Copy desktop/.env.example to desktop/.env.local and fill it in from the repo-root .env.'
    );
  }

  return {
    plugins: [react()],
    resolve: {
      // `shared/` lives one level up, outside this project's root, and has no
      // package.json on purpose (see ../shared/README.md) — so it is reached by
      // alias rather than by module resolution.
      alias: { shared: sharedDir },
    },
    server: {
      // Vite refuses to serve files above the project root by default; `shared/`
      // is above it. Allowing '..' is what lets HMR pick up an edit there.
      fs: { allow: ['..'] },
    },
  };
});
