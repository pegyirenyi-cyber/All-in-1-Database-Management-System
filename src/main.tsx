import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Register Offline Service Worker for offline capability
if ('serviceWorker' in navigator) {
  if ((import.meta as any).env.DEV) {
    // In development mode, force unregister any active service worker and clear caches to ensure the latest changes are loaded instantly
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister().then((success) => {
          if (success) console.log('[Service Worker] Unregistered active service worker in Dev mode to prevent caching.');
        });
      }
    });
    // Also purge caches
    if ('caches' in window) {
      caches.keys().then((names) => {
        for (const name of names) {
          caches.delete(name);
        }
      });
    }
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => {
          console.log('[Service Worker] Registered successfully with scope:', reg.scope);
        })
        .catch((err) => {
          console.error('[Service Worker] Registration failed:', err);
        });
    });
  }
}

