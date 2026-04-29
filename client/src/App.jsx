import React, { useState, useMemo, useEffect } from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { darkTheme, lightTheme } from './styles/theme';
import './styles/safeArea.css';
import './styles/animations.css';
import LobbyBrowser from './pages/LobbyBrowser';
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

  const path = window.location.pathname;
  const params = new URLSearchParams(window.location.search);
  const hasRoom = params.has('room');

  // Prevent accidental page leave during game
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (path === '/screen' || hasRoom) {
        e.preventDefault();
        e.returnValue = 'Game in progress! Are you sure you want to leave?';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [path, hasRoom]);

  let content;
  if (path === '/screen') {
    content = <TVScreen theme={theme} toggleTheme={toggleTheme} />;
  } else if (path === '/admin') {
    content = <AdminDashboard />;
  } else if (hasRoom) {
    // Joining a game via QR or lobby click → go straight to mobile game view
    content = <MobileView />;
  } else {
    // Landing page → lobby browser
    content = <LobbyBrowser />;
  }

  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      {content}
    </ThemeProvider>
  );
}
