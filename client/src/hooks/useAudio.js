import { useRef, useState, useCallback, useEffect } from 'react';

export default function useAudio() {
  const bgmRef = useRef(null);
  const [muted, setMuted] = useState(false);
  const [musicVolume, setMusicVolume] = useState(0.3);
  const [sfxVolume, setSfxVolume] = useState(0.7);

  // Lazy-init BGM audio element
  const getBgm = useCallback(() => {
    if (!bgmRef.current) {
      bgmRef.current = new Audio('/audio/bgm.mp3');
      bgmRef.current.loop = true;
      bgmRef.current.volume = musicVolume;
    }
    return bgmRef.current;
  }, []);

  const playBgm = useCallback(() => {
    if (muted) return;
    const bgm = getBgm();
    bgm.volume = musicVolume;
    bgm.play().catch(() => {}); // auto-play policy — silent fail
  }, [muted, musicVolume, getBgm]);

  const stopBgm = useCallback(() => {
    if (bgmRef.current) {
      bgmRef.current.pause();
      bgmRef.current.currentTime = 0;
    }
  }, []);

  const playSfx = useCallback(
    (sfxPath) => {
      if (muted) return;
      const sfx = new Audio(sfxPath);
      sfx.volume = sfxVolume;
      sfx.play().catch(() => {});
    },
    [muted, sfxVolume]
  );

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      if (!prev && bgmRef.current) {
        bgmRef.current.pause();
      }
      return !prev;
    });
  }, []);

  // Update BGM volume when slider changes
  useEffect(() => {
    if (bgmRef.current) {
      bgmRef.current.volume = muted ? 0 : musicVolume;
    }
  }, [musicVolume, muted]);

  return {
    muted,
    musicVolume,
    sfxVolume,
    setMusicVolume,
    setSfxVolume,
    toggleMute,
    playBgm,
    stopBgm,
    playSfx,
  };
}
