import { createApp } from './app';
import { env } from './config/env';

if (!process.env.FUNCTIONS_EMULATOR) {
  // eslint-disable-next-line no-console
  console.info('Starting standalone Express server for local development');
}

const app = createApp();
const port = env.port;

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API server listening on http://localhost:${port}`);
});
