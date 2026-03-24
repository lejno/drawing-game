import { useParams } from "react-router-dom";
import ChatBox from "./ChatBox";

export default function Room() {
  const { roomId } = useParams();

  return (
    <div>
      <h1>Room: {roomId}</h1>
      <ChatBox roomId={roomId}></ChatBox>
    </div>
  );
}
