import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Circle,
  LayoutDashboard,
  MonitorSmartphone,
  Boxes,
  Package2,
  Users,
  Upload,
  RotateCcw,
  BarChart3,
} from 'lucide-react';
import { cn } from '../lib/utils';

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: MonitorSmartphone, label: 'POS System', path: '/pos' },
  { icon: Boxes, label: 'Inventory', path: '/inventory' },
  { icon: Package2, label: 'Products', path: '/products' },
  { icon: Users, label: 'Customers', path: '/customers' },
  { icon: Upload, label: 'Bulk Import', path: '/import' },
  { icon: RotateCcw, label: 'Returns', path: '/returns' },
  { icon: BarChart3, label: 'Reports', path: '/reports' },
];

export const Sidebar: React.FC = () => {
  return (
    <aside className="pos-sidebar">
      <div className="pos-sidebar-head">
        <div className="pos-brand">
          <div className="pos-brand-meta">
            <span>Diastar</span>
          </div>
        </div>
      </div>

      <p className="pos-nav-section-label">Navigation</p>

      <nav className="pos-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => cn('pos-nav-link', isActive && 'active')}
          >
            <span className="pos-nav-icon">
              <item.icon size={16} />
            </span>
            <span className="pos-nav-text">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="pos-users mt-auto">
        {['Leslie K.', 'Cameron W.', 'Jacob J.'].map((name) => (
          <div key={name} className="pos-user-chip">
            <span>{name[0]}</span>
            <p>{name}</p>
          </div>
        ))}
        <div className="pos-footer-note">2026 Diastar App</div>
      </div>
    </aside>
  );
};
