import React from 'react';
import { Box, Typography, LinearProgress } from '@mui/material';

export default function DiversityChart({ categories }) {
  if (!categories || categories.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No diversity data yet. Approve some generated content to see category distribution.
      </Typography>
    );
  }

  const total = categories.reduce((sum, c) => sum + c.count, 0);
  const maxCount = Math.max(...categories.map((c) => c.count));

  return (
    <Box>
      {categories.map((cat) => {
        const pct = total > 0 ? (cat.count / total) * 100 : 0;
        return (
          <Box key={cat.id} sx={{ mb: 1.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="body2">{cat.name}</Typography>
              <Typography variant="body2" color="text.secondary">
                {cat.count} ({pct.toFixed(0)}%)
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={maxCount > 0 ? (cat.count / maxCount) * 100 : 0}
              sx={{
                height: 8,
                borderRadius: 4,
                bgcolor: 'action.hover',
                '& .MuiLinearProgress-bar': {
                  bgcolor: pct < 10 ? 'error.main' : pct < 20 ? 'warning.main' : 'success.main',
                  borderRadius: 4,
                },
              }}
            />
          </Box>
        );
      })}
    </Box>
  );
}
