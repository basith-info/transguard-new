import React, { useState, useEffect } from "react";
import {
  CalendarDays,
  Users,
  Building2,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Clock,
  RefreshCw,
  UserX,
  Sun,
  ShieldAlert,
  Zap,
  Eye,
  UserPlus,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format, startOfWeek, addDays } from "date-fns";
import { Link } from "react-router-dom";

/* ─── Fade-up animation preset ──────────────────────────────── */
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay, ease: [0.4, 0, 0.2, 1] },
});

/* ─── KPI card ───────────────────────────────────────────────── */
function KPICard({
  label, value, sub1, sub2, icon: Icon, accent, trend
}: {
  label: string; value: number | string; sub1: string; sub2?: string;
  icon: React.ElementType; accent: "blue" | "emerald" | "amber" | "red"; trend?: "up" | "down" | "flat";
}) {
  const scheme = {
    blue: { bg: "from-brand-navy to-slate-700", ring: "border-brand-navy/20", light: "bg-blue-50", text: "text-blue-600", dot: "bg-blue-500" },
    emerald: { bg: "from-emerald-600 to-teal-700", ring: "border-emerald-200", light: "bg-emerald-50", text: "text-emerald-600", dot: "bg-emerald-500" },
    amber: { bg: "from-amber-500 to-orange-600", ring: "border-amber-200", light: "bg-amber-50", text: "text-amber-600", dot: "bg-amber-500" },
    red: { bg: "from-red-600 to-rose-700", ring: "border-red-200", light: "bg-red-50", text: "text-red-600", dot: "bg-red-500" },
  }[accent];

  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor = trend === "up" ? "text-emerald-600" : trend === "down" ? "text-red-500" : "text-slate-400";

  return (
    <motion.div {...fadeUp()} className={`relative overflow-hidden rounded-[2rem] border ${scheme.ring} bg-white shadow-sm hover:shadow-xl transition-all duration-300 group cursor-default`}>
      {/* Gradient strip at top */}
      <div className={`h-1.5 w-full bg-gradient-to-r ${scheme.bg}`} />

      <div className="p-7">
        <div className="flex items-start justify-between mb-6">
          <div className={`w-12 h-12 ${scheme.light} rounded-2xl flex items-center justify-center shadow-inner`}>
            <Icon size={22} className={scheme.text} />
          </div>
          {trend && (
            <span className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-widest ${trendColor}`}>
              <TrendIcon size={12} />
            </span>
          )}
        </div>

        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-1.5">{label}</p>
        <h3 className="text-5xl font-black text-brand-navy tracking-tight leading-none mb-5">{value}</h3>

        <div className={`h-px w-full bg-gradient-to-r ${scheme.bg} opacity-10 mb-4`} />
        <p className={`text-xs font-black ${scheme.text} mb-1`}>{sub1}</p>
        {sub2 && <p className="text-[10px] text-slate-400 font-medium">{sub2}</p>}
      </div>
    </motion.div>
  );
}

/* ─── Quick action row ───────────────────────────────────────── */
function ActionRow({ icon: Icon, label, desc, to, onClick, urgent }: any) {
  const Tag: any = to ? Link : onClick ? "button" : "div";
  const props = to ? { to } : onClick ? { onClick } : {};
  return (
    <Tag {...props}
      className={`flex items-center gap-4 p-4 rounded-2xl border transition-all group text-left w-full ${urgent
          ? "bg-red-50 border-red-200 hover:bg-red-100"
          : "bg-white border-slate-100 hover:border-brand-navy/20 hover:shadow-md"
        } ${onClick ? "cursor-pointer" : ""}`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all ${urgent ? "bg-red-500 text-white" : "bg-slate-50 text-brand-navy group-hover:bg-brand-navy group-hover:text-white"
        }`}>
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-black leading-tight ${urgent ? "text-red-700" : "text-brand-navy"}`}>{label}</p>
        <p className="text-[10px] text-slate-400 font-medium mt-0.5 truncate">{desc}</p>
      </div>
      <ChevronRight size={14} className={`shrink-0 transition-transform group-hover:translate-x-1 ${urgent ? "text-red-400" : "text-slate-300"}`} />
    </Tag>
  );
}

/* ─── Main ───────────────────────────────────────────────────── */
export default function SchedulingDashboard() {
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [replacePanelOpen, setReplacePanelOpen] = useState(false);
  const [tempAssignmentOpen, setTempAssignmentOpen] = useState(false);
  const [absentSlots, setAbsentSlots] = useState<any[]>([]);
  const [availableGuards, setAvailableGuards] = useState<any[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [replacementNote, setReplacementNote] = useState("");
  const [clients, setClients] = useState<any[]>([]);
  const [guards, setGuards] = useState<any[]>([]);
  const [tempForm, setTempForm] = useState({ guard_id: "", client_id: "", date: "", shift: "Day", reason: "Cover" });
  const [showAllGaps, setShowAllGaps] = useState(false);

  const todayFull = format(new Date(), "EEEE, dd MMMM yyyy");
  const todayShort = format(new Date(), "yyyy-MM-dd");

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [overviewRes, clientsRes, guardsRes] = await Promise.all([
        fetch("/api/scheduling/overview"),
        fetch("/api/clients"),
        fetch("/api/guards"),
      ]);
      const data = await overviewRes.json();
      setOverview(data);
      setClients(await clientsRes.json());
      setGuards(await guardsRes.json());
      setLastUpdated(new Date());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const openReplacePanel = async () => {
    setReplacePanelOpen(true);
    setSelectedSlot(null);
    const [slotsRes, availRes] = await Promise.all([
      fetch(`/api/scheduling/absent-slots?date=${todayShort}`),
      fetch(`/api/guards/available?date=${todayShort}`),
    ]);
    setAbsentSlots(await slotsRes.json());
    setAvailableGuards(await availRes.json());
  };

  const handleReplaceGuard = async (replacementGuardId: number) => {
    if (!selectedSlot) return;
    await fetch("/api/daily-schedules/replace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: selectedSlot.date,
        original_guard_id: selectedSlot.guard_id,
        replacement_guard_id: replacementGuardId,
        client_id: selectedSlot.client_id,
        template_id: selectedSlot.template_id,
        notes: replacementNote,
      }),
    });
    setReplacePanelOpen(false);
    setSelectedSlot(null);
    setReplacementNote("");
    load();
  };

  const openTempAssignment = () => {
    setTempAssignmentOpen(true);
    setTempForm({
      guard_id: "",
      client_id: "",
      date: todayShort,
      shift: "Day",
      reason: "Cover",
    });
  };

  const handleTempAssignment = async () => {
    if (!tempForm.guard_id || !tempForm.client_id) return;
    await fetch("/api/daily-schedules/temporary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        guard_id: Number(tempForm.guard_id),
        client_id: Number(tempForm.client_id),
        date: tempForm.date,
        shift: tempForm.shift,
        reason: tempForm.reason,
      }),
    });
    setTempAssignmentOpen(false);
    load();
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), i));

  const gapAccent = (): "emerald" | "amber" | "red" => {
    if (!overview) return "amber";
    if (overview.openGaps === 0) return "emerald";
    if (overview.openGaps <= 3) return "amber";
    return "red";
  };

  const deployedAccent = (): "emerald" | "amber" | "red" => {
    if (!overview) return "amber";
    const pct = overview.deployedToday / Math.max(overview.totalAssignments, 1);
    if (pct >= 0.9) return "emerald";
    if (pct >= 0.5) return "amber";
    return "red";
  };

  return (
    <div className="space-y-10 pb-20">

      {/* ── Hero Header ─────────────────────────────────────────── */}
      <motion.div {...fadeUp(0)} className="relative overflow-hidden bg-brand-navy rounded-[2.5rem] px-10 py-10 shadow-2xl shadow-brand-navy/30">
        {/* Decorative circles */}
        <div className="absolute -top-10 -right-10 w-64 h-64 bg-white/5 rounded-full" />
        <div className="absolute -bottom-10 -right-32 w-96 h-96 bg-white/[0.03] rounded-full" />
        <div className="absolute top-4 right-20 w-20 h-20 bg-white/5 rounded-full" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              <span className="text-xs font-black text-white/50 uppercase tracking-[0.3em]">Live — {todayFull}</span>
            </div>
            <h2 className="text-4xl font-black text-white tracking-tight leading-tight">Scheduling Hub</h2>
            <p className="text-white/50 font-medium mt-1.5 text-sm">Real-time deployment overview and operational gap tracking</p>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            {lastUpdated && (
              <span className="text-[10px] text-white/40 font-medium">
                Last updated: {format(lastUpdated, "h:mm a")}
              </span>
            )}
            <button onClick={load}
              className="p-3.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all border border-white/10"
              title="Refresh">
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            </button>
            <Link to="/scheduling/calendar"
              className="flex items-center gap-3 bg-white text-brand-navy font-black uppercase tracking-widest text-xs px-8 py-4 rounded-2xl hover:bg-slate-50 transition-all shadow-xl hover:shadow-2xl hover:scale-105">
              <CalendarDays size={18} />
              Open Calendar
            </Link>
          </div>
        </div>

        {/* Inline context strip */}
        {overview && (
          <div className="relative mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Assigned", value: overview.totalAssignments, icon: Users, color: "text-blue-300" },
              { label: "Present Today", value: overview.deployedToday, icon: Sun, color: "text-emerald-300" },
              { label: "Absent Today", value: overview.absentToday, icon: UserX, color: "text-red-300" },
              { label: "Sites Affected", value: overview.sitesNeedingCover, icon: ShieldAlert, color: "text-amber-300" },
            ].map(({ label, value, icon: Ic, color }) => (
              <div key={label} className="flex items-center gap-3 bg-white/[0.07] border border-white/10 rounded-2xl px-5 py-4">
                <Ic size={18} className={color} />
                <div>
                  <p className="text-xl font-black text-white leading-none">{value}</p>
                  <p className="text-[9px] text-white/40 font-black uppercase tracking-widest mt-0.5">{label}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* ── This Week Summary Strip ── */}
      {overview && (
        <motion.div {...fadeUp(0.05)} className="flex flex-wrap gap-2">
          {weekDays.map((d) => {
            const isToday = format(d, "yyyy-MM-dd") === todayShort;
            const isPast = d < new Date() && !isToday;
            return (
              <div
                key={d.toISOString()}
                className={`flex flex-col items-center px-4 py-3 rounded-xl border min-w-[4rem] ${
                  isToday ? "bg-blue-50 border-blue-200 ring-2 ring-blue-200" : "bg-white border-slate-100"
                }`}
              >
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  {format(d, "EEE")}
                </span>
                <span className={`text-lg font-black ${isToday ? "text-blue-600" : "text-brand-navy"}`}>
                  {format(d, "d")}
                </span>
                {isPast && <span className="text-[10px] text-emerald-600 font-bold">✓</span>}
                {isToday && overview.deployedToday > 0 && (
                  <span className="text-[10px] font-bold text-slate-500">
                    {overview.deployedToday} deployed
                  </span>
                )}
              </div>
            );
          })}
        </motion.div>
      )}

      {/* ── Unassigned Guards Alert ── */}
      {!loading && overview?.unassignedGuards?.length > 0 && (
        <motion.div {...fadeUp(0.05)} className="flex items-center justify-between p-4 rounded-2xl bg-amber-50 border border-amber-200">
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} className="text-amber-600" />
            <div>
              <p className="font-black text-amber-800">
                {overview.unassignedGuards.length} guard{overview.unassignedGuards.length !== 1 ? "s" : ""} have no site assignment
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                {overview.unassignedGuards.slice(0, 3).map((g: any) => g.full_name).join(", ")}
                {overview.unassignedGuards.length > 3 && ` [+${overview.unassignedGuards.length - 3} more]`}
              </p>
            </div>
          </div>
          <Link
            to="/scheduling/assignments"
            className="text-xs font-black text-amber-700 uppercase tracking-widest flex items-center gap-1 hover:text-amber-800"
          >
            Assign Now <ArrowRight size={12} />
          </Link>
        </motion.div>
      )}

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        {loading ? (
          Array(4).fill(0).map((_, i) => (
            <div key={i} className="rounded-[2rem] border border-slate-100 bg-white p-7 space-y-4 animate-pulse">
              <div className="w-12 h-12 rounded-2xl bg-slate-100" />
              <div className="h-3 w-1/2 bg-slate-100 rounded-lg" />
              <div className="h-10 w-2/3 bg-slate-50 rounded-xl" />
              <div className="h-px bg-slate-100" />
              <div className="h-3 w-3/4 bg-slate-50 rounded-lg" />
            </div>
          ))
        ) : overview && (
          <>
            <KPICard
              label="Active Assignments"
              value={overview.totalAssignments}
              sub1={`Across ${overview.activeSites} active sites`}
              sub2="Guards with a current client assignment"
              icon={Users}
              accent="blue"
            />
            <KPICard
              label="Active Sites"
              value={overview.activeSites}
              sub1={`${overview.activeSites - (overview.siteGapDetails?.length || 0)} fully staffed`}
              sub2={`${overview.siteGapDetails?.length || 0} sites have open gaps`}
              icon={Building2}
              accent={overview.siteGapDetails?.length === 0 ? "emerald" : "amber"}
            />
            <KPICard
              label="Open Gaps"
              value={overview.openGaps}
              sub1={overview.openGaps === 0 ? "All sites fully staffed ✓" : `${overview.openGaps} guards needed`}
              sub2={overview.openGaps > 0 ? `${overview.siteGapDetails?.length} sites understaffed` : "No action required"}
              icon={AlertTriangle}
              accent={gapAccent()}
            />
            <KPICard
              label="Deployed Today"
              value={overview.deployedToday}
              sub1={`${overview.absentToday} absent · ${overview.sitesNeedingCover} sites need cover`}
              sub2="Based on today's attendance records"
              icon={CheckCircle2}
              accent={deployedAccent()}
            />
          </>
        )}
      </div>

      {/* ── Lower grid ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

        {/* Gap Alerts — 2/3 width */}
        <motion.div {...fadeUp(0.1)} className="xl:col-span-2 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center">
                <AlertTriangle size={16} className="text-red-500" />
              </div>
              <div>
                <h3 className="text-lg font-black text-brand-navy tracking-tight leading-none">Site Gap Alerts</h3>
                <p className="text-[10px] text-slate-400 font-medium tracking-widest uppercase mt-0.5">Sites with insufficient guard coverage</p>
              </div>
            </div>
            <Link to="/scheduling/assignments"
              className="text-[10px] font-black text-brand-navy uppercase tracking-widest flex items-center gap-1.5 hover:text-slate-600 transition-colors">
              Manage <ChevronRight size={12} />
            </Link>
          </div>

          <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-sm">
            {/* Empty state — compact */}
            {!loading && (!overview?.siteGapDetails || overview.siteGapDetails.length === 0) && (
              <div className="flex items-center gap-5 px-8 py-7 border-b border-slate-50 last:border-b-0">
                <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                  <CheckCircle2 size={20} className="text-emerald-500" />
                </div>
                <div>
                  <p className="text-base font-black text-brand-navy">All sites are fully staffed</p>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">No open gaps detected based on current guard assignments</p>
                </div>
                <span className="ml-auto text-[10px] font-black text-emerald-600 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-full whitespace-nowrap">
                  ✅ All Clear
                </span>
              </div>
            )}

            {/* Loading skeleton */}
            {loading && Array(3).fill(0).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-6 py-5 border-b border-slate-50 animate-pulse">
                <div className="w-10 h-10 rounded-xl bg-slate-100 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-slate-100 rounded w-1/3" />
                  <div className="h-2.5 bg-slate-50 rounded w-1/2" />
                </div>
                <div className="h-6 w-20 bg-slate-100 rounded-full" />
              </div>
            ))}

            {/* Gap rows — clickable to open site scheduling */}
            {!loading && (() => {
              const gaps = overview?.siteGapDetails || [];
              const displayGaps = showAllGaps || gaps.length <= 5 ? gaps : gaps.slice(0, 5);
              return (
                <>
            {displayGaps.map((site: any, i: number) => {
              const missing = site.guards_required - site.assigned_count;
              const isCritical = missing >= 3;
              const isWarn = missing === 2;

              return (
                <Link key={site.id} to={`/scheduling/calendar?client=${site.id}`}
                  className={`flex items-center justify-between px-6 py-5 border-b border-slate-50 last:border-b-0 hover:bg-slate-50/50 transition-colors group cursor-pointer ${isCritical ? 'border-l-4 border-l-red-400' : isWarn ? 'border-l-4 border-l-amber-400' : 'border-l-4 border-l-slate-200'}`}>
                  <div className="flex items-center gap-4">
                    <motion.div {...fadeUp(i * 0.05)}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isCritical ? 'bg-red-50 text-red-500' : isWarn ? 'bg-amber-50 text-amber-500' : 'bg-slate-50 text-slate-400'}`}>
                      <Building2 size={16} />
                    </motion.div>
                    <div>
                      <p className="text-sm font-black text-brand-navy">{site.name}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                        {site.assigned_count} of {site.guards_required} assigned
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-3.5 py-1.5 rounded-full text-[10px] font-black border whitespace-nowrap ${isCritical ? 'bg-red-50 text-red-600 border-red-200'
                        : isWarn ? 'bg-amber-50 text-amber-600 border-amber-200'
                          : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}>
                      −{missing} guard{missing !== 1 ? 's' : ''}
                    </span>
                    <span className="text-[10px] font-black text-brand-navy uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                      Manage →
                    </span>
                  </div>
                </Link>
              );
            })}
            {gaps.length > 5 && !showAllGaps && (
              <button
                onClick={() => setShowAllGaps(true)}
                className="w-full py-4 text-center text-sm font-bold text-brand-navy hover:bg-slate-50 transition-colors border-b border-slate-50"
              >
                Show All ({gaps.length} sites)
              </button>
            )}
            {showAllGaps && gaps.length > 5 && (
              <button
                onClick={() => setShowAllGaps(false)}
                className="w-full py-4 text-center text-sm font-bold text-slate-500 hover:bg-slate-50 transition-colors"
              >
                Show less
              </button>
            )}
                </>
              );
            })()}
          </div>
        </motion.div>

        {/* Daily Operations — 1/3 width */}
        <motion.div {...fadeUp(0.15)} className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-navy/10 flex items-center justify-center border border-brand-navy/10">
              <Zap size={16} className="text-brand-navy" />
            </div>
            <div>
              <h3 className="text-lg font-black text-brand-navy tracking-tight leading-none">Daily Operations</h3>
              <p className="text-[10px] text-slate-400 font-medium tracking-widest uppercase mt-0.5">Common supervisor actions</p>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            {/* Operational */}
            <ActionRow
              icon={UserX}
              label="Assign Replacement Guard"
              desc="Cover a sick or absent guard instantly"
              onClick={openReplacePanel}
              urgent={overview?.absentToday > 0}
            />
            <ActionRow
              icon={Eye}
              label="View Today's Coverage"
              desc={`${overview?.deployedToday ?? '—'} guards deployed · ${overview?.absentToday ?? 0} absent`}
              to="/scheduling/today"
            />
            <ActionRow
              icon={UserPlus}
              label="Add Temporary Assignment"
              desc="One-day cover or event security"
              onClick={openTempAssignment}
            />

            {/* Divider */}
            <div className="flex items-center gap-2 py-1">
              <div className="flex-1 h-px bg-slate-100" />
              <span className="text-[9px] text-slate-300 font-black uppercase tracking-widest px-1">Admin</span>
              <div className="flex-1 h-px bg-slate-100" />
            </div>

            <ActionRow icon={Users} label="Site Assignments" desc="Manage permanent guard placements" to="/scheduling/assignments" />
            <ActionRow icon={Clock} label="Shift Templates" desc="Configure reusable shift patterns" to="/scheduling/templates" />
            <ActionRow icon={CalendarDays} label="Open Calendar" desc="Full monthly schedule view" to="/scheduling/calendar" />
          </div>

          {/* Auto-scheduling info banner */}
          <div className="mt-2 bg-gradient-to-br from-brand-navy to-slate-700 rounded-2xl p-5 text-white">
            <div className="flex items-center gap-3 mb-2">
              <Zap size={16} className="text-white/60" />
              <span className="text-xs font-black uppercase tracking-widest text-white/80">Auto-Scheduling</span>
            </div>
            <p className="text-[11px] text-white/50 leading-relaxed font-medium">
              Assignments automatically populate the calendar. Use the calendar to manage exceptions and one-off replacements.
            </p>
          </div>
        </motion.div>
      </div>

      {/* ── Assign Replacement Side Panel ── */}
      <AnimatePresence>
        {replacePanelOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex justify-end"
            onClick={() => setReplacePanelOpen(false)}
          >
            <div className="absolute inset-0 bg-black/30" />
            <motion.div
              initial={{ x: 400 }}
              animate={{ x: 0 }}
              exit={{ x: 400 }}
              transition={{ type: "spring", damping: 25 }}
              className="relative w-full max-w-md bg-white shadow-2xl overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
                <h3 className="text-lg font-black text-brand-navy">Assign Replacement Guard</h3>
                <button onClick={() => setReplacePanelOpen(false)} className="p-2 rounded-lg hover:bg-slate-100">
                  <X size={18} />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Replace for</p>
                  <p className="font-bold text-brand-navy mt-1">Today, {format(new Date(), "dd MMM yyyy")}</p>
                </div>

                {absentSlots.length === 0 ? (
                  <p className="text-sm text-slate-500">No absent guards need replacement today.</p>
                ) : (
                  <>
                    <div>
                      <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Absent Guard</p>
                      <div className="space-y-2">
                        {absentSlots.map((slot) => (
                          <button
                            key={slot.id}
                            onClick={() => {
                              setSelectedSlot(slot);
                              fetch(`/api/guards/available?date=${slot.date}&rank=${slot.rank || ""}`)
                                .then((r) => r.json())
                                .then(setAvailableGuards);
                            }}
                            className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                              selectedSlot?.id === slot.id ? "border-brand-navy bg-brand-navy/5" : "border-slate-200 hover:border-slate-300"
                            }`}
                          >
                            <p className="font-bold text-brand-navy">{slot.guard_name}</p>
                            <p className="text-xs text-slate-500">{slot.client_name} · {slot.template_name} · {slot.rank || "—"}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {selectedSlot && (
                      <>
                        <div>
                          <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Available Guards (matching rank)</p>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {availableGuards.length === 0 ? (
                              <p className="text-sm text-slate-500">No available guards.</p>
                            ) : (
                              availableGuards.map((g: any) => (
                                <button
                                  key={g.id}
                                  onClick={() => handleReplaceGuard(g.id)}
                                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 hover:border-brand-navy hover:bg-brand-navy/5 transition-all text-left"
                                >
                                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                                    <User size={14} className="text-slate-600" />
                                  </div>
                                  <div>
                                    <p className="font-bold text-brand-navy">{g.full_name}</p>
                                    <p className="text-xs text-slate-500">{g.rank || g.designation || "—"}</p>
                                  </div>
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-2">Notes (optional)</label>
                          <input
                            type="text"
                            value={replacementNote}
                            onChange={(e) => setReplacementNote(e.target.value)}
                            placeholder="e.g. Cover for sick leave"
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm"
                          />
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Add Temporary Assignment Modal ── */}
      <AnimatePresence>
        {tempAssignmentOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setTempAssignmentOpen(false)}
          >
            <div className="absolute inset-0 bg-black/30" />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-black text-brand-navy">Add Temporary Assignment</h3>
                <button onClick={() => setTempAssignmentOpen(false)} className="p-2 rounded-lg hover:bg-slate-100">
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-2">Guard</label>
                  <select
                    value={tempForm.guard_id}
                    onChange={(e) => setTempForm((f) => ({ ...f, guard_id: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200"
                  >
                    <option value="">Choose...</option>
                    {guards.filter((g: any) => g.status === "Active").map((g: any) => (
                      <option key={g.id} value={g.id}>{g.full_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-2">Client / Site</label>
                  <select
                    value={tempForm.client_id}
                    onChange={(e) => setTempForm((f) => ({ ...f, client_id: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200"
                  >
                    <option value="">Choose...</option>
                    {clients.filter((c: any) => c.status === "Active").map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-2">Date</label>
                  <input
                    type="date"
                    value={tempForm.date}
                    onChange={(e) => setTempForm((f) => ({ ...f, date: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200"
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-2">Shift</label>
                  <div className="flex gap-2">
                    {["Day", "Night"].map((s) => (
                      <button
                        key={s}
                        onClick={() => setTempForm((f) => ({ ...f, shift: s }))}
                        className={`flex-1 py-3 rounded-xl border font-bold text-sm ${
                          tempForm.shift === s ? "border-brand-navy bg-brand-navy text-white" : "border-slate-200"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-2">Reason</label>
                  <div className="flex gap-2 flex-wrap">
                    {["Cover", "Event", "Emergency"].map((r) => (
                      <button
                        key={r}
                        onClick={() => setTempForm((f) => ({ ...f, reason: r }))}
                        className={`px-4 py-2 rounded-xl border font-bold text-sm ${
                          tempForm.reason === r ? "border-brand-navy bg-brand-navy text-white" : "border-slate-200"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={handleTempAssignment}
                  disabled={!tempForm.guard_id || !tempForm.client_id}
                  className="w-full py-4 rounded-xl bg-brand-navy text-white font-black uppercase tracking-widest hover:bg-brand-navy/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create Assignment
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
