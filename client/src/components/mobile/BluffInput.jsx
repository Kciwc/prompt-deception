import React, { useState, useEffect } from 'react';
import { Box, Typography, TextField, Button, Alert } from '@mui/material';
import socket from '../../socket';

export default function BluffInput({ gameState }) {
  const [bluff, setBluff] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [rejection, setRejection] = useState(null);

  useEffect(() => {
    socket.on('bluffRejected', ({ error }) => {
      setRejection(error);
      setTimeout(() => setRejection(null), 4000);
    });
    socket.on('bluffSubmitted', () => {
      // Could be from teammate; we track our own via local state
    });
    return () => {
      socket.off('bluffRejected');
      socket.off('bluffSubmitted');
    };
  }, []);

  const handleSubmit = () => {
    if (bluff.trim().length < 5) return;
    socket.emit('submitBluff', { text: bluff });
    setSubmitted(true);
  };

  return (
    <Box sx={{ textAlign: 'center' }}>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Write a Fake Prompt!
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Look at the image on the TV. Write a convincing fake AI prompt that could have generated it.
      </Typography>

      {rejection && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {rejection}
        </Alert>
      )}

      <TextField
        fullWidth
        multiline
        rows={3}
        value={bluff}
        onChange={(e) => {
          setBluff(e.target.value);
          setSubmitted(false);
        }}
        placeholder="A photorealistic painting of..."
        inputProps={{ maxLength: 200 }}
        sx={{ mb: 2 }}
      />
      <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
        {bluff.length}/200 characters — minimum 5 visible characters
      </Typography>
      <Button
        fullWidth
        variant="contained"
        size="large"
        onClick={handleSubmit}
        disabled={bluff.trim().length < 5}
        color={submitted ? 'success' : 'primary'}
        sx={{ py: 2 }}
      >
        {submitted ? 'Submitted! (tap to update)' : 'Submit Bluff'}
      </Button>
    </Box>
  );
}
