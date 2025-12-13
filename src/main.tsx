import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ThemeProvider } from './contexts/ThemeContext.tsx';
import { WallProvider } from './contexts/WallContext.tsx';
import './index.css';

// Tauri deep link listener: deliver OAuth codes from desktop redirects to the UI via window.postMessage
try {
  // Import dynamically so web builds won't fail
  // @ts-ignore
  import('@tauri-apps/api/event').then(({ listen }) => {
    listen('tauri://deep-link', (event: any) => {
      try {
        const url = new URL(event.payload as string);
        if (url.protocol !== 'brick:') return;
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        if (!code) return;
        window.postMessage({ provider: state, code }, '*');
      } catch (err) {
        // Ignore URL parse errors
      }
    });
  }).catch(() => {
    // Not running in Tauri environment; ignore
  });
} catch (err) {
  // ignore import failures (web mode)
}

createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <WallProvider>
      <App />
    </WallProvider>
  </ThemeProvider>
);
