import { useParams } from "react-router-dom";
import ChatBox from "./ChatBox";
import socket, { reqRoomData, startGame, nextTurn } from "./client";
import { useEffect, useRef, useState } from "react";

export default function Room() {
  const { roomId } = useParams();
  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [players, setPlayers] = useState([]);
  const [currentDrawerId, setCurrentDrawerId] = useState(null);
  const [adminId, setAdminId] = useState(null);
  const [gameStarted, setGameStarted] = useState(false);
  const renderCountRef = useRef(0);
  const prevRenderStateRef = useRef({ roomId: undefined, room: undefined });

  useEffect(() => {
    renderCountRef.current += 1;
    const prev = prevRenderStateRef.current;
    const reason = [];

    if (prev.roomId !== roomId) reason.push("roomId changed");
    if (prev.room !== room) reason.push("room changed");

    console.log(
      `[Room render #${renderCountRef.current}] ${
        reason.length ? reason.join(", ") : "parent re-render"
      }`,
    );

    prevRenderStateRef.current = { roomId, room };
  });

  useEffect(() => {
    function onRoomSent(nextRoom) {
      setRoom(nextRoom);
      setMessages(nextRoom.messages ?? []);
      setPlayers(nextRoom.players ?? []);
      setCurrentDrawerId(nextRoom.currentDrawerId ?? null);
      setAdminId(nextRoom.adminId ?? null);
      setGameStarted(nextRoom.started ?? false);
      console.log("[room sent]", nextRoom);
    }

    function onNewMessage(msg) {
      setMessages((prev) => [...prev, msg]);
    }

    function onDrawerChanged({ drawerId, started }) {
      setCurrentDrawerId(drawerId);
      if (started !== undefined) setGameStarted(started);
    }

    socket.on("room sent", onRoomSent);
    socket.on("new message", onNewMessage);
    socket.on("drawer changed", onDrawerChanged);
    reqRoomData(roomId);

    return () => {
      socket.off("room sent", onRoomSent);
      socket.off("new message", onNewMessage);
      socket.off("drawer changed", onDrawerChanged);
    };
  }, [roomId]);

  function renderPlayers(players) {
    return players.map((player, index) => <li key={index}>{player}</li>);
  }

  return (
    <div>
      <h1>Room: {room?.name}</h1>
      <div className="players-display">
        <h2>Players:</h2>
        <ul>{renderPlayers(players)}</ul>
      </div>

      <div className="chatbox-display">
        <h2>Chat:</h2>
        <ChatBox roomId={roomId} messages={messages} />
      </div>
      {currentDrawerId === socket.id && <p>YOUR TURN</p>}
      {adminId === socket.id && !gameStarted && (
        <button onClick={() => startGame(roomId)}>Start</button>
      )}
      {currentDrawerId === socket.id && (
        <button onClick={() => nextTurn(roomId)}>End Turn</button>
      )}
    </div>
  );
}
