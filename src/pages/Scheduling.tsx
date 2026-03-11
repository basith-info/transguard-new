import React from "react";
import { Routes, Route, Link, useLocation, Navigate } from "react-router-dom";
import {
  LayoutDashboard,
  Calendar as CalendarIcon,
  Users,
  Clock,
  ChevronRight
} from "lucide-react";
import { motion } from "framer-motion";

import SchedulingDashboard from "./Scheduling/SchedulingDashboard";
import CalendarView from "./Scheduling/CalendarView";
import SiteAssignments from "./Scheduling/SiteAssignments";
import ScheduleTemplates from "./Scheduling/ScheduleTemplates";
import TodayCoverage from "./Scheduling/TodayCoverage";

const SubNavItem = ({ to, icon: Icon, label, active }: any) => (
  <Link to={to}>
    <div className={`flex items-center gap-3 px-6 py-4 rounded-2xl transition-all duration-300 group ${active
        ? "bg-brand-navy text-white shadow-xl shadow-brand-navy/20"
        : "text-slate-500 hover:bg-white hover:text-brand-navy hover:shadow-sm border border-transparent hover:border-slate-200"
      }`}>
      <Icon size={20} className={active ? "text-white" : "group-hover:text-brand-navy transition-colors"} />
      <span className="font-black text-[10px] uppercase tracking-[0.2em]">{label}</span>
      {active && (
        <motion.div
          layoutId="active-pill"
          className="ml-auto"
        >
          <ChevronRight size={16} />
        </motion.div>
      )}
    </div>
  </Link>
);

export default function Scheduling() {
  const location = useLocation();

  const subMenuItems = [
    { to: "/scheduling", icon: LayoutDashboard, label: "Overview", exact: true },
    { to: "/scheduling/calendar", icon: CalendarIcon, label: "Calendar" },
    { to: "/scheduling/assignments", icon: Users, label: "Assignments" },
    { to: "/scheduling/templates", icon: Clock, label: "Templates" },
  ];

  const isActive = (item: any) => {
    if (item.exact) return location.pathname === item.to;
    return location.pathname.startsWith(item.to);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-10 min-h-[calc(100vh-120px)]">
      {/* Sub-Navigation Sidebar */}
      <aside className="lg:w-72 flex flex-col gap-3">
        <div className="mb-6 px-6">
          <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Scheduling</h2>
        </div>
        <nav className="flex flex-col gap-2.5">
          {subMenuItems.map((item) => (
            <SubNavItem
              key={item.to}
              to={item.to}
              icon={item.icon}
              label={item.label}
              active={isActive(item)}
            />
          ))}
        </nav>

        {/* Auto-Scheduling tip now shown inline in the dashboard overview */}
      </aside>

      {/* Sub-Page Content */}
      <main className="flex-1">
        <Routes>
          <Route index element={<SchedulingDashboard />} />
          <Route path="today" element={<TodayCoverage />} />
          <Route path="calendar" element={<CalendarView />} />
          <Route path="assignments" element={<SiteAssignments />} />
          <Route path="templates" element={<ScheduleTemplates />} />
        </Routes>
      </main>
    </div>
  );
}
