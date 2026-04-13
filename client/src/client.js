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

export function nextTurn(roomId) {
  socket.emit("next turn", roomId);
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

export function reqRoomData(roomId) {
  socket.emit("request room data", roomId);
}

export function reqSendMessage(msg, roomId) {
  socket.emit("send message", msg, roomId);
  console.log(`${msg} ${socket.id}`);
}
export function reqJoinRoom(roomId) {
  socket.emit("join room", roomId);
}
export function reqCreateRoom(name) {
  socket.emit("create room", name);
}

export default socket;
