import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Heart, MessageCircle, Share2, TrendingUp, Trophy } from 'lucide-react';

interface SocialPost {
  id: string;
  user: {
    name: string;
    avatar: string;
    rank: string;
  };
  type: 'win' | 'achievement' | 'strategy';
  content: string;
  timestamp: string;
  likes: number;
  comments: number;
  shares: number;
  isLiked: boolean;
}

const mockPosts: SocialPost[] = [
  {
    id: '1',
    user: {
      name: 'PokerPro_X',
      avatar: '/placeholder.svg',
      rank: 'Master'
    },
    type: 'win',
    content: 'Just crushed a high-stakes tournament with my new AI bot strategy! 🚀 Earned 50,000 chips in 2 hours.',
    timestamp: '2 hours ago',
    likes: 234,
    comments: 45,
    shares: 12,
    isLiked: false
  },
  {
    id: '2',
    user: {
      name: 'BotMaster2024',
      avatar: '/placeholder.svg',
      rank: 'Expert'
    },
    type: 'achievement',
    content: 'Unlocked the "AI Whisperer" achievement! My bot just achieved a 95% win rate over 1000 games.',
    timestamp: '4 hours ago',
    likes: 189,
    comments: 23,
    shares: 8,
    isLiked: true
  },
  {
    id: '3',
    user: {
      name: 'StrategyQueen',
      avatar: '/placeholder.svg',
      rank: 'Pro'
    },
    type: 'strategy',
    content: 'Pro tip: Always train your bot on multiple table sizes. Just updated my neural network weights and seeing 15% better performance!',
    timestamp: '6 hours ago',
    likes: 156,
    comments: 67,
    shares: 34,
    isLiked: false
  }
];

export function SocialFeed() {
  const [posts, setPosts] = useState<SocialPost[]>(mockPosts);

  const handleLike = (postId: string) => {
    setPosts(posts.map(post => 
      post.id === postId 
        ? { 
            ...post, 
            likes: post.isLiked ? post.likes - 1 : post.likes + 1,
            isLiked: !post.isLiked 
          }
        : post
    ));
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'win':
        return <TrendingUp className="h-4 w-4 text-success" />;
      case 'achievement':
        return <Trophy className="h-4 w-4 text-warning" />;
      case 'strategy':
        return <MessageCircle className="h-4 w-4 text-info" />;
      default:
        return null;
    }
  };

  const getTypeBadge = (type: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      win: 'default',
      achievement: 'secondary',
      strategy: 'outline'
    };
    return variants[type] || 'default';
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-foreground mb-2">Community Feed</h2>
        <p className="text-muted-foreground">See what the poker bot community is up to</p>
      </div>

      {posts.map((post) => (
        <Card key={post.id} className="transition-all duration-200 hover:shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={post.user.avatar} alt={post.user.name} />
                  <AvatarFallback>{post.user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center space-x-2">
                    <p className="font-semibold text-sm">{post.user.name}</p>
                    <Badge variant="outline" className="text-xs">{post.user.rank}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{post.timestamp}</p>
                </div>
              </div>
              <div className="flex items-center space-x-1">
                {getTypeIcon(post.type)}
                <Badge variant={getTypeBadge(post.type)} className="text-xs capitalize">
                  {post.type}
                </Badge>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="pt-0">
            <p className="text-sm text-foreground mb-4 leading-relaxed">
              {post.content}
            </p>
            
            <div className="flex items-center justify-between pt-3 border-t border-border">
              <div className="flex items-center space-x-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleLike(post.id)}
                  className={`hover:bg-red-50 hover:text-red-600 ${
                    post.isLiked ? 'text-red-600' : 'text-muted-foreground'
                  }`}
                >
                  <Heart 
                    className={`h-4 w-4 mr-1 ${post.isLiked ? 'fill-current' : ''}`} 
                  />
                  {post.likes}
                </Button>
                
                <Button variant="ghost" size="sm" className="hover:bg-blue-50 hover:text-blue-600">
                  <MessageCircle className="h-4 w-4 mr-1" />
                  {post.comments}
                </Button>
                
                <Button variant="ghost" size="sm" className="hover:bg-green-50 hover:text-green-600">
                  <Share2 className="h-4 w-4 mr-1" />
                  {post.shares}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}