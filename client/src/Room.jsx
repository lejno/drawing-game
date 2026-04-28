import { useParams } from "react-router-dom";
import ChatBox from "./ChatBox";
import socket, {
  reqRoomData,
  startGame,
  nextTurn,
  reqChooseWord,
} from "./client";
import { useEffect, useRef, useState } from "react";

export default function Room() {
  const { roomId } = useParams();
  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [players, setPlayers] = useState([]);
  const [currentDrawerId, setCurrentDrawerId] = useState(null);
  const [adminId, setAdminId] = useState(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [wordChoices, setWordChoices] = useState([]);
  const [hasChosenWord, setHasChosenWord] = useState(false);
  const [pickEndsAt, setPickEndsAt] = useState(null);
  const [roundEndsAt, setRoundEndsAt] = useState(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const renderCountRef = useRef(0);
  const prevRenderStateRef = useRef({ roomId: undefined, room: undefined });

  useEffect(() => {
    if (!pickEndsAt && !roundEndsAt) {
      return;
    }

    const intervalId = setInterval(() => {
      setNowMs(Date.now());
    }, 250);

    return () => clearInterval(intervalId);
  }, [pickEndsAt, roundEndsAt]);

  const pickSecondsLeft = pickEndsAt
    ? Math.max(0, Math.ceil((pickEndsAt - nowMs) / 1000))
    : 0;
  const roundSecondsLeft = roundEndsAt
    ? Math.max(0, Math.ceil((roundEndsAt - nowMs) / 1000))
    : 0;

  useEffect(() => {
    renderCountRef.current += 1;
    const prev = prevRenderStateRef.current;
    const reason = [];

    if (prev.roomId !== roomId) reason.push("roomId changed");
    if (prev.room !== room) reason.push("room changed");

    console.log(
      `[Room render #${renderCountRef.current}] ${
        reason.length ? reason.join(", ") : "parent re-render"
      }`,
    );

    prevRenderStateRef.current = { roomId, room };
  });

  useEffect(() => {
    function onRoomSent(nextRoom) {
      setRoom(nextRoom);
      setMessages(nextRoom.messages ?? []);
      setPlayers(nextRoom.players ?? []);
      setCurrentDrawerId(nextRoom.currentDrawerId ?? null);
      setAdminId(nextRoom.adminId ?? null);
      setGameStarted(nextRoom.started ?? false);
      setWordChoices(nextRoom.wordChoices ?? []);
      setHasChosenWord(Boolean(nextRoom.word));
      setPickEndsAt(nextRoom.pickDeadline ?? null);
      setRoundEndsAt(nextRoom.roundDeadline ?? null);
      console.log("[room sent]", nextRoom);
    }

    function onNewMessage(msg) {
      setMessages((prev) => [...prev, msg]);
    }

    function onDrawerChanged({ drawerId, started }) {
      setCurrentDrawerId(drawerId);
      if (started !== undefined) setGameStarted(started);
      setWordChoices([]);
      setHasChosenWord(false);
      setPickEndsAt(null);
      setRoundEndsAt(null);
    }

    function onChooseWord(words) {
      if (Array.isArray(words)) {
        setWordChoices(words);
        setHasChosenWord(false);
      }
    }

    function onWordSelected() {
      setWordChoices([]);
      setHasChosenWord(true);
    }

    function onPickTimerStarted({ endsAt }) {
      setPickEndsAt(endsAt ?? null);
    }

    function onRoundTimerStarted({ endsAt }) {
      setRoundEndsAt(endsAt ?? null);
    }

    function onRoundEnded() {
      setRoundEndsAt(null);
      setHasChosenWord(false);
    }

    function onWordAutoSelected() {
      setWordChoices([]);
      setHasChosenWord(true);
    }

    socket.on("room sent", onRoomSent);
    socket.on("new message", onNewMessage);
    socket.on("drawer changed", onDrawerChanged);
    socket.on("choose a word", onChooseWord);
    socket.on("word selected", onWordSelected);
    socket.on("pick timer started", onPickTimerStarted);
    socket.on("round timer started", onRoundTimerStarted);
    socket.on("round ended", onRoundEnded);
    socket.on("word auto selected", onWordAutoSelected);
    reqRoomData(roomId);

    return () => {
      socket.off("room sent", onRoomSent);
      socket.off("new message", onNewMessage);
      socket.off("drawer changed", onDrawerChanged);
      socket.off("choose a word", onChooseWord);
      socket.off("word selected", onWordSelected);
      socket.off("pick timer started", onPickTimerStarted);
      socket.off("round timer started", onRoundTimerStarted);
      socket.off("round ended", onRoundEnded);
      socket.off("word auto selected", onWordAutoSelected);
    };
  }, [roomId]);

  function handleWordChoose(word) {
    reqChooseWord(roomId, word);
    setWordChoices([]);
    setHasChosenWord(true);
  }

  function renderPlayers(players) {
    return players.map((player, index) => <li key={index}>{player}</li>);
  }

  return (
    <div>
      <h1>Room: {room?.name}</h1>
      <div className="players-display">
        <h2>Players:</h2>
        <ul>{renderPlayers(players)}</ul>
      </div>

      <div className="chatbox-display">
        <h2>Chat:</h2>
        <ChatBox roomId={roomId} messages={messages} />
      </div>
      {currentDrawerId === socket.id && <p>YOUR TURN</p>}
      {adminId === socket.id && !gameStarted && (
        <button onClick={() => startGame(roomId)}>Start</button>
      )}
      {currentDrawerId === socket.id && wordChoices.length > 0 && (
        <div>
          <p>Choose a word:</p>
          <p>Time left: {pickSecondsLeft}s</p>
          {wordChoices.map((word) => (
            <button key={word} onClick={() => handleWordChoose(word)}>
              {word}
            </button>
          ))}
        </div>
      )}
      {currentDrawerId === socket.id && hasChosenWord && (
        <p>Word selected. Start drawing!</p>
      )}
      {roundSecondsLeft > 0 && <p>Round time left: {roundSecondsLeft}s</p>}
      {currentDrawerId === socket.id && (
        <button onClick={() => nextTurn(roomId)}>End Turn</button>
      )}
    </div>
  );
}
