import { resolve } from 'path';
import { createServer } from 'vite';

(async () => {
  const server = await createServer();
  const resolvedId = await server.pluginContainer.resolveId('./db', '/app/applet/src/App.tsx');
  console.log('RESOLVED TO:', resolvedId?.id);
  await server.close();
})();
