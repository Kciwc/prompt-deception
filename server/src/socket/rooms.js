// Module-level registry of active rooms. Single Node process, in-memory.
const rooms = new Map(); // code -> Room

function setRoom(room) { rooms.set(room.code, room); }
function getRoom(code) { return rooms.get(code); }
function deleteRoom(code) { rooms.delete(code); }
function listPublicRooms() {
  const out = [];
  for (const r of rooms.values()) {
    if (r.isPublic && r.status !== 'finished') out.push(r.publicSummary());
  }
  // Newest first.
  out.sort((a, b) => b.createdAt - a.createdAt);
  return out;
}
function allRooms() { return rooms; }

module.exports = { setRoom, getRoom, deleteRoom, listPublicRooms, allRooms };
