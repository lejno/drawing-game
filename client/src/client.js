import { io } from "socket.io-client";

const socket = io();

socket.on("connect", () => {
  console.log("connected to socket server:", socket.id);
});

socket.on("connect_error", (err) => {
  console.error("socket connection error:", err.message);
});

socket.on("msg", (message) => {
  console.log(message);
});

socket.on("error msg", (message) => {
  console.log(`ERROR: ${message}`);
});

socket.on("store token", (token) => {
  localStorage.setItem("roomSessionToken", token);
});

// socket.on("check cookie", () => {
//   const token = localStorage.getItem("playerToken");
//   socket.emit("cookie sent", token);
// });

export function reqRoomsList(roomId) {
  socket.emit("request rooms list", roomId);
}

export function nextTurn(roomId) {
  socket.emit("next turn", roomId);
}

export function reqChooseWord(roomId, chosenWord) {
  socket.emit("word chosen", roomId, chosenWord);
}

export function startGame(roomId) {
  socket.emit("start game", roomId);
}

export function reqDrawStroke(stroke, roomId) {
  socket.emit("draw stroke", stroke, roomId);
}

export function reqClearDrawing(roomId) {
  socket.emit("clear drawing", roomId);
}

export function reqUndoStroke(roomId) {
  socket.emit("undo stroke", roomId);
}

export function reqRoomData(roomId, token) {
  socket.emit("request room data", roomId, token);
}

export function reqSendMessage(msg, roomId) {
  socket.emit("send message", msg, roomId);
  console.log(`${msg} ${socket.id}`);
}
export function reqJoinRoom(roomId, playerName, token) {
  socket.emit("join room", roomId, playerName, token);
}
export function reqCreateRoom(name, playerName, token, settings) {
  socket.emit("create room", name, playerName, token, settings);
}

export default socket;
