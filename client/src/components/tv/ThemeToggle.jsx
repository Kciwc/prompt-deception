import React from 'react';
import { Box, Typography } from '@mui/material';

export default function ThemeToggle({ theme, toggleTheme }) {
  return (
    <Box
      onClick={toggleTheme}
      sx={{
        position: 'absolute',
        top: 20,
        right: 120,
        zIndex: 50,
        cursor: 'pointer',
        bgcolor: 'rgba(255,255,255,0.1)',
        borderRadius: 2,
        px: 2,
        py: 0.5,
        '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
      }}
    >
      <Typography variant="body2">
        {theme === 'dark' ? '☀ Light' : '🌙 Dark'}
      </Typography>
    </Box>
  );
}
