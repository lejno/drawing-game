import { useEffect, useState } from "react";

export default function BrowseRooms() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    console.log("BrowseRooms mounted, fetching rooms...");

    fetch("/api/rooms")
      .then((res) => res.json())
      .then((data) => {
        console.log("Rooms fetched:", data);
        setRooms(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching rooms:", err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading)
    return (
      <div className="main">
        <p>Loading rooms...</p>
      </div>
    );
  if (error)
    return (
      <div className="main">
        <p>Error: {error}</p>
      </div>
    );

  return (
    <div className="main">
      <h1>Browse Rooms</h1>
      <ul>
        {rooms.map((room) => (
          <li key={room.id}>
            {room.name} - {room.players} players
          </li>
        ))}
      </ul>
    </div>
  );
}
