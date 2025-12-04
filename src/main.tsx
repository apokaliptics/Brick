import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ThemeProvider } from './contexts/ThemeContext.tsx';
import { WallProvider } from './contexts/WallContext.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <WallProvider>
      <App />
    </WallProvider>
  </ThemeProvider>
);
