import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  CreditCard,
  Building2,
  CalendarDays,
  BarChart3,
  LogOut,
  Menu,
  X,
  Shield,
  Soup
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Dashboard from "./pages/Dashboard";
import Guards from "./pages/Guards";
import GuardProfile from "./pages/GuardProfile";
import Attendance from "./pages/Attendance";
import Payroll from "./pages/Payroll";
import Clients from "./pages/Clients";
import ClientProfile from "./pages/ClientProfile";
import Scheduling from "./pages/Scheduling";
import Reports from "./pages/Reports";
import FoodModule from "./pages/FoodModule";

interface SidebarItemProps {
  to?: string;
  icon?: any;
  label?: string;
  active?: boolean;
  group?: string;
  badge?: number;
  key?: any;
}

const SidebarItem = ({ to, icon: Icon, label, active, group, badge }: SidebarItemProps) => {
  if (group) {
    return (
      <div className="px-6 pt-6 pb-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
        {group}
      </div>
    );
  }

  return (
    <Link to={to!}>
      <div className={`flex items-center gap-3 px-4 py-3.5 mx-2 rounded-[1rem] transition-all duration-200 ${active
        ? "bg-brand-navy text-white shadow-[0_8px_16px_rgba(19,58,108,0.15)] font-bold"
        : "text-slate-500 hover:bg-slate-50 hover:text-brand-navy font-semibold"
        }`}>
        <Icon size={20} strokeWidth={active ? 2.5 : 2} />
        <span className="text-sm flex-1">{label}</span>
        {badge !== undefined && badge > 0 && (
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${active ? "bg-white/20 text-white" : "bg-red-100 text-red-600"
            }`}>
            {badge}
          </span>
        )}
        {active && !badge && <div className="ml-auto w-1 h-5 bg-brand-accent rounded-full" />}
      </div>
    </Link>
  );
};

const Layout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const menuItems = [
    { group: "MAIN" },
    { to: "/", icon: LayoutDashboard, label: "Dashboard" },
    { group: "OPERATIONS" },
    { to: "/scheduling", icon: CalendarDays, label: "Scheduling", badge: 3 },
    { to: "/attendance", icon: CalendarCheck, label: "Attendance" },
    { to: "/guards", icon: Users, label: "Guards" },
    { to: "/clients", icon: Building2, label: "Clients" },
    { group: "FINANCE & ADMIN" },
    { to: "/payroll", icon: CreditCard, label: "Payroll", badge: 12 },
    { to: "/food", icon: Soup, label: "Food Module" },
    { to: "/reports", icon: BarChart3, label: "Reports" },
  ];

  return (
    <div className="flex min-h-screen bg-brand-light text-slate-900 font-sans">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-[260px] bg-white border-r border-slate-100 py-6 sticky top-0 h-screen shadow-[4px_0_24px_rgba(0,0,0,0.01)]">
        <div className="flex items-center justify-center px-6 mb-4">
          <img src="/logo.png" alt="Transguard Logo" className="w-full max-w-[150px] h-auto object-contain" />
        </div>

        <nav className="flex-1 overflow-y-auto no-scrollbar pb-6 flex flex-col gap-1">
          {menuItems.map((item, idx) => (
            <SidebarItem
              key={item.to || item.group || idx}
              to={item.to}
              icon={item.icon}
              label={item.label}
              group={item.group}
              badge={item.badge}
              active={location.pathname === item.to}
            />
          ))}
        </nav>

        <div className="mt-auto border-t border-slate-100 mx-4 pt-4 shrink-0">
          {/* User info */}
          <div className="flex items-center gap-3 px-4 py-3 mb-1">
            <div className="w-9 h-9 rounded-full bg-brand-navy text-white flex items-center justify-center text-sm font-black flex-shrink-0">
              SA
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-800 truncate">Super Admin</p>
              <p className="text-xs text-slate-400 truncate">admin@transguard.lk</p>
            </div>
          </div>
          <Link to="/settings" className="flex items-center gap-3 px-4 py-3 mx-0 rounded-[1rem] text-slate-500 hover:bg-slate-50 hover:text-brand-navy transition-colors font-semibold text-sm">
            <Shield size={18} />
            <span>Settings</span>
          </Link>
          <button className="flex items-center gap-3 px-4 py-3 w-full text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-[1rem] transition-colors font-semibold text-sm">
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-white border-b border-slate-100 p-4 flex items-center justify-between z-50 shadow-sm">
        <div className="flex items-center h-8">
          <img src="/logo.png" alt="Transguard Logo" className="h-full w-auto object-contain" />
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-brand-navy">
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: -100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            className="md:hidden fixed inset-0 bg-white z-40 pt-20 p-6 flex flex-col gap-2 overflow-y-auto pb-10"
          >
            {menuItems.map((item, idx) => {
              if (item.group) {
                return (
                  <div key={idx} className="px-2 pt-6 pb-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {item.group}
                  </div>
                );
              }
              return (
                <Link
                  key={item.to}
                  to={item.to!}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center justify-between px-4 py-4 rounded-xl font-semibold ${location.pathname === item.to
                    ? "bg-brand-navy text-white shadow-lg shadow-brand-navy/20"
                    : "text-slate-500 hover:bg-slate-50"
                    }`}
                >
                  <div className="flex items-center gap-3">
                    {item.icon && <item.icon size={20} />}
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${location.pathname === item.to ? "bg-white/20 text-white" : "bg-red-100 text-red-600"
                      }`}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-10 pt-24 md:pt-10 overflow-x-hidden">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
};

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/guards" element={<Guards />} />
          <Route path="/guards/:id" element={<GuardProfile />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/payroll" element={<Payroll />} />
          <Route path="/food" element={<FoodModule />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/clients/:id" element={<ClientProfile />} />
          <Route path="/scheduling/*" element={<Scheduling />} />
          <Route path="/reports" element={<Reports />} />
        </Routes>
      </Layout>
    </Router>
  );
}
