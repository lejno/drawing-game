import { useParams } from "react-router-dom";
import ChatBox from "./ChatBox";
import socket, { reqRoomData } from "./client";
import { useEffect, useRef, useState } from "react";

export default function Room() {
  const { roomId } = useParams();
  const [room, setRoom] = useState(null);
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
      console.log("[room sent]", nextRoom);
    }

    socket.on("room sent", onRoomSent);
    reqRoomData(roomId);

    return () => {
      socket.off("room sent", onRoomSent);
    };
  }, [roomId]);

  return (
    <div>
      <h1>Room: {room?.name}</h1>
      <ChatBox roomId={roomId} messages={room?.messages ?? []}></ChatBox>
    </div>
  );
}
