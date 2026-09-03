import { useEffect, useState } from "react";
import socket from "./client";
import { useNavigate } from "react-router-dom";
import { reqJoinRoom } from "./client";

function randomName() {
  return (
    "Player" +
    Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0")
  ).slice(0, 10);
}

export default function BrowseRooms() {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);

  useEffect(() => {
    socket.on("rooms list", (roomsList) => {
      setRooms(roomsList);
    });

    socket.emit("request rooms list");
  }, []);
  useEffect(() => {
    function handleRoomNavigate(roomId) {
      navigate(`/room/${roomId}`);
    }

    socket.on("room joined", handleRoomNavigate);

    return () => {
      socket.off("room joined", handleRoomNavigate);
    };
  }, [navigate]);

  function handleJoin(e, roomId) {
    e.preventDefault();
    const token = localStorage.getItem("roomSessionToken") || undefined;
    reqJoinRoom(roomId, randomName(), token);
  }
  return (
    <div className="main rooms-main">
      <div className="rooms-browse-grid">
        <h1 className="rooms-list-h1">Available Rooms</h1>
        <div className="rooms-list-wrapper">
          <ul>
            {rooms.map((room) => (
              <li key={room.id}>
                {room.name} ({room.playerCount} players)
                <button onClick={(e) => handleJoin(e, room.id)}>
                  Join Room
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
