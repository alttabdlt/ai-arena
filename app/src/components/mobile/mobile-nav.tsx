import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { 
  Menu, 
  Home, 
  Users, 
  Trophy, 
  Rocket,
  Settings, 
  BookOpen, 
  Scale,
  Activity,
  LayoutDashboard,
  HelpCircle,
  Code2
} from 'lucide-react';

const navItems = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/tournaments', icon: Trophy, label: 'Tournaments' },
  { to: '/bots', icon: Activity, label: 'Bots' },
  { to: '/deploy', icon: Rocket, label: 'Deploy Bot' },
  { to: '/docs', icon: Code2, label: 'Developer Docs' },
  { to: '/learn', icon: BookOpen, label: 'Learn' },
  { to: '/legal', icon: Scale, label: 'Legal' }
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