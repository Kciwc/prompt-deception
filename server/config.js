module.exports = {
  PORT: process.env.PORT || 3000,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'changeme',

  // Team definitions — STRICTLY 3 teams
  TEAMS: [
    { index: 0, color: 'cyan', label: 'Neon Cyan', hex: '#00e5ff' },
    { index: 1, color: 'magenta', label: 'Magenta', hex: '#ff00e5' },
    { index: 2, color: 'amber', label: 'Amber', hex: '#ffab00' },
  ],

  // Timer defaults (seconds)
  TIMERS: {
    PHASE1_BLUFF: 90,
    PHASE2_INTRA_VOTE: 45,
    PHASE3_MAIN_VOTE: 60,
    PHASE4_FEEDBACK: 20,
    FAST_FORWARD: 10,
    ADD_TIME: 15,
  },

  // Sanitization limits
  BLUFF_MIN_CHARS: 5,
  MAX_CONSECUTIVE_EMOJI: 3,
  DEBOUNCE_MS: 300,

  // Room code length
  ROOM_CODE_LENGTH: 4,
};
