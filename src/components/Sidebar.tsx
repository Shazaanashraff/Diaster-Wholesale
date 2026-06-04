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
  LogOut,
  Building2,
  ShoppingCart,
  Download,
  CornerUpLeft,
  Wallet,
  ArrowLeftRight,
  ClipboardList,
  UserCog,
  Activity,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { getCurrentRole, can, type Permission } from '../utils/permissions';

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  section?: string;
  requires?: Permission | Permission[];
}

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const ALL_NAV_ITEMS: NavItem[] = [
  { icon: LayoutDashboard,   label: 'Dashboard',   path: '/' },
  { icon: MonitorSmartphone, label: 'Digital POS', path: '/pos',       requires: 'pos' },
  { icon: ClipboardList,     label: 'Cashier',     path: '/cashier',   requires: 'pos' },
  { icon: Boxes,             label: 'Inventory',   path: '/inventory', requires: 'view_inventory' },
  { icon: Package2,          label: 'Products',    path: '/products',  requires: 'manage_products' },
  { icon: Users,             label: 'Customers',   path: '/customers', requires: 'view_customers' },
  { icon: RotateCcw,         label: 'Returns',     path: '/returns',   requires: 'manage_returns' },
  { icon: BarChart3,         label: 'Reports',     path: '/reports',   requires: 'view_reports' },
  { icon: ShoppingCart,    label: 'Procurement',      path: '/purchases',         requires: 'manage_procurement',   section: 'Procurement' },
  { icon: Building2,       label: 'Suppliers',         path: '/suppliers',         requires: ['manage_suppliers', 'manage_payments'] as Permission[], section: 'Procurement' },
  { icon: CornerUpLeft,    label: 'Supplier Returns',  path: '/supplier-returns',  requires: 'manage_procurement',   section: 'Procurement' },
  { icon: ArrowLeftRight,  label: 'Stock Transfers',   path: '/stock-transfers',   requires: 'manage_procurement',   section: 'Procurement' },
  { icon: Wallet,          label: 'Day Transactions',  path: '/day-transactions',  requires: ['manage_costs', 'manage_payments'] as Permission[], section: 'Procurement' },
  { icon: Upload,          label: 'Bulk Import',       path: '/import',            requires: 'bulk_import',          section: 'Admin' },
  { icon: UserCog,         label: 'Salespeople',       path: '/salespeople',       requires: 'manage_salespeople',    section: 'Admin' },
  { icon: Activity,        label: 'Developer Portal',  path: '/developer',         requires: 'view_dev_portal',       section: 'Admin' },
  { icon: Download,        label: 'Updates',           path: '/updates',                                             section: 'Admin' },
];

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
  const role = getCurrentRole();
  const navItems = ALL_NAV_ITEMS.filter((item) => {
    if (role === 'developer') {
      return item.path === '/developer';
    }
    return !item.requires || (Array.isArray(item.requires) ? item.requires.some(r => can(r, role)) : can(item.requires, role));
  });

  const handleLogout = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload();
  };

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
        {navItems.map((item, idx) => {
          const prevSection = navItems[idx - 1]?.section;
          const showSectionLabel = !collapsed && item.section && item.section !== prevSection;
          return (
            <React.Fragment key={item.path}>
              {showSectionLabel && (
                <p className="pos-nav-section-label" style={{ marginTop: '6px' }}>{item.section}</p>
              )}
              <NavLink
                to={item.path}
                className={({ isActive }) => cn('pos-nav-link', isActive && 'active')}
                title={collapsed ? item.label : undefined}
              >
                <span className="pos-nav-icon">
                  <item.icon size={16} />
                </span>
                {!collapsed && <span className="pos-nav-text">{item.label}</span>}
              </NavLink>
            </React.Fragment>
          );
        })}
      </nav>

      <div className="pos-users">
        {!collapsed && (
          <div className="px-3 py-2 mb-1">
            <p className="text-[9px] font-bold uppercase tracking-widest text-gray-600">Signed in as</p>
            <p className="text-[11px] font-bold text-gray-400 mt-0.5">{role.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</p>
          </div>
        )}
        <button
          type="button"
          onClick={handleLogout}
          className="pos-user-chip"
          title={collapsed ? 'Logout' : undefined}
        >
          <span>
            <LogOut size={12} />
          </span>
          {!collapsed && <p>Logout</p>}
        </button>
        {!collapsed && <div className="pos-footer-note">2026 Diastar App</div>}
      </div>
    </aside>
  );
};
