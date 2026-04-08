import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  IconButton,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material';

export default function AdminDashboard() {
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [rounds, setRounds] = useState([]);
  const [image, setImage] = useState(null);
  const [realPrompt, setRealPrompt] = useState('');
  const [status, setStatus] = useState(null);
  const [uploading, setUploading] = useState(false);

  const headers = { 'x-admin-password': password };

  const login = async () => {
    try {
      const res = await fetch(`/admin/rounds`, { headers });
      if (res.ok) {
        const data = await res.json();
        setRounds(data);
        setAuthenticated(true);
      } else {
        setStatus({ type: 'error', msg: 'Wrong password.' });
      }
    } catch {
      setStatus({ type: 'error', msg: 'Server unreachable.' });
    }
  };

  const fetchRounds = async () => {
    const res = await fetch(`/admin/rounds`, { headers });
    if (res.ok) setRounds(await res.json());
  };

  const upload = async () => {
    if (!image || !realPrompt.trim()) {
      setStatus({ type: 'error', msg: 'Need both an image and a prompt.' });
      return;
    }
    setUploading(true);
    const form = new FormData();
    form.append('image', image);
    form.append('realPrompt', realPrompt);

    try {
      const res = await fetch(`/admin/upload`, {
        method: 'POST',
        headers: { 'x-admin-password': password },
        body: form,
      });
      const data = await res.json();
      if (data.success) {
        setStatus({ type: 'success', msg: 'Round uploaded!' });
        setImage(null);
        setRealPrompt('');
        fetchRounds();
      } else {
        setStatus({ type: 'error', msg: data.error });
      }
    } catch {
      setStatus({ type: 'error', msg: 'Upload failed.' });
    }
    setUploading(false);
  };

  const deleteRound = async (id) => {
    await fetch(`/admin/rounds/${id}`, { method: 'DELETE', headers });
    fetchRounds();
  };

  const resetUsed = async () => {
    await fetch(`/admin/rounds/reset`, { method: 'POST', headers });
    fetchRounds();
    setStatus({ type: 'success', msg: 'All rounds marked as unused.' });
  };

  if (!authenticated) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', bgcolor: 'background.default' }}>
        <Paper sx={{ p: 4, maxWidth: 400, width: '100%' }}>
          <Typography variant="h5" gutterBottom fontWeight={700}>
            Admin Login
          </Typography>
          <TextField
            fullWidth
            type="password"
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && login()}
            sx={{ mb: 2 }}
          />
          <Button fullWidth variant="contained" onClick={login}>
            Login
          </Button>
          {status && (
            <Alert severity={status.type} sx={{ mt: 2 }}>
              {status.msg}
            </Alert>
          )}
        </Paper>
      </Box>
    );
  }

  const unused = rounds.filter((r) => !r.used).length;
  const used = rounds.filter((r) => r.used).length;

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3, minHeight: '100vh', bgcolor: 'background.default' }}>
      <Typography variant="h4" gutterBottom fontWeight={700}>
        Admin Dashboard
      </Typography>

      {status && (
        <Alert severity={status.type} sx={{ mb: 2 }} onClose={() => setStatus(null)}>
          {status.msg}
        </Alert>
      )}

      {/* Upload section */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Upload Round</Typography>
        <Box sx={{ mb: 2 }}>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setImage(e.target.files[0])}
          />
        </Box>
        <TextField
          fullWidth
          label="Real AI Prompt"
          value={realPrompt}
          onChange={(e) => setRealPrompt(e.target.value)}
          sx={{ mb: 2 }}
          helperText="The actual prompt used to generate the image"
        />
        <Button variant="contained" onClick={upload} disabled={uploading}>
          {uploading ? 'Uploading...' : 'Upload'}
        </Button>
      </Paper>

      {/* Stats */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Round Content</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {unused} unused / {used} used / {rounds.length} total
        </Typography>
        <Button size="small" variant="outlined" onClick={resetUsed} sx={{ mb: 2 }}>
          Reset All to Unused
        </Button>

        <List>
          {rounds.map((round) => (
            <ListItem key={round.id} divider>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                <img
                  src={round.imageUrl}
                  alt="round"
                  style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8 }}
                />
                <ListItemText
                  primary={round.realPrompt}
                  secondary={`${round.used ? 'Used' : 'Unused'} — ${new Date(round.createdAt).toLocaleDateString()}`}
                />
                <Button size="small" color="error" onClick={() => deleteRound(round.id)}>
                  Delete
                </Button>
              </Box>
            </ListItem>
          ))}
        </List>
      </Paper>
    </Box>
  );
}
