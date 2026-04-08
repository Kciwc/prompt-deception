import React, { useState } from 'react';
import { Box, Button, Slider, Typography, Divider } from '@mui/material';
import socket from '../../socket';

export default function HostControls({
  gameState,
  muted,
  musicVolume,
  sfxVolume,
  onMusicVolume,
  onSfxVolume,
  onToggleMute,
}) {
  const [expanded, setExpanded] = useState(false);
  const phase = gameState?.phase ?? 0;

  return (
    <Box
      sx={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        bgcolor: 'rgba(0,0,0,0.9)',
        backdropFilter: 'blur(10px)',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        zIndex: 100,
        transition: 'all 0.3s',
      }}
    >
      {/* Toggle bar */}
      <Box
        onClick={() => setExpanded(!expanded)}
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          py: 1,
          cursor: 'pointer',
          '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
        }}
      >
        <Typography variant="caption" color="text.secondary">
          {expanded ? '▼ Hide Controls' : '▲ Host Controls'}
        </Typography>
      </Box>

      {expanded && (
        <Box sx={{ p: 2, display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
          {/* Game controls */}
          {phase === 0 && (
            <Button
              variant="contained"
              color="success"
              onClick={() => socket.emit('host:startGame')}
              size="large"
            >
              Start Game
            </Button>
          )}

          <Button
            variant="outlined"
            onClick={() => socket.emit('host:pause')}
          >
            {gameState?.paused ? 'Resume' : 'Pause'}
          </Button>

          {phase >= 1 && phase <= 3 && (
            <>
              <Button
                variant="outlined"
                onClick={() => socket.emit('host:addTime')}
              >
                +15s
              </Button>

              <Button
                variant="outlined"
                color="warning"
                onClick={() => socket.emit('host:undoPhase')}
              >
                Undo Phase
              </Button>

              <Button
                variant="outlined"
                color="error"
                onClick={() => socket.emit('host:trashRound')}
              >
                Trash Round
              </Button>
            </>
          )}

          {phase === 1 && (
            <Button
              variant={gameState?.doublePoints ? 'contained' : 'outlined'}
              color="warning"
              onClick={() => socket.emit('host:doublePoints')}
            >
              {gameState?.doublePoints ? 'Double Points ON' : 'Double Points'}
            </Button>
          )}

          {/* Kick player dropdown */}
          {gameState?.players?.length > 0 && (
            <KickMenu players={gameState.players} />
          )}

          <Divider orientation="vertical" flexItem sx={{ mx: 1, borderColor: 'rgba(255,255,255,0.1)' }} />

          {/* Audio controls */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 250 }}>
            <Button size="small" variant="text" onClick={onToggleMute}>
              {muted ? '🔇' : '🔊'}
            </Button>
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" color="text.secondary">Music</Typography>
              <Slider
                size="small"
                value={musicVolume}
                onChange={(_, v) => onMusicVolume(v)}
                min={0}
                max={1}
                step={0.05}
              />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" color="text.secondary">SFX</Typography>
              <Slider
                size="small"
                value={sfxVolume}
                onChange={(_, v) => onSfxVolume(v)}
                min={0}
                max={1}
                step={0.05}
              />
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
}

function KickMenu({ players }) {
  const [open, setOpen] = useState(false);

  return (
    <Box sx={{ position: 'relative' }}>
      <Button variant="outlined" color="error" size="small" onClick={() => setOpen(!open)}>
        Kick Player
      </Button>
      {open && (
        <Box
          sx={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            bgcolor: 'background.paper',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 1,
            mb: 1,
            minWidth: 150,
            maxHeight: 200,
            overflowY: 'auto',
            zIndex: 200,
          }}
        >
          {players.map((p) => (
            <Box
              key={p.socketId}
              onClick={() => {
                socket.emit('host:kick', { socketId: p.socketId });
                setOpen(false);
              }}
              sx={{
                px: 2,
                py: 1,
                cursor: 'pointer',
                '&:hover': { bgcolor: 'rgba(255,0,0,0.1)' },
                borderBottom: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              <Typography variant="body2">{p.name}</Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
