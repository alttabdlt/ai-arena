import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { 
  Menu, 
  Home, 
  Users, 
  Trophy, 
  Target,
  Vault,
  Shield,
  Rocket,
  BarChart3, 
  Settings, 
  BookOpen, 
  Code, 
  Scale,
  MessageSquare,
  Activity
} from 'lucide-react';

const navItems = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/discover', icon: Target, label: 'Discover' },
  { to: '/bots', icon: BarChart3, label: 'Bots' },
  { to: '/tournaments', icon: Trophy, label: 'Tournaments' },
  { to: '/vaults', icon: Vault, label: 'Vaults' },
  { to: '/portfolio', icon: Users, label: 'Portfolio' },
  { to: '/kyc', icon: Shield, label: 'KYC' },
  { to: '/launch', icon: Rocket, label: 'Launch' },
  { to: '/analytics', icon: Activity, label: 'Analytics' },
  { to: '/social', icon: MessageSquare, label: 'Social' },
  { to: '/learn', icon: BookOpen, label: 'Learn' },
  { to: '/legal', icon: Scale, label: 'Legal' },
  { to: '/settings', icon: Settings, label: 'Settings' }
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Menu className="h-4 w-4" />
            <span className="sr-only">Toggle navigation menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72">
          <div className="flex flex-col space-y-4 py-4">
            <div className="px-3 py-2">
              <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">
                Navigation
              </h2>
              <div className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.to;
                  
                  return (
                    <Button
                      key={item.to}
                      variant={isActive ? "secondary" : "ghost"}
                      className="w-full justify-start"
                      asChild
                      onClick={() => setOpen(false)}
                    >
                      <Link to={item.to}>
                        <Icon className="mr-2 h-4 w-4" />
                        {item.label}
                      </Link>
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}