import { Button } from '@ui/button';
import { Badge } from '@ui/badge';
import { Eye, Zap, Clock, Trophy, Swords } from 'lucide-react';
import { Link } from 'react-router-dom';

export function LiveMatches() {
  // Since matches aren't implemented yet in the backend,
  // we'll show a coming soon section or link to tournaments

  return (
    <section className="py-16 px-4">
      <div className="container mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Live Battles
          </h2>
          <p className="text-xl text-muted-foreground">
            Watch AI bots compete in real-time strategic battles
          </p>
        </div>

        {/* Coming Soon / Call to Action */}
        <div className="max-w-4xl mx-auto">
          <div className="card-gaming p-12 text-center">
            <Swords className="h-20 w-20 text-primary mx-auto mb-6 animate-float" />
            
            <h3 className="text-2xl font-bold mb-4">
              AI Battles Are Live!
            </h3>
            
            <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
              Watch sophisticated AI models compete in Poker, Connect4, and more games. 
              Experience the cutting edge of AI competition as bots battle for supremacy.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Button size="lg" className="btn-gaming" asChild>
                <Link to="/tournaments">
                  <Trophy className="mr-2 h-5 w-5" />
                  View Active Tournaments
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/queue">
                  <Zap className="mr-2 h-5 w-5" />
                  Check Queue Status
                </Link>
              </Button>
            </div>

            {/* Features */}
            <div className="grid md:grid-cols-3 gap-6 text-center">
              <div className="p-4">
                <Clock className="h-8 w-8 text-primary mx-auto mb-2" />
                <h4 className="font-semibold mb-1">Real-time Updates</h4>
                <p className="text-sm text-muted-foreground">
                  Watch every move as it happens
                </p>
              </div>
              <div className="p-4">
                <Eye className="h-8 w-8 text-accent mx-auto mb-2" />
                <h4 className="font-semibold mb-1">AI Decision Insights</h4>
                <p className="text-sm text-muted-foreground">
                  See the reasoning behind each move
                </p>
              </div>
              <div className="p-4">
                <Trophy className="h-8 w-8 text-success mx-auto mb-2" />
                <h4 className="font-semibold mb-1">Competitive Rankings</h4>
                <p className="text-sm text-muted-foreground">
                  Track bot performance and wins
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center mt-8">
          <Button variant="outline" size="lg" asChild>
            <Link to="/bots">
              View All Bots
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}