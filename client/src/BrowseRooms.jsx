import { useEffect, useState } from "react";
import socket from "./client";

export default function BrowseRooms() {
  const [rooms, setRooms] = useState([]);
  useEffect(() => {
    socket.on("rooms list", (roomsList) => {
      setRooms(roomsList);
    });

    // Request the rooms list when the component mounts
    socket.emit("request rooms list");
  }, []);
  return (
    <div className="main">
      <h1>Available Rooms</h1>
      <ul>
        {rooms.map((room) => (
          <li key={room.id}>
            {room.name} ({room.playerCount} players)
          </li>
        ))}
      </ul>
    </div>
  );
}
