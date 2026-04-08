import React from 'react';
import { Box, Typography } from '@mui/material';

const TEAM_HEX = ['#00e5ff', '#ff00e5', '#ffab00'];
const PODIUM_HEIGHTS = { 1: 200, 2: 140, 3: 90 };

export default function Podium({ data }) {
  const { placements, superlatives } = data;

  // Sort for visual layout: 2nd, 1st, 3rd
  const sorted = [...placements].sort((a, b) => {
    const order = { 1: 1, 2: 0, 3: 2 };
    return (order[a.placement] ?? a.placement) - (order[b.placement] ?? b.placement);
  });

  return (
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 20,
      }}
    >
      <Typography variant="h2" fontWeight={800} sx={{ mb: 6 }}>
        Final Standings
      </Typography>

      {/* Podium blocks */}
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 3, mb: 6 }}>
        {sorted.map((team) => {
          const height = PODIUM_HEIGHTS[team.placement] || 80;
          return (
            <Box
              key={team.index}
              sx={{
                textAlign: 'center',
                animation: 'riseUp 0.8s ease',
                '@keyframes riseUp': {
                  from: { transform: 'translateY(50px)', opacity: 0 },
                  to: { transform: 'translateY(0)', opacity: 1 },
                },
              }}
            >
              <Typography variant="h4" fontWeight={800} sx={{ color: TEAM_HEX[team.index], mb: 1 }}>
                {team.score}
              </Typography>
              <Typography variant="h6" fontWeight={700} sx={{ color: TEAM_HEX[team.index], mb: 1 }}>
                {team.name}
              </Typography>
              <Box
                sx={{
                  width: 180,
                  height,
                  bgcolor: TEAM_HEX[team.index],
                  borderRadius: '8px 8px 0 0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0.9,
                }}
              >
                <Typography variant="h2" fontWeight={900} sx={{ color: 'rgba(0,0,0,0.7)' }}>
                  {team.placement === 1 && placements.filter(p => p.placement === 1).length > 1
                    ? 'TIE!'
                    : `#${team.placement}`}
                </Typography>
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* Superlatives */}
      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 900 }}>
        {superlatives.map((s, i) => (
          <Box
            key={i}
            sx={{
              bgcolor: 'background.paper',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 2,
              p: 2,
              minWidth: 200,
              textAlign: 'center',
              animation: `fadeIn 0.5s ease ${i * 0.2}s both`,
              '@keyframes fadeIn': {
                from: { opacity: 0, transform: 'scale(0.9)' },
                to: { opacity: 1, transform: 'scale(1)' },
              },
            }}
          >
            <Typography variant="subtitle2" color="primary" fontWeight={700}>
              {s.title}
            </Typography>
            <Typography variant="h6" fontWeight={700} sx={{ my: 0.5 }}>
              {s.recipient}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {s.subtitle}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
