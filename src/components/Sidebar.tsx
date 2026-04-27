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
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '../lib/utils';

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
}

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
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

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
  return (
    <aside className={cn('pos-sidebar', collapsed && 'sidebar-collapsed')}>
      <div className="pos-sidebar-head">
        <div className="pos-brand">
          <div className="pos-brand-logo">
            <Circle size={12} />
          </div>
          {!collapsed && (
            <div className="pos-brand-meta">
              <span>Diastar</span>
            </div>
          )}
          <button
            type="button"
            className="pos-sidebar-toggle"
            onClick={onToggle}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
          </button>
        </div>
      </div>

      {!collapsed && <p className="pos-nav-section-label">Navigation</p>}

      <nav className="pos-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => cn('pos-nav-link', isActive && 'active')}
            title={collapsed ? item.label : undefined}
          >
            <span className="pos-nav-icon">
              <item.icon size={16} />
            </span>
            {!collapsed && <span className="pos-nav-text">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="pos-users mt-auto">
        {['Leslie K.', 'Cameron W.', 'Jacob J.'].map((name) => (
          <div key={name} className="pos-user-chip" title={collapsed ? name : undefined}>
            <span>{name[0]}</span>
            {!collapsed && <p>{name}</p>}
          </div>
        ))}
        {!collapsed && <div className="pos-footer-note">2026 Diastar App</div>}
      </div>
    </aside>
  );
};
