import { useEffect, useRef } from "react";
import { reqCreateRoom, reqJoinRoom } from "./client";
import socket from "./client";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const createNameRef = useRef();
  const joinIdRef = useRef();
  const navigate = useNavigate();

  // to implement
  // on draw => send arrays of pixels?
  // erase => no idea
  // on player joined??
  // declare end of turn
  // on end of turn => generate new word, distribute points

  useEffect(() => {
    function handleRoomNavigate(roomId) {
      navigate(`/room/${roomId}`);
    }

    socket.on("room created", handleRoomNavigate);
    socket.on("room joined", handleRoomNavigate);

    return () => {
      socket.off("room created", handleRoomNavigate);
      socket.off("room joined", handleRoomNavigate);
    };
  }, [navigate]);

  function handleCreate(e) {
    e.preventDefault();
    reqCreateRoom(createNameRef.current.value);
  }

  function handleJoin(e) {
    e.preventDefault();
    reqJoinRoom(joinIdRef.current.value);
  }

  return (
    <div>
      <form onSubmit={handleCreate}>
        <label htmlFor="room-name">Room Name</label>
        <input id="room-name" ref={createNameRef} type="text" />
        <button type="submit">Create Room</button>
      </form>

      <form onSubmit={handleJoin}>
        <label htmlFor="room-id">Room ID</label>
        <input id="room-id" ref={joinIdRef} type="text" />
        <button type="submit">Join Room</button>
      </form>
    </div>
  );
}
