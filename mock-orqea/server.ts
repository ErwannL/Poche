import { configFromEnv } from './config.ts';
import { createMockApp } from './app.ts';

const config = configFromEnv(process.env);
const port = Number(process.env.MOCK_PORT ?? 4010);

createMockApp(config).listen(port, () => {
  console.log(
    `Mock Orqea sur http://localhost:${port} — modes : ${config.modes.join(', ') || 'aucun'}`,
  );
});
