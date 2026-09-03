import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./Home";
import Room from "./Room";
import BrowseRooms from "./BrowseRooms";
import CreateRoomPage from "./CreateRoomPage";
import RegisterForm from "./RegisterForm";
import LoginForm from "./LoginForm";
import { AuthProvider } from "./AuthContext";
import Header from "./Header";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Header />

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/register" element={<RegisterForm />} />
          <Route path="/login" element={<LoginForm />}></Route>
          <Route path="/create-room" element={<CreateRoomPage />} />
          <Route path="/room/:roomId" element={<Room />} />
          <Route path="/rooms/" element={<BrowseRooms />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
);
