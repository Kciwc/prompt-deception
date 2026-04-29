import { createTheme } from '@mui/material/styles';

export const TEAM_COLORS = {
  cyan: { main: '#00e5ff', dark: '#00b8d4', bg: 'rgba(0, 229, 255, 0.12)', glow: 'rgba(0, 229, 255, 0.4)', text: '#00e5ff' },
  magenta: { main: '#ff00e5', dark: '#c400b0', bg: 'rgba(255, 0, 229, 0.12)', glow: 'rgba(255, 0, 229, 0.4)', text: '#ff00e5' },
  amber: { main: '#ffab00', dark: '#ff8f00', bg: 'rgba(255, 171, 0, 0.12)', glow: 'rgba(255, 171, 0, 0.4)', text: '#ffab00' },
  spectator: { main: '#9e9e9e', dark: '#757575', bg: 'rgba(158, 158, 158, 0.08)', glow: 'rgba(158, 158, 158, 0.2)', text: '#9e9e9e' },
};

export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#00e5ff' },
    secondary: { main: '#ff00e5' },
    background: {
      default: '#06060f',
      paper: '#12122a',
    },
    text: {
      primary: '#f0f0f0',
      secondary: '#8888aa',
    },
  },
  typography: {
    fontFamily: '"Montserrat", "Inter", "Roboto", sans-serif',
    h1: { fontFamily: '"Fredoka One", "Montserrat", cursive', fontWeight: 400 },
    h2: { fontFamily: '"Fredoka One", "Montserrat", cursive', fontWeight: 400 },
    h3: { fontFamily: '"Fredoka One", "Montserrat", cursive', fontWeight: 400 },
    h4: { fontFamily: '"Fredoka One", "Montserrat", cursive', fontWeight: 400 },
    h5: { fontFamily: '"Montserrat", sans-serif', fontWeight: 700 },
    h6: { fontFamily: '"Montserrat", sans-serif', fontWeight: 600 },
    button: { fontFamily: '"Montserrat", sans-serif', fontWeight: 700, textTransform: 'none', letterSpacing: '0.02em' },
  },
  shape: { borderRadius: 16 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          padding: '12px 28px',
          fontSize: '1rem',
          transition: 'all 0.2s ease',
        },
        contained: {
          boxShadow: '0 4px 20px rgba(0, 229, 255, 0.25)',
          '&:hover': {
            boxShadow: '0 6px 30px rgba(0, 229, 255, 0.4)',
            transform: 'translateY(-1px)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: '1px solid rgba(255,255,255,0.06)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: '1px solid rgba(255,255,255,0.08)',
          transition: 'all 0.3s ease',
          '&:hover': {
            border: '1px solid rgba(0, 229, 255, 0.3)',
            boxShadow: '0 8px 40px rgba(0, 229, 255, 0.15)',
          },
        },
      },
    },
  },
});

export const lightTheme = createTheme({
  ...darkTheme,
  palette: {
    mode: 'light',
    primary: { main: '#0097a7' },
    secondary: { main: '#c2185b' },
    background: {
      default: '#f0f0f5',
      paper: '#ffffff',
    },
    text: {
      primary: '#212121',
      secondary: '#666666',
    },
  },
});
