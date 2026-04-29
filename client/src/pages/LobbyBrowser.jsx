import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Card, CardContent, TextField, Chip } from '@mui/material';
import socket from '../socket';
import { TEAM_COLORS } from '../styles/theme';

const TEAM_HEX = ['#00e5ff', '#ff00e5', '#ffab00'];

export default function LobbyBrowser({ onNavigate }) {
  const [lobbies, setLobbies] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [lobbyName, setLobbyName] = useState('');

  useEffect(() => {
    socket.emit('lobby:subscribe');

    socket.on('lobby:list', (data) => {
      setLobbies(data.filter((l) => l.phase === 0));
    });

    return () => {
      socket.emit('lobby:unsubscribe');
      socket.off('lobby:list');
    };
  }, []);

  const handleCreate = () => {
    const name = lobbyName.trim() || 'My Game';
    window.location.href = `/screen?name=${encodeURIComponent(name)}`;
  };

  const handleJoin = (roomCode) => {
    window.location.href = `/?room=${roomCode}`;
  };

  return (
    <Box sx={{ position: 'relative', minHeight: '100dvh', zIndex: 1 }}>
      {/* Blob background */}
      <div className="blob-bg">
        <div className="blob-amber" />
      </div>

      <Box sx={{ maxWidth: 700, mx: 'auto', p: 3, pt: 6, position: 'relative', zIndex: 2 }}>
        {/* Title */}
        <Typography
          variant="h2"
          className="shimmer-text"
          sx={{ textAlign: 'center', mb: 1, fontSize: { xs: '1.8rem', sm: '2.5rem' } }}
        >
          Ceyon's Super Spiffy
        </Typography>
        <Typography
          variant="h4"
          sx={{ textAlign: 'center', mb: 1, color: 'text.secondary', fontSize: { xs: '1rem', sm: '1.4rem' } }}
        >
          Non-Googleable Trivia
        </Typography>
        <Typography
          variant="body2"
          sx={{ textAlign: 'center', mb: 5, color: 'text.secondary', opacity: 0.6 }}
        >
          Join an open game or host your own
        </Typography>

        {/* Create Game */}
        {!showCreate ? (
          <Button
            fullWidth
            variant="contained"
            size="large"
            className="pulse-glow"
            onClick={() => setShowCreate(true)}
            sx={{
              mb: 4,
              py: 2,
              fontSize: '1.1rem',
              background: 'linear-gradient(135deg, #00e5ff 0%, #ff00e5 100%)',
              '&:hover': { background: 'linear-gradient(135deg, #00b8d4 0%, #c400b0 100%)' },
            }}
          >
            Create New Game
          </Button>
        ) : (
          <Card sx={{ mb: 4, bgcolor: 'background.paper' }} className="card-enter">
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>Name Your Lobby</Typography>
              <TextField
                fullWidth
                value={lobbyName}
                onChange={(e) => setLobbyName(e.target.value)}
                placeholder="e.g., Friday Night Trivia"
                inputProps={{ maxLength: 40 }}
                autoFocus
                sx={{ mb: 2 }}
              />
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="contained"
                  fullWidth
                  onClick={handleCreate}
                  sx={{
                    background: 'linear-gradient(135deg, #00e5ff 0%, #ff00e5 100%)',
                    '&:hover': { background: 'linear-gradient(135deg, #00b8d4 0%, #c400b0 100%)' },
                  }}
                >
                  Create & Host
                </Button>
                <Button variant="outlined" onClick={() => setShowCreate(false)}>
                  Cancel
                </Button>
              </Box>
            </CardContent>
          </Card>
        )}

        {/* Active Lobbies */}
        <Typography variant="h5" sx={{ mb: 2 }}>
          Open Games
          {lobbies.length > 0 && (
            <Chip
              label={lobbies.length}
              size="small"
              sx={{ ml: 1, bgcolor: 'primary.main', color: 'black', fontWeight: 700 }}
            />
          )}
        </Typography>

        {lobbies.length === 0 ? (
          <Card sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.1)' }}>
            <CardContent sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                No games right now
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ opacity: 0.6 }}>
                Create one and get the party started!
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {lobbies.map((lobby, idx) => (
              <Card
                key={lobby.roomCode}
                className="card-enter glow-card"
                sx={{
                  bgcolor: 'background.paper',
                  cursor: 'pointer',
                  animationDelay: `${idx * 0.1}s`,
                  opacity: 0,
                }}
                onClick={() => handleJoin(lobby.roomCode)}
              >
                <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        {lobby.lobbyName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Room {lobby.roomCode}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="h5" sx={{ color: 'primary.main', fontWeight: 700 }}>
                        {lobby.playerCount}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        player{lobby.playerCount !== 1 ? 's' : ''}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Team bars */}
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {lobby.teams.map((team) => (
                      <Box
                        key={team.index}
                        sx={{
                          flex: 1,
                          bgcolor: `${TEAM_HEX[team.index]}15`,
                          border: `1px solid ${TEAM_HEX[team.index]}30`,
                          borderRadius: 2,
                          p: 1,
                          textAlign: 'center',
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{ color: TEAM_HEX[team.index], fontWeight: 600, fontSize: '0.7rem' }}
                        >
                          {team.finalName}
                        </Typography>
                        <Typography variant="body2" sx={{ color: TEAM_HEX[team.index], fontWeight: 700 }}>
                          {team.playerCount}
                        </Typography>
                      </Box>
                    ))}
                  </Box>

                  <Button
                    fullWidth
                    variant="outlined"
                    size="small"
                    sx={{ mt: 2 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleJoin(lobby.roomCode);
                    }}
                  >
                    Join Game
                  </Button>
                </CardContent>
              </Card>
            ))}
          </Box>
        )}

        {/* Manual room code entry (fallback) */}
        <Box sx={{ mt: 4, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary" sx={{ opacity: 0.5 }}>
            Have a room code?{' '}
            <Box
              component="span"
              sx={{ color: 'primary.main', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
              onClick={() => {
                const code = prompt('Enter room code:');
                if (code) handleJoin(code.toUpperCase());
              }}
            >
              Enter it here
            </Box>
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
