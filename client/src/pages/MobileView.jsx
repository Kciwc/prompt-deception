import React, { useState, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import socket from '../socket';
import useGameState from '../hooks/useGameState';
import useWakeLock from '../hooks/useWakeLock';
import useAudio from '../hooks/useAudio';
import Lobby from '../components/mobile/Lobby';
import BluffInput from '../components/mobile/BluffInput';
import IntraTeamVote from '../components/mobile/IntraTeamVote';
import MainVote from '../components/mobile/MainVote';
import Feedback from '../components/mobile/Feedback';
import CountdownBar from '../components/mobile/CountdownBar';
import { TEAM_COLORS } from '../styles/theme';

export default function MobileView() {
  useWakeLock();
  const {
    gameState,
    timer,
    error,
    paused,
    hostAction,
    confetti,
    gotItRight,
    kicked,
    tvDisconnected,
  } = useGameState();
  const { muted, toggleMute, playSfx } = useAudio();

  const [joined, setJoined] = useState(false);

  // Listen for wake-up chime
  useEffect(() => {
    socket.on('wakeUpChime', () => {
      playSfx('/audio/chime.mp3');
    });
    socket.on('nudgeReceived', () => {
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    });
    return () => {
      socket.off('wakeUpChime');
      socket.off('nudgeReceived');
    };
  }, [playSfx]);

  if (kicked) {
    return (
      <Box className="mobile-view team-bg-spectator" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh' }}>
        <Typography variant="h4" color="error">
          You've been removed by the host.
        </Typography>
      </Box>
    );
  }

  // Get team color class
  const myPlayer = gameState?.players?.find((p) => p.socketId === socket.id);
  const teamColor = myPlayer?.teamIndex !== null && myPlayer?.teamIndex !== undefined
    ? ['cyan', 'magenta', 'amber'][myPlayer.teamIndex]
    : 'spectator';
  const bgClass = `team-bg-${teamColor}`;

  return (
    <Box className={`mobile-view ${bgClass}`} sx={{ minHeight: '100dvh', position: 'relative' }}>
      {/* Pinned countdown bar */}
      {gameState && gameState.phase >= 1 && gameState.phase <= 4 && (
        <CountdownBar
          remaining={timer}
          total={gameState.phase === 1 ? 90 : gameState.phase === 2 ? 45 : gameState.phase === 3 ? 60 : 20}
          paused={paused}
          teamColor={teamColor}
        />
      )}

      {/* Error toast */}
      {error && (
        <Box sx={{ position: 'fixed', top: 60, left: '50%', transform: 'translateX(-50%)', bgcolor: 'error.main', color: 'white', px: 3, py: 1.5, borderRadius: 2, zIndex: 200, maxWidth: '90vw', textAlign: 'center' }}>
          <Typography variant="body2">{error}</Typography>
        </Box>
      )}

      {/* Host action notification */}
      {hostAction && (
        <Box sx={{ position: 'fixed', top: 60, left: '50%', transform: 'translateX(-50%)', bgcolor: 'primary.main', color: 'black', px: 3, py: 1.5, borderRadius: 2, zIndex: 200, maxWidth: '90vw', textAlign: 'center' }}>
          <Typography variant="body2" fontWeight={700}>{hostAction}</Typography>
        </Box>
      )}

      {/* Paused overlay */}
      {paused && (
        <Box sx={{ position: 'fixed', inset: 0, bgcolor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
          <Typography variant="h3" color="white">PAUSED</Typography>
        </Box>
      )}

      {/* TV Disconnected overlay */}
      {tvDisconnected && !paused && (
        <Box sx={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', bgcolor: 'warning.main', color: 'black', px: 3, py: 1, borderRadius: 2, zIndex: 200 }}>
          <Typography variant="body2">Host disconnected — waiting...</Typography>
        </Box>
      )}

      {/* Confetti overlay on correct guess */}
      {confetti && gotItRight && (
        <Box sx={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, pointerEvents: 'none' }}>
          <Typography variant="h2" sx={{ color: '#00e5ff', textShadow: '0 0 20px rgba(0,229,255,0.8)' }}>
            YOU GOT IT!
          </Typography>
        </Box>
      )}

      {/* Mute toggle */}
      <Box
        onClick={toggleMute}
        sx={{ position: 'fixed', bottom: 16, right: 16, bgcolor: 'rgba(0,0,0,0.5)', borderRadius: '50%', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 150, fontSize: 20 }}
      >
        {muted ? '🔇' : '🔊'}
      </Box>

      {/* Phase content */}
      <Box sx={{ p: 2, pt: gameState?.phase >= 1 ? 8 : 2 }}>
        {!gameState || !joined ? (
          <Lobby onJoined={() => setJoined(true)} gameState={gameState} />
        ) : gameState.phase === 0 ? (
          <Lobby onJoined={() => {}} gameState={gameState} joined />
        ) : gameState.phase === 1 ? (
          <BluffInput gameState={gameState} />
        ) : gameState.phase === 2 ? (
          <IntraTeamVote gameState={gameState} />
        ) : gameState.phase === 3 ? (
          <MainVote gameState={gameState} />
        ) : gameState.phase === 4 ? (
          <Feedback gameState={gameState} />
        ) : gameState.phase === 5 ? (
          <Box sx={{ textAlign: 'center', pt: 8 }}>
            <Typography variant="h4" gutterBottom>Game Over!</Typography>
            <Typography variant="body1" color="text.secondary">
              Check the TV for the final standings.
            </Typography>
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}
