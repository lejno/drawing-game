import { useEffect, useRef, useState } from "react";
import socket from "./client";
import { useNavigate } from "react-router-dom";
import { reqCreateRoom } from "./client";
import { useAuth } from "./authContext";

const DEFAULT_ROOM_SETTINGS = {
  maxPlayers: 8,
  timeLimit: 60,
  maxRounds: 3,
};

export default function CreateRoomPage() {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const roomNameRef = useRef();
  const playerNameRef = useRef();
  const roomSettings = useRef({ ...DEFAULT_ROOM_SETTINGS });

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

    return () => {
      socket.off("room created", handleRoomNavigate);
    };
  }, [navigate]);

  function handleSubmit(e) {
    e.preventDefault();
    const roomName = roomNameRef.current.value.trim();
    const playerName = isLoggedIn ? null : playerNameRef.current.value.trim();

    if (!roomName) {
      submitError(roomNameRef, "Room name cannot be empty");
      return;
    }

    if (!isLoggedIn && !playerName) {
      submitError(playerNameRef, "Player name cannot be empty");
      return;
    }

    reqCreateRoom(roomName, playerName, roomSettings.current);
  }

  return (
    <div className="main">
      <div className="create-room-page">
        <h1>Create Room</h1>
        <form onSubmit={handleSubmit}>
          <div className="input-row">
            <input
              id="maxPlayers"
              ref={roomNameRef}
              type="text"
              placeholder="Room Name"
              maxLength={20}
            />
          </div>
          {!isLoggedIn && (
            <input
              ref={playerNameRef}
              type="text"
              placeholder="Player Name"
              defaultValue={defaultPlayerName}
              maxLength={20}
            />
          )}
          <div className="input-row">
            <label htmlFor="maxPlayers">Max Players</label>
            <input
              id="maxPlayers"
              type="number"
              placeholder="Max Players"
              min={2}
              max={20}
              defaultValue={DEFAULT_ROOM_SETTINGS.maxPlayers}
              onChange={(e) => {
                const value = parseInt(e.target.value, 10);
                if (!isNaN(value)) {
                  roomSettings.current.maxPlayers = value;
                }
              }}
            />
          </div>
          <div className="input-row">
            <label htmlFor="timeLimit">Round Time Limit</label>
            <input
              id="timeLimit"
              type="number"
              placeholder="Time Limit (seconds)"
              min={10}
              max={300}
              defaultValue={DEFAULT_ROOM_SETTINGS.timeLimit}
              onChange={(e) => {
                const value = parseInt(e.target.value, 10);
                if (!isNaN(value)) {
                  roomSettings.current.timeLimit = value;
                }
              }}
            />
          </div>

          <div className="input-row">
            <label htmlFor="maxRounds">Number of Rounds</label>
            <input
              id="maxRounds"
              type="number"
              placeholder="Max Rounds"
              min={1}
              max={10}
              defaultValue={DEFAULT_ROOM_SETTINGS.maxRounds}
              onChange={(e) => {
                const value = parseInt(e.target.value, 10);
                if (!isNaN(value)) {
                  roomSettings.current.maxRounds = value;
                }
              }}
            />
          </div>
          <button type="submit">Create Room</button>
        </form>
      </div>
    </div>
  );
}
