import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, UserCheck, UserX, Building2, AlertTriangle,
  CreditCard, Utensils, CheckCircle2, Clock, ExternalLink, ChevronRight,
  TrendingUp, TrendingDown, Bell
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

// ─── helpers ───────────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, string> = {
  P: "Present", H: "Half-Day", A: "Absent", "": "Not Marked",
};

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function fmtLKR(n: number) {
  return "LKR " + n.toLocaleString("en-LK", { maximumFractionDigits: 0 });
}

// ─── sub-components ────────────────────────────────────────────────────────

const DashboardSkeleton = () => (
  <div className="space-y-8 animate-pulse">
    <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
      <div>
        <div className="h-3 w-32 bg-slate-200 rounded mb-3"></div>
        <div className="h-10 w-64 bg-slate-200 rounded"></div>
        <div className="h-4 w-48 bg-slate-100 rounded mt-2"></div>
      </div>
      <div className="flex gap-3">
        <div className="h-10 w-32 bg-slate-200 rounded-2xl"></div>
        <div className="h-10 w-32 bg-slate-200 rounded-2xl"></div>
      </div>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      {[1, 2, 3, 4].map(i => <div key={i} className="h-36 bg-slate-100 rounded-[2rem]"></div>)}
    </div>
    <div className="flex flex-col xl:flex-row gap-5">
      <div className="flex-1 space-y-5">
        <div className="h-[340px] bg-slate-100 rounded-[2rem]"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="h-64 bg-slate-100 rounded-[2rem]"></div>
          <div className="h-64 bg-slate-100 rounded-[2rem]"></div>
        </div>
      </div>
      <div className="w-full xl:w-80 h-[620px] bg-slate-100 rounded-[2rem]"></div>
    </div>
  </div>
);

const KpiCard = ({ title, value, icon: Icon, color, bg, border, sub1, trend, trendGood, onClick }: any) => (
  <div
    onClick={onClick}
    className={`bg-white border-y border-r border-slate-200 border-l-[6px] ${border} p-6 flex flex-col justify-between group ${onClick ? "cursor-pointer hover:-translate-y-1 shadow-sm hover:shadow-md" : ""} transition-all duration-300 rounded-[1.5rem]`}
  >
    <div className="flex items-start justify-between mb-3">
      <div className={`p-3 rounded-[1rem] ${bg} group-hover:scale-110 transition-transform`}>
        <Icon className={color} size={22} strokeWidth={2.5} />
      </div>
      {trend && (
        <span className={`flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full ${trendGood ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
          {trendGood ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {trend}
        </span>
      )}
    </div>
    <div>
      <h3 className="text-[2.5rem] leading-none font-black text-slate-800 tracking-tight">{value}</h3>
      <p className="text-slate-500 font-bold text-sm mt-3 uppercase tracking-wider">{title}</p>
      {sub1 && <p className="text-slate-400 text-xs mt-1 font-medium">{sub1}</p>}
    </div>
  </div>
);

// ─── main component ─────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [todayAttendanceMarked, setTodayAttendanceMarked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const today = new Date();
  const monthParam = today.getMonth() + 1;
  const yearParam = today.getFullYear();

  const fetchDashboardData = () => {
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    Promise.all([
      fetch("/api/stats", { signal: controller.signal }).then(r => r.ok ? r.json() : Promise.reject(new Error(r.statusText))),
      fetch(`/api/dashboard/monthly-attendance?month=${monthParam}&year=${yearParam}`, { signal: controller.signal }).then(r => r.ok ? r.json() : []),
      fetch("/api/dashboard/recent-activity", { signal: controller.signal }).then(r => r.ok ? r.json() : [])
    ])
      .then(([s, chart, act]) => {
        clearTimeout(timeoutId);
        if (s?.error) throw new Error(s.error);
        setStats(s);
        setChartData(Array.isArray(chart) ? chart : []);
        const todayStr = today.toISOString().split("T")[0];
        const todayRow = (Array.isArray(chart) ? chart : []).find((c: any) => c.date === todayStr);
        setTodayAttendanceMarked(!!todayRow && (todayRow.present + todayRow.half + todayRow.absent) > 0);
        setActivity(Array.isArray(act) ? act : []);
        setLoading(false);
      })
      .catch(err => {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') setError("Connection timed out. Please try again.");
        else setError(err.message || "Failed to load dashboard data.");
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchDashboardData();
  }, [monthParam, yearParam]);

  const donutData = useMemo(() => {
    if (!stats) return [];
    const total = (stats.totalGuards || 0) + (stats.onLeave || 0) + (stats.resigned || 0);
    if (total === 0) return [{ name: "No Data", value: 1 }];
    return [
      { name: "Active", value: stats.totalGuards || 0 },
      { name: "On Leave", value: stats.onLeave || 0 },
      { name: "Resigned", value: stats.resigned || 0 },
    ].filter(d => d.value > 0);
  }, [stats]);

  const DONUT_COLORS = ["#22c55e", "#f59e0b", "#ef4444"];

  if (loading) return <DashboardSkeleton />;

  if (error || !stats) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <div className="bg-red-50 p-6 rounded-full mb-6 text-red-500">
          <AlertTriangle size={48} strokeWidth={1.5} />
        </div>
        <h2 className="text-2xl font-black text-slate-800 mb-2">Oops! Couldn't load dashboard</h2>
        <p className="text-slate-500 mb-6">{error || "An unexpected error occurred."}</p>
        <button
          onClick={fetchDashboardData}
          className="bg-brand-navy hover:bg-slate-800 text-white px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-lg"
        >
          Try Again
        </button>
      </div>
    );
  }

  const presentPct = stats.totalGuards > 0 ? Math.round((stats.presentToday / stats.totalGuards) * 100) : 0;
  const monthName = today.toLocaleString("en-GB", { month: "short" });

  const alerts: { label: string; icon: string; href: string }[] = [];
  if (stats.sitesWithGaps > 0) alerts.push({ label: `${stats.sitesWithGaps} Site Gaps`, icon: "⚠️", href: "/scheduling" });
  if (stats.pendingPayroll > 0) alerts.push({ label: `Payroll Unapproved`, icon: "💰", href: "/payroll" });

  // Heatmap generation
  const daysInMonth = new Date(yearParam, monthParam, 0).getDate();
  const heatmapDays = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const row = chartData.find(d => d.day === day);
    const total = row ? (row.present + row.half + row.absent) : 0;
    const isToday = day === today.getDate();
    let intensityClass = "bg-slate-100 border border-slate-200"; // No data
    if (total > 0) {
      const pct = Math.round((row.present / total) * 100);
      if (pct >= 95) intensityClass = "bg-[#7c3aed] text-white"; // Highest
      else if (pct >= 85) intensityClass = "bg-[#8b5cf6] text-white opacity-90"; // High
      else if (pct >= 70) intensityClass = "bg-[#a78bfa] text-white opacity-80"; // Medium
      else intensityClass = "bg-[#c4b5fd] text-slate-800"; // Low
    }
    return { day, pct: total > 0 ? Math.round((row.present / total) * 100) : null, intensityClass, isToday };
  });

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10">
      {/* ── Header ── */}
      <div className="flex items-center justify-between bg-white px-8 py-6 rounded-[2rem] border border-slate-200 shadow-sm">
        <div>
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1.5 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            {fmtDate(today)}
          </p>
          <h1 className="text-[28px] md:text-3xl font-black text-brand-navy tracking-tight">Good Morning, Admin 👋</h1>
          <p className="text-slate-500 font-medium mt-1">{stats.totalGuards} guards active across {stats.totalClients} sites today</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate("/attendance")}
            className="bg-brand-navy hover:bg-slate-800 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-lg flex items-center gap-2"
          >
            {todayAttendanceMarked ? <><CheckCircle2 size={16} /> View Attendance</> : <><UserCheck size={16} /> Mark Attendance</>}
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <KpiCard
          title="Active Guards"
          value={stats.totalGuards}
          icon={Users}
          border="border-l-[#7c3aed]"
          color="text-[#7c3aed]"
          bg="bg-[#7c3aed]/10"
          sub1={`${stats.presentToday} deployed · ${stats.totalGuards - stats.presentToday} unmarked`}
          trend="+3" trendGood={true}
          onClick={() => navigate("/guards")}
        />
        <KpiCard
          title="Present Today"
          value={`${presentPct}%`}
          icon={UserCheck}
          border="border-l-emerald-500"
          color="text-emerald-500"
          bg="bg-emerald-50"
          sub1={`${stats.presentToday} total present`}
          trend="+1.2%" trendGood={true}
          onClick={() => navigate("/attendance")}
        />
        <KpiCard
          title="Absent/Leave"
          value={stats.absentToday + (stats.onLeave || 0)}
          icon={UserX}
          border="border-l-amber-500"
          color="text-amber-500"
          bg="bg-amber-50"
          sub1={`${stats.absentToday} Absent · ${stats.onLeave || 0} Leave`}
          trend="-2" trendGood={true}
          onClick={() => navigate("/attendance")}
        />
        <KpiCard
          title="Active Clients"
          value={stats.totalClients}
          icon={Building2}
          border="border-l-brand-accent"
          color="text-brand-accent"
          bg="bg-brand-accent/10"
          sub1={stats.sitesWithGaps > 0 ? `${stats.sitesWithGaps} sites have gaps` : "100% Fully Covered"}
          onClick={() => navigate("/clients")}
        />
      </div>

      <div className="flex flex-col xl:flex-row gap-6">
        {/* ── Main Left Content ── */}
        <div className="flex-1 space-y-6 min-w-0">

          {/* Attendance Heatmap */}
          <div className="bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm">
            <div className="flex flex-wrapjustify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-black text-brand-navy tracking-tight">Attendance Consistency</h3>
                <p className="text-slate-500 text-sm mt-1">{monthName} {yearParam} Heatmap</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Low</span>
                <div className="flex gap-1.5">
                  <div className="w-5 h-5 rounded-md bg-[#c4b5fd]"></div>
                  <div className="w-5 h-5 rounded-md bg-[#a78bfa]"></div>
                  <div className="w-5 h-5 rounded-md bg-[#8b5cf6]"></div>
                  <div className="w-5 h-5 rounded-md bg-[#7c3aed]"></div>
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">High</span>
              </div>
            </div>

            {chartData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <div className="bg-slate-50 p-4 rounded-full mb-3"><Clock size={32} className="text-slate-300" /></div>
                <p className="font-bold text-slate-600">No attendance data yet</p>
                <p className="text-sm mt-1">Start by marking today's attendance.</p>
              </div>
            ) : (
              <div className="grid grid-cols-7 sm:grid-cols-10 md:grid-cols-14 lg:grid-cols-16 gap-2">
                {heatmapDays.map((hd) => (
                  <div
                    key={hd.day}
                    className={`aspect-square rounded-xl flex items-center justify-center relative group ${hd.intensityClass} ${hd.isToday ? 'ring-2 ring-brand-navy ring-offset-2' : ''}`}
                    title={`Day ${hd.day}: ${hd.pct !== null ? `${hd.pct}%` : 'No data'}`}
                  >
                    <span className={`text-xs font-bold ${hd.pct ? '' : 'text-slate-400'}`}>{hd.pct ? `${hd.pct}%` : '—'}</span>
                    <span className="absolute -top-2 -right-2 text-[9px] font-black bg-white text-slate-800 rounded-full w-4 h-4 flex items-center justify-center shadow-sm border border-slate-200">
                      {hd.day}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Lower Grid (Donut & Payroll) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 p-8 rounded-[2rem] shadow-sm flex flex-col">
              <h3 className="text-lg font-black text-brand-navy tracking-tight mb-6">Workforce Split</h3>
              <div className="flex-1 flex items-center justify-center relative h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={donutData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={4} dataKey="value" stroke="none">
                      {donutData.map((_: any, i: number) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: "16px", border: "none", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-4xl font-black text-brand-navy leading-none">{stats.totalGuards}</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Guards</span>
                </div>
              </div>
            </div>

            <div className="bg-[#0B1221] p-8 rounded-[2rem] shadow-sm flex flex-col text-white relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-48 h-48 bg-brand-accent rounded-full blur-[80px] opacity-20 group-hover:opacity-40 transition-opacity"></div>
              <div className="flex items-center justify-between mb-8 relative z-10">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] bg-white/10 px-3 py-1.5 rounded-full">Payroll Cycle</span>
                <CreditCard size={20} className="text-white/50" />
              </div>
              <div className="relative z-10 flex-1">
                <p className="text-white/60 font-medium text-sm mb-1">Status for {monthName} {yearParam}</p>
                <h3 className="text-3xl font-black tracking-tight mb-4">
                  {stats.payrollStatus === "Approved" ? "Finalised" : stats.payrollStatus === "Not Generated" ? "Not Ready" : "Pending"}
                </h3>

                {stats.payrollStatus === "Approved" ? (
                  <div className="w-full bg-white/10 h-2 rounded-full mb-2"><div className="h-full bg-emerald-400 rounded-full w-full"></div></div>
                ) : (
                  <div className="w-full bg-white/10 h-2 rounded-full mb-2"><div className="h-full bg-amber-400 rounded-full w-[70%]"></div></div>
                )}
                <p className="text-xs text-white/50 font-medium">Cycle completes on 30th {monthName}</p>
              </div>
              <button
                onClick={() => navigate("/payroll")}
                className="w-full bg-white text-[#0B1221] py-3.5 rounded-2xl font-black uppercase tracking-widest text-xs mt-6 hover:bg-slate-100 transition-colors relative z-10"
              >
                Go to Payroll
              </button>
            </div>
          </div>
        </div>

        {/* ── Sticky Right Panel ── */}
        <div className="w-full xl:w-96 flex flex-col gap-6">

          <div className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm">
            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Top Priorities</h3>
            <div className="space-y-3">
              {alerts.length === 0 ? (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                  <CheckCircle2 size={24} className="text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-700">All caught up!</p>
                </div>
              ) : (
                alerts.map((a, i) => (
                  <div key={i} onClick={() => navigate(a.href)} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-4 cursor-pointer hover:bg-slate-100 transition-colors">
                    <span className="text-xl">{a.icon}</span>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{a.label}</p>
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5">Click to resolve</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm flex-1">
            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Recent Activity</h3>
            <div className="space-y-4">
              {activity.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">No activity recorded</p>
              ) : (
                activity.slice(0, 6).map((row: any) => (
                  <div key={row.id} className="flex gap-3 relative">
                    <div className="absolute left-[3px] top-6 bottom-[-16px] w-[2px] bg-slate-100 last:hidden"></div>
                    <div className="w-2 h-2 rounded-full bg-brand-accent mt-2 relative z-10 flex-shrink-0 ring-4 ring-white"></div>
                    <div>
                      <p className="text-sm font-bold text-slate-800 leading-tight">
                        {row.full_name} <span className="font-medium text-slate-500 text-xs">marked {STATUS_MAP[row.status] || row.status}</span>
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">{row.client_name || "Unassigned"} · {row.date}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <button onClick={() => navigate("/attendance")} className="w-full py-3 mt-6 border border-slate-200 text-slate-600 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 transition-colors">
              View Audit Log
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
