import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./Home";
import Room from "./Room";
import BrowseRooms from "./BrowseRooms";
import CreateRoomPage from "./CreateRoomPage";
import RegisterForm from "./RegisterForm";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/register" element={<RegisterForm />} />
        <Route path="/create-room" element={<CreateRoomPage />} />
        <Route path="/room/:roomId" element={<Room />} />
        <Route path="/rooms/" element={<BrowseRooms />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
