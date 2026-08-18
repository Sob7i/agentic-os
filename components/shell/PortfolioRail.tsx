import Link from "next/link";
import s from "./shell.module.css";

/**
 * The portfolio home rail (frame B′1).
 *
 * The project list is deliberately *not* here: in B′ entering a project replaces
 * this rail entirely, which is the mode switch D23 chose. Projects are entered
 * from the pane, and once inside, the ribbon carries them.
 */
export function PortfolioRail({ current }: { current: "board" | "overview" }) {
  return (
    <aside className={s.homeRail}>
      <p className={s.brand}>Agentic OS</p>
      <ul className={s.railTabs}>
        <li className={s.railTab}>
          <Link href="/" data-current={current === "board"}>Board</Link>
        </li>
        <li className={s.railTab}>
          <Link href="/overview" data-current={current === "overview"}>Overview</Link>
        </li>
      </ul>
      <p className={s.railNote}>
        Inbox arrives with the execution layer. There is nothing to be blocked on yet.
      </p>
    </aside>
  );
}
