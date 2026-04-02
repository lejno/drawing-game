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

app.use(express.static(path.join(__dirname, "client/dist")));

function handleCreateRoom(socket, name) {
  let roomId = nanoid(6);
  while (rooms.has(roomId)) {
    roomId = nanoid(6);
  }

  rooms.set(roomId, {
    name: name,
    players: [],
    word: null,
    messages: [],
    drawingData: [],
  });

  const room = rooms.get(roomId);
  socket.join(roomId);
  socket.emit("room created", roomId);
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

  socket.emit("msg", `welcome to the ${roomId}`);
  console.log(`${socket.id} joined ${room.name} ${roomId}`);
  socket.join(roomId);
  socket.emit("room joined", roomId);
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
  socket.on("disconnect", (reason) => {
    console.log(`${socket.id} disconnected: ${reason}`);
  });
});

app.get("/*splat", (req, res) => {
  res.sendFile(path.join(__dirname, "client/dist", "index.html"));
});

server.listen(3000, () => {
  console.log("Socket server on http://localhost:3000");
});
