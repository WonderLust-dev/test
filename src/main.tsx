import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

// Automatically detect repo basename for GitHub Pages (e.g. /test) or root (/)
export const getBasename = (): string => {
  const pathname = window.location.pathname;
  if (window.location.hostname.endsWith('github.io')) {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length > 0) {
      const first = segments[0];
      const knownRoutes = ['notes', 'library', 'practice', 'mistakes', 'bookmarks', 'analytics', 'studio', 'import', 'exam', 'results', 'review', 'dashboard'];
      if (!knownRoutes.includes(first)) {
        return `/${first}`;
      }
    }
  }
  if (pathname.startsWith('/test/') || pathname === '/test') {
    return '/test';
  }
  return '';
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter basename={getBasename()}>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);

