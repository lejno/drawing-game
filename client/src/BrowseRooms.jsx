import { useEffect, useState } from "react";
import socket from "./client";
import { useNavigate } from "react-router-dom";
import { reqJoinRoom } from "./client";

export default function BrowseRooms() {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  useEffect(() => {
    socket.on("rooms list", (roomsList) => {
      setRooms(roomsList);
    });

    // Request the rooms list when the component mounts
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
    reqJoinRoom(roomId);
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
