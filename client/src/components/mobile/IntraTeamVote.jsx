import React, { useState, useEffect } from 'react';
import { Box, Typography, Button } from '@mui/material';
import socket from '../../socket';
import useDebounce from '../../hooks/useDebounce';

export default function IntraTeamVote({ gameState }) {
  const [voted, setVoted] = useState(null);
  const [teamBluffs, setTeamBluffs] = useState([]);
  const debounce = useDebounce(300);

  const myPlayer = gameState?.players?.find((p) => p.socketId === socket.id);
  const myTeam = myPlayer?.teamIndex;

  useEffect(() => {
    // Get bluffs for our team from the server
    // The server sends them via gameState updates indirectly;
    // we rely on the bluffSubmitted event count for now
    // In Phase 2, the server should send team bluffs to the team room
    socket.on('teamBluffs', ({ bluffs }) => {
      setTeamBluffs(bluffs);
    });
    return () => socket.off('teamBluffs');
  }, []);

  // If bluffs aren't available via a separate event, show placeholder
  const bluffsAvailable = teamBluffs.length > 0;

  const handleVote = debounce((index) => {
    socket.emit('voteIntraTeam', { bluffIndex: index });
    setVoted(index);
  });

  const handleNudge = debounce(() => {
    socket.emit('nudge');
  });

  return (
    <Box sx={{ textAlign: 'center' }}>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Pick Your Team's Best Bluff!
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Vote for the most convincing fake prompt from your team. No typo appeals!
      </Typography>

      {bluffsAvailable ? (
        teamBluffs.map((bluff, i) => (
          <Button
            key={i}
            fullWidth
            variant={voted === i ? 'contained' : 'outlined'}
            onClick={() => handleVote(i)}
            disabled={bluff.socketId === socket.id}
            sx={{ mb: 1.5, py: 1.5, textAlign: 'left', justifyContent: 'flex-start' }}
          >
            <Box>
              <Typography variant="body2" color="text.secondary">{bluff.playerName}</Typography>
              <Typography variant="body1">{bluff.text}</Typography>
            </Box>
          </Button>
        ))
      ) : (
        <Box sx={{ py: 4 }}>
          <Typography variant="body1" color="text.secondary">
            Waiting for bluffs from your team...
          </Typography>
        </Box>
      )}

      <Button
        variant="outlined"
        onClick={handleNudge}
        sx={{ mt: 3 }}
      >
        Nudge Teammates
      </Button>
    </Box>
  );
}
