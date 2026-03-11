import React, { useState, useEffect } from "react";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Search,
  Building2,
  User,
  Clock,
  Calendar as CalendarIcon,
  Filter,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  X,
  Zap,
  MoreVertical,
  ArrowRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  addMonths,
  subMonths,
  isToday,
  parseISO
} from "date-fns";

import { Link, useSearchParams } from "react-router-dom";

export default function CalendarView() {
  const [searchParams] = useSearchParams();
  const clientFromUrl = searchParams.get("client");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"client" | "guard">("client");
  const [selectedClientId, setSelectedClientId] = useState<string>(clientFromUrl || "");
  const [selectedGuardId, setSelectedGuardId] = useState<string>("");
  const [dayDetail, setDayDetail] = useState<{ date: string; clientId: string; clientName: string } | null>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [guards, setGuards] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [gapAlerts, setGapAlerts] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [replacingSchedule, setReplacingSchedule] = useState<any>(null);
  const [availableGuards, setAvailableGuards] = useState<any[]>([]);
  const [replacementNote, setReplacementNote] = useState("");

  const [addingGuardDay, setAddingGuardDay] = useState<string | null>(null);
  const [tempGuardId, setTempGuardId] = useState("");
  const [tempShift, setTempShift] = useState("Day");
  const [tempNotes, setTempNotes] = useState("");

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate)
  });

  const handleAddTempGuard = () => {
    if (!addingGuardDay || !selectedClientId || !tempGuardId) return;
    fetch("/api/daily-schedules/temporary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: addingGuardDay,
        guard_id: tempGuardId,
        client_id: selectedClientId,
        shift: tempShift,
        notes: tempNotes
      })
    })
      .then(res => res.json())
      .then(() => {
        setAddingGuardDay(null);
        setTempGuardId("");
        setTempNotes("");
        fetchSchedules();
      });
  };

  useEffect(() => {
    fetchClients();
    fetchGuards();
    fetchGapAlerts();
  }, [clientFromUrl]);

  useEffect(() => {
    fetchSchedules();
  }, [currentDate, selectedClientId, selectedGuardId, viewMode]);

  const fetchClients = () => {
    fetch("/api/clients")
      .then(res => res.json())
      .then(data => {
        setClients(data);
        const urlClient = searchParams.get("client");
        if (urlClient && data.some((c: any) => c.id.toString() === urlClient)) {
          setSelectedClientId(urlClient);
        } else if (data.length > 0 && !selectedClientId) {
          setSelectedClientId(data[0].id.toString());
        }
      });
  };

  const fetchGuards = () => {
    fetch("/api/guards")
      .then(res => res.json())
      .then(data => setGuards(data));
  };

  const fetchGapAlerts = () => {
    fetch("/api/gap-alerts")
      .then(res => res.json())
      .then(data => setGapAlerts(data));
  };

  const fetchSchedules = () => {
    const month = currentDate.getMonth() + 1;
    const year = currentDate.getFullYear();
    let url = `/api/daily-schedules?month=${month}&year=${year}`;
    if (viewMode === "client" && selectedClientId) url += `&client_id=${selectedClientId}`;
    if (viewMode === "guard" && selectedGuardId) url += `&guard_id=${selectedGuardId}`;
    if (viewMode === "guard" && !selectedGuardId) url = `/api/daily-schedules?month=${month}&year=${year}`;

    fetch(url)
      .then(res => res.json())
      .then(data => setSchedules(data));
  };

  const getGuardViewData = () => {
    const month = currentDate.getMonth() + 1;
    const year = currentDate.getFullYear();
    const daysInMonth = new Date(year, month, 0).getDate();
    const guardMap = new Map<number, { name: string; days: Record<number, string> }>();
    const clientAbbrev = (name: string) => (name || "").split(" ").map((w: string) => w[0]).join("").slice(0, 3).toUpperCase() || "—";
    for (const s of schedules) {
      if (!guardMap.has(s.guard_id)) {
        guardMap.set(s.guard_id, { name: s.guard_name, days: {} });
      }
      const d = parseInt(String(s.date).split("-")[2], 10);
      const entry = guardMap.get(s.guard_id)!;
      entry.days[d] = clientAbbrev(s.client_name);
    }
    let guardList = Array.from(guardMap.entries()).map(([id, v]) => ({ id, ...v }));
    if (selectedGuardId) guardList = guardList.filter(g => g.id.toString() === selectedGuardId);
    return { guardList, daysInMonth };
  };

  const handleGenerateCalendar = () => {
    const monthYear = format(currentDate, "MMMM yyyy");
    if (!confirm(`Regenerate ${monthYear}? This will overwrite manual changes.`)) return;
    setIsGenerating(true);
    fetch("/api/scheduling/generate-calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        month: currentDate.getMonth() + 1,
        year: currentDate.getFullYear()
      })
    })
      .then(res => res.json())
      .then(() => {
        setIsGenerating(false);
        fetchSchedules();
        alert("Calendar generated successfully!");
      });
  };

  const handleOpenReplacement = (schedule: any) => {
    setReplacingSchedule(schedule);
    fetch(`/api/guards/available?date=${schedule.date}`)
      .then(res => res.json())
      .then(data => setAvailableGuards(data));
  };

  const handleReplaceGuard = (replacementGuardId: number) => {
    fetch("/api/daily-schedules/replace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: replacingSchedule.date,
        original_guard_id: replacingSchedule.guard_id,
        replacement_guard_id: replacementGuardId,
        client_id: replacingSchedule.client_id,
        template_id: replacingSchedule.template_id,
        notes: replacementNote
      })
    })
      .then(res => res.json())
      .then(() => {
        setReplacingSchedule(null);
        setReplacementNote("");
        fetchSchedules();
        fetchGapAlerts();
      });
  };

  const getDaySchedules = (day: Date) => {
    const dateStr = format(day, "yyyy-MM-dd");
    return schedules.filter(s => s.date === dateStr);
  };

  const getClientHeadcount = () => {
    const client = clients.find(c => c.id.toString() === selectedClientId);
    return client?.guards_required || 0;
  };

  const handleDayClick = (day: Date) => {
    if (viewMode !== "client" || !selectedClientId) return;
    const client = clients.find(c => c.id.toString() === selectedClientId);
    setDayDetail({ date: format(day, "yyyy-MM-dd"), clientId: selectedClientId, clientName: client?.name || "" });
  };

  const getDayDetailSlots = (): Record<string, any[]> => {
    if (!dayDetail) return {};
    const daySchedules = schedules.filter(s => s.date === dayDetail.date && s.client_id.toString() === dayDetail.clientId);
    const byTemplate = daySchedules.reduce((acc: Record<string, any[]>, s) => {
      const k = s.template_name || "Other";
      if (!acc[k]) acc[k] = [];
      acc[k].push(s);
      return acc;
    }, {});
    return byTemplate;
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
        <div>
          <h2 className="text-4xl font-black text-brand-navy tracking-tight">Operations Calendar</h2>
          <p className="text-slate-500 font-medium">Manage daily deployments, gaps, and replacements</p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex bg-white border border-slate-200 rounded-2xl p-1.5 shadow-sm">
            <button
              onClick={() => setViewMode("client")}
              className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === "client" ? "bg-brand-navy text-white shadow-lg shadow-brand-navy/20" : "text-slate-400 hover:text-brand-navy"
                }`}
            >
              By Client
            </button>
            <button
              onClick={() => setViewMode("guard")}
              className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === "guard" ? "bg-brand-navy text-white shadow-lg shadow-brand-navy/20" : "text-slate-400 hover:text-brand-navy"
                }`}
            >
              By Guard
            </button>
          </div>

          <div className="flex items-center bg-white border border-slate-200 rounded-2xl p-1.5 shadow-sm">
            <button
              onClick={() => setCurrentDate(subMonths(currentDate, 1))}
              className="p-2.5 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-brand-navy transition-all"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="px-8 flex items-center gap-3 font-black text-brand-navy min-w-[200px] justify-center text-xs uppercase tracking-widest">
              <CalendarIcon size={16} className="text-brand-navy" />
              {format(currentDate, "MMMM yyyy")}
            </div>
            <button
              onClick={() => setCurrentDate(addMonths(currentDate, 1))}
              className="p-2.5 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-brand-navy transition-all"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <button
            onClick={handleGenerateCalendar}
            disabled={isGenerating}
            className="bg-brand-navy hover:bg-slate-800 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center gap-3 transition-all disabled:opacity-50 shadow-xl shadow-brand-navy/20"
          >
            <RefreshCw size={18} className={isGenerating ? "animate-spin" : ""} />
            <span>Generate Month</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {viewMode === "client" ? (
          <div className="flex items-center gap-3 flex-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">By Client</span>
            <div className="relative flex-1 min-w-0">
              <Building2 className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
              <select
                className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-14 pr-6 text-brand-navy font-black focus:outline-none focus:ring-2 focus:ring-brand-navy/10 transition-all appearance-none shadow-sm"
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
              >
                <option value="">Select Client Site...</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div className="relative flex-1">
            <User className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
            <select
              className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-14 pr-6 text-brand-navy font-black focus:outline-none focus:ring-2 focus:ring-brand-navy/10 transition-all appearance-none shadow-sm"
              value={selectedGuardId}
              onChange={(e) => setSelectedGuardId(e.target.value)}
            >
              <option value="">Select Guard...</option>
              {guards.map(g => (
                <option key={g.id} value={g.id}>{g.full_name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex gap-3">
          <div className="flex items-center gap-3 px-6 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm">
            <div className="w-3.5 h-3.5 rounded-full bg-blue-500 shadow-sm"></div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Regular</span>
          </div>
          <div className="flex items-center gap-3 px-6 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm">
            <div className="w-3.5 h-3.5 rounded-full bg-amber-500 shadow-sm"></div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Replacement</span>
          </div>
          <div className="flex items-center gap-3 px-6 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm">
            <div className="w-3.5 h-3.5 rounded-full bg-red-500 shadow-sm"></div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gap</span>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-[3rem] overflow-hidden shadow-2xl">
        {viewMode === "guard" ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="py-4 px-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest sticky left-0 bg-slate-50 z-10">Guard</th>
                  {Array.from({ length: getGuardViewData().daysInMonth }, (_, i) => i + 1).map(d => (
                    <th key={d} className={`py-3 px-2 text-center text-[10px] font-black uppercase min-w-[2.5rem] ${isToday(new Date(currentDate.getFullYear(), currentDate.getMonth(), d)) ? "bg-blue-100 text-blue-600" : "text-slate-400"
                      }`}>
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {getGuardViewData().guardList.map((g) => (
                  <tr key={g.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="py-3 px-6 font-bold text-brand-navy sticky left-0 bg-white z-10">{g.name}</td>
                    {Array.from({ length: getGuardViewData().daysInMonth }, (_, i) => i + 1).map(d => (
                      <td key={d} className={`py-2 px-2 text-center text-xs font-bold min-w-[2.5rem] ${isToday(new Date(currentDate.getFullYear(), currentDate.getMonth(), d)) ? "bg-blue-50" : ""
                        }`}>
                        {g.days[d] || "—"}
                      </td>
                    ))}
                  </tr>
                ))}
                {getGuardViewData().guardList.length === 0 && (
                  <tr><td colSpan={32} className="py-16 text-center text-slate-400">No guard assignments for this month</td></tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/50">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
                <div key={day} className="py-6 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] border-r border-slate-100 last:border-r-0">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 auto-rows-[180px]">
              {daysInMonth.map((day, idx) => {
                const daySchedules = getDaySchedules(day);
                const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                const headcount = getClientHeadcount();
                const isGap = viewMode === "client" && daySchedules.length < headcount;

                return (
                  <div
                    key={day.toString()}
                    onClick={() => handleDayClick(day)}
                    className={`p-6 border-r border-b border-slate-100 last:border-r-0 relative group transition-all cursor-pointer ${!isCurrentMonth ? "bg-slate-50/30" : "hover:bg-slate-50/50"
                      } ${isGap && isCurrentMonth ? "bg-red-50/50" : ""} ${isToday(day) && isCurrentMonth ? "bg-blue-50/80 ring-1 ring-blue-100" : ""}`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span className={`text-base font-black tracking-tight ${isToday(day) ? "text-brand-navy underline decoration-4 underline-offset-4" : isCurrentMonth ? "text-slate-400" : "text-slate-200"
                        }`}>
                        {format(day, "d")}
                      </span>
                      {isGap && isCurrentMonth && (
                        <div className="flex items-center gap-1.5 text-red-500 animate-pulse">
                          <AlertTriangle size={16} />
                          <span className="text-[10px] font-black uppercase tracking-widest">Gap</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2.5 overflow-y-auto max-h-[110px] no-scrollbar">
                      {daySchedules.map(s => {
                        const isAbsent = s.attendance_status === 'A';
                        return (
                          <div
                            key={s.id}
                            onClick={() => handleOpenReplacement(s)}
                            className={`p-3 rounded-2xl border cursor-pointer transition-all hover:scale-[1.02] active:scale-95 shadow-sm ${isAbsent
                              ? "bg-red-50 border-red-200 text-red-700 hover:border-red-300"
                              : s.type === 'Replacement'
                                ? "bg-amber-50 border-amber-200 text-amber-700 hover:border-amber-300"
                                : "bg-white border-slate-100 text-slate-600 hover:border-brand-navy/20"
                              }`}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[10px] font-black truncate max-w-[85%] uppercase tracking-tight flex items-center gap-1">
                                {isAbsent && <AlertTriangle size={10} className="text-red-500" />}
                                {s.guard_name}
                              </span>
                              {s.type === 'Replacement' && !isAbsent && <RefreshCw size={10} className="text-amber-500" />}
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full shadow-inner" style={{ backgroundColor: s.color_code }}></div>
                              <span className="text-[8px] font-black uppercase tracking-widest opacity-60 flex-1">{s.template_name}</span>
                              {isAbsent && <span className="text-[8px] font-black text-red-600 bg-red-100 px-1.5 py-0.5 rounded-sm">ABSENT</span>}
                            </div>
                          </div>
                        );
                      })}

                      {isCurrentMonth && viewMode === "client" && daySchedules.length < headcount && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setAddingGuardDay(format(day, "yyyy-MM-dd")); }}
                          className="w-full py-3 border-2 border-dashed border-red-200 rounded-2xl text-red-300 hover:border-red-400 hover:text-red-500 transition-all flex items-center justify-center gap-2 group/btn"
                        >
                          <Plus size={16} className="group-hover/btn:scale-110 transition-transform" />
                          <span className="text-[9px] font-black uppercase tracking-widest">Add Guard</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Day Detail Side Panel */}
      <AnimatePresence>
        {dayDetail && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex justify-end"
            onClick={() => setDayDetail(null)}
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
                <div>
                  <h3 className="text-lg font-black text-brand-navy">{dayDetail.clientName}</h3>
                  <p className="text-sm text-slate-500">{format(parseISO(dayDetail.date), "EEEE, dd MMMM yyyy")}</p>
                </div>
                <button onClick={() => setDayDetail(null)} className="p-2 rounded-lg hover:bg-slate-100">
                  <X size={18} />
                </button>
              </div>
              <div className="p-6 space-y-6">
                {Object.entries(getDayDetailSlots()).map(([shiftName, slots]) => (
                  <div key={shiftName}>
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">{shiftName}</h4>
                    <div className="space-y-2">
                      {slots.map((s: any) => (
                        <div key={s.id} className="flex items-center justify-between py-3 px-4 rounded-xl bg-slate-50 border border-slate-100">
                          <div>
                            <p className="font-bold text-brand-navy">{s.guard_name}</p>
                            <p className="text-xs text-slate-500">{s.rank || "—"} · {s.template_name}</p>
                          </div>
                          {s.attendance_status === 'A' ? (
                            <span className="text-xs font-black text-red-600 bg-red-100 px-2 py-1 rounded-full flex items-center gap-1"><AlertTriangle size={12} /> Absent</span>
                          ) : s.attendance_status === 'P' || s.attendance_status === 'H' ? (
                            <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full flex items-center gap-1"><CheckCircle2 size={12} /> Present</span>
                          ) : (
                            <span className="text-xs font-black text-slate-500 bg-slate-200 px-2 py-1 rounded-full">No Data</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {getClientHeadcount() > schedules.filter(s => s.date === dayDetail.date && s.client_id.toString() === dayDetail.clientId).length && (
                  <div>
                    <h4 className="text-xs font-black text-amber-600 uppercase tracking-widest mb-2">Vacant</h4>
                    <div className="flex items-center gap-3 py-3 px-4 rounded-xl border-2 border-dashed border-amber-200 bg-amber-50">
                      <AlertTriangle size={18} className="text-amber-600 shrink-0" />
                      <div className="flex-1">
                        <p className="font-bold text-amber-800">Slot needs assignment</p>
                        <p className="text-xs text-amber-600">Click the + Add Guard button on the calendar cell to assign someone quickly.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Replacement Modal */}
      <AnimatePresence>
        {replacingSchedule && (
          <div className="fixed inset-0 bg-brand-navy/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white border border-slate-200 rounded-[3rem] w-full max-w-2xl overflow-hidden shadow-2xl"
            >
              <div className="p-10 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-3xl font-black text-brand-navy tracking-tight">Replace Guard</h3>
                  <p className="text-slate-500 font-medium mt-1">Assign a substitute for {format(parseISO(replacingSchedule.date), "PP")}</p>
                </div>
                <button onClick={() => setReplacingSchedule(null)} className="text-slate-400 hover:text-brand-navy transition-colors">
                  <X size={32} />
                </button>
              </div>

              <div className="p-10 space-y-10">
                <div className="flex items-center justify-between p-8 bg-slate-50 rounded-[2rem] border border-slate-100 shadow-inner">
                  <div className="flex items-center gap-6">
                    <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center shadow-sm">
                      <User size={28} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Original Guard</p>
                      <Link to={`/guards/${replacingSchedule.guard_id}`} className="text-xl font-black text-brand-navy hover:text-brand-navy/70 transition-colors tracking-tight">
                        {replacingSchedule.guard_name}
                      </Link>
                    </div>
                  </div>
                  <ArrowRight className="text-slate-200" size={24} />
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Site / Shift</p>
                    <p className="text-base font-black text-brand-navy tracking-tight">{replacingSchedule.client_name}</p>
                    <p className="text-[10px] font-black text-brand-navy uppercase tracking-widest mt-1 underline decoration-2 underline-offset-2">{replacingSchedule.template_name}</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Available Guards</h4>
                  <div className="grid grid-cols-1 gap-4 max-h-[350px] overflow-y-auto pr-4 no-scrollbar">
                    {Array.isArray(availableGuards) && availableGuards.map(g => (
                      <div
                        key={g.id}
                        onClick={() => handleReplaceGuard(g.id)}
                        className="flex items-center justify-between p-6 bg-white border border-slate-100 rounded-2xl hover:border-brand-navy/20 hover:shadow-lg cursor-pointer transition-all group shadow-sm"
                      >
                        <div className="flex items-center gap-5">
                          <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-brand-navy group-hover:text-white transition-all shadow-inner">
                            <User size={24} />
                          </div>
                          <div>
                            <p className="text-base font-black text-brand-navy tracking-tight">{g.full_name}</p>
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">{g.designation}</p>
                          </div>
                        </div>
                        <button className="bg-slate-50 group-hover:bg-brand-navy text-slate-400 group-hover:text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm">
                          Select
                        </button>
                      </div>
                    ))}
                    {(!Array.isArray(availableGuards) || availableGuards.length === 0) && (
                      <div className="text-center py-16 border-2 border-dashed border-slate-100 rounded-[2rem] bg-slate-50/50">
                        <p className="text-slate-400 font-black uppercase tracking-widest text-xs">No available guards found for this date.</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Replacement Note</label>
                  <textarea
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-6 text-brand-navy font-bold focus:outline-none focus:ring-2 focus:ring-brand-navy/10 min-h-[100px] text-sm transition-all"
                    placeholder="Reason for replacement..."
                    value={replacementNote}
                    onChange={(e) => setReplacementNote(e.target.value)}
                  />
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Guard / Temporary Assignment Modal */}
      <AnimatePresence>
        {addingGuardDay && (
          <div className="fixed inset-0 bg-brand-navy/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white border border-slate-200 rounded-[3rem] w-full max-w-xl overflow-hidden shadow-2xl"
            >
              <div className="p-10 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-3xl font-black text-brand-navy tracking-tight">Assign Guard</h3>
                  <p className="text-slate-500 font-medium mt-1">Fill an open slot for {format(parseISO(addingGuardDay), "PP")}</p>
                </div>
                <button onClick={() => setAddingGuardDay(null)} className="text-slate-400 hover:text-brand-navy transition-colors">
                  <X size={32} />
                </button>
              </div>

              <div className="p-10 space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Select Guard</label>
                  <div className="relative">
                    <User className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                    <select
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-14 pr-6 text-brand-navy font-black focus:outline-none focus:ring-2 focus:ring-brand-navy/10 transition-all appearance-none shadow-sm"
                      value={tempGuardId}
                      onChange={(e) => setTempGuardId(e.target.value)}
                    >
                      <option value="">Choose a guard...</option>
                      {guards.map(g => <option key={g.id} value={g.id}>{g.full_name}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Shift Type</label>
                  <div className="flex gap-4">
                    <button
                      onClick={() => setTempShift("Day")}
                      className={`flex-1 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all border ${tempShift === "Day" ? "bg-brand-navy text-white border-brand-navy shadow-lg" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"}`}
                    >
                      Day Shift
                    </button>
                    <button
                      onClick={() => setTempShift("Night")}
                      className={`flex-1 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all border ${tempShift === "Night" ? "bg-brand-navy text-white border-brand-navy shadow-lg" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"}`}
                    >
                      Night Shift
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Notes (Optional)</label>
                  <input
                    type="text"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-brand-navy font-bold focus:outline-none focus:ring-2 focus:ring-brand-navy/10 transition-all"
                    placeholder="E.g., Event coverage, extra support..."
                    value={tempNotes}
                    onChange={(e) => setTempNotes(e.target.value)}
                  />
                </div>

                <div className="pt-4 flex justify-end gap-4">
                  <button onClick={() => setAddingGuardDay(null)} className="px-8 py-4 font-black text-slate-500 hover:text-slate-700 tracking-widest uppercase text-xs transition-colors">
                    Cancel
                  </button>
                  <button
                    onClick={handleAddTempGuard}
                    disabled={!tempGuardId}
                    className="bg-brand-accent hover:bg-[#ff8f00] text-white px-10 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-brand-accent/20 disabled:opacity-50 flex items-center gap-2"
                  >
                    Confirm Assignment
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
