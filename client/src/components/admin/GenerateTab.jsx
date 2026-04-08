import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Grid,
  TextField,
  Alert,
  CircularProgress,
  ToggleButtonGroup,
  ToggleButton,
  Divider,
} from '@mui/material';
import GeneratedCard from './GeneratedCard';
import DiversityChart from './DiversityChart';

export default function GenerateTab({ headers }) {
  const [items, setItems] = useState([]);
  const [diversity, setDiversity] = useState([]);
  const [count, setCount] = useState(5);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('pending');

  const fetchItems = async () => {
    try {
      const url = filter ? `/admin/generated?status=${filter}` : '/admin/generated';
      const res = await fetch(url, { headers });
      if (res.ok) setItems(await res.json());
    } catch {
      console.error('Failed to fetch generated items');
    }
  };

  const fetchDiversity = async () => {
    try {
      const res = await fetch('/admin/diversity', { headers });
      if (res.ok) setDiversity(await res.json());
    } catch {
      console.error('Failed to fetch diversity');
    }
  };

  useEffect(() => {
    fetchItems();
    fetchDiversity();
  }, [filter]);

  const generate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/admin/generate', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ count }),
      });
      const data = await res.json();
      if (data.success) {
        setFilter('pending');
        fetchItems();
        fetchDiversity();
      } else {
        setError(data.error || 'Generation failed');
      }
    } catch {
      setError('Network error — is the server running?');
    }
    setGenerating(false);
  };

  const handleUpdate = () => {
    fetchItems();
    fetchDiversity();
  };

  const pendingCount = items.filter((i) => i.status === 'pending').length;

  return (
    <Box>
      {/* Generator Controls */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          AI Content Generator
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Generate image prompts via Claude + images via DALL-E 3. Review, approve, or discard with
          feedback (Bad Fence).
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
          <TextField
            type="number"
            size="small"
            label="Count"
            value={count}
            onChange={(e) => setCount(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
            sx={{ width: 100 }}
            slotProps={{ htmlInput: { min: 1, max: 10 } }}
          />
          <Button
            variant="contained"
            onClick={generate}
            disabled={generating}
            startIcon={generating ? <CircularProgress size={18} /> : null}
          >
            {generating ? 'Generating...' : `Generate ${count} Rounds`}
          </Button>
        </Box>

        {generating && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Generating {count} prompts + images... This can take 1-2 minutes. Don&apos;t close this page.
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
      </Paper>

      {/* Diversity Chart */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Category Diversity
        </Typography>
        <DiversityChart categories={diversity} />
      </Paper>

      {/* Filter + Items */}
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            Generated Content {filter === 'pending' && pendingCount > 0 ? `(${pendingCount} pending)` : ''}
          </Typography>
          <ToggleButtonGroup
            value={filter}
            exclusive
            onChange={(e, val) => val !== null && setFilter(val)}
            size="small"
          >
            <ToggleButton value="pending">Pending</ToggleButton>
            <ToggleButton value="approved">Approved</ToggleButton>
            <ToggleButton value="discarded">Discarded</ToggleButton>
            <ToggleButton value="">All</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {items.length === 0 ? (
          <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            No {filter || ''} content yet. Generate some!
          </Typography>
        ) : (
          <Grid container spacing={2}>
            {items.map((item) => (
              <Grid key={item.id} size={{ xs: 12, sm: 6, md: 4 }}>
                <GeneratedCard item={item} headers={headers} onUpdate={handleUpdate} />
              </Grid>
            ))}
          </Grid>
        )}
      </Paper>
    </Box>
  );
}
