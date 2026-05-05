import { loadConfig } from './config.js';
import { buildServer } from './server.js';

async function main() {
  const config = loadConfig();
  const app = await buildServer(config);
  await app.listen({ port: config.PORT, host: config.HOST });
  app.log.info(`backend listening on ${config.HOST}:${config.PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
