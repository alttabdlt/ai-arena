interface FundingReceiptRow {
  id: string;
  txHash: string;
  walletAddress: string;
  arenaAmount: number;
  blockNumber: number | null;
  createdAt: string;
}

interface AgentFundingModalProps {
  open: boolean;
  agentName: string | null;
  bankroll: number | null;
  reserveBalance: number | null;
  tokenAddress: string;
  nadFunUrl: string;
  txHash: string;
  submitting: boolean;
  error: string | null;
  success: string | null;
  receipts: FundingReceiptRow[];
  totals: { creditedArena: number; receiptCount: number } | null;
  historyLoading?: boolean;
  onTxHashChange: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}

function shortHash(hash: string): string {
  if (!hash || hash.length < 14) return hash;
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 'now';
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function AgentFundingModal({
  open,
  agentName,
  bankroll,
  reserveBalance,
  tokenAddress,
  nadFunUrl,
  txHash,
  submitting,
  error,
  success,
  receipts,
  totals,
  historyLoading = false,
  onTxHashChange,
  onSubmit,
  onClose,
}: AgentFundingModalProps) {
  if (!open) return null;

  const lowFuel = (bankroll ?? 0) < 30;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm">
      <div className="w-[560px] max-w-[96vw] rounded-2xl border border-cyan-500/35 bg-slate-950/92 p-4 shadow-2xl shadow-black/50">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-300">Agent Funding</div>
            <div className="mt-1 text-lg font-black text-amber-300">{agentName || 'Selected Agent'}</div>
            <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] font-mono">
              <span className="rounded border border-slate-700/70 bg-slate-900/60 px-1.5 py-0.5 text-slate-200">
                BAL ${Math.round(bankroll || 0)}A
              </span>
              <span className="rounded border border-slate-700/70 bg-slate-900/60 px-1.5 py-0.5 text-slate-300">
                RESERVE {Math.round(reserveBalance || 0)}R
              </span>
              <span
                className={`rounded border px-1.5 py-0.5 ${
                  lowFuel
                    ? 'border-rose-500/60 bg-rose-950/40 text-rose-200'
                    : 'border-emerald-500/60 bg-emerald-950/40 text-emerald-200'
                }`}
              >
                {lowFuel ? 'LOW FUEL' : 'FUEL READY'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-700/70 px-2 py-1 text-xs text-slate-400 hover:border-slate-600 hover:text-slate-200"
          >
            ✕
          </button>
        </div>

        <div className="space-y-2 rounded-xl border border-slate-800/60 bg-slate-900/45 p-3">
          <div className="text-[10px] font-mono text-cyan-200">STEP 1 · BUY $ARENA</div>
          <div className="text-[11px] text-slate-300">
            Buy $ARENA on nad.fun with your connected wallet, then copy the transaction hash.
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.open(nadFunUrl, '_blank', 'noopener,noreferrer')}
              className="rounded-lg border border-amber-500/60 bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-500/28"
            >
              Buy on nad.fun
            </button>
            <span className="truncate text-[10px] font-mono text-slate-500">{tokenAddress}</span>
          </div>
        </div>

        <div className="mt-2 space-y-2 rounded-xl border border-slate-800/60 bg-slate-900/45 p-3">
          <div className="text-[10px] font-mono text-cyan-200">STEP 2 · VERIFY TX HASH</div>
          <input
            type="text"
            value={txHash}
            onChange={(event) => onTxHashChange(event.target.value)}
            placeholder="0x... (Monad tx hash)"
            className="w-full rounded-lg border border-slate-700/70 bg-slate-950/75 px-3 py-2 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/55 focus:outline-none"
          />
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting || !txHash.trim()}
            className="w-full rounded-lg border border-cyan-500/60 bg-cyan-500/20 px-3 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/28 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Verifying & Crediting…' : 'Verify & Credit Agent'}
          </button>
          {error && (
            <div className="rounded-lg border border-rose-500/35 bg-rose-950/35 px-2 py-1 text-[11px] text-rose-200">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-lg border border-emerald-500/35 bg-emerald-950/35 px-2 py-1 text-[11px] text-emerald-200">
              {success}
            </div>
          )}
        </div>

        <div className="mt-2 rounded-xl border border-slate-800/60 bg-slate-900/40 p-3">
          <div className="mb-1 flex items-center justify-between">
            <div className="text-[10px] font-mono text-cyan-200">FUNDING HISTORY</div>
            <div className="text-[10px] font-mono text-slate-400">
              TOTAL +{Math.round(totals?.creditedArena || 0)}A · {totals?.receiptCount || 0} tx
            </div>
          </div>
          <div className="space-y-1">
            {historyLoading && (
              <div className="text-[11px] text-slate-500">Refreshing receipts…</div>
            )}
            {receipts.length === 0 && (
              <div className="text-[11px] text-slate-500">No verified funding tx yet.</div>
            )}
            {receipts.map((row) => (
              <div
                key={row.id}
                className="flex items-center justify-between rounded-md border border-slate-800/60 bg-slate-950/55 px-2 py-1 text-[11px]"
              >
                <div className="font-mono text-slate-300">{shortHash(row.txHash)}</div>
                <div className="font-mono text-emerald-300">+{Math.round(row.arenaAmount)}A</div>
                <div className="text-slate-500">{timeAgo(row.createdAt)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
