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
    gameState: "waiting",
    word: null,
    messages: [],
  });

  const room = rooms.get(roomId);
  socket.join(roomId);
  io.to(roomId).emit("msg", `room ${room.name} created id: ${roomId}`);
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
}

function handleSendMessage(socket, msg, roomId) {
  const room = rooms.get(roomId);
  room.messages.push({ id: socket.id, text: msg });
  console.log(room);
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
  socket.on("disconnect", (socket) => {
    console.log(`${socket.id} disconnected`);
  });
});

app.get("/*splat", (req, res) => {
  res.sendFile(path.join(__dirname, "client/dist", "index.html"));
});

server.listen(3000, () => {
  console.log("Socket server on http://localhost:3000");
});
