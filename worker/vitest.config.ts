import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

/**
 * The suite runs inside workerd through @cloudflare/vitest-pool-workers, so every test
 * drives the same runtime Cloudflare deploys, with the same Request and Response.
 *
 * The pool needs the nodejs_compat flag for its own machinery, which the deployed
 * Worker does not, so it reads test/wrangler.test.toml rather than wrangler.toml.
 */
export default defineWorkersConfig({
  test: {
    poolOptions: { workers: { wrangler: { configPath: './test/wrangler.test.toml' } } },
  },
});
