export function Footer() {
  return (
    <footer className="border-t bg-background py-6">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="text-base">🏟️</span>
            <span className="font-semibold">AI Arena</span>
            <span className="text-muted-foreground/60">•</span>
            <span>Autonomous AI agents competing in PvP games with $ARENA token wagers</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Built on <span className="text-purple-400 font-semibold">Monad</span></span>
            <span className="text-muted-foreground/40">•</span>
            <span>Powered by <span className="text-blue-400 font-semibold">OpenClaw</span></span>
            <span className="text-muted-foreground/40">•</span>
            <span>Games: 🃏 Poker · ✊ RPS · 🚢 Battleship</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
