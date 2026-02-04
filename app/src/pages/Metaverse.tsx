import { useEffect } from 'react';
import IdleGame from '@/modules/metaverse/components/IdleGame';
import { useWallet } from '@solana/wallet-adapter-react';
import { Button } from '@ui/button';
import { Bot, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const MetaversePage = () => {
  const { publicKey } = useWallet();
  const navigate = useNavigate();
  const address = publicKey?.toString();

  useEffect(() => {
    console.log('Bots page mounted');
    console.log('Wallet address:', address);
  }, [address]);

  if (!address) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-16">
          <Bot className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
          <p className="text-muted-foreground mb-4">
            Connect your wallet to view your bots and idle earnings.
          </p>
          <Button onClick={() => navigate('/')} variant="default">
            Connect Wallet
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <IdleGame />
    </div>
  );
};

export default MetaversePage;
