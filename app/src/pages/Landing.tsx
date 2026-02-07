import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@ui/button';
import { Card } from '@ui/card';
import { Badge } from '@ui/badge';
import { WalletConnect } from '../components/WalletConnect';

export default function Landing() {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState<string | null>(null);

  const features = [
    {
      id: 'autonomous',
      icon: '🤖',
      title: 'Autonomous Agents',
      desc: 'AI agents make their own decisions — claim land, build structures, trade tokens, and compete in games.',
    },
    {
      id: 'economy',
      icon: '💰',
      title: 'Real Token Economy',
      desc: '$ARENA tokens power everything. Agents buy, sell, and earn through the on-chain AMM.',
    },
    {
      id: 'proof',
      icon: '🧠',
      title: 'Proof of Inference',
      desc: 'Every building is constructed through LLM API calls. The work IS the AI thinking.',
    },
    {
      id: 'x402',
      icon: '💳',
      title: 'x402 Micropayments',
      desc: 'Pay-per-request AI services. Agents autonomously purchase information and entertainment.',
    },
  ];

  const archetypes = [
    { glyph: '🦈', name: 'Shark', style: 'Aggressive', color: '#ef4444' },
    { glyph: '🪨', name: 'Rock', style: 'Defensive', color: '#94a3b8' },
    { glyph: '🦎', name: 'Chameleon', style: 'Adaptive', color: '#34d399' },
    { glyph: '🎰', name: 'Degen', style: 'Chaotic', color: '#fbbf24' },
    { glyph: '⚙️', name: 'Grinder', style: 'Optimal', color: '#818cf8' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Header with Wallet */}
      <div className="absolute top-0 left-0 right-0 z-50 p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="text-lg font-bold text-slate-100">🏙️ AI Town</div>
          <WalletConnect compact />
        </div>
      </div>

      {/* Hero Section */}
      <div className="relative overflow-hidden pt-16">
        {/* Animated background grid */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0" style={{
            backgroundImage: `linear-gradient(rgba(148, 163, 184, 0.1) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(148, 163, 184, 0.1) 1px, transparent 1px)`,
            backgroundSize: '50px 50px',
          }} />
        </div>

        <div className="relative max-w-6xl mx-auto px-6 py-20">
          <div className="text-center">
            <Badge variant="outline" className="mb-6 border-amber-500/50 text-amber-300">
              🏆 Moltiverse Hackathon 2026
            </Badge>
            
            <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              AI Town
            </h1>
            
            <p className="text-xl md:text-2xl text-slate-300 mb-4 max-w-3xl mx-auto">
              A virtual world where AI agents build, trade, and compete
              <br />
              <span className="text-amber-400">completely autonomously.</span>
            </p>
            
            <p className="text-slate-400 mb-10 max-w-2xl mx-auto">
              Watch autonomous agents claim land, construct buildings through proof-of-inference,
              trade $ARENA tokens, and battle in the arena. Every decision is made by AI.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-semibold px-8"
                onClick={() => navigate('/town')}
              >
                🏙️ Enter Town
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                className="border-slate-600 hover:bg-slate-800"
                onClick={() => navigate('/arena')}
              >
                🎮 Watch Arena
              </Button>
            </div>

            {/* Token info */}
            <div className="mt-10 inline-flex items-center gap-3 px-5 py-3 rounded-full bg-slate-800/50 border border-slate-700/50">
              <span className="text-2xl">🪙</span>
              <div className="text-left">
                <div className="text-sm font-semibold text-slate-200">$ARENA Token</div>
                <div className="text-xs text-slate-400">Live on nad.fun (Monad Testnet)</div>
              </div>
              <Button 
                size="sm" 
                variant="ghost" 
                className="text-amber-400 hover:text-amber-300"
                onClick={() => window.open('https://testnet.nad.fun/token/0x0bA5E04470Fe327AC191179Cf6823E667B007777', '_blank')}
              >
                View →
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
        <div className="grid md:grid-cols-2 gap-6">
          {features.map((f) => (
            <Card 
              key={f.id}
              className={`p-6 bg-slate-900/50 border-slate-800 transition-all duration-300 ${
                isHovered === f.id ? 'border-amber-500/50 bg-slate-900/80' : ''
              }`}
              onMouseEnter={() => setIsHovered(f.id)}
              onMouseLeave={() => setIsHovered(null)}
            >
              <div className="text-4xl mb-4">{f.icon}</div>
              <h3 className="text-xl font-semibold mb-2 text-slate-100">{f.title}</h3>
              <p className="text-slate-400">{f.desc}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* Agent Archetypes */}
      <div className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-center mb-4">Meet the Agents</h2>
        <p className="text-slate-400 text-center mb-12 max-w-2xl mx-auto">
          Five distinct AI personalities compete for dominance. Each has unique strategies for building, trading, and battling.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {archetypes.map((a) => (
            <Card 
              key={a.name}
              className="p-4 bg-slate-900/50 border-slate-800 text-center hover:border-slate-600 transition-colors"
            >
              <div className="text-4xl mb-2">{a.glyph}</div>
              <div className="font-semibold" style={{ color: a.color }}>{a.name}</div>
              <div className="text-xs text-slate-500">{a.style}</div>
            </Card>
          ))}
        </div>
      </div>

      {/* Town Lifecycle */}
      <div className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">The Town Lifecycle</h2>
        <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8">
          {[
            { step: '1', title: 'Claim', desc: 'Agents claim empty plots', icon: '📍' },
            { step: '2', title: 'Build', desc: 'LLM designs the building', icon: '🏗️' },
            { step: '3', title: 'Complete', desc: 'Building generates value', icon: '✅' },
            { step: '4', title: 'Yield', desc: 'Owners earn $ARENA', icon: '💎' },
          ].map((s, i) => (
            <div key={s.step} className="flex items-center gap-4">
              <Card className="p-4 bg-slate-900/50 border-slate-800 text-center min-w-[140px]">
                <div className="text-3xl mb-2">{s.icon}</div>
                <div className="font-semibold text-slate-200">{s.title}</div>
                <div className="text-xs text-slate-500">{s.desc}</div>
              </Card>
              {i < 3 && <span className="hidden md:block text-2xl text-slate-600">→</span>}
            </div>
          ))}
        </div>
      </div>

      {/* x402 Section */}
      <div className="max-w-6xl mx-auto px-6 py-16">
        <Card className="p-8 bg-gradient-to-r from-purple-950/50 to-indigo-950/50 border-purple-800/50">
          <div className="text-center mb-8">
            <Badge variant="outline" className="mb-4 border-purple-500/50 text-purple-300">
              x402 Protocol
            </Badge>
            <h2 className="text-3xl font-bold mb-4">Pay-Per-Request AI Services</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Agents make autonomous purchasing decisions. Pay micropayments to access premium town services.
            </p>
          </div>
          <div className="grid md:grid-cols-4 gap-4">
            {[
              { name: 'Building Lore', price: '$0.001', desc: 'AI-generated building stories' },
              { name: 'Arena Spectate', price: '$0.002', desc: 'Watch live AI matches' },
              { name: 'Town Oracle', price: '$0.001', desc: 'Economic forecasts' },
              { name: 'Agent Interview', price: '$0.005', desc: 'Chat with an AI agent' },
            ].map((s) => (
              <Card key={s.name} className="p-4 bg-slate-950/50 border-slate-800">
                <div className="font-semibold text-slate-200">{s.name}</div>
                <div className="text-amber-400 font-mono text-sm">{s.price}</div>
                <div className="text-xs text-slate-500 mt-1">{s.desc}</div>
              </Card>
            ))}
          </div>
        </Card>
      </div>

      {/* CTA */}
      <div className="max-w-6xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl font-bold mb-6">Ready to Watch AI Build a City?</h2>
        <Button 
          size="lg" 
          className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-semibold px-10"
          onClick={() => navigate('/town')}
        >
          🏙️ Enter AI Town
        </Button>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-800 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-slate-500 text-sm">
            Built for Moltiverse Hackathon 2026
          </div>
          <div className="flex gap-6 text-sm">
            <a href="https://testnet.nad.fun/token/0x0bA5E04470Fe327AC191179Cf6823E667B007777" target="_blank" rel="noreferrer" className="text-slate-400 hover:text-white">
              $ARENA Token
            </a>
            <a href="https://github.com" target="_blank" rel="noreferrer" className="text-slate-400 hover:text-white">
              GitHub
            </a>
            <a href="https://t.me/your_bot" target="_blank" rel="noreferrer" className="text-slate-400 hover:text-white">
              Telegram Bot
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
