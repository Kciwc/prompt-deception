import React, { useState } from 'react';
import { Box, Typography, TextField, Button, Chip } from '@mui/material';
import socket from '../../socket';
import { TEAM_COLORS } from '../../styles/theme';

export default function Lobby({ onJoined, gameState, joined }) {
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [teamNameProposal, setTeamNameProposal] = useState('');

  const handleJoin = () => {
    if (!roomCode.trim() || !playerName.trim()) return;
    socket.emit('join', { roomCode: roomCode.toUpperCase(), playerName: playerName.trim() });
    onJoined();
  };

  const myPlayer = gameState?.players?.find((p) => p.socketId === socket.id);

  // Pre-join: enter room code and name
  if (!joined && !myPlayer) {
    return (
      <Box sx={{ textAlign: 'center', pt: 6 }}>
        <Typography variant="h3" fontWeight={800} gutterBottom>
          Join Game
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Enter the code from the TV screen
        </Typography>
        <TextField
          fullWidth
          label="Room Code"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          inputProps={{ maxLength: 4, style: { textAlign: 'center', fontSize: 28, letterSpacing: 8 } }}
          sx={{ mb: 2, maxWidth: 300, mx: 'auto', display: 'block' }}
        />
        <TextField
          fullWidth
          label="Your Name"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          inputProps={{ maxLength: 20 }}
          sx={{ mb: 3, maxWidth: 300, mx: 'auto', display: 'block' }}
        />
        <Button variant="contained" size="large" onClick={handleJoin} sx={{ minWidth: 200 }}>
          Join
        </Button>
      </Box>
    );
  }

  // Post-join: lobby view with team switching, ready button, team name proposals
  const teamColors = ['cyan', 'magenta', 'amber'];
  const teamLabels = ['Neon Cyan', 'Magenta', 'Amber'];
  const myTeam = myPlayer?.teamIndex;

  return (
    <Box sx={{ pt: 2 }}>
      <Typography variant="h5" fontWeight={700} gutterBottom textAlign="center">
        Waiting for game to start...
      </Typography>

      {/* Team switcher */}
      <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 3, mb: 1 }}>
        Switch Teams
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
        {teamColors.map((color, i) => (
          <Button
            key={i}
            variant={myTeam === i ? 'contained' : 'outlined'}
            onClick={() => socket.emit('switchTeam', { targetTeam: i })}
            sx={{
              flex: 1,
              borderColor: TEAM_COLORS[color].main,
              color: myTeam === i ? 'black' : TEAM_COLORS[color].main,
              bgcolor: myTeam === i ? TEAM_COLORS[color].main : 'transparent',
              '&:hover': { bgcolor: TEAM_COLORS[color].bg },
            }}
          >
            {teamLabels[i]}
          </Button>
        ))}
      </Box>

      {/* Team name proposal */}
      {myTeam !== null && myTeam !== undefined && (
        <Box sx={{ mb: 3 }}>
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

          {/* Proposed names with vote buttons */}
          {gameState?.teams?.[myTeam]?.proposedNames?.length > 0 && (
            <Box sx={{ mt: 2 }}>
              {gameState.teams[myTeam].proposedNames.map((pn, idx) => (
                <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Chip
                    label={`${pn.name} (${pn.votes})`}
                    onClick={() => socket.emit('voteTeamName', { nameIndex: idx })}
                    variant="outlined"
                    sx={{ flex: 1 }}
                  />
                </Box>
              ))}
            </Box>
          )}
        </Box>
      )}

      {/* Teammates list */}
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
        Your Team
      </Typography>
      <Box sx={{ mb: 3 }}>
        {gameState?.players
          ?.filter((p) => p.teamIndex === myTeam)
          .map((p) => (
            <Typography key={p.socketId} variant="body2" sx={{ opacity: p.ready ? 1 : 0.5 }}>
              {p.name} {p.socketId === socket.id ? '(you)' : ''} {p.ready ? '✓' : ''}
            </Typography>
          ))}
      </Box>

      {/* Ready button */}
      <Button
        fullWidth
        variant="contained"
        size="large"
        onClick={() => socket.emit('ready')}
        color={myPlayer?.ready ? 'success' : 'primary'}
        sx={{ py: 2 }}
      >
        {myPlayer?.ready ? "READY! (tap to un-ready)" : "I'M READY!"}
      </Button>
    </Box>
  );
}
