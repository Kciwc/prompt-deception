import React from 'react';
import { Box } from '@mui/material';

export default function ImageDisplay({ imageUrl }) {
  if (!imageUrl) return null;

  return (
    <Box
      sx={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        maxWidth: '60%',
        maxHeight: '70%',
        zIndex: 1,
      }}
    >
      <img
        src={imageUrl}
        alt="AI Generated"
        style={{
          maxWidth: '100%',
          maxHeight: '70vh',
          borderRadius: 16,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          objectFit: 'contain',
        }}
      />
    </Box>
  );
}
