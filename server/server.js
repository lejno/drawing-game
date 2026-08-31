const express = require("express");
const cors = require("cors");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const registerController = require("./controllers/registerController");
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:3000"],
    methods: ["GET", "POST"],
  },
});
const path = require("path");
const { nanoid } = require("nanoid");
const rooms = new Map();
const pickTimers = new Map();
const roundTimers = new Map();
const intermissionTimers = new Map();
const afkTimers = new Map();
const disconnectTimers = new Map();
const WORD_PICK_TIME_MS = 10_000;
const ROUND_TIME_MS = 10_000;
const ALL_GUESSED_INTERMISSION_MS = 5_000;
const AFK_TIME_MS = 5_000;
const DISCONNECT_GRACE_MS = 10_000;
const DEFAULT_ROOM_SETTINGS = {
  maxPlayers: 8,
  maxRounds: 3,
  timeLimit: 60,
};
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:3000"],
    credentials: true,
  }),
);

app.use(express.json());
app.post("/api/register", registerController.register_post);

// MongoDB connection setup
const mongoose = require("mongoose");
require("dotenv").config();

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));
const words = ["fish", "stone", "rock", "paper", "scissor"];

function getRandomWords(count = 3) {
  return [...words].sort(() => 0.5 - Math.random()).slice(0, count);
}

const playerSessions = new Map();

function getPlayerBySocketId(room, socketId) {
  if (!room) return null;
  return room.players.find((player) => player.socketId === socketId) ?? null;
}

function getPlayerById(room, playerId) {
  if (!room) return null;
  return room.players.find((player) => player.id === playerId) ?? null;
}

function clearDisconnectTimer(playerId) {
  const timer = disconnectTimers.get(playerId);
  if (!timer) {
    return;
  }

  clearTimeout(timer);
  disconnectTimers.delete(playerId);
}

function resolvePlayerIdFromToken(token) {
  if (typeof token !== "string" || token.trim().length === 0) {
    return nanoid();
  }

  const normalized = token.trim();
  if (playerSessions.has(normalized)) {
    return normalized;
  }

  return nanoid();
}

function removePlayerFromRoom(roomId, playerId) {
  const room = rooms.get(roomId);
  if (!room) {
    return;
  }

  const player = getPlayerById(room, playerId);
  if (!player) {
    return;
  }

  const wasCurrentDrawer = room.currentDrawerId === playerId;
  const wasAdmin = room.adminId === playerId;

  room.players = room.players.filter(
    (existingPlayer) => existingPlayer.id !== playerId,
  );
  room.toBePlayed = room.toBePlayed.filter((pid) => pid !== playerId);
  room.alreadyPlayed = room.alreadyPlayed.filter((pid) => pid !== playerId);
  room.guessedCurrentWord = room.guessedCurrentWord.filter(
    (pid) => pid !== playerId,
  );
  playerSessions.delete(playerId);

  if (room.players.length === 0) {
    clearRoomTimers(roomId);
    rooms.delete(roomId);
    console.log(`room ${roomId} deleted (empty)`);
    return;
  }

  if (wasAdmin && room.players.length > 0) {
    room.adminId = room.players[0].id;
    console.log(`admin ${playerId} left, new admin: ${room.adminId}`);
  }

  if (wasCurrentDrawer) {
    clearRoomTimers(roomId);
    room.word = null;
    room.wordChoices = null;
    room.currentDrawerId = null;
    if (room.started && room.players.length >= 2) {
      handleNextTurn(roomId);
      return;
    } else if (room.started && room.players.length < 2) {
      room.started = false;
    }
  } else {
    maybeAdvanceIfAllGuessed(roomId);
  }

  io.to(roomId).emit("room sent", serializeRoom(room));
}

function serializeRoom(room) {
  return {
    adminId: room.adminId,
    started: room.started,
    name: room.name,
    players: room.players,
    toBePlayed: room.toBePlayed,
    alreadyPlayed: room.alreadyPlayed,
    currentDrawerId: room.currentDrawerId,
    guessedCurrentWord: room.guessedCurrentWord,
    word: room.word,
    wordChoices: room.wordChoices,
    messages: room.messages,
    drawingData: room.drawingData,
    pickDeadline: room.pickDeadline,
    roundDeadline: room.roundDeadline,
  };
}

app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:3000"],
    credentials: true,
  }),
);
app.use(express.json());
app.post("/api/register", registerController.register_post);
app.use(express.static(path.join(__dirname, "client/dist")));

function clearPickTimer(roomId) {
  const pickTimer = pickTimers.get(roomId);
  if (pickTimer) {
    clearTimeout(pickTimer);
    pickTimers.delete(roomId);
  }

  const room = rooms.get(roomId);
  if (!room) {
    return;
  }

  room.pickDeadline = null;
}

function clearRoundTimer(roomId) {
  const roundTimer = roundTimers.get(roomId);
  if (roundTimer) {
    clearTimeout(roundTimer);
    roundTimers.delete(roomId);
  }

  const room = rooms.get(roomId);
  if (!room) {
    return;
  }

  room.roundDeadline = null;
}

function clearRoomTimers(roomId) {
  clearPickTimer(roomId);
  clearRoundTimer(roomId);
  clearIntermissionTimer(roomId);
  clearAfkTimer(roomId);
}

function clearAfkTimer(roomId) {
  const afkTimer = afkTimers.get(roomId);
  if (afkTimer) {
    clearTimeout(afkTimer);
    afkTimers.delete(roomId);
  }
}

function startAfkTimer(roomId) {
  const room = rooms.get(roomId);
  if (!room || !room.currentDrawerId) {
    return;
  }

  clearAfkTimer(roomId);

  const afkTimer = setTimeout(() => {
    afkTimers.delete(roomId);
    const currentRoom = rooms.get(roomId);
    if (!currentRoom || !currentRoom.word) {
      return;
    }

    startIntermission(roomId, "afk");
  }, AFK_TIME_MS);

  afkTimers.set(roomId, afkTimer);
}

// restarts the countdown; called whenever the drawer sends any drawing activity
function resetAfkTimer(roomId) {
  if (!afkTimers.has(roomId)) {
    return;
  }

  startAfkTimer(roomId);
}

function clearIntermissionTimer(roomId) {
  const intermissionTimer = intermissionTimers.get(roomId);
  if (intermissionTimer) {
    clearTimeout(intermissionTimer);
    intermissionTimers.delete(roomId);
  }
}

function startRoundTimer(roomId) {
  const room = rooms.get(roomId);
  if (!room || !room.word || !room.currentDrawerId) {
    return;
  }

  clearRoundTimer(roomId);
  room.roundDeadline = Date.now() + ROUND_TIME_MS;

  io.to(roomId).emit("round timer started", {
    durationMs: ROUND_TIME_MS,
    endsAt: room.roundDeadline,
  });

  const roundTimer = setTimeout(() => {
    const currentRoom = rooms.get(roomId);
    if (!currentRoom || !currentRoom.word) {
      return;
    }

    startIntermission(roomId, "time-up");
  }, ROUND_TIME_MS);

  roundTimers.set(roomId, roundTimer);
}

function startPickTimer(roomId, wordChoices) {
  const room = rooms.get(roomId);
  if (!room || !room.currentDrawerId) {
    return;
  }

  clearPickTimer(roomId);
  room.pickDeadline = Date.now() + WORD_PICK_TIME_MS;

  io.to(roomId).emit("pick timer started", {
    durationMs: WORD_PICK_TIME_MS,
    endsAt: room.pickDeadline,
  });

  const pickTimer = setTimeout(() => {
    const currentRoom = rooms.get(roomId);
    if (!currentRoom || currentRoom.word || !currentRoom.currentDrawerId) {
      return;
    }

    const fallbackChoices =
      currentRoom.wordChoices && currentRoom.wordChoices.length > 0
        ? currentRoom.wordChoices
        : wordChoices;
    const autoWord =
      fallbackChoices[Math.floor(Math.random() * fallbackChoices.length)];

    if (!autoWord) {
      handleNextTurn(roomId);
      return;
    }

    clearPickTimer(roomId);
    currentRoom.word = autoWord;
    currentRoom.wordChoices = null;
    console.log(`[word auto selected] room: ${roomId} | word: ${autoWord}`);

    io.to(roomId).emit("word auto selected");
    io.to(roomId).emit("word selected");
    startRoundTimer(roomId);
  }, WORD_PICK_TIME_MS);

  pickTimers.set(roomId, pickTimer);
}

function createRoomState(name, safeSettings) {
  return {
    adminId: null,
    started: false,
    name,
    players: [],
    toBePlayed: [],
    alreadyPlayed: [],
    currentDrawerId: null,
    guessedCurrentWord: [],
    word: null,
    wordChoices: null,
    messages: [],
    drawingData: [],
    pickDeadline: null,
    roundDeadline: null,
    currentRound: 0,
    maxPlayers: safeSettings.maxPlayers,
    maxRounds: safeSettings.maxRounds,
    timeLimit: safeSettings.timeLimit,
  };
}

function handleCreateRoom(socket, name, playerName, token, settings) {
  const safeSettings = {
    maxPlayers:
      Number.isFinite(settings?.maxPlayers) && settings.maxPlayers > 0
        ? settings.maxPlayers
        : DEFAULT_ROOM_SETTINGS.maxPlayers,
    maxRounds:
      Number.isFinite(settings?.maxRounds) && settings.maxRounds > 0
        ? settings.maxRounds
        : Number.isFinite(settings?.rounds) && settings.rounds > 0
          ? settings.rounds
          : DEFAULT_ROOM_SETTINGS.maxRounds,
    timeLimit:
      Number.isFinite(settings?.timeLimit) && settings.timeLimit > 0
        ? settings.timeLimit
        : DEFAULT_ROOM_SETTINGS.timeLimit,
  };

  let roomId = nanoid(6);
  while (rooms.has(roomId)) {
    roomId = nanoid(6);
  }

  rooms.set(roomId, createRoomState(name, safeSettings));

  const room = rooms.get(roomId);
  socket.join(roomId);
  socket.emit("room created", roomId);
  const playerId = resolvePlayerIdFromToken(token);
  const player = {
    id: playerId,
    socketId: socket.id,
    name: playerName,
    score: 0,
    connected: true,
    roomId: roomId,
  };
  room.players.push(player);
  room.adminId = player.id;
  room.toBePlayed.push(player.id);
  playerSessions.set(player.id, {
    playerId: player.id,
    roomId,
  });
  socket.emit("store token", player.id);
  io.to(roomId).emit("msg", `room ${room.name} created id: ${roomId}`);
  io.to(roomId).emit("room sent", serializeRoom(room));
  console.log(`${roomId}`);
}

function handleJoinRoom(socket, roomId, playerName, token) {
  const room = rooms.get(roomId);

  if (room && room.players.length >= room.maxPlayers) {
    socket.emit("error msg", "Room is full");
    return;
  }

  if (!room) {
    socket.emit("error msg", "Room does not exist");
    return;
  }
  const providedToken =
    typeof token === "string" && token.trim().length > 0 ? token.trim() : null;
  const foundPlayer = providedToken ? getPlayerById(room, providedToken) : null;

  if (
    foundPlayer &&
    foundPlayer.connected &&
    foundPlayer.socketId &&
    foundPlayer.socketId !== socket.id
  ) {
    socket.emit("error msg", "This player is already connected to the room");
    return;
  }

  if (room.players.some((player) => player.socketId === socket.id)) {
    socket.join(roomId);
    socket.emit("room joined", roomId);
    socket.emit("room sent", serializeRoom(room));
    return;
  }

  if (foundPlayer) {
    clearDisconnectTimer(foundPlayer.id);
    foundPlayer.socketId = socket.id;
    foundPlayer.connected = true;
    socket.join(roomId);
    socket.emit("room joined", roomId);
    socket.emit("room sent", serializeRoom(room));
    return;
  }

  socket.emit("msg", `welcome to the ${roomId}`);
  console.log(`${socket.id} joined ${room.name} ${roomId}`);
  socket.join(roomId);
  socket.emit("room joined", roomId);
  const playerId = resolvePlayerIdFromToken(providedToken);
  const player = {
    id: playerId,
    socketId: socket.id,
    name: playerName,
    score: 0,
    connected: true,
    roomId: roomId,
  };
  room.players.push(player);
  playerSessions.set(player.id, {
    playerId: player.id,
    roomId,
  });
  socket.emit("store token", player.id);
  room.toBePlayed.push(player.id);
  io.to(roomId).emit("room sent", serializeRoom(room));
}

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) =>
      i === 0 ? j : j === 0 ? i : 0,
    ),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

function handleSendMessage(socket, msg, roomId) {
  const room = rooms.get(roomId);
  if (!room) {
    socket.emit("error msg", "Room does not exist");
    return;
  }
  const sender = getPlayerBySocketId(room, socket.id);
  if (!sender) {
    socket.emit("error msg", "Join the room before sending messages");
    return;
  }

  function checkAnswer(roomWord, msg) {
    if (!roomWord) return false;
    const word = roomWord.trim().toLowerCase();
    const text = msg.trim().toLowerCase();
    const wordRegex = new RegExp(`\\b${word}\\b`);
    return wordRegex.test(text);
  }

  function checkClose(roomWord, msg) {
    if (!roomWord) return null;
    const word = roomWord.trim().toLowerCase();
    const msgWords =
      msg
        .trim()
        .toLowerCase()
        .match(/[a-z']+/g) || [];
    for (const w of msgWords) {
      if (w === word) continue;
      if (levenshtein(w, word) <= 1 || w.includes(word) || word.includes(w)) {
        return w;
      }
    }
    return null;
  }

  if (checkAnswer(room.word, msg)) {
    if (sender.id === room.currentDrawerId) {
      return;
    }

    if (room.guessedCurrentWord.includes(sender.id)) {
      return;
    }

    io.to(roomId).emit("correct answer", { id: sender.id });
    const guesser = room.players.find((player) => player.id === sender.id);
    if (guesser) {
      guesser.score += 1;
    }
    const guessName = guesser?.name ?? sender.id;
    const guessMsg = { id: "system", text: `${guessName} guessed the word!` };
    room.guessedCurrentWord.push(sender.id);
    room.messages.push(guessMsg);
    io.to(roomId).emit("room sent", serializeRoom(room));
    io.to(roomId).emit("new message", guessMsg);

    maybeAdvanceIfAllGuessed(roomId);

    return;
  }

  const closeWord = checkClose(room.word, msg);
  if (closeWord) {
    socket.emit("close answer", { word: closeWord });
    return;
  }

  const newMessage = { id: sender.id, name: sender.name, text: msg };
  room.messages.push(newMessage);
  io.to(roomId).emit("new message", newMessage);
}

function maybeAdvanceIfAllGuessed(roomId) {
  const room = rooms.get(roomId);
  if (!room || !room.currentDrawerId || !room.word) {
    return;
  }

  const guessersNeeded = room.players.filter(
    (player) => player.id !== room.currentDrawerId,
  );
  const allGuessed =
    guessersNeeded.length > 0 &&
    guessersNeeded.every((player) =>
      room.guessedCurrentWord.includes(player.id),
    );

  if (!allGuessed) {
    return;
  }

  startIntermission(roomId, "all-guessed");
}

function clearDrawingForRoom(roomId) {
  const room = rooms.get(roomId);
  if (!room) {
    return;
  }

  if (room.drawingData.length === 0) {
    return;
  }

  room.drawingData = [];
  io.to(roomId).emit("drawing cleared");
}

function startIntermission(roomId, reason) {
  const room = rooms.get(roomId);
  if (!room || !room.currentDrawerId) {
    return;
  }

  if (intermissionTimers.has(roomId)) {
    return;
  }

  const nextDrawerId = getNextDrawerId(room);
  clearPickTimer(roomId);
  clearRoundTimer(roomId);
  clearDrawingForRoom(roomId);

  io.to(roomId).emit("round ended", { reason });
  io.to(roomId).emit("intermission started", {
    reason,
    nextDrawerId,
    durationMs: ALL_GUESSED_INTERMISSION_MS,
    endsAt: Date.now() + ALL_GUESSED_INTERMISSION_MS,
  });

  const intermissionTimer = setTimeout(() => {
    intermissionTimers.delete(roomId);
    handleNextTurn(roomId);
  }, ALL_GUESSED_INTERMISSION_MS);

  intermissionTimers.set(roomId, intermissionTimer);
}

function getNextDrawerId(room) {
  if (!room) {
    return null;
  }

  const toBePlayed = [...room.toBePlayed];
  const alreadyPlayed = [...room.alreadyPlayed];

  if (
    room.currentDrawerId &&
    room.players.some((player) => player.id === room.currentDrawerId) &&
    !alreadyPlayed.includes(room.currentDrawerId)
  ) {
    alreadyPlayed.push(room.currentDrawerId);
  }

  if (toBePlayed.length === 0) {
    const playersStillInRoom = alreadyPlayed.filter((pid) =>
      room.players.some((player) => player.id === pid),
    );
    const refilled = [...new Set(playersStillInRoom)];
    if (refilled.length === 0) {
      return null;
    }

    return refilled[0];
  }

  return toBePlayed[0];
}

function handleRoomData(socket, roomId, token) {
  const room = rooms.get(roomId);
  if (!room) {
    socket.emit("error msg", "Room does not exist");
    return;
  }

  const providedToken =
    typeof token === "string" && token.trim().length > 0 ? token.trim() : null;
  if (providedToken) {
    const foundPlayer = getPlayerById(room, providedToken);
    if (foundPlayer) {
      if (
        foundPlayer.connected &&
        foundPlayer.socketId &&
        foundPlayer.socketId !== socket.id
      ) {
        socket.emit(
          "error msg",
          "This player is already connected to the room",
        );
        return;
      }

      clearDisconnectTimer(foundPlayer.id);
      foundPlayer.socketId = socket.id;
      foundPlayer.connected = true;
    }
  }

  socket.join(roomId);
  socket.emit("room sent", serializeRoom(room));
}

function handleDrawStroke(socket, stroke, roomId) {
  const room = rooms.get(roomId);
  if (!room) {
    socket.emit("error msg", "Room does not exist");
    return;
  }

  const drawer = getPlayerBySocketId(room, socket.id);
  if (!drawer) {
    socket.emit("error msg", "Join the room before drawing");
    return;
  }

  if (room.currentDrawerId !== drawer.id) {
    socket.emit("error msg", "Only current drawer can draw");
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
    playerId: drawer.id,
    socketId: socket.id,
  };

  room.drawingData.push(nextStroke);
  io.to(roomId).emit("draw stroke", nextStroke);
  resetAfkTimer(roomId);
}

function handleUndoStroke(socket, roomId) {
  const room = rooms.get(roomId);
  if (!room) {
    socket.emit("error msg", "Room does not exist");
    return;
  }

  const drawer = getPlayerBySocketId(room, socket.id);
  if (!drawer) {
    socket.emit("error msg", "Join the room before undo");
    return;
  }

  if (room.currentDrawerId !== drawer.id) {
    socket.emit("error msg", "Only current drawer can undo");
    return;
  }

  if (room.drawingData.length === 0) {
    return;
  }

  const lastStroke = room.drawingData[room.drawingData.length - 1];
  const lastStrokeId = lastStroke.strokeId;

  if (lastStroke.playerId !== drawer.id) {
    return;
  }

  if (lastStrokeId) {
    room.drawingData = room.drawingData.filter(
      (stroke) => stroke.strokeId !== lastStrokeId,
    );
    io.to(roomId).emit("stroke undone", { strokeId: lastStrokeId });
    resetAfkTimer(roomId);
    return;
  }

  room.drawingData.pop();
  io.to(roomId).emit("stroke undone", { strokeId: null });
  resetAfkTimer(roomId);
}

function handleClearDrawing(socket, roomId) {
  const room = rooms.get(roomId);
  if (!room) {
    socket.emit("error msg", "Room does not exist");
    return;
  }

  const drawer = getPlayerBySocketId(room, socket.id);
  if (!drawer) {
    socket.emit("error msg", "Join the room before clearing");
    return;
  }

  if (room.currentDrawerId !== drawer.id) {
    socket.emit("error msg", "Only current drawer can clear canvas");
    return;
  }

  room.drawingData = [];
  io.to(roomId).emit("drawing cleared");
  resetAfkTimer(roomId);
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
    io.to(roomId).emit("room sent", serializeRoom(room));
    handleNextTurn(roomId);
  }
}

function handleNextTurn(roomId) {
  const room = rooms.get(roomId);
  if (!room) {
    return;
  }

  clearRoomTimers(roomId);
  clearDrawingForRoom(roomId);
  room.currentRound += 1;

  if (room.maxRounds > 0 && room.currentRound >= room.maxRounds) {
    room.started = false;
    room.currentDrawerId = null;
    io.to(roomId).emit("drawer changed", { drawerId: null });
    io.to(roomId).emit("game ended");
    return;
  }

  if (
    room.currentDrawerId &&
    room.players.some((player) => player.id === room.currentDrawerId) &&
    !room.alreadyPlayed.includes(room.currentDrawerId)
  ) {
    room.alreadyPlayed.push(room.currentDrawerId);
  }

  if (room.toBePlayed.length === 0) {
    // readd alreadyplayed to tobeplayed
    const playersStillInRoom = room.alreadyPlayed.filter((pid) =>
      room.players.some((player) => player.id === pid),
    );
    room.toBePlayed = [...new Set(playersStillInRoom)];
    room.alreadyPlayed = [];

    if (room.toBePlayed.length === 0) {
      room.currentDrawerId = null;
      io.to(roomId).emit("drawer changed", { drawerId: null });
      return;
    }
  }

  if (room.players.length < 2) {
    room.currentDrawerId = null;
    io.to(roomId).emit("drawer changed", { drawerId: null });
    room.started = false;
    io.to(roomId).emit("room sent", serializeRoom(room));
    return;
  }

  let currentDrawer = room.toBePlayed.shift();
  room.currentDrawerId = currentDrawer;
  room.guessedCurrentWord = [];
  room.word = null;
  room.wordChoices = null;
  const random3 = getRandomWords(3);
  room.wordChoices = random3;
  io.to(roomId).emit("drawer changed", {
    drawerId: currentDrawer,
  });
  const currentDrawerPlayer = getPlayerById(room, currentDrawer);
  if (currentDrawerPlayer?.socketId) {
    io.to(currentDrawerPlayer.socketId).emit("choose a word", random3);
  }
  console.log(
    "current drawer:",
    currentDrawer,
    "remaining:",
    room.toBePlayed.length,
  );

  startPickTimer(roomId, random3);
}

function handleWordChosen(socket, roomId, chosenWord) {
  const room = rooms.get(roomId);
  if (!room) {
    socket.emit("error msg", "Room does not exist");
    return;
  }

  const drawer = getPlayerBySocketId(room, socket.id);
  if (!drawer) {
    socket.emit("error msg", "Join the room before choosing a word");
    return;
  }

  if (room.currentDrawerId !== drawer.id) {
    socket.emit("error msg", "Only current drawer can choose a word");
    return;
  }

  if (typeof chosenWord !== "string" || chosenWord.trim().length === 0) {
    socket.emit("error msg", "Invalid word selected");
    return;
  }

  if (room.word) {
    socket.emit("error msg", "Word already selected for this round");
    return;
  }

  const normalizedWord = chosenWord.trim().toLowerCase();
  if (
    Array.isArray(room.wordChoices) &&
    room.wordChoices.length > 0 &&
    !room.wordChoices.includes(normalizedWord)
  ) {
    socket.emit("error msg", "Selected word is not one of the options");
    return;
  }

  clearPickTimer(roomId);
  room.word = normalizedWord;
  room.wordChoices = null;
  console.log(`[word chosen] room: ${roomId} | word: ${normalizedWord}`);
  io.to(roomId).emit("word selected");
  startRoundTimer(roomId);
  startAfkTimer(roomId);
}

io.on("connection", (socket) => {
  console.log("a user connected:", socket.id);

  socket.on("create room", (name, playerName, token, settings) => {
    handleCreateRoom(socket, name, playerName, token, settings);
  });
  socket.on("join room", (roomId, playerName, token) => {
    handleJoinRoom(socket, roomId, playerName, token);
  });
  socket.on("send message", (msg, roomId) => {
    handleSendMessage(socket, msg, roomId);
  });
  socket.on("request room data", (roomId, token) => {
    handleRoomData(socket, roomId, token);
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
  socket.on("request rooms list", () => {
    const roomsList = Array.from(rooms.entries())
      .filter(([, room]) => room.players.length < room.maxPlayers)
      .map(([id, room]) => ({
        id,
        name: room.name,
        playerCount: room.players.length,
      }));
    socket.emit("rooms list", roomsList);
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

    const drawer = getPlayerBySocketId(room, socket.id);
    if (!drawer) {
      socket.emit("error msg", "Join the room before ending turn");
      return;
    }

    if (room.currentDrawerId !== drawer.id) {
      socket.emit("error msg", "Only current drawer can end turn");
      return;
    }

    startIntermission(roomId, "end-turn");
  });
  socket.on("word chosen", (roomId, chosenWord) => {
    handleWordChosen(socket, roomId, chosenWord);
  });
  socket.on("disconnect", (reason) => {
    console.log(`${socket.id} disconnected: ${reason}`);
    rooms.forEach((room, roomId) => {
      const disconnectedPlayer = getPlayerBySocketId(room, socket.id);
      if (!disconnectedPlayer) {
        return;
      }

      disconnectedPlayer.socketId = null;
      disconnectedPlayer.connected = false;
      clearDisconnectTimer(disconnectedPlayer.id);
      const removeTimer = setTimeout(() => {
        disconnectTimers.delete(disconnectedPlayer.id);
        removePlayerFromRoom(roomId, disconnectedPlayer.id);
      }, DISCONNECT_GRACE_MS);
      disconnectTimers.set(disconnectedPlayer.id, removeTimer);
      io.to(roomId).emit("room sent", serializeRoom(room));
    });
  });
});

app.get("/*splat", (req, res) => {
  res.sendFile(path.join(__dirname, "client/dist", "index.html"));
});

server.listen(3000, () => {
  console.log("Socket server on http://localhost:3000");
});
