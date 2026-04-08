// Drift-corrected interval timer
// Compares Date.now() against start time to avoid JS timer drift

function startTimer(game, durationSeconds, onTick, onExpire) {
  clearTimer(game);

  game.timer.duration = durationSeconds;
  game.timer.remaining = durationSeconds;
  game.timer.startedAt = Date.now();
  game.timer.paused = false;

  game.timer.intervalRef = setInterval(() => {
    if (game.timer.paused) return;

    const elapsed = Math.floor((Date.now() - game.timer.startedAt) / 1000);
    game.timer.remaining = Math.max(0, game.timer.duration - elapsed);

    onTick(game.timer.remaining);

    if (game.timer.remaining <= 0) {
      clearTimer(game);
      onExpire();
    }
  }, 1000);
}

function clearTimer(game) {
  if (game.timer.intervalRef) {
    clearInterval(game.timer.intervalRef);
    game.timer.intervalRef = null;
  }
}

function pauseTimer(game) {
  if (!game.timer.paused) {
    game.timer.paused = true;
    // Store how much time was left so we can resume accurately
    const elapsed = Math.floor((Date.now() - game.timer.startedAt) / 1000);
    game.timer.remaining = Math.max(0, game.timer.duration - elapsed);
  }
}

function resumeTimer(game) {
  if (game.timer.paused) {
    game.timer.paused = false;
    // Reset start time relative to remaining time
    game.timer.duration = game.timer.remaining;
    game.timer.startedAt = Date.now();
  }
}

function addTime(game, seconds) {
  game.timer.duration += seconds;
  // Recalculate remaining
  const elapsed = Math.floor((Date.now() - game.timer.startedAt) / 1000);
  game.timer.remaining = Math.max(0, game.timer.duration - elapsed);
}

function fastForwardTo(game, seconds) {
  // Jump timer so only `seconds` remain
  const elapsed = Math.floor((Date.now() - game.timer.startedAt) / 1000);
  const currentRemaining = game.timer.duration - elapsed;
  if (currentRemaining > seconds) {
    game.timer.duration = elapsed + seconds;
    game.timer.remaining = seconds;
  }
}

module.exports = {
  startTimer,
  clearTimer,
  pauseTimer,
  resumeTimer,
  addTime,
  fastForwardTo,
};
