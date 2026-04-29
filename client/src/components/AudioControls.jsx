import { useEffect, useState } from 'react';
import { audioManager } from '../audio/AudioManager';
import './AudioControls.css';

// Full sliders for the TV host — music + SFX independently, plus mute.
export function HostAudioControls() {
  const [music, setMusic] = useState(audioManager.settings.musicVolume);
  const [sfx, setSfx] = useState(audioManager.settings.sfxVolume);
  const [muted, setMuted] = useState(audioManager.settings.muted);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    audioManager.setMusicVolume(music);
  }, [music]);
  useEffect(() => {
    audioManager.setSfxVolume(sfx);
  }, [sfx]);
  useEffect(() => {
    audioManager.setMuted(muted);
  }, [muted]);

  async function unlockAudio() {
    await audioManager.unlock();
    setUnlocked(true);
  }

  return (
    <div className="audio-controls">
      {!unlocked && (
        <button onClick={unlockAudio} className="audio-unlock">
          🔊 Enable audio
        </button>
      )}
      {unlocked && (
        <>
          <label className="vol-row">
            <span>Music</span>
            <input type="range" min="0" max="1" step="0.05" value={music}
              onChange={(e) => setMusic(parseFloat(e.target.value))} />
            <span className="val">{Math.round(music * 100)}</span>
          </label>
          <label className="vol-row">
            <span>SFX</span>
            <input type="range" min="0" max="1" step="0.05" value={sfx}
              onChange={(e) => setSfx(parseFloat(e.target.value))} />
            <span className="val">{Math.round(sfx * 100)}</span>
          </label>
          <button
            type="button"
            className={`mute-btn ${muted ? 'is-muted' : ''}`}
            onClick={() => setMuted(!muted)}
          >
            {muted ? '🔇 Muted' : '🔊'}
          </button>
        </>
      )}
    </div>
  );
}

// Compact mute toggle for the player's phone (per spec: "local audio mute").
export function PlayerMuteToggle() {
  const [muted, setMuted] = useState(audioManager.settings.muted);
  const [unlocked, setUnlocked] = useState(false);

  async function toggle() {
    if (!unlocked) {
      await audioManager.unlock();
      setUnlocked(true);
      // First tap unlocks but doesn't mute.
      return;
    }
    const next = !muted;
    setMuted(next);
    audioManager.setMuted(next);
  }

  return (
    <button type="button" className={`player-mute ${muted ? 'is-muted' : ''}`} onClick={toggle} title="Toggle audio">
      {!unlocked ? '🔊 Tap to enable' : muted ? '🔇' : '🔊'}
    </button>
  );
}
