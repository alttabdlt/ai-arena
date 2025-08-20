import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import { Trophy, Coins, Loader2, CheckCircle } from 'lucide-react';
import { CLAIM_WINNINGS, UPDATE_BOT_EXPERIENCE } from '@/graphql/queries/betting';

interface ClaimXPModalProps {
  isOpen: boolean;
  onClose: () => void;
  winnings: any[];
  selectedBotId: string | null;
  onClaimComplete: () => void;
}

const ClaimXPModal: React.FC<ClaimXPModalProps> = ({
  isOpen,
  onClose,
  winnings,
  selectedBotId,
  onClaimComplete
}) => {
  const [claiming, setClaiming] = useState(false);
  const [claimedBets, setClaimedBets] = useState<Set<string>>(new Set());
  
  const [claimWinnings] = useMutation(CLAIM_WINNINGS);
  const [updateBotExperience] = useMutation(UPDATE_BOT_EXPERIENCE);
  
  if (!isOpen || winnings.length === 0) return null;
  
  const totalWinnings = winnings.reduce((acc, bet) => acc + (bet.actualPayout || 0), 0);
  
  const handleClaimAll = async () => {
    if (!selectedBotId) return;
    
    setClaiming(true);
    try {
      let totalXpClaimed = 0;
      
      // Claim each winning bet
      for (const bet of winnings) {
        if (!claimedBets.has(bet.id)) {
          try {
            const result = await claimWinnings({
              variables: { betId: bet.id }
            });
            
            if (result.data?.claimWinnings?.xpClaimed) {
              totalXpClaimed += result.data.claimWinnings.xpClaimed;
              setClaimedBets(prev => new Set([...prev, bet.id]));
            }
          } catch (error) {
            console.error('Failed to claim bet:', bet.id, error);
          }
        }
      }
      
      // Update bot experience with total claimed XP
      if (totalXpClaimed > 0) {
        await updateBotExperience({
          variables: {
            botId: selectedBotId,
            xpGained: totalXpClaimed
          }
        });
      }
      
      // Show success animation
      setTimeout(() => {
        onClaimComplete();
        onClose();
      }, 1500);
      
    } catch (error) {
      console.error('Error claiming winnings:', error);
      setClaiming(false);
    }
  };
  
  return (
    <div className="claim-xp-modal-overlay" onClick={onClose}>
      <div className="claim-xp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <Trophy className="trophy-icon" />
          <h2>Tournament Winnings!</h2>
        </div>
        
        <div className="modal-content">
          <div className="winnings-summary">
            <p className="congrats-text">Congratulations! You have won:</p>
            <div className="xp-amount">
              <Coins className="xp-icon" />
              <span className="xp-value">{totalWinnings.toLocaleString()}</span>
              <span className="xp-label">XP</span>
            </div>
          </div>
          
          <div className="winnings-details">
            <h3>Tournament Results:</h3>
            {winnings.map((bet, index) => (
              <div key={bet.id} className="winning-item">
                <div className="tournament-info">
                  <span className="game-type">{bet.tournament?.gameType || 'Tournament'}</span>
                  <span className="winner-name">{bet.participant?.name || 'AI Model'} won!</span>
                </div>
                <div className="payout-info">
                  <span className="payout-amount">+{bet.actualPayout?.toLocaleString() || 0} XP</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="modal-footer">
          {!claiming ? (
            <>
              <button className="btn-secondary" onClick={onClose}>
                Later
              </button>
              <button className="btn-primary" onClick={handleClaimAll}>
                <Trophy className="btn-icon" />
                Claim {totalWinnings.toLocaleString()} XP
              </button>
            </>
          ) : (
            <div className="claiming-state">
              {claimedBets.size === winnings.length ? (
                <>
                  <CheckCircle className="success-icon" />
                  <span>XP Added to Your Bot!</span>
                </>
              ) : (
                <>
                  <Loader2 className="loading-icon" />
                  <span>Claiming XP...</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      
      <style>{`
        .claim-xp-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: fadeIn 0.3s ease-out;
        }
        
        .claim-xp-modal {
          background: #1a1a2e;
          border-radius: 16px;
          padding: 32px;
          max-width: 500px;
          width: 90%;
          max-height: 80vh;
          overflow-y: auto;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
          animation: slideUp 0.3s ease-out;
        }
        
        .modal-header {
          text-align: center;
          margin-bottom: 24px;
        }
        
        .trophy-icon {
          width: 48px;
          height: 48px;
          color: #ffd700;
          margin: 0 auto 16px;
          animation: bounce 1s infinite;
        }
        
        .modal-header h2 {
          font-size: 28px;
          font-weight: bold;
          color: #ffffff;
          margin: 0;
        }
        
        .winnings-summary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
          text-align: center;
        }
        
        .congrats-text {
          color: rgba(255, 255, 255, 0.9);
          font-size: 14px;
          margin-bottom: 12px;
        }
        
        .xp-amount {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
        }
        
        .xp-icon {
          width: 32px;
          height: 32px;
          color: #ffd700;
        }
        
        .xp-value {
          font-size: 36px;
          font-weight: bold;
          color: #ffffff;
        }
        
        .xp-label {
          font-size: 24px;
          color: rgba(255, 255, 255, 0.9);
        }
        
        .winnings-details {
          margin-bottom: 24px;
        }
        
        .winnings-details h3 {
          font-size: 16px;
          color: #a0a0a0;
          margin-bottom: 12px;
        }
        
        .winning-item {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 8px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .tournament-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        
        .game-type {
          font-size: 12px;
          color: #a0a0a0;
          text-transform: uppercase;
        }
        
        .winner-name {
          font-size: 14px;
          color: #ffffff;
        }
        
        .payout-amount {
          font-size: 16px;
          font-weight: bold;
          color: #4ade80;
        }
        
        .modal-footer {
          display: flex;
          gap: 12px;
          justify-content: center;
        }
        
        .btn-primary, .btn-secondary {
          padding: 12px 24px;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: transform 0.2s;
        }
        
        .btn-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }
        
        .btn-primary:hover {
          transform: scale(1.05);
        }
        
        .btn-secondary {
          background: rgba(255, 255, 255, 0.1);
          color: #a0a0a0;
        }
        
        .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.15);
        }
        
        .btn-icon {
          width: 20px;
          height: 20px;
        }
        
        .claiming-state {
          display: flex;
          align-items: center;
          gap: 12px;
          color: #ffffff;
          font-size: 16px;
        }
        
        .loading-icon {
          width: 24px;
          height: 24px;
          animation: spin 1s linear infinite;
        }
        
        .success-icon {
          width: 24px;
          height: 24px;
          color: #4ade80;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideUp {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default ClaimXPModal;