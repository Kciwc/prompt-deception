import React from 'react';
import { Box, Typography } from '@mui/material';

const TEAM_HEX = ['#00e5ff', '#ff00e5', '#ffab00'];

export default function RevealSequence({ steps, scores, teams }) {
  return (
    <Box
      sx={{
        position: 'absolute',
        bottom: 100,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '80%',
        maxWidth: 800,
        zIndex: 10,
      }}
    >
      {steps.map((step, i) => (
        <Box
          key={i}
          sx={{
            bgcolor: step.isReal ? 'rgba(0,230,118,0.15)' : 'background.paper',
            border: step.isReal ? '2px solid #00e676' : '1px solid rgba(255,255,255,0.1)',
            borderRadius: 2,
            p: 2,
            mb: 1.5,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            animation: 'fadeSlideIn 0.5s ease',
            '@keyframes fadeSlideIn': {
              from: { opacity: 0, transform: 'translateY(20px)' },
              to: { opacity: 1, transform: 'translateY(0)' },
            },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography
              variant="h5"
              sx={{
                color: step.isReal
                  ? '#00e676'
                  : step.sourceTeam !== null
                  ? TEAM_HEX[step.sourceTeam]
                  : '#fff',
              }}
            >
              {step.icon}
            </Typography>
            <Box>
              <Typography variant="body1" fontWeight={600}>
                {step.text}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {step.isReal
                  ? 'THE REAL PROMPT!'
                  : step.sourceTeam !== null
                  ? `Bluff by ${teams?.[step.sourceTeam]?.finalName || `Team ${step.sourceTeam + 1}`}`
                  : ''}
              </Typography>
            </Box>
          </Box>
          <Typography variant="h6" fontWeight={700} sx={{ minWidth: 60, textAlign: 'right' }}>
            {step.votesReceived} vote{step.votesReceived !== 1 ? 's' : ''}
          </Typography>
        </Box>
      ))}

      {/* Score deltas after all revealed */}
      {scores && steps.length > 0 && (
        <Box sx={{ mt: 3, display: 'flex', gap: 3, justifyContent: 'center' }}>
          {scores.teams.map((t, i) => (
            <Box key={i} sx={{ textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: TEAM_HEX[t.index] }}>
                {t.finalName}
              </Typography>
              <Typography variant="h5" fontWeight={800} sx={{ color: TEAM_HEX[t.index] }}>
                {t.score}
              </Typography>
              {scores.roundDelta[t.index] > 0 && (
                <Typography variant="caption" sx={{ color: '#00e676' }}>
                  +{scores.roundDelta[t.index]}
                </Typography>
              )}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
