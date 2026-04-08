import React from 'react';
import { Chip } from '@mui/material';
import { TEAM_COLORS } from '../../styles/theme';

const COLOR_KEYS = ['cyan', 'magenta', 'amber'];

export default function TeamBadge({ teamIndex, teamName, size = 'small' }) {
  const color = COLOR_KEYS[teamIndex] || 'spectator';
  const colors = TEAM_COLORS[color];

  return (
    <Chip
      label={teamName || `Team ${teamIndex + 1}`}
      size={size}
      sx={{
        bgcolor: colors.bg,
        color: colors.main,
        borderColor: colors.main,
        border: '1px solid',
        fontWeight: 700,
      }}
    />
  );
}
