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
        <div className="blob-bg"><div className="blob-amber" /></div>
        <Typography variant="h4" color="error" sx={{ position: 'relative', zIndex: 2 }}>
          You've been removed by the host.
        </Typography>
      </Box>
    );
  }

  const myPlayer = gameState?.players?.find((p) => p.socketId === socket.id);
  const teamColor = myPlayer?.teamIndex !== null && myPlayer?.teamIndex !== undefined
    ? ['cyan', 'magenta', 'amber'][myPlayer.teamIndex]
    : 'spectator';
  const bgClass = `team-bg-${teamColor}`;
  const tc = TEAM_COLORS[teamColor];

  return (
    <Box className={`mobile-view ${bgClass}`} sx={{ minHeight: '100dvh', position: 'relative' }}>
      {/* Countdown bar */}
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
        <Box sx={{
          position: 'fixed', top: 60, left: '50%', transform: 'translateX(-50%)',
          bgcolor: 'rgba(211,47,47,0.95)', color: 'white', px: 3, py: 1.5,
          borderRadius: 3, zIndex: 200, maxWidth: '90vw', textAlign: 'center',
          backdropFilter: 'blur(8px)', boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
        }}>
          <Typography variant="body2" fontWeight={600}>{error}</Typography>
        </Box>
      )}

      {/* Host action notification */}
      {hostAction && (
        <Box sx={{
          position: 'fixed', top: 60, left: '50%', transform: 'translateX(-50%)',
          background: 'linear-gradient(135deg, #00e5ff, #ff00e5)',
          color: 'white', px: 3, py: 1.5, borderRadius: 3, zIndex: 200,
          maxWidth: '90vw', textAlign: 'center',
          boxShadow: '0 8px 30px rgba(0,229,255,0.3)',
        }}>
          <Typography variant="body2" fontWeight={700}>{hostAction}</Typography>
        </Box>
      )}

      {/* Paused overlay */}
      {paused && (
        <Box sx={{
          position: 'fixed', inset: 0, bgcolor: 'rgba(6,6,15,0.92)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 300, backdropFilter: 'blur(8px)',
        }}>
          <Typography variant="h3" sx={{ color: 'white', textShadow: '0 0 30px rgba(0,229,255,0.5)' }}>
            PAUSED
          </Typography>
        </Box>
      )}

      {/* TV Disconnected */}
      {tvDisconnected && !paused && (
        <Box sx={{
          position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          bgcolor: 'rgba(255,171,0,0.9)', color: 'black', px: 3, py: 1,
          borderRadius: 3, zIndex: 200, backdropFilter: 'blur(8px)',
        }}>
          <Typography variant="body2" fontWeight={600}>Host disconnected — waiting...</Typography>
        </Box>
      )}

      {/* Correct guess celebration */}
      {confetti && gotItRight && (
        <Box sx={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, pointerEvents: 'none' }}>
          <Typography variant="h2" sx={{ color: '#00e5ff', textShadow: '0 0 40px rgba(0,229,255,0.8)' }}>
            YOU GOT IT!
          </Typography>
        </Box>
      )}

      {/* Mute toggle */}
      <Box
        onClick={toggleMute}
        sx={{
          position: 'fixed', bottom: 16, right: 16,
          bgcolor: 'rgba(18,18,42,0.8)', borderRadius: '50%',
          width: 48, height: 48, display: 'flex', alignItems: 'center',
          justifyContent: 'center', cursor: 'pointer', zIndex: 150,
          fontSize: 22, border: '1px solid rgba(255,255,255,0.1)',
          backdropFilter: 'blur(8px)',
          transition: 'all 0.2s ease',
          '&:hover': { bgcolor: 'rgba(18,18,42,0.95)' },
        }}
      >
        {muted ? '🔇' : '🔊'}
      </Box>

      {/* Phase content */}
      <Box sx={{ p: 2, pt: gameState?.phase >= 1 ? 8 : 2, position: 'relative', zIndex: 1 }}>
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
            <Typography variant="h3" gutterBottom>Game Over!</Typography>
            <Typography variant="body1" color="text.secondary">
              Check the TV for the final standings.
            </Typography>
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}
