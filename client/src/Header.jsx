import { Link } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function Header() {
  const { isLoggedIn, logout } = useAuth();

  return (
    <header>
      <Link to="/">Drawing Game</Link>

      {isLoggedIn ? (
        <button onClick={logout}>Log out</button>
      ) : (
        <>
          <Link to="/login">Log in</Link>
          <Link to="/register">Register</Link>
        </>
      )}
    </header>
  );
}
