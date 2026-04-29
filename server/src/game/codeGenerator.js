// Unambiguous chars: no 0/O, 1/I/L, B/8, 5/S, 2/Z. Easy to read off a TV.
const ALPHABET = 'ACDEFGHJKMNPQRTUVWXY3479';

function generateRoomCode(rooms) {
  for (let attempt = 0; attempt < 50; attempt++) {
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    }
    if (!rooms.has(code)) return code;
  }
  throw new Error('Unable to generate unique room code after 50 attempts');
}

module.exports = { generateRoomCode };
