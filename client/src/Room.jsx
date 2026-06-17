import { useParams } from "react-router-dom";
import ChatBox from "./ChatBox";
import socket, {
  reqRoomData,
  reqJoinRoom,
  startGame,
  nextTurn,
  reqChooseWord,
} from "./client";
import { useEffect, useRef, useState } from "react";
import Canvas from "./Canvas";
import PlayerCard from "./PlayerCard";
import pfp from "./assets/pfp.webp";

export default function Room() {
  const { roomId } = useParams();
  const [clientPlayerId, setClientPlayerId] = useState(() =>
    localStorage.getItem("playerToken"),
  );
  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [drawingData, setDrawingData] = useState([]);
  const [players, setPlayers] = useState([]);
  const [currentDrawerId, setCurrentDrawerId] = useState(null);
  const [adminId, setAdminId] = useState(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [wordChoices, setWordChoices] = useState([]);
  const [hasChosenWord, setHasChosenWord] = useState(false);
  const [pickEndsAt, setPickEndsAt] = useState(null);
  const [currentWord, setCurrentWord] = useState(null);
  const [roundEndsAt, setRoundEndsAt] = useState(null);
  const [intermissionEndsAt, setIntermissionEndsAt] = useState(null);
  const [intermissionNextDrawerId, setIntermissionNextDrawerId] =
    useState(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [errorMsg, setErrorMsg] = useState("");
  const [pendingName, setPendingName] = useState("");
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const renderCountRef = useRef(0);
  const prevRenderStateRef = useRef({ roomId: undefined, room: undefined });

  useEffect(() => {
    if (!pickEndsAt && !roundEndsAt && !intermissionEndsAt) {
      return;
    }

    const intervalId = setInterval(() => {
      setNowMs(Date.now());
    }, 250);

    return () => clearInterval(intervalId);
  }, [pickEndsAt, roundEndsAt, intermissionEndsAt]);

  const pickSecondsLeft = pickEndsAt
    ? Math.max(0, Math.ceil((pickEndsAt - nowMs) / 1000))
    : 0;
  const roundSecondsLeft = roundEndsAt
    ? Math.max(0, Math.ceil((roundEndsAt - nowMs) / 1000))
    : 0;
  const intermissionSecondsLeft = intermissionEndsAt
    ? Math.max(0, Math.ceil((intermissionEndsAt - nowMs) / 1000))
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
    function onStoreToken(token) {
      setClientPlayerId(token);
    }

    socket.on("store token", onStoreToken);

    return () => {
      socket.off("store token", onStoreToken);
    };
  }, []);

  useEffect(() => {
    function onRoomSent(nextRoom) {
      setRoom(nextRoom);
      setMessages(nextRoom.messages ?? []);
      setDrawingData(nextRoom.drawingData ?? []);
      setPlayers(nextRoom.players ?? []);
      const isInRoom = (nextRoom.players ?? []).some(
        (p) => p.id === clientPlayerId,
      );
      setShowNamePrompt(!isInRoom);
      setCurrentDrawerId(nextRoom.currentDrawerId ?? null);
      setAdminId(nextRoom.adminId ?? null);
      setGameStarted(nextRoom.started ?? false);
      setWordChoices(nextRoom.wordChoices ?? []);
      if (nextRoom.word) {
        setCurrentWord(nextRoom.word);
        setHasChosenWord(true);
      } else {
        setHasChosenWord(false);
      }
      setPickEndsAt(nextRoom.pickDeadline ?? null);
      setRoundEndsAt(nextRoom.roundDeadline ?? null);
      setIntermissionEndsAt(null);
      setIntermissionNextDrawerId(null);
      setErrorMsg("");
      console.log("[room sent]", nextRoom);
    }

    function onNewMessage(msg) {
      setMessages((prev) => [...prev, msg]);
    }

    function onDrawStroke(stroke) {
      setDrawingData((prev) => [...prev, stroke]);
    }

    function onDrawingCleared() {
      setDrawingData([]);
    }

    function onStrokeUndone(payload) {
      if (payload?.strokeId) {
        setDrawingData((prev) =>
          prev.filter((stroke) => stroke.strokeId !== payload.strokeId),
        );
        return;
      }

      setDrawingData((prev) => prev.slice(0, -1));
    }

    function onDrawerChanged({ drawerId, started }) {
      setCurrentDrawerId(drawerId);
      if (started !== undefined) setGameStarted(started);
      setWordChoices([]);
      setHasChosenWord(false);
      setPickEndsAt(null);
      setRoundEndsAt(null);
      setIntermissionEndsAt(null);
      setIntermissionNextDrawerId(null);
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

    function onIntermissionStarted({ endsAt, nextDrawerId }) {
      setIntermissionEndsAt(endsAt ?? null);
      setIntermissionNextDrawerId(nextDrawerId ?? null);
      setRoundEndsAt(null);
      setHasChosenWord(false);
    }

    function onErrorMessage(message) {
      setErrorMsg(message ?? "Something went wrong");
    }

    socket.on("room sent", onRoomSent);
    socket.on("new message", onNewMessage);
    socket.on("draw stroke", onDrawStroke);
    socket.on("drawing cleared", onDrawingCleared);
    socket.on("stroke undone", onStrokeUndone);
    socket.on("drawer changed", onDrawerChanged);
    socket.on("choose a word", onChooseWord);
    socket.on("word selected", onWordSelected);
    socket.on("pick timer started", onPickTimerStarted);
    socket.on("round timer started", onRoundTimerStarted);
    socket.on("round ended", onRoundEnded);
    socket.on("word auto selected", onWordAutoSelected);
    socket.on("intermission started", onIntermissionStarted);
    socket.on("error msg", onErrorMessage);
    reqRoomData(roomId, clientPlayerId || undefined);

    return () => {
      socket.off("room sent", onRoomSent);
      socket.off("new message", onNewMessage);
      socket.off("draw stroke", onDrawStroke);
      socket.off("drawing cleared", onDrawingCleared);
      socket.off("stroke undone", onStrokeUndone);
      socket.off("drawer changed", onDrawerChanged);
      socket.off("choose a word", onChooseWord);
      socket.off("word selected", onWordSelected);
      socket.off("pick timer started", onPickTimerStarted);
      socket.off("round timer started", onRoundTimerStarted);
      socket.off("round ended", onRoundEnded);
      socket.off("word auto selected", onWordAutoSelected);
      socket.off("intermission started", onIntermissionStarted);
      socket.off("error msg", onErrorMessage);
    };
  }, [roomId, clientPlayerId]);

  const intermissionText =
    intermissionSecondsLeft > 0 && intermissionNextDrawerId
      ? `its ${
          players.find((player) => player.id === intermissionNextDrawerId)
            ?.name ?? intermissionNextDrawerId
        } turn next (${intermissionSecondsLeft}s)`
      : "";

  function handleNameSubmit(e) {
    e.preventDefault();
    const name =
      pendingName.trim() ||
      "Player" +
        Math.floor(Math.random() * 1000)
          .toString()
          .padStart(3, "0");
    reqJoinRoom(roomId, name, clientPlayerId || undefined);
    setShowNamePrompt(false);
  }

  function handleWordChoose(word) {
    reqChooseWord(roomId, word);
    setWordChoices([]);
    setHasChosenWord(true);
    setCurrentWord(word);
  }

  function renderPlayers(players) {
    return players.map((player) => (
      <PlayerCard player={player} key={player.id} pfp={pfp} />
    ));
  }

  if (showNamePrompt) {
    return (
      <div className="room-layout">
        <form onSubmit={handleNameSubmit} style={{ margin: "2rem" }}>
          <p>Enter your name to join "{room?.name ?? roomId}":</p>
          <input
            type="text"
            placeholder="Your name"
            value={pendingName}
            onChange={(e) => setPendingName(e.target.value)}
            autoFocus
          />
          <button type="submit">Join</button>
        </form>
      </div>
    );
  }

  return (
    <div className="room-layout">
      <div className="room-info">
        <h1 className="room-name">Room: {room?.name}</h1>
      </div>
      <div className="players-display">
        <h2>Players:</h2>
        <ul>{renderPlayers(players)}</ul>
      </div>

      <div className="canvas-display">
        {currentDrawerId === clientPlayerId && hasChosenWord && (
          <p>Your word: {currentWord}</p>
        )}
        <Canvas
          roomId={roomId}
          drawingData={drawingData}
          canDraw={currentDrawerId === clientPlayerId && hasChosenWord}
          overlayText={intermissionText}
        />
      </div>
      <div className="chatbox-display">
        <h2>Chat:</h2>
        <ChatBox roomId={roomId} messages={messages} />
      </div>
      <div className="room-controls">
        {errorMsg && <p>{errorMsg}</p>}
        {currentDrawerId === clientPlayerId && <p>YOUR TURN</p>}
        {adminId === clientPlayerId && !gameStarted && (
          <button
            onClick={() => startGame(roomId)}
            disabled={players.length < 2}
            title={players.length < 2 ? "Need at least 2 players" : ""}
          >
            Start
          </button>
        )}
        {adminId === clientPlayerId && !gameStarted && players.length < 2 && (
          <p>Need at least 2 players to start.</p>
        )}
        {currentDrawerId === clientPlayerId && wordChoices.length > 0 && (
          <div className="choose-word">
            <p>Choose a word:</p>
            <p>Time left: {pickSecondsLeft}s</p>
            {wordChoices.map((word) => (
              <button key={word} onClick={() => handleWordChoose(word)}>
                {word}
              </button>
            ))}
          </div>
        )}
        {currentDrawerId === clientPlayerId && hasChosenWord && (
          <p>Word selected. Start drawing!</p>
        )}
        {roundSecondsLeft > 0 && <p>Round time left: {roundSecondsLeft}s</p>}
        {currentDrawerId === clientPlayerId && (
          <button onClick={() => nextTurn(roomId)}>End Turn</button>
        )}
      </div>
    </div>
  );
}
