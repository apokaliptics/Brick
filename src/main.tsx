import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ThemeProvider } from './contexts/ThemeContext.tsx';
import { WallProvider } from './contexts/WallContext.tsx';
import './index.css';

// Tauri deep link listener: deliver OAuth codes from desktop redirects to the UI via window.postMessage
const startDeepLinkListener = async () => {
  try {
    const { listen } = await import('@tauri-apps/api/event');
    await listen('tauri://deep-link', (event: { payload?: unknown } | null) => {
      const payload = event?.payload;
      if (typeof payload !== 'string') return;
      try {
        const url = new URL(payload);
        if (url.protocol !== 'brick:') return;
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        if (code === null || code === '') return;
        window.postMessage({ provider: state ?? undefined, code }, '*');
      } catch {
        // ignore malformed URLs
      }
    });
  } catch {
    // Not running in Tauri environment; ignore
  }
};

void startDeepLinkListener();

createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <WallProvider>
      <App />
    </WallProvider>
  </ThemeProvider>
);
