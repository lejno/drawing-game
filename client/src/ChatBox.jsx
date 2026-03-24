import { useRef } from "react";
import { reqSendMessage } from "./client";
// import socket from "./client";

export default function ChatBox({ roomId }) {
  //   const [messages, setMessages] = useState([]);
  const inputRef = useRef();

  //   useEffect(() => {
  //     const handleChatMessage = (msg) => {
  //       setMessages((prev) => [...prev, msg]);
  //     };

  //     socket.on("chat message", handleChatMessage);

  //     return () => socket.off("chat message", handleChatMessage);
  //   }, []);

  function handleSubmit(e) {
    e.preventDefault();
    reqSendMessage(inputRef.current.value, roomId);
    inputRef.current.value = ""; // clear input
  }

  //   function renderMessages(messages) {
  //     return messages.map((msg, index) => <li key={index}>{msg.text}</li>);
  //   }

  return (
    <div className="chat-box-wrapper">
      <div className="messages-display">
        <ul></ul>
      </div>
      <form onSubmit={handleSubmit}>
        <input type="text" className="chat-input" ref={inputRef} />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
