import React, { useState } from 'react';
import {
  Card,
  CardMedia,
  CardContent,
  CardActions,
  Typography,
  Button,
  TextField,
  Chip,
  Box,
  IconButton,
  Collapse,
} from '@mui/material';

export default function GeneratedCard({ item, headers, onUpdate }) {
  const [discardReason, setDiscardReason] = useState('');
  const [showDiscard, setShowDiscard] = useState(false);
  const [loading, setLoading] = useState(false);

  const approve = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/admin/generated/${item.id}/approve`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
      if (res.ok) onUpdate();
    } catch (err) {
      console.error('Approve failed:', err);
    }
    setLoading(false);
  };

  const discard = async () => {
    if (!discardReason.trim() || discardReason.trim().length < 3) return;
    setLoading(true);
    try {
      const res = await fetch(`/admin/generated/${item.id}/discard`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: discardReason }),
      });
      if (res.ok) onUpdate();
    } catch (err) {
      console.error('Discard failed:', err);
    }
    setLoading(false);
  };

  const regenerate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/admin/generated/${item.id}/regenerate`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
      if (res.ok) onUpdate();
    } catch (err) {
      console.error('Regenerate failed:', err);
    }
    setLoading(false);
  };

  const statusColor =
    item.status === 'approved' ? 'success' : item.status === 'discarded' ? 'error' : 'warning';

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', opacity: item.status !== 'pending' ? 0.7 : 1 }}>
      {item.imageUrl ? (
        <CardMedia
          component="img"
          height="200"
          image={item.imageUrl}
          alt={item.prompt}
          sx={{ objectFit: 'cover' }}
        />
      ) : (
        <Box
          sx={{
            height: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'action.hover',
          }}
        >
          <Typography color="text.secondary">No image yet</Typography>
        </Box>
      )}

      <CardContent sx={{ flexGrow: 1 }}>
        <Typography variant="body2" sx={{ mb: 1, fontStyle: 'italic' }}>
          &ldquo;{item.prompt}&rdquo;
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          <Chip label={item.status} color={statusColor} size="small" />
          {item.category && <Chip label={item.category} size="small" variant="outlined" />}
        </Box>
        {item.discardReason && (
          <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
            Reason: {item.discardReason}
          </Typography>
        )}
      </CardContent>

      {item.status === 'pending' && (
        <CardActions sx={{ flexDirection: 'column', gap: 1, p: 2 }}>
          <Box sx={{ display: 'flex', gap: 1, width: '100%' }}>
            <Button
              variant="contained"
              color="success"
              size="small"
              fullWidth
              onClick={approve}
              disabled={loading || !item.imageUrl}
            >
              Approve
            </Button>
            <Button
              variant="outlined"
              size="small"
              fullWidth
              onClick={regenerate}
              disabled={loading}
            >
              Regen Image
            </Button>
          </Box>

          <Button
            variant="text"
            color="error"
            size="small"
            fullWidth
            onClick={() => setShowDiscard(!showDiscard)}
          >
            {showDiscard ? 'Cancel' : 'Discard...'}
          </Button>

          <Collapse in={showDiscard} sx={{ width: '100%' }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                size="small"
                fullWidth
                placeholder="Why is this bad?"
                value={discardReason}
                onChange={(e) => setDiscardReason(e.target.value)}
              />
              <Button
                variant="contained"
                color="error"
                size="small"
                onClick={discard}
                disabled={loading || discardReason.trim().length < 3}
              >
                Discard
              </Button>
            </Box>
          </Collapse>
        </CardActions>
      )}
    </Card>
  );
}
