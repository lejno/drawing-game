import { useParams } from "react-router-dom";
import ChatBox from "./ChatBox";
import socket, { reqRoomData } from "./client";
import { useEffect, useRef, useState } from "react";
import Canvas from "./Canvas";

// to implement
// on draw => send arrays of pixels?
// erase => no idea
// on player joined??
// declare end of turn
// on end of turn => generate new word, distribute points

export default function Room() {
  const { roomId } = useParams();
  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [drawingData, setDrawingData] = useState([]);
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
      setDrawingData(nextRoom.drawingData ?? []);
      console.log("[room sent]", nextRoom);
    }

    function onNewMessage(msg) {
      setMessages((prev) => [...prev, msg]);
    }

    function onDrawStroke(stroke) {
      setDrawingData((prev) => [...prev, stroke]);
    }

    function onDrawingCleared() {
      setDrawingData([]);
    }

    function onStrokeUndone(payload) {
      if (payload?.strokeId) {
        setDrawingData((prev) =>
          prev.filter((stroke) => stroke.strokeId !== payload.strokeId),
        );
        return;
      }

      setDrawingData((prev) => prev.slice(0, -1));
    }

    socket.on("room sent", onRoomSent);
    socket.on("new message", onNewMessage);
    socket.on("draw stroke", onDrawStroke);
    socket.on("drawing cleared", onDrawingCleared);
    socket.on("stroke undone", onStrokeUndone);
    reqRoomData(roomId);

    return () => {
      socket.off("room sent", onRoomSent);
      socket.off("new message", onNewMessage);
      socket.off("draw stroke", onDrawStroke);
      socket.off("drawing cleared", onDrawingCleared);
      socket.off("stroke undone", onStrokeUndone);
    };
  }, [roomId]);

  return (
    <div>
      <h1>Room: {room?.name}</h1>
      <Canvas roomId={roomId} drawingData={drawingData} />
      <ChatBox roomId={roomId} messages={messages}></ChatBox>
    </div>
  );
}
