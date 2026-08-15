/**
 * "Mark verified" — a local acknowledgement that a drift is known and accepted.
 * Spec §1.5, AC-9. Local-only by DECISIONS D6: this file never leaves the machine.
 *
 * It is keyed by `claimHash`, which is built from the claim's own text and the
 * verified frontier (lib/reconcile/checks.ts). So an acknowledgement expires by
 * construction the moment either side of the comparison moves — there is no
 * expiry logic to get wrong, and no way to silence a drift that has since
 * changed into a different drift.
 *
 * This is the one piece of state the dashboard stores, and it is deliberately
 * not a status: it records that *you looked*, never what is true. Storing a
 * status here would be the second source of truth D11 forbids.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export interface Acknowledgement {
  atISO: string;
  project: string;
  checkId: string;
  /** The claim as it read when acknowledged — so a stale key is still legible. */
  claim: string;
}

type Store = Record<string, Acknowledgement>;

/** Resolved per call so tests can point it at a temp directory. `data/` is gitignored. */
function storePath(): string {
  return process.env.AGENTIC_OS_DATA_DIR
    ? join(process.env.AGENTIC_OS_DATA_DIR, "verified.json")
    : join(process.cwd(), "data", "verified.json");
}

export function readAcknowledgements(): Store {
  const path = storePath();
  if (!existsSync(path)) return {};
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return parsed && typeof parsed === "object" ? (parsed as Store) : {};
  } catch {
    // A corrupt store must not blank the Board. Losing acknowledgements shows
    // more drift than there is, which fails safe; throwing would show none.
    return {};
  }
}

function write(store: Store): void {
  const path = storePath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(store, null, 2) + "\n", "utf8");
}

export function acknowledge(claimHash: string, ack: Acknowledgement): void {
  const store = readAcknowledgements();
  store[claimHash] = ack;
  write(store);
}

export function unacknowledge(claimHash: string): void {
  const store = readAcknowledgements();
  delete store[claimHash];
  write(store);
}
