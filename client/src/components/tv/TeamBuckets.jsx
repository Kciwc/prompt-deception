import React from 'react';
import { Box, Typography } from '@mui/material';

const TEAM_HEX = ['#00e5ff', '#ff00e5', '#ffab00'];
const BUCKET_CLASSES = ['bucket-cyan', 'bucket-magenta', 'bucket-amber'];

export default function TeamBuckets({ teams, players }) {
  if (!teams || !players) return null;

  return (
    <Box sx={{ display: 'flex', gap: 3, justifyContent: 'center', width: '100%', maxWidth: 1000, mx: 'auto' }}>
      {teams.map((team) => {
        const teamPlayers = players.filter((p) => p.teamIndex === team.index);
        const color = TEAM_HEX[team.index];

        return (
          <Box
            key={team.index}
            className={BUCKET_CLASSES[team.index]}
            sx={{
              flex: 1,
              minHeight: 220,
              borderRadius: 4,
              p: 2.5,
              bgcolor: `${color}08`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              transition: 'all 0.3s ease',
            }}
          >
            {/* Team header */}
            <Typography
              variant="h5"
              sx={{
                color,
                mb: 2,
                textShadow: `0 0 20px ${color}60`,
                textAlign: 'center',
              }}
            >
              {team.finalName}
            </Typography>

            {/* Player chips */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: '100%', alignItems: 'center' }}>
              {teamPlayers.length === 0 ? (
                <Typography
                  variant="body2"
                  sx={{ color: `${color}60`, fontStyle: 'italic', mt: 2 }}
                >
                  Waiting for players...
                </Typography>
              ) : (
                teamPlayers.map((player, idx) => (
                  <Box
                    key={player.socketId}
                    className="player-drop-in"
                    sx={{
                      bgcolor: `${color}18`,
                      border: `1px solid ${color}40`,
                      borderRadius: 3,
                      px: 2.5,
                      py: 1,
                      width: '100%',
                      maxWidth: 200,
                      textAlign: 'center',
                      position: 'relative',
                      animationDelay: `${idx * 0.1}s`,
                      opacity: player.connected ? 1 : 0.4,
                    }}
                  >
                    <Typography
                      variant="body1"
                      sx={{ color, fontWeight: 600, fontSize: '0.95rem' }}
                    >
                      {player.name}
                    </Typography>
                    {player.ready && (
                      <Box
                        className="check-bounce"
                        sx={{
                          position: 'absolute',
                          top: -6,
                          right: -6,
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          bgcolor: '#00e676',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 13,
                          fontWeight: 800,
                          color: 'black',
                          boxShadow: '0 2px 8px rgba(0,230,118,0.4)',
                        }}
                      >
                        ✓
                      </Box>
                    )}
                  </Box>
                ))
              )}
            </Box>

            {/* Player count */}
            <Typography
              variant="caption"
              sx={{ color: `${color}80`, mt: 'auto', pt: 2 }}
            >
              {teamPlayers.length} player{teamPlayers.length !== 1 ? 's' : ''}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}
