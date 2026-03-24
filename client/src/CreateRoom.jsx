import { reqCreateRoom } from "./client";
import { useRef } from "react";

export default function CreateRoomForm() {
  const nameRef = useRef();

  function handleSubmit(e) {
    e.preventDefault();
    reqCreateRoom(nameRef.current.value);
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="room-name">Room Name</label>
      <input
        id="room-name"
        className="room-name"
        type="text"
        name="room-name"
        ref={nameRef}
      />
      <button type="submit" className="create-room-submit">
        Create Room
      </button>
    </form>
  );
}
