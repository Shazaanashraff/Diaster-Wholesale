import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  FileText, 
  Landmark,
  Wallet,
  BarChart2,
  Zap,
  RotateCcw
} from 'lucide-react';
import { cn } from '../lib/utils';

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: ShoppingCart, label: 'POS System', path: '/pos' },
  { icon: Package, label: 'Inventory', path: '/inventory' },
  { icon: FileText, label: 'Products', path: '/products' },
  { icon: Landmark, label: 'Customers', path: '/customers' },
  { icon: Wallet, label: 'Bulk Import', path: '/import' },
  { icon: RotateCcw, label: 'Returns', path: '/returns' },
  { icon: BarChart2, label: 'Reports', path: '/reports' },
];

export const Sidebar: React.FC = () => {
  return (
    <aside className="w-72 h-screen bg-white flex flex-col z-20 shrink-0 border-r border-border">
      <div className="p-8 flex items-center gap-4">
        <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white">
          <Zap size={22} fill="currentColor" strokeWidth={0} />
        </div>
        <h1 className="font-bold text-xl text-dark tracking-tight uppercase">Diaster</h1>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={(props) => 
              cn(
                "sidebar-link",
                props.isActive ? "text-primary bg-violet-50/50 after:opacity-100" : "text-gray-400"
              )
            }
          >
            {(props) => (
              <>
                <div className={cn("relative z-10", props.isActive ? "text-primary" : "text-gray-400")}>
                  <item.icon size={20} strokeWidth={props.isActive ? 2.5 : 2} />
                </div>
                <span className={cn("text-[13px] font-semibold", props.isActive ? "text-dark" : "text-gray-400")}>
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};
