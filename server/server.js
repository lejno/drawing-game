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
const pickTimers = new Map();
const roundTimers = new Map();
const WORD_PICK_TIME_MS = 10_000;
const ROUND_TIME_MS = 60_000;

const words = ["fish", "stone", "rock", "paper", "scissor"];

function getRandomWords(count = 3) {
  return [...words].sort(() => 0.5 - Math.random()).slice(0, count);
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

    clearRoundTimer(roomId);
    io.to(roomId).emit("round ended", { reason: "time-up" });
    handleNextTurn(roomId);
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
    guessedCurrentWord: [],
    word: null,
    wordChoices: null,
    messages: [],
    drawingData: [],
    pickDeadline: null,
    roundDeadline: null,
  });

  const room = rooms.get(roomId);
  socket.join(roomId);
  socket.emit("room created", roomId);
  room.players.push(socket.id);
  room.toBePlayed.push(socket.id);
  io.to(roomId).emit("msg", `room ${room.name} created id: ${roomId}`);
  io.to(roomId).emit("room sent", serializeRoom(room));
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
    socket.emit("room sent", serializeRoom(room));
    return;
  }

  socket.emit("msg", `welcome to the ${roomId}`);
  console.log(`${socket.id} joined ${room.name} ${roomId}`);
  socket.join(roomId);
  socket.emit("room joined", roomId);
  room.players.push(socket.id);
  room.toBePlayed.push(socket.id);
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
    if (socket.id === room.currentDrawerId) {
      return;
    }

    if (room.guessedCurrentWord.includes(socket.id)) {
      return;
    }

    io.to(roomId).emit("correct answer", { id: socket.id });
    const guessMsg = { id: "system", text: `${socket.id} guessed the word!` };
    room.guessedCurrentWord.push(socket.id);
    room.messages.push(guessMsg);
    io.to(roomId).emit("new message", guessMsg);
    maybeAdvanceIfAllGuessed(roomId);

    return;
  }

  const closeWord = checkClose(room.word, msg);
  if (closeWord) {
    socket.emit("close answer", { word: closeWord });
    return;
  }

  const newMessage = { id: socket.id, text: msg };
  room.messages.push(newMessage);
  io.to(roomId).emit("new message", newMessage);
}

function maybeAdvanceIfAllGuessed(roomId) {
  const room = rooms.get(roomId);
  if (!room || !room.currentDrawerId || !room.word) {
    return;
  }

  const guessersNeeded = room.players.filter(
    (playerId) => playerId !== room.currentDrawerId,
  );
  const allGuessed =
    guessersNeeded.length > 0 &&
    guessersNeeded.every((playerId) =>
      room.guessedCurrentWord.includes(playerId),
    );

  if (!allGuessed) {
    return;
  }

  io.to(roomId).emit("round ended", { reason: "all-guessed" });
  handleNextTurn(roomId);
}

function handleRoomData(socket, roomId) {
  const room = rooms.get(roomId);
  if (!room) {
    socket.emit("error msg", "Room does not exist");
    return;
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

  if (
    room.currentDrawerId &&
    room.players.includes(room.currentDrawerId) &&
    !room.alreadyPlayed.includes(room.currentDrawerId)
  ) {
    room.alreadyPlayed.push(room.currentDrawerId);
  }

  if (room.toBePlayed.length === 0) {
    // readd alreadyplayed to tobeplayed
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
  io.to(currentDrawer).emit("choose a word", random3);
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

  if (room.currentDrawerId !== socket.id) {
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
  socket.on("word chosen", (roomId, chosenWord) => {
    handleWordChosen(socket, roomId, chosenWord);
  });
  socket.on("disconnect", (reason) => {
    console.log(`${socket.id} disconnected: ${reason}`);
    rooms.forEach((room, roomId) => {
      const wasCurrentDrawer = room.currentDrawerId === socket.id;
      room.players = room.players.filter((pid) => pid !== socket.id);
      room.toBePlayed = room.toBePlayed.filter((pid) => pid !== socket.id);
      room.alreadyPlayed = room.alreadyPlayed.filter(
        (pid) => pid !== socket.id,
      );
      room.guessedCurrentWord = room.guessedCurrentWord.filter(
        (pid) => pid !== socket.id,
      );

      if (room.players.length === 0) {
        clearRoomTimers(roomId);
        rooms.delete(roomId);
        console.log(`room ${roomId} deleted (empty)`);
        return;
      }

      if (wasCurrentDrawer) {
        clearRoomTimers(roomId);
        room.word = null;
        room.wordChoices = null;
        room.currentDrawerId = null;
        if (room.started && room.players.length >= 2) {
          handleNextTurn(roomId);
        }
      } else {
        maybeAdvanceIfAllGuessed(roomId);
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
