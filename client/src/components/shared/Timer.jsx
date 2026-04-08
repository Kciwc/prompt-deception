import React from 'react';
import { Typography } from '@mui/material';

export default function Timer({ remaining, urgent = 10 }) {
  const isUrgent = remaining <= urgent;

  return (
    <Typography
      variant="h3"
      fontWeight={800}
      sx={{
        color: isUrgent ? '#ff1744' : 'text.primary',
        animation: isUrgent ? 'pulse 0.5s infinite alternate' : 'none',
        '@keyframes pulse': {
          from: { opacity: 1 },
          to: { opacity: 0.4 },
        },
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {remaining}
    </Typography>
  );
}
