import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global error handler for mobile debugging
window.onerror = function(msg, url, line, col, error) {
  const errorMsg = `Error: ${msg}\nUrl: ${url}\nLine: ${line}`;
  console.error(errorMsg);
  alert(errorMsg);
  return false;
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
