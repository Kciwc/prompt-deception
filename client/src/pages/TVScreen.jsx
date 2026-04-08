import React, { useState, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import socket from '../socket';
import useGameState from '../hooks/useGameState';
import useAudio from '../hooks/useAudio';
import HostControls from '../components/tv/HostControls';
import ImageDisplay from '../components/tv/ImageDisplay';
import RevealSequence from '../components/tv/RevealSequence';
import Podium from '../components/tv/Podium';
import Confetti from '../components/tv/Confetti';
import ThemeToggle from '../components/tv/ThemeToggle';

export default function TVScreen({ theme, toggleTheme }) {
  const {
    gameState,
    timer,
    error,
    paused,
    hostAction,
    revealSteps,
    podiumData,
    scoresData,
    confetti,
  } = useGameState();
  const { muted, musicVolume, sfxVolume, setMusicVolume, setSfxVolume, toggleMute, playBgm, stopBgm, playSfx } = useAudio();

  const [roomCode, setRoomCode] = useState(null);

  // Create room on mount
  useEffect(() => {
    socket.emit('tv:createRoom');

    socket.on('roomCreated', ({ roomCode: code }) => {
      setRoomCode(code);
    });

    return () => {
      socket.off('roomCreated');
    };
  }, []);

  // Play BGM during active phases
  useEffect(() => {
    if (gameState && gameState.phase >= 1 && gameState.phase <= 3 && !paused) {
      playBgm();
    } else {
      stopBgm();
    }
  }, [gameState?.phase, paused, playBgm, stopBgm]);

  // Wake-up chime at 10 seconds
  useEffect(() => {
    socket.on('wakeUpChime', () => {
      playSfx('/audio/chime.mp3');
    });
    return () => socket.off('wakeUpChime');
  }, [playSfx]);

  return (
    <Box className="tv-screen" sx={{ bgcolor: 'background.default', color: 'text.primary' }}>
      {/* Theme toggle */}
      <ThemeToggle theme={theme} toggleTheme={toggleTheme} />

      {/* Room code display (lobby) */}
      {gameState?.phase === 0 && roomCode && (
        <Box sx={{ position: 'absolute', top: 40, left: '50%', transform: 'translateX(-50%)', textAlign: 'center', zIndex: 10 }}>
          <Typography variant="h6" color="text.secondary">Join at</Typography>
          <Typography variant="h2" fontWeight={800} sx={{ letterSpacing: 8, color: 'primary.main' }}>
            {roomCode}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
            {gameState.players?.length || 0} player{gameState.players?.length !== 1 ? 's' : ''} connected
          </Typography>
          {/* Ready progress */}
          {gameState.players?.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                {gameState.players.filter((p) => p.ready).length} / {gameState.players.length} ready
              </Typography>
              <Box sx={{ width: 300, height: 8, bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 4, mt: 1, mx: 'auto', overflow: 'hidden' }}>
                <Box
                  sx={{
                    width: `${(gameState.players.filter((p) => p.ready).length / Math.max(gameState.players.length, 1)) * 100}%`,
                    height: '100%',
                    bgcolor: 'primary.main',
                    borderRadius: 4,
                    transition: 'width 0.3s ease',
                  }}
                />
              </Box>
            </Box>
          )}
          {/* Team roster */}
          <Box sx={{ display: 'flex', gap: 4, mt: 4, justifyContent: 'center' }}>
            {gameState.teams?.map((team) => (
              <Box key={team.index} sx={{ textAlign: 'center', minWidth: 150 }}>
                <Typography variant="h6" sx={{ color: ['#00e5ff', '#ff00e5', '#ffab00'][team.index] }}>
                  {team.finalName}
                </Typography>
                {gameState.players
                  .filter((p) => p.teamIndex === team.index)
                  .map((p) => (
                    <Typography key={p.socketId} variant="body2" sx={{ opacity: p.ready ? 1 : 0.5 }}>
                      {p.name} {p.ready ? '✓' : ''}
                    </Typography>
                  ))}
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* Current AI image (always visible during active game) */}
      {gameState && gameState.phase >= 1 && gameState.phase <= 4 && (
        <ImageDisplay imageUrl={gameState.currentImage} />
      )}

      {/* Timer display */}
      {gameState && gameState.phase >= 1 && gameState.phase <= 4 && (
        <Box sx={{ position: 'absolute', top: 20, right: 40, zIndex: 10 }}>
          <Typography
            variant="h2"
            fontWeight={800}
            sx={{ color: timer <= 10 ? 'error.main' : 'text.primary', transition: 'color 0.3s' }}
          >
            {timer}
          </Typography>
        </Box>
      )}

      {/* Phase label */}
      {gameState && gameState.phase >= 1 && gameState.phase <= 4 && (
        <Box sx={{ position: 'absolute', top: 20, left: 40, zIndex: 10 }}>
          <Typography variant="h5" fontWeight={700} color="text.secondary">
            {gameState.phase === 1 && 'Write your bluffs!'}
            {gameState.phase === 2 && 'Team vote — pick your best!'}
            {gameState.phase === 3 && 'Which one is REAL?'}
            {gameState.phase === 4 && 'The truth revealed...'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Round {gameState.roundIndex + 1} / {gameState.totalRounds}
            {gameState.doublePoints && ' — DOUBLE POINTS!'}
          </Typography>
        </Box>
      )}

      {/* Phase 3: Show options on TV */}
      {gameState?.phase === 3 && gameState.mainVoteOptions && (
        <Box sx={{ position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)', width: '80%', maxWidth: 800 }}>
          {gameState.mainVoteOptions.map((opt, i) => (
            <Box
              key={i}
              sx={{ bgcolor: 'background.paper', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2, p: 2, mb: 1.5, textAlign: 'center' }}
            >
              <Typography variant="h6">
                {['◆', '●', '▲', '■'][i % 4]} {opt.text}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      {/* Phase 4: Reveal sequence */}
      {gameState?.phase === 4 && (
        <RevealSequence steps={revealSteps} scores={scoresData} teams={gameState.teams} />
      )}

      {/* Phase 5: Podium */}
      {gameState?.phase === 5 && podiumData && (
        <Podium data={podiumData} />
      )}

      {/* Confetti */}
      {confetti && <Confetti />}

      {/* Paused overlay */}
      {paused && (
        <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }}>
          <Typography variant="h1" color="white" fontWeight={800}>PAUSED</Typography>
        </Box>
      )}

      {/* Host action notification */}
      {hostAction && (
        <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', bgcolor: 'primary.main', color: 'black', px: 4, py: 2, borderRadius: 3, zIndex: 400 }}>
          <Typography variant="h4" fontWeight={700}>{hostAction}</Typography>
        </Box>
      )}

      {/* Error */}
      {error && (
        <Box sx={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', bgcolor: 'error.main', color: 'white', px: 3, py: 1, borderRadius: 2, zIndex: 400 }}>
          <Typography>{error}</Typography>
        </Box>
      )}

      {/* Host controls (bottom bar) */}
      {gameState && (
        <HostControls
          gameState={gameState}
          muted={muted}
          musicVolume={musicVolume}
          sfxVolume={sfxVolume}
          onMusicVolume={setMusicVolume}
          onSfxVolume={setSfxVolume}
          onToggleMute={toggleMute}
        />
      )}

      {/* Score sidebar */}
      {gameState && gameState.phase >= 1 && (
        <Box sx={{ position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)', zIndex: 10 }}>
          {gameState.teams.map((team) => (
            <Box key={team.index} sx={{ textAlign: 'center', mb: 2 }}>
              <Typography variant="body2" sx={{ color: ['#00e5ff', '#ff00e5', '#ffab00'][team.index] }}>
                {team.finalName}
              </Typography>
              <Typography variant="h4" fontWeight={800} sx={{ color: ['#00e5ff', '#ff00e5', '#ffab00'][team.index] }}>
                {team.score}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
