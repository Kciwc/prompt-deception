import { createTheme } from '@mui/material/styles';

// Team color tokens
export const TEAM_COLORS = {
  cyan: { main: '#00e5ff', dark: '#00b8d4', bg: 'rgba(0, 229, 255, 0.12)', text: '#00e5ff' },
  magenta: { main: '#ff00e5', dark: '#c400b0', bg: 'rgba(255, 0, 229, 0.12)', text: '#ff00e5' },
  amber: { main: '#ffab00', dark: '#ff8f00', bg: 'rgba(255, 171, 0, 0.12)', text: '#ffab00' },
  spectator: { main: '#9e9e9e', dark: '#757575', bg: 'rgba(158, 158, 158, 0.08)', text: '#9e9e9e' },
};

export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#00e5ff' },
    secondary: { main: '#ff00e5' },
    background: {
      default: '#0a0a0a',
      paper: '#1a1a2e',
    },
    text: {
      primary: '#f0f0f0',
      secondary: '#aaaaaa',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 800 },
    h2: { fontWeight: 700 },
    h3: { fontWeight: 700 },
    button: { fontWeight: 600, textTransform: 'none' },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          padding: '12px 24px',
          fontSize: '1rem',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
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
      default: '#f5f5f5',
      paper: '#ffffff',
    },
    text: {
      primary: '#212121',
      secondary: '#666666',
    },
  },
});
