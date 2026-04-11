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
  Zap
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
                props.isActive ? "text-primary bg-orange-50/50 after:opacity-100" : "text-gray-400"
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

      <div className="p-6">
        <div className="bg-orange-50 border border-orange-100 rounded-3xl p-6 relative overflow-hidden group hover:bg-orange-100/50 transition-all duration-500">
          <div className="relative z-10">
            <h3 className="text-primary font-bold text-lg mb-2">Diaster</h3>
            <p className="text-gray-500 text-xs font-semibold leading-relaxed mb-4">
              Manage sales, inventory, and payments all in one place. Start selling faster and smarter.
            </p>
            <button className="w-full bg-primary text-white py-3 rounded-xl text-xs font-bold hover:bg-orange-600 transition-all shadow-lg shadow-orange-100">
              Get Started
            </button>
          </div>
          <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-all"></div>
        </div>
      </div>
    </aside>
  );
};
