import { signOut } from "@/app/actions";
import { currentPlayer } from "@/lib/auth";
import { formatCode } from "@/lib/sync-code";
import CopyButton from "./CopyButton";

/** Signed-in name in the header. Opening it shows your own sync code; it is only ever rendered for its owner. */
export default async function PlayerChip() {
  const player = await currentPlayer();
  if (!player) return null;
  return (
    <details className="player-chip">
      <summary>{player.name}</summary>
      <div className="chip-pop">
        <div className="muted">Your sync code</div>
        <div className="code-mid">{formatCode(player.code)}</div>
        <CopyButton text={formatCode(player.code)} className="linkish" />
        <p>Enter it on another device to add scores from there. Keep it to yourself.</p>
        <form action={signOut}>
          <button type="submit" className="linkish">
            Sign out on this device
          </button>
        </form>
      </div>
    </details>
  );
}
