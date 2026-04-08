import React from 'react';
import { Box, Typography, LinearProgress } from '@mui/material';
import { TEAM_COLORS } from '../../styles/theme';

export default function CountdownBar({ remaining, total, paused, teamColor }) {
  const progress = total > 0 ? (remaining / total) * 100 : 0;
  const isUrgent = remaining <= 10;

  return (
    <Box className="countdown-bar" sx={{ bgcolor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', p: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography
          variant="h6"
          fontWeight={800}
          sx={{
            color: isUrgent ? '#ff1744' : TEAM_COLORS[teamColor]?.main || '#fff',
            animation: isUrgent ? 'pulse 0.5s infinite alternate' : 'none',
            '@keyframes pulse': { from: { opacity: 1 }, to: { opacity: 0.5 } },
          }}
        >
          {paused ? 'PAUSED' : `${remaining}s`}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={progress}
        sx={{
          height: 4,
          borderRadius: 2,
          bgcolor: 'rgba(255,255,255,0.1)',
          '& .MuiLinearProgress-bar': {
            bgcolor: isUrgent ? '#ff1744' : TEAM_COLORS[teamColor]?.main || '#00e5ff',
            transition: 'transform 1s linear',
          },
        }}
      />
    </Box>
  );
}
