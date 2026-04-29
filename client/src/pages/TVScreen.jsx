import React, { useState, useEffect, useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { QRCodeSVG } from 'qrcode.react';
import socket from '../socket';
import useGameState from '../hooks/useGameState';
import useAudio from '../hooks/useAudio';
import HostControls from '../components/tv/HostControls';
import ImageDisplay from '../components/tv/ImageDisplay';
import RevealSequence from '../components/tv/RevealSequence';
import Podium from '../components/tv/Podium';
import Confetti from '../components/tv/Confetti';
import ThemeToggle from '../components/tv/ThemeToggle';
import TeamBuckets from '../components/tv/TeamBuckets';

const TEAM_HEX = ['#00e5ff', '#ff00e5', '#ffab00'];

// Floating particles for lobby ambiance
function FloatingParticles() {
  const particles = useMemo(() =>
    Array.from({ length: 20 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 15}s`,
      duration: `${12 + Math.random() * 10}s`,
      color: ['#00e5ff', '#ff00e5', '#ffab00'][i % 3],
      size: 2 + Math.random() * 4,
    })), []);

  return (
    <>
      {particles.map((p) => (
        <div
          key={p.id}
          className="floating-particle"
          style={{
            left: p.left,
            animationDelay: p.delay,
            animationDuration: p.duration,
            background: p.color,
            width: p.size,
            height: p.size,
            boxShadow: `0 0 ${p.size * 3}px ${p.color}`,
          }}
        />
      ))}
    </>
  );
}

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

  // Create room on mount, pass lobby name from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const lobbyName = params.get('name') || undefined;

    socket.emit('tv:createRoom', { lobbyName });

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
      {/* Blob background */}
      <div className="blob-bg">
        <div className="blob-amber" />
      </div>

      {/* Theme toggle */}
      <ThemeToggle theme={theme} toggleTheme={toggleTheme} />

      {/* ═══ LOBBY PHASE ═══ */}
      {gameState?.phase === 0 && roomCode && (
        <>
          <FloatingParticles />

          <Box sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            pt: 5,
            zIndex: 10,
            overflow: 'auto',
          }}>
            {/* Title */}
            <Typography
              variant="h2"
              className="shimmer-text"
              sx={{ mb: 0.5, fontSize: '2.2rem' }}
            >
              {gameState.lobbyName || `Game ${roomCode}`}
            </Typography>

            {/* QR + Code side by side */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 4, mt: 3, mb: 4 }}>
              <Box sx={{ bgcolor: 'white', p: 2, borderRadius: 3, boxShadow: '0 0 40px rgba(0,229,255,0.2)' }}>
                <QRCodeSVG
                  value={`${window.location.origin}/?room=${roomCode}`}
                  size={140}
                  level="M"
                  includeMargin={false}
                />
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                  Scan or enter code
                </Typography>
                <Typography
                  variant="h1"
                  sx={{
                    letterSpacing: 10,
                    color: 'primary.main',
                    textShadow: '0 0 30px rgba(0,229,255,0.5)',
                    fontSize: '3.5rem',
                  }}
                >
                  {roomCode}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {gameState.players?.length || 0} player{gameState.players?.length !== 1 ? 's' : ''} connected
                </Typography>
              </Box>
            </Box>

            {/* Ready progress bar */}
            {gameState.players?.length > 0 && (() => {
              const readyCount = gameState.players.filter((p) => p.ready).length;
              const total = gameState.players.length;
              return (
                <Box sx={{ mb: 4, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {readyCount} / {total} ready
                  </Typography>
                  <Box sx={{ width: 400, height: 6, bgcolor: 'rgba(255,255,255,0.08)', borderRadius: 3, mx: 'auto', overflow: 'hidden' }}>
                    <Box
                      sx={{
                        width: `${(readyCount / Math.max(total, 1)) * 100}%`,
                        height: '100%',
                        background: readyCount === total
                          ? 'linear-gradient(90deg, #00e676, #69f0ae)'
                          : 'linear-gradient(90deg, #00e5ff, #ff00e5)',
                        borderRadius: 3,
                        transition: 'width 0.4s ease, background 0.4s ease',
                        boxShadow: readyCount === total
                          ? '0 0 20px rgba(0,230,118,0.5)'
                          : '0 0 20px rgba(0,229,255,0.3)',
                      }}
                    />
                  </Box>
                </Box>
              );
            })()}

            {/* Team Buckets */}
            <TeamBuckets teams={gameState.teams} players={gameState.players} />
          </Box>
        </>
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
            sx={{
              color: timer <= 10 ? 'error.main' : 'text.primary',
              transition: 'color 0.3s',
              textShadow: timer <= 10 ? '0 0 20px rgba(255,0,0,0.5)' : 'none',
            }}
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
              className="card-enter"
              sx={{
                bgcolor: 'rgba(18,18,42,0.9)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 3,
                p: 2.5,
                mb: 1.5,
                textAlign: 'center',
                backdropFilter: 'blur(10px)',
                animationDelay: `${i * 0.15}s`,
                opacity: 0,
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
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
        <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(6,6,15,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, backdropFilter: 'blur(8px)' }}>
          <Typography variant="h1" sx={{ color: 'white', textShadow: '0 0 40px rgba(0,229,255,0.5)' }}>PAUSED</Typography>
        </Box>
      )}

      {/* Host action notification */}
      {hostAction && (
        <Box sx={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'linear-gradient(135deg, #00e5ff, #ff00e5)',
          color: 'white', px: 5, py: 2.5, borderRadius: 4, zIndex: 400,
          boxShadow: '0 10px 40px rgba(0,229,255,0.3)',
        }}>
          <Typography variant="h4">{hostAction}</Typography>
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
            <Box key={team.index} sx={{ textAlign: 'center', mb: 3 }}>
              <Typography variant="body2" sx={{ color: TEAM_HEX[team.index], fontWeight: 600 }}>
                {team.finalName}
              </Typography>
              <Typography
                variant="h3"
                sx={{
                  color: TEAM_HEX[team.index],
                  textShadow: `0 0 20px ${TEAM_HEX[team.index]}60`,
                }}
              >
                {team.score}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
