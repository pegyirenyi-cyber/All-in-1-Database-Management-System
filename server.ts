import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { apiRouter } from './src/api-router';

// Dynamically load Firebase config if exists for server-side persistence sync
let firebaseConfig = {
  projectId: process.env.FIREBASE_PROJECT_ID || '',
  apiKey: process.env.FIREBASE_API_KEY || ''
};

if (!firebaseConfig.projectId || !firebaseConfig.apiKey) {
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      firebaseConfig.projectId = fileConfig.projectId || '';
      firebaseConfig.apiKey = fileConfig.apiKey || '';
      console.log(`[Server Setup] Loaded Firebase credentials from file fallback. Project: ${firebaseConfig.projectId}`);
    }
  } catch (err) {
    console.warn("[Server Setup] Could not read firebase-applet-config.json fallback. Using environment variables.", err);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Secure HTTP Headers Middleware
  app.use((_req, res, next) => {
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });

  // Custom parser to capture the exact raw request payload as a Buffer
  // This is required to securely verify Paystack Webhook signatures (HMAC-SHA512)
  app.use(express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    }
  }));
  app.use(express.urlencoded({ extended: true }));
 
  // ==================== PAYSTACK PAYMENT API ====================
  app.use('/api', apiRouter);
 
  // ==================== VITE & ASSETS ROUTING ====================

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log("[Node Server] Running in Development Mode. Mounted Vite live refresh middleware.");
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log("[Node Server] Running in Production Mode. Serving static compiled resources from /dist.");
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Applet Engine] Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
