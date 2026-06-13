import { useEffect, useRef, useState } from "react";
import { reqCreateRoom, reqJoinRoom } from "./client";
import socket from "./client";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const createNameRef = useRef();
  const joinIdRef = useRef();
  const navigate = useNavigate();
  const joinNameRef = useRef();

  // to implement
  // on draw => send arrays of pixels?
  // erase => no idea
  // on player joined??
  // declare end of turn
  // on end of turn => generate new word, distribute points
  function openBrowser() {
    navigate("/rooms");
  }

  function randomName() {
    return (
      "Player" +
      Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, "0")
    ).slice(0, 10);
  }

  const [defaultPlayerName] = useState(() => randomName());

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

  function submitError(inputRef, errorMsg) {
    const input = inputRef.current;
    if (!input) return;

    if (!input.dataset.originalPlaceholder) {
      input.dataset.originalPlaceholder = input.placeholder || "";
    }

    input.value = "";
    input.placeholder = errorMsg;
    input.classList.add("input-error");
    input.focus();

    input.addEventListener(
      "input",
      () => {
        input.classList.remove("input-error");
        input.placeholder = input.dataset.originalPlaceholder || "";
      },
      { once: true },
    );
  }

  function handleCreate(e) {
    if (!createNameRef.current.value) {
      createNameRef.current.value = "Room " + Math.floor(Math.random() * 1000);
    }
    e.preventDefault();
    const token = localStorage.getItem("playerToken");
    reqCreateRoom(
      createNameRef.current.value,
      joinNameRef.current?.value,
      token || undefined,
    );
  }

  function handleJoin(e) {
    e.preventDefault();

    const token = localStorage.getItem("playerToken");

    if (!joinIdRef.current.value.trim()) {
      submitError(joinIdRef, "Room ID is required");
      return;
    }

    if (!joinNameRef.current.value.trim()) {
      joinNameRef.current.value = defaultPlayerName;
    }

    reqJoinRoom(
      joinIdRef.current.value,
      joinNameRef.current?.value,
      token || undefined,
    );
  }

  return (
    <div className="main">
      <div className="join-create-room-wrapper">
        {" "}
        <div className="playerPanel">
          <input
            type="text"
            defaultValue={defaultPlayerName}
            ref={joinNameRef}
          />
        </div>
        <form onSubmit={handleCreate}>
          <input id="room-name" ref={createNameRef} placeholder="Room Name" />
          <button type="submit">Create Room</button>
        </form>
        <form onSubmit={handleJoin}>
          <input
            id="room-id"
            ref={joinIdRef}
            type="text"
            placeholder="Room ID"
          />
          <button type="submit">Join Room</button>
          <button type="button" onClick={() => openBrowser()}>
            Browse Rooms
          </button>
        </form>
      </div>
    </div>
  );
}
