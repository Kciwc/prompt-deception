import { useState, useEffect, useCallback } from 'react';
import socket from '../socket';

export default function useGameState() {
  const [gameState, setGameState] = useState(null);
  const [timer, setTimer] = useState(0);
  const [error, setError] = useState(null);
  const [paused, setPaused] = useState(false);
  const [hostAction, setHostAction] = useState(null);
  const [revealSteps, setRevealSteps] = useState([]);
  const [podiumData, setPodiumData] = useState(null);
  const [scoresData, setScoresData] = useState(null);
  const [confetti, setConfetti] = useState(false);
  const [gotItRight, setGotItRight] = useState(false);
  const [kicked, setKicked] = useState(false);
  const [tvDisconnected, setTvDisconnected] = useState(false);

  useEffect(() => {
    socket.on('gameState', (state) => {
      setGameState(state);
      setError(null);
    });

    socket.on('timerTick', ({ remaining }) => {
      setTimer(remaining);
    });

    socket.on('phaseChange', ({ phase, timerSeconds }) => {
      setTimer(timerSeconds || 0);
      setRevealSteps([]);
      setConfetti(false);
      setGotItRight(false);
    });

    socket.on('paused', ({ paused: p, reason }) => {
      setPaused(p);
      if (p && reason) setHostAction(reason);
    });

    socket.on('error', ({ message }) => {
      setError(message);
      setTimeout(() => setError(null), 4000);
    });

    socket.on('hostAction', ({ action }) => {
      setHostAction(action);
      setTimeout(() => setHostAction(null), 3000);
    });

    socket.on('revealStep', (step) => {
      setRevealSteps((prev) => [...prev, step]);
    });

    socket.on('confetti', () => {
      setConfetti(true);
      setTimeout(() => setConfetti(false), 5000);
    });

    socket.on('youGotItRight', () => {
      setGotItRight(true);
    });

    socket.on('podium', (data) => {
      setPodiumData(data);
    });

    socket.on('scores', (data) => {
      setScoresData(data);
    });

    socket.on('playerKicked', ({ reason }) => {
      setKicked(true);
    });

    socket.on('tvDisconnected', () => {
      setTvDisconnected(true);
    });

    socket.on('tvReconnected', () => {
      setTvDisconnected(false);
    });

    return () => {
      socket.off('gameState');
      socket.off('timerTick');
      socket.off('phaseChange');
      socket.off('paused');
      socket.off('error');
      socket.off('hostAction');
      socket.off('revealStep');
      socket.off('confetti');
      socket.off('youGotItRight');
      socket.off('podium');
      socket.off('scores');
      socket.off('playerKicked');
      socket.off('tvDisconnected');
      socket.off('tvReconnected');
    };
  }, []);

  return {
    gameState,
    timer,
    error,
    paused,
    hostAction,
    revealSteps,
    podiumData,
    scoresData,
    confetti,
    gotItRight,
    kicked,
    tvDisconnected,
  };
}
