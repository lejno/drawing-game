const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:3000"],
    methods: ["GET", "POST"],
  },
});
const path = require("path");
const { nanoid } = require("nanoid");
const rooms = new Map();

const words = ["fish", "stone", "rock", "paper", "scissor"];

function getRandomWords(count = 3) {
  return [...words].sort(() => 0.5 - Math.random()).slice(0, count);
}

app.use(express.static(path.join(__dirname, "client/dist")));

function handleCreateRoom(socket, name) {
  let roomId = nanoid(6);
  while (rooms.has(roomId)) {
    roomId = nanoid(6);
  }

  rooms.set(roomId, {
    adminId: socket.id,
    started: false,
    name: name,
    players: [],
    toBePlayed: [],
    alreadyPlayed: [],
    currentDrawerId: null,
    word: null,
    messages: [],
    drawingData: [],
  });

  const room = rooms.get(roomId);
  socket.join(roomId);
  socket.emit("room created", roomId);
  room.players.push(socket.id);
  room.toBePlayed.push(socket.id);
  io.to(roomId).emit("msg", `room ${room.name} created id: ${roomId}`);
  io.to(roomId).emit("room sent", room);
  console.log(`${roomId}`);
}

function handleJoinRoom(socket, roomId) {
  const room = rooms.get(roomId);
  if (!room) {
    socket.emit("error msg", "Room does not exist");
    return;
  }

  if (room.players.includes(socket.id)) {
    socket.join(roomId);
    socket.emit("room joined", roomId);
    socket.emit("room sent", room);
    return;
  }

  socket.emit("msg", `welcome to the ${roomId}`);
  console.log(`${socket.id} joined ${room.name} ${roomId}`);
  socket.join(roomId);
  socket.emit("room joined", roomId);
  room.players.push(socket.id);
  room.toBePlayed.push(socket.id);
  io.to(roomId).emit("room sent", room);
}

function handleSendMessage(socket, msg, roomId) {
  const room = rooms.get(roomId);
  if (!room) {
    socket.emit("error msg", "Room does not exist");
    return;
  }

  const newMessage = { id: socket.id, text: msg };
  room.messages.push(newMessage);
  io.to(roomId).emit("new message", newMessage);
}

function handleRoomData(socket, roomId) {
  const room = rooms.get(roomId);
  if (!room) {
    socket.emit("error msg", "Room does not exist");
    return;
  }

  socket.join(roomId);
  socket.emit("room sent", room);
}

function handleDrawStroke(socket, stroke, roomId) {
  const room = rooms.get(roomId);
  if (!room) {
    socket.emit("error msg", "Room does not exist");
    return;
  }

  const nextStroke = {
    x0: Number(stroke.x0),
    y0: Number(stroke.y0),
    x1: Number(stroke.x1),
    y1: Number(stroke.y1),
    color: stroke.color,
    lineWidth: Number(stroke.lineWidth),
    strokeId: stroke.strokeId,
    tool: stroke.tool === "erase" ? "erase" : "draw",
    socketId: socket.id,
  };

  room.drawingData.push(nextStroke);
  io.to(roomId).emit("draw stroke", nextStroke);
}

function handleUndoStroke(socket, roomId) {
  const room = rooms.get(roomId);
  if (!room) {
    socket.emit("error msg", "Room does not exist");
    return;
  }

  if (room.drawingData.length === 0) {
    return;
  }

  const lastStroke = room.drawingData[room.drawingData.length - 1];
  const lastStrokeId = lastStroke.strokeId;

  if (lastStroke.socketId !== socket.id) {
    return;
  }

  if (lastStrokeId) {
    room.drawingData = room.drawingData.filter(
      (stroke) => stroke.strokeId !== lastStrokeId,
    );
    io.to(roomId).emit("stroke undone", { strokeId: lastStrokeId });
    return;
  }

  room.drawingData.pop();
  io.to(roomId).emit("stroke undone", { strokeId: null });
}

function handleClearDrawing(socket, roomId) {
  const room = rooms.get(roomId);
  if (!room) {
    socket.emit("error msg", "Room does not exist");
    return;
  }

  room.drawingData = [];
  io.to(roomId).emit("drawing cleared");
}

function handleStartGame(roomId) {
  const room = rooms.get(roomId);
  if (!room) {
    console.log("start game failed: room not found", roomId);
    return;
  }

  if (room.players.length < 2) {
    io.to(roomId).emit("error msg", "Not enough players in room");
    return;
  } else if (room.started === true) {
    io.to(roomId).emit("error msg", "Game already started");
  } else {
    room.started = true;
    io.to(roomId).emit("room sent", room);
    handleNextTurn(roomId);
  }
}

function handleNextTurn(roomId) {
  const room = rooms.get(roomId);
  if (!room) {
    return;
  }

  if (
    room.currentDrawerId &&
    room.players.includes(room.currentDrawerId) &&
    !room.alreadyPlayed.includes(room.currentDrawerId)
  ) {
    room.alreadyPlayed.push(room.currentDrawerId);
  }

  if (room.toBePlayed.length > 0) {
    let currentDrawer = room.toBePlayed.shift();
    room.currentDrawerId = currentDrawer;
    const random3 = getRandomWords(3);
    io.to(currentDrawer).emit("msg", `choose a word: ${random3}`);
    io.to(roomId).emit("drawer changed", {
      drawerId: currentDrawer,
    });
    console.log(
      "current drawer:",
      currentDrawer,
      "remaining:",
      room.toBePlayed.length,
    );
  } else {
    const playersStillInRoom = room.alreadyPlayed.filter((pid) =>
      room.players.includes(pid),
    );
    room.toBePlayed = [...new Set(playersStillInRoom)];
    room.alreadyPlayed = [];

    if (room.toBePlayed.length === 0) {
      room.currentDrawerId = null;
      io.to(roomId).emit("drawer changed", { drawerId: null });
      return;
    }

    let currentDrawer = room.toBePlayed.shift();
    room.currentDrawerId = currentDrawer;
    const random3 = getRandomWords(3);
    io.to(currentDrawer).emit("msg", `choose a word: ${random3}`);
    io.to(roomId).emit("drawer changed", {
      drawerId: currentDrawer,
    });
  }
}

// function handleEndTurn(socket, roomId) {
//   const room = rooms.get(roomId);
//   if (!room) return;

//   if (room.currentDrawerId !== socket.id) return;

//   if (room.currentDrawerId) {
//     room.alreadyPlayed.push(room.currentDrawerId);
//     room.currentDrawerId = null;
//     console.log("turn ended, moved to alreadyPlayed");
//   }

//   handleStartGame(roomId);
// }

io.on("connection", (socket) => {
  console.log("a user connected:", socket.id);

  socket.on("create room", (name) => {
    handleCreateRoom(socket, name);
  });
  socket.on("join room", (roomId) => {
    handleJoinRoom(socket, roomId);
  });
  socket.on("send message", (msg, roomId) => {
    handleSendMessage(socket, msg, roomId);
  });
  socket.on("request room data", (roomId) => {
    handleRoomData(socket, roomId);
  });
  socket.on("draw stroke", (stroke, roomId) => {
    handleDrawStroke(socket, stroke, roomId);
  });
  socket.on("clear drawing", (roomId) => {
    handleClearDrawing(socket, roomId);
  });
  socket.on("undo stroke", (roomId) => {
    handleUndoStroke(socket, roomId);
  });
  socket.on("start game", (roomId) => {
    handleStartGame(roomId);
  });
  socket.on("next turn", (roomId) => {
    const room = rooms.get(roomId);
    if (!room) {
      socket.emit("error msg", "Room does not exist");
      return;
    }

    if (room.currentDrawerId !== socket.id) {
      socket.emit("error msg", "Only current drawer can end turn");
      return;
    }

    handleNextTurn(roomId);
  });
  socket.on("disconnect", (reason) => {
    console.log(`${socket.id} disconnected: ${reason}`);
    rooms.forEach((room) => {
      room.players = room.players.filter((pid) => pid !== socket.id);
      room.toBePlayed = room.toBePlayed.filter((pid) => pid !== socket.id);
      room.alreadyPlayed = room.alreadyPlayed.filter(
        (pid) => pid !== socket.id,
      );
      if (room.currentDrawerId === socket.id) {
        room.currentDrawerId = null;
      }
    });
  });
});

app.get("/*splat", (req, res) => {
  res.sendFile(path.join(__dirname, "client/dist", "index.html"));
});

server.listen(3000, () => {
  console.log("Socket server on http://localhost:3000");
});
