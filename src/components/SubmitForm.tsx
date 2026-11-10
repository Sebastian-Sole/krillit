import { currentPlayer } from "@/lib/auth";
import { listPlayers } from "@/lib/db";
import ScorePanel from "./ScorePanel";

/** The "add your score" card. Signed-out visitors get the who-are-you gate instead. */
export default async function SubmitForm({ dayNumber }: { dayNumber: number }) {
  const player = await currentPlayer();
  const names = player ? [] : (await listPlayers()).map((p) => p.name).sort((a, b) => a.localeCompare(b));
  return <ScorePanel dayNumber={dayNumber} player={player ? { name: player.name } : null} names={names} />;
}
