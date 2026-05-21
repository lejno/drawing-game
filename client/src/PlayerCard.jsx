export default function PlayerCard({ player, pfp }) {
  return (
    <li className="player-card">
      <img src={pfp} alt="" />
      <div className="player-name">{player.name}</div>
      <div className="player-score">{player.score}</div>
    </li>
  );
}
