import React, { useState, useMemo, useEffect } from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { darkTheme, lightTheme } from './styles/theme';
import MobileView from './pages/MobileView';
import TVScreen from './pages/TVScreen';
import AdminDashboard from './pages/AdminDashboard';

export default function App() {
  const [theme, setTheme] = useState('dark');

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  const muiTheme = useMemo(
    () => (theme === 'dark' ? darkTheme : lightTheme),
    [theme]
  );

  // Simple client-side routing based on pathname
  const path = window.location.pathname;

  // Prevent accidental page leave during game
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (path === '/' || path === '/screen') {
        e.preventDefault();
        e.returnValue = 'Game in progress! Are you sure you want to leave?';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [path]);

  let content;
  if (path === '/screen') {
    content = <TVScreen theme={theme} toggleTheme={toggleTheme} />;
  } else if (path === '/admin') {
    content = <AdminDashboard />;
  } else {
    content = <MobileView />;
  }

  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      {content}
    </ThemeProvider>
  );
}
