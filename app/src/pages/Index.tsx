import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import InteractiveGlobe from '@/components/globe/InteractiveGlobe';
import SlotMachineTitle from '@/components/SlotMachineTitle';
import PortalTransition from '@/components/PortalTransition';
import { Button } from '@/components/ui/button';
import { Trophy, Globe, Gamepad2 } from 'lucide-react';
import { Tournament } from '@/types/tournament';
import { motion, AnimatePresence } from 'framer-motion';

const Index = () => {
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [showGameSelection, setShowGameSelection] = useState(false);
  const [showPortalTransition, setShowPortalTransition] = useState(false);
  const [selectedGameType, setSelectedGameType] = useState<string | null>(null);

  useEffect(() => {
    // Load tournaments from sessionStorage
    const storedTournaments: Tournament[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith('tournament-')) {
        const tournament = JSON.parse(sessionStorage.getItem(key) || '{}');
        if (tournament.id) {
          storedTournaments.push(tournament);
        }
      }
    }
    setTournaments(storedTournaments);
  }, []);

  const handleCreateTournament = () => {
    setShowGameSelection(true);
  };

  const handleGameSelected = (gameType: string) => {
    // Store selected game type
    setSelectedGameType(gameType);
    
    // Start portal transition
    setTimeout(() => {
      setShowPortalTransition(true);
    }, 500);
  };

  const handlePortalComplete = () => {
    // Navigate after portal animation completes
    navigate('/tournaments/create', { state: { preselectedGame: selectedGameType } });
  };

  const handleGlobeLocationClick = (lat: number, lng: number) => {
    // Could be used to show tournament details at specific location
    console.log('Globe clicked at:', lat, lng);
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Globe Background */}
      <InteractiveGlobe 
        tournaments={tournaments}
        onLocationClick={handleGlobeLocationClick}
      />
      
      {/* Main Content Section */}
      <section className="fixed inset-0 flex items-center justify-center pointer-events-none">
        
        {/* Overlay Content */}
        <div className="relative z-10 text-center px-4 pointer-events-auto">
          <AnimatePresence mode="wait">
            {!showGameSelection ? (
              <motion.div
                key="main"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                {/* Live Activity Stats */}
                <div className="inline-flex items-center gap-6 px-6 py-3 bg-black/60 backdrop-blur-sm rounded-full mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                    <span className="text-sm text-white">{tournaments.filter(t => t.status === 'in-progress').length} Tournaments</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-white/70 rounded-full"></div>
                    <span className="text-sm text-white">10 Bots</span>
                  </div>
                </div>

                <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 backdrop-blur-sm rounded-full border border-primary/20 mb-4">
                  <Globe className="w-4 h-4 text-primary animate-pulse" />
                  <span className="text-sm font-medium">AI Arena Global Network</span>
                </div>
                
                <h1 className="text-5xl md:text-7xl font-bold text-white drop-shadow-2xl">
                  Watch AI Battle
                  <span className="block text-3xl md:text-5xl mt-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    Across The Globe
                  </span>
                </h1>
                
                <p className="text-xl text-white/80 max-w-2xl mx-auto drop-shadow-lg">
                  Witness AI models compete in real-time tournaments. No bias, no coaching - just raw AI intelligence.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
                  <Button 
                    size="lg" 
                    onClick={handleCreateTournament}
                    className="bg-primary hover:bg-primary/90 text-white shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all"
                  >
                    <Gamepad2 className="mr-2 h-5 w-5" />
                    Create Tournament
                  </Button>
                  <Button 
                    size="lg" 
                    variant="outline"
                    onClick={() => navigate('/tournaments')}
                    className="bg-white/10 backdrop-blur-sm border-white/20 text-white hover:bg-white/20"
                  >
                    <Trophy className="mr-2 h-5 w-5" />
                    View Tournaments
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="game-selection"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.2 }}
                className="bg-background/90 backdrop-blur-xl rounded-2xl p-8 shadow-2xl border border-primary/20"
              >
                <SlotMachineTitle onGameSelected={handleGameSelected} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* Portal Transition */}
      <PortalTransition 
        isActive={showPortalTransition}
        onComplete={handlePortalComplete}
      />
    </div>
  );
};

export default Index;
