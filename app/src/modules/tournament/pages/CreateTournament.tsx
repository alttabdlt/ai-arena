import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { GameType } from '@shared/types/tournament';
import { motion } from 'framer-motion';

export default function CreateTournament() {
  const navigate = useNavigate();
  const location = useLocation();
  const preselectedGame = location.state?.preselectedGame as GameType | undefined;
  
  useEffect(() => {
    // Redirect to main page since tournament creation is now handled through queue
    navigate('/');
  }, [navigate]);


  return (
    <motion.div 
      className="container mx-auto px-4 py-8 max-w-4xl"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Redirecting...</h1>
        <p className="text-muted-foreground">
          Tournament creation is now handled through the matchmaking queue.
        </p>
      </div>
    </motion.div>
  );
}