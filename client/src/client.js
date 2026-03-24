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

socket.on("room created", (roomId) => {
  window.location.href = `/room/${roomId}`;
});

socket.on("room joined", (roomId) => {
  window.location.href = `/room/${roomId}`;
});

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
