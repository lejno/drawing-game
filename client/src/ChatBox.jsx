import { useRef } from "react";
import { reqSendMessage } from "./client";
// import socket from "./client";

export default function ChatBox({ roomId, messages }) {
  //   const [messages, setMessages] = useState([]);
  const inputRef = useRef();

  function handleSubmit(e) {
    e.preventDefault();
    reqSendMessage(inputRef.current.value, roomId);
    inputRef.current.value = "";
  }

  function renderMessages(messages) {
    return messages.map((msg, index) => (
      <li key={index}>
        {msg.id}: {msg.text}
      </li>
    ));
  }

  return (
    <div className="chat-box-wrapper">
      <div className="messages-display">
        <ul>{renderMessages(messages)}</ul>
      </div>
      <form onSubmit={handleSubmit}>
        <input type="text" className="chat-input" ref={inputRef} />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
