export default function PlayerCard({ player, pfp }) {
  return (
    <li className={player.connected ? "player-card" : "player-card-dc"}>
      <img className="player-card-img" src={pfp} alt="" />
      <div className="player-name">
        {player.name}
        {!player.connected && " (Disconnected)"}
      </div>
      <div className="player-score">{player.score}</div>
    </li>
  );
}
