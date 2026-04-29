import React, { useState } from 'react';
import { Box, Typography, TextField, Button, Chip, Card, CardContent } from '@mui/material';
import socket from '../../socket';
import { TEAM_COLORS } from '../../styles/theme';

const TEAM_HEX = ['#00e5ff', '#ff00e5', '#ffab00'];

export default function Lobby({ onJoined, gameState, joined }) {
  const urlRoom = new URLSearchParams(window.location.search).get('room');
  const [roomCode, setRoomCode] = useState(urlRoom ? urlRoom.toUpperCase() : '');
  const [playerName, setPlayerName] = useState('');
  const [teamNameProposal, setTeamNameProposal] = useState('');

  const handleJoin = () => {
    if (!roomCode.trim() || !playerName.trim()) return;
    socket.emit('join', { roomCode: roomCode.toUpperCase(), playerName: playerName.trim() });
    onJoined();
  };

  const myPlayer = gameState?.players?.find((p) => p.socketId === socket.id);

  // Pre-join: name entry (room code pre-filled from URL)
  if (!joined && !myPlayer) {
    return (
      <Box sx={{ textAlign: 'center', pt: 4 }}>
        <Typography variant="h3" className="shimmer-text" sx={{ mb: 1, fontSize: '2rem' }}>
          Join Game
        </Typography>
        {urlRoom ? (
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Room <strong style={{ color: '#00e5ff' }}>{roomCode}</strong>
          </Typography>
        ) : (
          <>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Enter the code from the TV
            </Typography>
            <TextField
              fullWidth
              label="Room Code"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              inputProps={{ maxLength: 4, style: { textAlign: 'center', fontSize: 28, letterSpacing: 8, fontFamily: '"Fredoka One", cursive' } }}
              sx={{ mb: 2, maxWidth: 300, mx: 'auto', display: 'block' }}
            />
          </>
        )}
        <TextField
          fullWidth
          label="Your Name"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
          inputProps={{ maxLength: 20 }}
          autoFocus={!!urlRoom}
          sx={{ mb: 3, maxWidth: 300, mx: 'auto', display: 'block' }}
        />
        <Button
          variant="contained"
          size="large"
          onClick={handleJoin}
          className="pulse-glow"
          sx={{
            minWidth: 200, py: 1.5,
            background: 'linear-gradient(135deg, #00e5ff 0%, #ff00e5 100%)',
            '&:hover': { background: 'linear-gradient(135deg, #00b8d4 0%, #c400b0 100%)' },
          }}
        >
          Join
        </Button>
      </Box>
    );
  }

  // Post-join: lobby with team switching
  const teamColors = ['cyan', 'magenta', 'amber'];
  const teamLabels = ['Neon Cyan', 'Magenta', 'Amber'];
  const myTeam = myPlayer?.teamIndex;

  return (
    <Box sx={{ pt: 2 }}>
      <Typography variant="h4" sx={{ textAlign: 'center', mb: 0.5 }}>
        Waiting to start...
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mb: 3, opacity: 0.7 }}>
        Pick your team and get ready
      </Typography>

      {/* Team switcher */}
      <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
        {teamColors.map((color, i) => (
          <Button
            key={i}
            variant={myTeam === i ? 'contained' : 'outlined'}
            onClick={() => socket.emit('switchTeam', { targetTeam: i })}
            sx={{
              flex: 1,
              py: 1.5,
              borderColor: `${TEAM_HEX[i]}60`,
              color: myTeam === i ? 'black' : TEAM_HEX[i],
              bgcolor: myTeam === i ? TEAM_HEX[i] : 'transparent',
              fontWeight: 700,
              boxShadow: myTeam === i ? `0 4px 20px ${TEAM_HEX[i]}40` : 'none',
              '&:hover': {
                bgcolor: myTeam === i ? TEAM_HEX[i] : `${TEAM_HEX[i]}15`,
                borderColor: TEAM_HEX[i],
              },
            }}
          >
            {teamLabels[i]}
          </Button>
        ))}
      </Box>

      {/* Team name proposal */}
      {myTeam !== null && myTeam !== undefined && (
        <Card sx={{ mb: 3, bgcolor: 'rgba(18,18,42,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              Propose a Team Name
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                size="small"
                fullWidth
                value={teamNameProposal}
                onChange={(e) => setTeamNameProposal(e.target.value)}
                inputProps={{ maxLength: 30 }}
                placeholder="e.g., Byte Me"
              />
              <Button
                variant="outlined"
                onClick={() => {
                  if (teamNameProposal.trim().length >= 2) {
                    socket.emit('proposeTeamName', { name: teamNameProposal });
                    setTeamNameProposal('');
                  }
                }}
              >
                Propose
              </Button>
            </Box>

            {gameState?.teams?.[myTeam]?.proposedNames?.length > 0 && (
              <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {gameState.teams[myTeam].proposedNames.map((pn, idx) => (
                  <Chip
                    key={idx}
                    label={`${pn.name} (${pn.votes})`}
                    onClick={() => socket.emit('voteTeamName', { nameIndex: idx })}
                    variant="outlined"
                    sx={{
                      borderColor: `${TEAM_HEX[myTeam]}40`,
                      color: TEAM_HEX[myTeam],
                      '&:hover': { bgcolor: `${TEAM_HEX[myTeam]}15` },
                    }}
                  />
                ))}
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* Teammates */}
      <Card sx={{ mb: 3, bgcolor: 'rgba(18,18,42,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <CardContent>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
            Your Team
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {gameState?.players
              ?.filter((p) => p.teamIndex === myTeam)
              .map((p) => (
                <Box
                  key={p.socketId}
                  className="player-drop-in"
                  sx={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    px: 2, py: 0.8, borderRadius: 2,
                    bgcolor: p.socketId === socket.id ? `${TEAM_HEX[myTeam]}15` : 'transparent',
                    border: p.socketId === socket.id ? `1px solid ${TEAM_HEX[myTeam]}30` : '1px solid transparent',
                  }}
                >
                  <Typography variant="body2" sx={{ opacity: p.ready ? 1 : 0.5, fontWeight: p.socketId === socket.id ? 700 : 400 }}>
                    {p.name} {p.socketId === socket.id ? '(you)' : ''}
                  </Typography>
                  {p.ready && (
                    <Box className="check-bounce" sx={{ color: '#00e676', fontWeight: 800, fontSize: 16 }}>✓</Box>
                  )}
                </Box>
              ))}
          </Box>
        </CardContent>
      </Card>

      {/* Ready button */}
      <Button
        fullWidth
        variant="contained"
        size="large"
        onClick={() => socket.emit('ready')}
        sx={{
          py: 2.5,
          fontSize: '1.1rem',
          background: myPlayer?.ready
            ? 'linear-gradient(135deg, #00e676, #69f0ae)'
            : 'linear-gradient(135deg, #00e5ff 0%, #ff00e5 100%)',
          color: myPlayer?.ready ? 'black' : 'white',
          boxShadow: myPlayer?.ready
            ? '0 4px 20px rgba(0,230,118,0.4)'
            : '0 4px 20px rgba(0,229,255,0.3)',
          '&:hover': {
            background: myPlayer?.ready
              ? 'linear-gradient(135deg, #00c853, #00e676)'
              : 'linear-gradient(135deg, #00b8d4 0%, #c400b0 100%)',
          },
        }}
      >
        {myPlayer?.ready ? "READY! ✓" : "I'M READY!"}
      </Button>
    </Box>
  );
}
