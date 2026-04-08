import React, { useState } from 'react';
import { Box, Typography, Button } from '@mui/material';
import socket from '../../socket';
import useDebounce from '../../hooks/useDebounce';

const ICONS = ['◆', '●', '▲', '■'];

export default function MainVote({ gameState }) {
  const [selected, setSelected] = useState(null);
  const debounce = useDebounce(300);

  const options = gameState?.mainVoteOptions || [];
  const myPlayer = gameState?.players?.find((p) => p.socketId === socket.id);

  const handleVote = debounce((index) => {
    socket.emit('voteMainRound', { optionIndex: index });
    setSelected(index);
  });

  return (
    <Box sx={{ textAlign: 'center' }}>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Which Prompt is REAL?
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Pick the one that actually generated the image. You can change your mind until time runs out!
      </Typography>

      {options.map((opt, i) => (
        <Button
          key={i}
          fullWidth
          variant={selected === i ? 'contained' : 'outlined'}
          onClick={() => handleVote(i)}
          sx={{
            mb: 1.5,
            py: 2,
            textAlign: 'left',
            justifyContent: 'flex-start',
            borderColor: selected === i ? 'primary.main' : 'rgba(255,255,255,0.2)',
          }}
        >
          <Typography variant="body1">
            {ICONS[i % ICONS.length]} {opt.text}
          </Typography>
        </Button>
      ))}

      {selected !== null && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Vote locked on {ICONS[selected % ICONS.length]}. Tap another to change!
        </Typography>
      )}
    </Box>
  );
}
