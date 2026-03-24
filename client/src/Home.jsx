import { useEffect, useRef } from "react";
import { reqCreateRoom, reqJoinRoom } from "./client";

export default function Home() {
  const createNameRef = useRef();
  const joinIdRef = useRef();

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
