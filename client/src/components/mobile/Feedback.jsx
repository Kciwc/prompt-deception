import React, { useState } from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import socket from '../../socket';
import useDebounce from '../../hooks/useDebounce';

export default function Feedback({ gameState }) {
  const [voted, setVoted] = useState(null);
  const debounce = useDebounce(300);

  const handleFeedback = debounce((thumbsUp) => {
    socket.emit('feedback', { thumbsUp });
    setVoted(thumbsUp);
  });

  return (
    <Box sx={{ textAlign: 'center', pt: 4 }}>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        What did you think?
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
        Rate this round's image and prompt.
      </Typography>

      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
        <Box
          onClick={() => handleFeedback(true)}
          sx={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 40,
            cursor: 'pointer',
            bgcolor: voted === true ? 'success.main' : 'rgba(255,255,255,0.1)',
            border: voted === true ? '3px solid' : '2px solid rgba(255,255,255,0.2)',
            borderColor: voted === true ? 'success.main' : 'rgba(255,255,255,0.2)',
            transition: 'all 0.2s',
            '&:hover': { transform: 'scale(1.1)' },
          }}
        >
          👍
        </Box>
        <Box
          onClick={() => handleFeedback(false)}
          sx={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 40,
            cursor: 'pointer',
            bgcolor: voted === false ? 'error.main' : 'rgba(255,255,255,0.1)',
            border: voted === false ? '3px solid' : '2px solid rgba(255,255,255,0.2)',
            borderColor: voted === false ? 'error.main' : 'rgba(255,255,255,0.2)',
            transition: 'all 0.2s',
            '&:hover': { transform: 'scale(1.1)' },
          }}
        >
          👎
        </Box>
      </Box>

      {voted !== null && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
          {voted ? 'Glad you liked it!' : 'Noted. We\'ll try harder.'}
        </Typography>
      )}
    </Box>
  );
}
