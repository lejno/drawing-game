const { rooms } = require("../models/rooms");

exports.fetchRooms = (req, res) => {
  const roomsList = Array.from(rooms.entries()).map(([id, room]) => ({
    id,
    name: room.name,
    players: room.players.length,
  }));
  res.json(roomsList);
  console.log("Rooms fetched:", roomsList);
};
