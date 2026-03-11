import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  ChevronLeft, ChevronRight, Save, Download, Search, AlertCircle,
  Calendar as CalendarIcon, Lock, Unlock, CheckSquare, Square, Zap,
  ChevronDown, Building2, UserPlus, Filter, X, CheckCircle2, Users,
  Info
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths } from "date-fns";
import { Link } from "react-router-dom";
import { emitAttendanceUpdated } from "../lib/events";

/* ─── Status constants — P / H / A only ──────────────────────── */
const STATUS_ORDER = ['', 'P', 'H', 'A'];

const STATUS_COLORS: Record<string, string> = {
  P:  'bg-emerald-500 text-white',
  H:  'bg-amber-500 text-white',
  A:  'bg-red-500 text-white',
  '': 'bg-slate-50 text-slate-300 border border-slate-200',
};

const STATUS_TEXT_COLORS: Record<string, string> = {
  P: 'text-emerald-600',
  H: 'text-amber-500',
  A: 'text-red-500',
};

const STATUS_LABELS: Record<string, string> = {
  P: 'Present',
  H: 'Half Day',
  A: 'Absent',
};

/* ─── Guard type badge config ─────────────────────────────────── */
const TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  Regular:   { label: 'REGULAR',   cls: 'bg-blue-100 text-blue-700' },
  Temporary: { label: 'TEMPORARY', cls: 'bg-orange-100 text-orange-700' },
  Office:    { label: 'OFFICE',    cls: 'bg-purple-100 text-purple-700' },
  Volunteer: { label: 'AD-HOC',    cls: 'bg-slate-100 text-slate-500' },
};

/* ─── Avatar palette — colour by guard id mod 8 ──────────────── */
const AVATAR_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-amber-500',
  'bg-rose-500',  'bg-indigo-500',  'bg-teal-500',   'bg-orange-500',
];

/* ─── Frozen column offsets ──────────────────────────────────── */
const LEFT_CHECK   = 'left-0';
const LEFT_GUARD   = 'left-12';         // 48 px
const LEFT_SUMMARY = 'left-[304px]';    // 48 + 256

/* ─── Debounce helper ─────────────────────────────────────────── */
function useDebounce<T extends (...args: any[]) => any>(fn: T, delay: number) {
  const timer = useRef<any>(null);
  return useCallback((...args: Parameters<T>) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]);
}

/* ═══════════════════════════════════════════════════════════════ */
export default function Attendance() {
  const [currentDate, setCurrentDate]     = useState(new Date());
  const [guards, setGuards]               = useState<any[]>([]);
  const [templates, setTemplates]         = useState<any[]>([]);
  const [attendanceData, setAttendanceData] = useState<any>({});
  const [searchTerm, setSearchTerm]       = useState('');
  const [isLocked, setIsLocked]           = useState(false);
  const [selectedGuards, setSelectedGuards] = useState<number[]>([]);
  const [bulkStatus, setBulkStatus]       = useState('P');
  const [bulkDate, setBulkDate]           = useState(format(new Date(), 'yyyy-MM-dd'));
  const [collapsedClients, setCollapsedClients] = useState<string[]>([]);
  const [collapsedNightRows, setCollapsedNightRows] = useState<number[]>([]);
  const [showFilters, setShowFilters]     = useState(false);

  // Filters
  const [filterClient,      setFilterClient]      = useState('All');
  const [filterType,        setFilterType]         = useState('All');
  const [filterShift,       setFilterShift]        = useState('Both');
  const [filterRank,        setFilterRank]         = useState('All');
  const [filterAbsentToday, setFilterAbsentToday] = useState(false);

  // Auto-save
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | 'idle'>('idle');
  const pendingSaves = useRef<Map<string, Promise<any>>>(new Map());

  const daysInMonth = eachDayOfInterval({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) });
  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    fetchGuards();
    fetchTemplates();
    fetchAttendance();
    checkLockStatus();
  }, [currentDate]);

  const fetchGuards    = () => fetch('/api/guards').then(r => r.json()).then(setGuards);
  const fetchTemplates = () => fetch('/api/schedule-templates').then(r => r.json()).then(setTemplates);

  const fetchAttendance = () => {
    const month = currentDate.getMonth() + 1;
    const year  = currentDate.getFullYear();
    fetch(`/api/attendance?month=${month}&year=${year}`)
      .then(r => r.json())
      .then(data => {
        const mapped = data.reduce((acc: any, cur: any) => {
          if (!acc[cur.guard_id]) acc[cur.guard_id] = {};
          if (!acc[cur.guard_id][cur.template_id]) acc[cur.guard_id][cur.template_id] = {};
          acc[cur.guard_id][cur.template_id][cur.date] = cur.status;
          return acc;
        }, {});
        setAttendanceData(mapped);
      });
  };

  const checkLockStatus = () => {
    const month = currentDate.getMonth() + 1;
    const year  = currentDate.getFullYear();
    fetch(`/api/attendance/lock-status?month=${month}&year=${year}`)
      .then(r => r.json())
      .then(d => setIsLocked(!!d.locked))
      .catch(() => setIsLocked(false));
  };

  const toggleLock = () => {
    const month   = currentDate.getMonth() + 1;
    const year    = currentDate.getFullYear();
    const newLock = !isLocked;
    fetch('/api/attendance/toggle-lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month, year, locked: newLock }),
    }).then(() => setIsLocked(newLock));
  };

  /* ─── Save a single cell ─────────────────────────────────────── */
  const saveCellToServer = async (guardId: number, date: string, status: string, templateId: number) => {
    setSaveStatus('saving');
    try {
      const r = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guard_id: guardId, date, status, template_id: templateId }),
      });
      if (!r.ok) throw new Error('save failed');
      emitAttendanceUpdated(guardId);
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  };

  /* Debounced version — fires 1.5 s after the last change */
  const debouncedSave = useDebounce(saveCellToServer, 1500);

  /* ─── Click a cell → cycle P → H → A → empty ───────────────── */
  const handleCellClick = (guardId: number, dateStr: string, templateId: number) => {
    if (isLocked) return;
    const cur  = attendanceData[guardId]?.[templateId]?.[dateStr] || '';
    const next = STATUS_ORDER[(STATUS_ORDER.indexOf(cur) + 1) % STATUS_ORDER.length];
    setAttendanceData((prev: any) => ({
      ...prev,
      [guardId]: {
        ...prev[guardId],
        [templateId]: { ...prev[guardId]?.[templateId], [dateStr]: next },
      },
    }));
    debouncedSave(guardId, dateStr, next, templateId);
  };

  /* Immediate save (used for Save All button) */
  const saveCell = (guardId: number, date: string, status: string, templateId: number) =>
    fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guard_id: guardId, date, status, template_id: templateId }),
    }).then(r => { emitAttendanceUpdated(guardId); return r; });

  const handleBulkMark = async () => {
    if (isLocked || !selectedGuards.length) return;
    const tplId = finalTemplates[0]?.id;
    if (!tplId) return;
    const nd = { ...attendanceData };
    const saves: Promise<any>[] = [];
    for (const gid of selectedGuards) {
      if (!nd[gid]) nd[gid] = {};
      if (!nd[gid][tplId]) nd[gid][tplId] = {};
      nd[gid][tplId][bulkDate] = bulkStatus;
      saves.push(saveCell(gid, bulkDate, bulkStatus, tplId));
    }
    setAttendanceData(nd);
    setSelectedGuards([]);
    await Promise.all(saves);
    setSaveStatus('saved');
  };

  const handleFillEmpty = async () => {
    if (isLocked || !selectedGuards.length) return;
    const nd    = { ...attendanceData };
    const saves: Promise<any>[] = [];
    for (const gid of selectedGuards) {
      if (!nd[gid]) nd[gid] = {};
      finalTemplates.forEach(tpl => {
        if (!nd[gid][tpl.id]) nd[gid][tpl.id] = {};
        daysInMonth.forEach(day => {
          const ds = format(day, 'yyyy-MM-dd');
          if (!nd[gid][tpl.id][ds]) {
            nd[gid][tpl.id][ds] = 'A';
            saves.push(saveCell(gid, ds, 'A', tpl.id));
          }
        });
      });
    }
    setAttendanceData(nd);
    setSelectedGuards([]);
    await Promise.all(saves);
    setSaveStatus('saved');
  };

  const handleSaveAll = async () => {
    if (isLocked) return;
    setSaveStatus('saving');
    const saves: Promise<any>[] = [];
    Object.entries(attendanceData).forEach(([gid, tpls]: any) =>
      Object.entries(tpls).forEach(([tid, dates]: any) =>
        Object.entries(dates).forEach(([date, status]: any) =>
          saves.push(saveCell(Number(gid), date, status as string, Number(tid)))
        )
      )
    );
    await Promise.all(saves);
    emitAttendanceUpdated();
    setSaveStatus('saved');
    alert('Full month attendance saved!');
  };

  /* ─── Summary calculation (P / H / A only) ──────────────────── */
  const calcSummary = (guardId: number) => {
    const ga = attendanceData[guardId] || {};
    let P = 0, H = 0, A = 0, dayShifts = 0, nightShifts = 0;
    Object.entries(ga).forEach(([tid, dates]: any) => {
      const tpl     = templates.find(t => t.id === Number(tid));
      const isNight = tpl?.name?.toLowerCase().includes('night');
      Object.values(dates).forEach((s: any) => {
        if (s === 'P') { P++; isNight ? nightShifts++ : dayShifts++; }
        if (s === 'H') { H++; isNight ? nightShifts += 0.5 : dayShifts += 0.5; }
        if (s === 'A') A++;
      });
    });
    const effectiveDays = P + H * 0.5;
    const totalShifts   = dayShifts + nightShifts;
    return { P, H, A, effectiveDays, totalShifts };
  };

  const hasNightData = (guardId: number, nightTplId: number) => {
    const d = attendanceData[guardId]?.[nightTplId];
    return d && Object.values(d).some(s => s !== '');
  };

  /* ─── Guard helpers ──────────────────────────────────────────── */
  const getGuardId = (g: any) => {
    if (g.guard_type === 'Temporary') return g.nic ? `TGST-${String(g.id).padStart(4,'0')}` : 'TEM';
    if (g.guard_type === 'Office')    return `TGO-${String(g.id).padStart(4,'0')}`;
    if (g.guard_type === 'Volunteer') return `TGV-${String(g.id).padStart(4,'0')}`;
    return `TGS-${String(g.id).padStart(4,'0')}`;
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();
  };

  /* ─── Avatar component ───────────────────────────────────────── */
  const Avatar = ({ guard, size = 32 }: { guard: any; size?: number }) => {
    const colorCls = AVATAR_COLORS[guard.id % AVATAR_COLORS.length];
    if (guard.profile_photo) {
      return (
        <img
          src={guard.profile_photo}
          alt={guard.full_name}
          style={{ width: size, height: size }}
          className="rounded-full object-cover shrink-0 border-2 border-white shadow-sm"
        />
      );
    }
    return (
      <div
        style={{ width: size, height: size, fontSize: size * 0.35 }}
        className={`${colorCls} rounded-full flex items-center justify-center shrink-0 text-white font-black border-2 border-white shadow-sm`}
      >
        {getInitials(guard.full_name)}
      </div>
    );
  };

  /* ─── Inline summary (frozen column) ────────────────────────── */
  const InlineSummary = ({ guardId }: { guardId: number }) => {
    const s = calcSummary(guardId);
    return (
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-baseline gap-0.5">
            <span className="text-sm font-black text-emerald-600">{s.P}</span>
            <span className="text-[9px] font-black text-emerald-500 uppercase">P</span>
          </span>
          <span className="inline-flex items-baseline gap-0.5">
            <span className="text-sm font-black text-amber-500">{s.H}</span>
            <span className="text-[9px] font-black text-amber-400 uppercase">H</span>
          </span>
          <span className="inline-flex items-baseline gap-0.5">
            <span className="text-sm font-black text-red-500">{s.A}</span>
            <span className="text-[9px] font-black text-red-400 uppercase">A</span>
          </span>
        </div>
        <div className="flex items-center gap-2 pt-0.5 border-t border-slate-100">
          <span className="text-[9px] font-black text-brand-navy">{s.totalShifts.toFixed(s.totalShifts % 1 ? 1 : 0)} <span className="font-medium text-slate-400">SHIFTS</span></span>
          <span className="w-px h-2.5 bg-slate-200" />
          <span className="text-[9px] font-black text-brand-navy">{s.effectiveDays.toFixed(s.effectiveDays % 1 ? 1 : 0)} <span className="font-medium text-slate-400">EFF.DAYS</span></span>
        </div>
      </div>
    );
  };

  /* ─── Guard type badge ───────────────────────────────────────── */
  const TypeBadge = ({ type }: { type: string }) => {
    const cfg = TYPE_BADGE[type] || { label: type?.toUpperCase() || 'REGULAR', cls: 'bg-blue-100 text-blue-700' };
    return <span className={`${cfg.cls} text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md`}>{cfg.label}</span>;
  };

  /* ─── Derived data ───────────────────────────────────────────── */
  const clientNames = [...new Set(guards.map(g => g.client_name || 'Unassigned'))];
  const rankNames   = [...new Set(guards.map(g => g.rank).filter(Boolean))];

  const filteredGuards = guards.filter(g => {
    const matchSearch = g.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (g.client_name?.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchClient = filterClient === 'All' || (g.client_name || 'Unassigned') === filterClient;
    const matchType   = filterType === 'All' || g.guard_type === filterType;
    const matchRank   = filterRank === 'All' || g.rank === filterRank;
    const matchAbsent = !filterAbsentToday || ['A'].includes(
      attendanceData[g.id]?.[dayTplRef]?.[today] || attendanceData[g.id]?.[nightTplRef]?.[today] || ''
    );
    return matchSearch && matchClient && matchType && matchRank && matchAbsent;
  });

  const grouped = filteredGuards.reduce((acc: any, g) => {
    const key = g.client_name || 'Unassigned';
    if (!acc[key]) acc[key] = [];
    acc[key].push(g);
    return acc;
  }, {});

  const dayTpl  = templates.find(t => t.name.toLowerCase().includes('day') && !t.name.toLowerCase().includes('night'));
  const nightTpl = templates.find(t => t.name.toLowerCase().includes('night'));
  const finalTemplates = [dayTpl, nightTpl].filter(Boolean).length > 0
    ? [dayTpl, nightTpl].filter(Boolean)
    : templates.slice(0, 2);

  // refs used inside filteredGuards (pre-computation before JSX)
  const dayTplRef   = dayTpl?.id;
  const nightTplRef = nightTpl?.id;

  const getSiteStats = (sGuards: any[]) => {
    let presentToday = 0, absentToday = 0;
    sGuards.forEach(g => {
      const dayS = attendanceData[g.id]?.[dayTpl?.id]?.[today] || '';
      if (dayS === 'P' || dayS === 'H') presentToday++;
      else if (dayS === 'A') absentToday++;
    });
    return { total: sGuards.length, presentToday, absentToday };
  };

  const activeFilterCount = [
    filterClient !== 'All', filterType !== 'All', filterShift !== 'Both',
    filterRank !== 'All', filterAbsentToday,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setFilterClient('All'); setFilterType('All'); setFilterShift('Both');
    setFilterRank('All'); setFilterAbsentToday(false);
  };

  /* ─── Save status indicator ──────────────────────────────────── */
  const SaveIndicator = () => {
    if (isLocked) return (
      <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 border border-slate-200 px-3 py-2 rounded-xl bg-white">
        <Lock size={12} /> LOCKED 🔒
      </span>
    );
    if (saveStatus === 'saving') return (
      <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-600 border border-amber-200 px-3 py-2 rounded-xl bg-amber-50">
        <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping shrink-0" />
        AUTO-SAVE: SAVING…
      </span>
    );
    if (saveStatus === 'error') return (
      <button onClick={handleSaveAll} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-red-600 border border-red-200 px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 transition-all">
        <AlertCircle size={12} /> SAVE FAILED — Retry
      </button>
    );
    if (saveStatus === 'saved') return (
      <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-600 border border-emerald-200 px-3 py-2 rounded-xl bg-emerald-50">
        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
        AUTO-SAVE: ON
      </span>
    );
    return (
      <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-600 border border-emerald-200 px-3 py-2 rounded-xl bg-emerald-50">
        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
        AUTO-SAVE: ON
      </span>
    );
  };

  /* ─── Render ─────────────────────────────────────────────────── */
  return (
    <div className="space-y-6 pb-20">

      {/* ── Locked banner ── */}
      {isLocked && (
        <div className="flex items-center justify-between gap-4 bg-red-50 border border-red-200 rounded-2xl px-6 py-4">
          <div className="flex items-center gap-3">
            <Lock size={18} className="text-red-500 shrink-0" />
            <div>
              <p className="text-sm font-black text-red-700">Attendance sheet is locked for {format(currentDate, 'MMMM yyyy')}</p>
              <p className="text-xs text-red-500 font-medium mt-0.5">All cells are read-only. Click "Unlock Sheet" to resume editing.</p>
            </div>
          </div>
          <button onClick={toggleLock}
            className="shrink-0 flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest text-xs px-5 py-2.5 rounded-xl transition-all shadow-lg">
            <Unlock size={14} /> Unlock Sheet
          </button>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-brand-navy tracking-tight flex items-center gap-3">
            Attendance Sheet
            <button onClick={toggleLock}
              title={isLocked ? 'Click to unlock' : 'Click to lock this month'}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-black uppercase tracking-widest transition-all ${
                isLocked ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100' : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
              }`}>
              {isLocked ? <Lock size={14} /> : <Unlock size={14} />}
              {isLocked ? 'Locked' : 'Editable'}
            </button>
          </h2>
          <p className="text-slate-500 font-medium mt-1">Track daily attendance for all security personnel</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Month nav */}
          <div className="flex items-center bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="px-5 py-4 hover:bg-slate-50 text-slate-400 hover:text-brand-navy transition-all">
              <ChevronLeft size={20} />
            </button>
            <div className="px-8 flex items-center gap-2 font-black text-brand-navy min-w-[190px] justify-center uppercase tracking-widest text-xs">
              <CalendarIcon size={15} className="text-brand-navy/40" />
              {format(currentDate, 'MMMM yyyy')}
            </div>
            <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="px-5 py-4 hover:bg-slate-50 text-slate-400 hover:text-brand-navy transition-all">
              <ChevronRight size={20} />
            </button>
          </div>
          {/* Auto-save indicator */}
          <SaveIndicator />
          {/* Filters button */}
          <button onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-5 py-3.5 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all border ${
              activeFilterCount > 0 ? 'bg-brand-navy text-white border-brand-navy' : showFilters ? 'bg-brand-navy text-white border-brand-navy' : 'bg-white border-slate-200 text-slate-500'
            }`}>
            <Filter size={15} />
            Filters {activeFilterCount > 0 && <span className="bg-white text-brand-navy rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-black">{activeFilterCount}</span>}
          </button>
        </div>
      </div>

      {/* ── Expanded filters panel ── */}
      <AnimatePresence>
        {showFilters && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-wrap gap-6 items-end">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Client / Site</label>
                <select className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-brand-navy focus:outline-none min-w-[180px]"
                  value={filterClient} onChange={e => setFilterClient(e.target.value)}>
                  <option value="All">All Sites</option>
                  {clientNames.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Guard Type</label>
                <select className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-brand-navy focus:outline-none min-w-[160px]"
                  value={filterType} onChange={e => setFilterType(e.target.value)}>
                  <option value="All">All Types</option>
                  <option value="Regular">Regular</option>
                  <option value="Temporary">Temporary</option>
                  <option value="Volunteer">Ad-Hoc</option>
                  <option value="Office">Office</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Shift</label>
                <select className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-brand-navy focus:outline-none min-w-[140px]"
                  value={filterShift} onChange={e => setFilterShift(e.target.value)}>
                  <option value="Both">Day + Night</option>
                  <option value="Day">Day Only</option>
                  <option value="Night">Night Only</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rank</label>
                <select className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-brand-navy focus:outline-none min-w-[140px]"
                  value={filterRank} onChange={e => setFilterRank(e.target.value)}>
                  <option value="All">All Ranks</option>
                  <option value="OIC">OIC</option>
                  <option value="SSO">SSO</option>
                  <option value="Guard">Guard</option>
                  <option value="Supervisor">Supervisor</option>
                  {rankNames.filter(r => !['OIC','SSO','Guard','Supervisor'].includes(r)).map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status Today</label>
                <button onClick={() => setFilterAbsentToday(!filterAbsentToday)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border font-bold text-sm transition-all ${
                    filterAbsentToday ? 'bg-red-50 border-red-200 text-red-600' : 'bg-slate-50 border-slate-200 text-slate-500'
                  }`}>
                  {filterAbsentToday ? <CheckSquare size={15} /> : <Square size={15} />}
                  Absent Today
                </button>
              </div>
              {activeFilterCount > 0 && (
                <button onClick={clearFilters}
                  className="flex items-center gap-2 text-slate-400 hover:text-red-500 text-xs font-black uppercase tracking-widest border border-slate-200 rounded-xl px-4 py-2.5 hover:border-red-200 hover:bg-red-50 transition-all self-end">
                  <X size={14} /> Clear All
                </button>
              )}
            </div>
            {/* Active filter pills */}
            {activeFilterCount > 0 && (
              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100">
                {filterClient !== 'All' && (
                  <span className="flex items-center gap-1.5 bg-brand-navy/10 text-brand-navy text-xs font-black px-3 py-1 rounded-full">
                    Site: {filterClient} <button onClick={() => setFilterClient('All')}><X size={10} /></button>
                  </span>
                )}
                {filterType !== 'All' && (
                  <span className="flex items-center gap-1.5 bg-brand-navy/10 text-brand-navy text-xs font-black px-3 py-1 rounded-full">
                    Type: {filterType} <button onClick={() => setFilterType('All')}><X size={10} /></button>
                  </span>
                )}
                {filterShift !== 'Both' && (
                  <span className="flex items-center gap-1.5 bg-brand-navy/10 text-brand-navy text-xs font-black px-3 py-1 rounded-full">
                    Shift: {filterShift} <button onClick={() => setFilterShift('Both')}><X size={10} /></button>
                  </span>
                )}
                {filterRank !== 'All' && (
                  <span className="flex items-center gap-1.5 bg-brand-navy/10 text-brand-navy text-xs font-black px-3 py-1 rounded-full">
                    Rank: {filterRank} <button onClick={() => setFilterRank('All')}><X size={10} /></button>
                  </span>
                )}
                {filterAbsentToday && (
                  <span className="flex items-center gap-1.5 bg-red-100 text-red-600 text-xs font-black px-3 py-1 rounded-full">
                    Absent Today <button onClick={() => setFilterAbsentToday(false)}><X size={10} /></button>
                  </span>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Toolbar: search + legend ── */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input type="text" placeholder="Search guards or client sites…"
            className="w-full bg-white border border-slate-200 rounded-2xl py-3.5 pl-12 pr-5 text-brand-navy font-bold focus:outline-none focus:ring-2 focus:ring-brand-navy/10 shadow-sm"
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        {/* Legend — 3 items only */}
        <div className="flex items-center gap-3">
          {[['P','PRESENT','bg-emerald-500'],['H','HALF DAY','bg-amber-500'],['A','ABSENT','bg-red-500']].map(([code, label, bg]) => (
            <div key={code} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-100 rounded-xl shadow-sm">
              <div className={`w-3 h-3 rounded-md ${bg}`} />
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Bulk action bar ── */}
      <AnimatePresence>
        {selectedGuards.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
            className="bg-brand-navy p-5 rounded-[2rem] flex flex-col md:flex-row items-center justify-between gap-4 shadow-2xl shadow-brand-navy/20">
            <div className="flex items-center gap-3">
              <div className="bg-white/10 text-white p-2.5 rounded-xl"><CheckSquare size={20} /></div>
              <div>
                <p className="text-base font-black text-white">{selectedGuards.length} Guards Selected</p>
                <p className="text-[10px] text-white/60 font-medium">Apply bulk changes</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <input type="date" className="bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-sm text-white focus:outline-none"
                value={bulkDate} onChange={e => setBulkDate(e.target.value)} />
              <select className="bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-sm text-white focus:outline-none min-w-[140px]"
                value={bulkStatus} onChange={e => setBulkStatus(e.target.value)}>
                {Object.entries(STATUS_LABELS).map(([k, l]) => <option key={k} value={k} className="text-brand-navy">{l}</option>)}
              </select>
              <button onClick={handleBulkMark} className="bg-white text-brand-navy px-6 py-2.5 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-slate-50 transition-all">Mark Selected</button>
              <button onClick={handleFillEmpty} className="bg-red-500 hover:bg-red-600 text-white px-5 py-2.5 rounded-xl font-black uppercase tracking-widest text-xs transition-all">Fill Empty → Absent</button>
              <button onClick={() => setSelectedGuards([])} className="text-white/60 hover:text-white"><X size={18} /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main table ── */}
      <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table
            className="w-full text-left border-collapse table-fixed"
            style={{ minWidth: `${48 + 256 + 224 + 80 + daysInMonth.length * 52}px` }}
          >
            <thead>
              <tr className="bg-slate-50 text-slate-400 text-[10px] uppercase font-black tracking-widest border-b border-slate-100">
                {/* Checkbox */}
                <th className={`w-12 px-4 py-5 sticky ${LEFT_CHECK} z-30 bg-slate-50 border-r border-slate-100 text-center`}>
                  <button onClick={() => selectedGuards.length === filteredGuards.length
                    ? setSelectedGuards([]) : setSelectedGuards(filteredGuards.map(g => g.id))}
                    className="text-slate-300 hover:text-brand-navy transition-colors">
                    {selectedGuards.length === filteredGuards.length && filteredGuards.length > 0
                      ? <CheckSquare size={18} /> : <Square size={18} />}
                  </button>
                </th>
                {/* Guard details */}
                <th className={`w-64 px-5 py-5 sticky ${LEFT_GUARD} z-30 bg-slate-50 border-r border-slate-100`}>Guard Details</th>
                {/* Summary */}
                <th className={`w-56 px-4 py-5 sticky ${LEFT_SUMMARY} z-30 bg-slate-50 border-r-2 border-brand-navy/20`}>
                  <span className="text-[9px] font-black uppercase tracking-widest text-brand-navy/70">Summary (Frozen)</span>
                </th>
                {/* Shift label */}
                <th className="w-20 px-2 py-5 text-center bg-slate-50 border-r border-slate-100">Shift</th>
                {/* Day columns */}
                {daysInMonth.map(day => {
                  const isWknd  = [0, 6].includes(day.getDay());
                  const isToday = format(day, 'yyyy-MM-dd') === today;
                  return (
                    <th key={day.toString()}
                      className={`w-13 py-5 px-0.5 text-center border-r border-slate-100 ${
                        isToday ? 'bg-blue-50' : isWknd ? 'bg-red-50/60' : ''
                      }`}>
                      <span className={`text-xl block leading-none mb-1 font-black ${isToday ? 'text-blue-600' : ''}`}>{format(day, 'd')}</span>
                      <span className={`block text-[9px] font-black ${isToday ? 'text-blue-400' : isWknd ? 'text-red-400' : 'text-slate-300'}`}>
                        {format(day, 'EEE').toUpperCase()}
                      </span>
                      {isToday && <span className="block w-1.5 h-1.5 rounded-full bg-blue-400 mx-auto mt-0.5" />}
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {Object.entries(grouped).map(([clientName, cGuards]: [any, any]) => {
                const isCollapsed = collapsedClients.includes(clientName);
                const { total, presentToday, absentToday } = getSiteStats(cGuards);

                return (
                  <React.Fragment key={clientName}>
                    {/* ── Client group header ── */}
                    <tr className="border-y border-slate-200">
                      <td colSpan={daysInMonth.length + 4} className="py-0">
                        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-100 to-slate-50 border-l-4 border-brand-navy">
                          <button onClick={() => setCollapsedClients(p => p.includes(clientName) ? p.filter(c => c !== clientName) : [...p, clientName])}
                            className="flex items-center gap-4 text-brand-navy hover:text-slate-900 transition-colors">
                            <ChevronDown size={20} className={`transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`} />
                            <Building2 size={18} className="text-brand-navy/60" />
                            <span className="text-sm font-black uppercase tracking-[0.2em]">{clientName}</span>
                          </button>
                          <div className="flex items-center gap-3">
                            <div className="relative group">
                              <span className="text-[10px] bg-white border border-slate-300 text-brand-navy px-4 py-1.5 rounded-full font-black shadow-sm cursor-default hover:border-brand-navy/30 transition-all">
                                <Users size={10} className="inline mr-1" />{total} Guards
                              </span>
                              <div className="absolute right-0 top-9 bg-slate-900 text-white text-xs font-bold rounded-xl px-4 py-3 opacity-0 group-hover:opacity-100 transition-all z-50 shadow-xl pointer-events-none whitespace-nowrap">
                                <p className="text-emerald-400">✓ {presentToday} Present Today</p>
                                <p className="text-red-400">✗ {absentToday} Absent Today</p>
                                <p className="text-slate-400 mt-1">{total - presentToday - absentToday} Not marked</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>

                    {/* ── Guard rows ── */}
                    {!isCollapsed && cGuards.map((guard: any) => {
                      const isSelected   = selectedGuards.includes(guard.id);
                      const nightHasData = nightTpl ? hasNightData(guard.id, nightTpl.id) : false;
                      const nightCollapsed = collapsedNightRows.includes(guard.id);
                      const showNightFull = nightHasData || !nightCollapsed;
                      const rowBg = isSelected ? 'bg-brand-navy/5' : 'bg-white';
                      const rowSpan = showNightFull && nightTpl ? 2 : 1;
                      const guardTypeBadge = TYPE_BADGE[guard.guard_type] || TYPE_BADGE['Regular'];

                      return (
                        <React.Fragment key={guard.id}>
                          {/* ── DAY row ── */}
                          <tr className={`${rowBg} border-t border-slate-100 transition-colors`}>

                            {/* Checkbox */}
                            <td rowSpan={rowSpan}
                              className={`sticky ${LEFT_CHECK} z-20 ${rowBg} border-r border-slate-100 text-center align-middle px-4`}>
                              <button onClick={() => setSelectedGuards(p => p.includes(guard.id) ? p.filter(x => x !== guard.id) : [...p, guard.id])}
                                className={`${isSelected ? 'text-brand-navy' : 'text-slate-200'} hover:text-brand-navy transition-colors`}>
                                {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                              </button>
                            </td>

                            {/* Guard info with avatar */}
                            <td rowSpan={rowSpan}
                              className={`sticky ${LEFT_GUARD} z-20 ${rowBg} border-r border-slate-100 px-3 py-3 align-middle`}>
                              <div className="flex items-start gap-2.5">
                                {/* Avatar */}
                                <div className="relative group shrink-0 mt-0.5">
                                  <Avatar guard={guard} size={32} />
                                  {/* Hover popup */}
                                  <div className="absolute left-10 top-0 z-50 hidden group-hover:flex flex-col bg-slate-900 text-white rounded-2xl px-4 py-3 shadow-2xl w-52 pointer-events-none">
                                    <Avatar guard={guard} size={56} />
                                    <p className="text-xs font-black mt-2">{guard.full_name}</p>
                                    <p className="text-[10px] text-slate-400">{getGuardId(guard)}</p>
                                  </div>
                                </div>
                                {/* Details */}
                                <div className="flex flex-col gap-1 min-w-0">
                                  {/* Rate tooltip wrapper */}
                                  <div className="relative group/name">
                                    <Link to={`/guards/${guard.id}`}
                                      className="text-xs font-black text-brand-navy hover:text-slate-600 transition-colors tracking-tight block truncate max-w-[170px]">
                                      {guard.full_name}
                                    </Link>
                                    {/* Billing rate tooltip */}
                                    <div className="absolute left-0 top-6 z-50 hidden group-hover/name:block bg-slate-900 text-white rounded-2xl px-4 py-3 shadow-2xl whitespace-nowrap pointer-events-none min-w-[220px]">
                                      <p className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-2">{guard.full_name} — {guard.rank || 'Guard'}</p>
                                      <div className="space-y-1">
                                        <div className="flex justify-between gap-4 text-xs">
                                          <span className="text-slate-400">Day Rate:</span>
                                          <span className="font-black text-emerald-400">LKR {(guard.day_shift_rate || guard.basic_daily_rate || 0).toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between gap-4 text-xs">
                                          <span className="text-slate-400">Night Rate:</span>
                                          <span className="font-black text-indigo-400">LKR {(guard.night_shift_rate || guard.basic_daily_rate || 0).toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between gap-4 text-xs pt-1 border-t border-white/10">
                                          <span className="text-slate-400">Type:</span>
                                          <span className="font-black text-white">{guard.guard_type || 'Regular'}</span>
                                        </div>
                                        <div className="flex justify-between gap-4 text-xs">
                                          <span className="text-slate-400">Since:</span>
                                          <span className="font-black text-white">{guard.joined_date || '—'}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1">
                                    <span className="bg-slate-100 text-brand-navy px-1.5 py-0.5 rounded text-[8px] font-black">{getGuardId(guard)}</span>
                                    <span className="text-amber-600 text-[8px] font-black uppercase">{guard.rank || 'Guard'}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <TypeBadge type={guard.guard_type || 'Regular'} />
                                  </div>
                                  <div className="flex items-center gap-1 text-[8px] font-bold text-slate-400 uppercase tracking-wide">
                                    <Building2 size={8} />
                                    <span className="truncate max-w-[150px]">{guard.client_name || 'Unassigned'}</span>
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Summary */}
                            <td rowSpan={rowSpan}
                              className={`sticky ${LEFT_SUMMARY} z-20 ${rowBg} border-r-2 border-brand-navy/10 px-4 py-3 align-middle`}>
                              <InlineSummary guardId={guard.id} />
                            </td>

                            {/* DAY shift label */}
                            <td className="px-1 py-1 text-center border-r border-slate-100 bg-amber-50/30 align-middle">
                              <div className="flex flex-col items-center gap-1">
                                <span className="text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-lg bg-amber-50 text-amber-600 border border-amber-100 whitespace-nowrap">DAY</span>
                                {nightTpl && !nightHasData && (
                                  <button
                                    onClick={() => setCollapsedNightRows(p => p.includes(guard.id) ? p.filter(x => x !== guard.id) : [...p, guard.id])}
                                    className="text-[7px] text-slate-400 hover:text-indigo-600 font-black uppercase tracking-wide transition-colors">
                                    {nightCollapsed ? '+ NIGHT' : '▲'}
                                  </button>
                                )}
                              </div>
                            </td>

                            {/* DAY cells */}
                            {daysInMonth.map(day => {
                              const ds      = format(day, 'yyyy-MM-dd');
                              const status  = (dayTpl && attendanceData[guard.id]?.[dayTpl.id]?.[ds]) || '';
                              const isWknd  = [0, 6].includes(day.getDay());
                              const isTdy   = ds === today;
                              if (filterShift === 'Night') return <td key={ds} className="p-1 border-r border-slate-50" />;
                              return (
                                <td key={ds} className={`p-1 text-center border-r border-slate-50 ${isTdy ? 'bg-blue-50/40' : isWknd ? 'bg-red-50/20' : ''}`}>
                                  <button
                                    disabled={isLocked || !dayTpl}
                                    onClick={() => dayTpl && handleCellClick(guard.id, ds, dayTpl.id)}
                                    className={`w-11 h-11 rounded-xl flex items-center justify-center text-[10px] font-black transition-all ${STATUS_COLORS[status]} ${
                                      isLocked ? 'cursor-not-allowed opacity-70' : 'hover:scale-110 active:scale-90 cursor-pointer shadow-sm'
                                    }`}
                                  >
                                    {status || '-'}
                                  </button>
                                </td>
                              );
                            })}
                          </tr>

                          {/* ── NIGHT row ── */}
                          {nightTpl && showNightFull && (
                            <tr className={`${rowBg} border-b border-slate-100 transition-colors`}>
                              <td className="px-1 py-1 text-center border-r border-slate-100 bg-indigo-50/30 align-middle">
                                <span className="text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 whitespace-nowrap">NIGHT</span>
                              </td>
                              {daysInMonth.map(day => {
                                const ds     = format(day, 'yyyy-MM-dd');
                                const status = attendanceData[guard.id]?.[nightTpl.id]?.[ds] || '';
                                const isWknd = [0, 6].includes(day.getDay());
                                const isTdy  = ds === today;
                                if (filterShift === 'Day') return <td key={ds} className="p-1 border-r border-slate-50" />;
                                return (
                                  <td key={ds} className={`p-1 text-center border-r border-slate-50 ${isTdy ? 'bg-blue-50/40' : isWknd ? 'bg-red-50/20' : ''}`}>
                                    <button
                                      disabled={isLocked}
                                      onClick={() => handleCellClick(guard.id, ds, nightTpl.id)}
                                      className={`w-11 h-11 rounded-xl flex items-center justify-center text-[10px] font-black transition-all ${STATUS_COLORS[status]} ${
                                        isLocked ? 'cursor-not-allowed opacity-70' : 'hover:scale-110 active:scale-90 cursor-pointer shadow-sm'
                                      }`}
                                    >
                                      {status || '-'}
                                    </button>
                                  </td>
                                );
                              })}
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}

                    {/* ── Site coverage footer ── */}
                    {!isCollapsed && (
                      <tr className="border-b-2 border-slate-200">
                        <td colSpan={daysInMonth.length + 4} className="px-8 py-3 bg-slate-50/80">
                          <div className="flex flex-wrap items-center gap-6 text-[10px] font-black uppercase tracking-widest">
                            <span className="text-slate-500 font-black">{clientName} Coverage — {format(new Date(), 'EEE d MMM yyyy').toUpperCase()}</span>
                            <span className="text-emerald-600 flex items-center gap-1.5">
                              <CheckCircle2 size={11} /> {presentToday} Present
                            </span>
                            <span className="text-red-500 flex items-center gap-1.5">
                              <AlertCircle size={11} /> {absentToday} Absent
                            </span>
                            <span className="text-slate-400">{total - presentToday - absentToday} Not marked</span>
                            {presentToday >= total
                              ? <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full border border-emerald-200">{presentToday}/{total} Covered ✅</span>
                              : <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full border border-amber-200">{presentToday}/{total} Covered ⚠️</span>
                            }
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}

              {Object.keys(grouped).length === 0 && (
                <tr>
                  <td colSpan={daysInMonth.length + 4} className="py-24 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="bg-slate-50 p-8 rounded-full"><Users size={48} className="opacity-20" /></div>
                      <p className="font-black text-xl text-brand-navy">No guards found</p>
                      <p className="text-slate-500 text-sm">Adjust search or filter criteria</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Bottom bar ── */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3 text-slate-500 text-xs font-medium bg-white px-5 py-3 rounded-2xl border border-slate-100 shadow-sm">
          <Info size={15} className="text-brand-navy" />
          Effective Days = Present + (Half × 0.5) · Absent = no pay
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-50 shadow-sm transition-all">
            <Download size={16} /> Export Sheet
          </button>
          <button
            disabled={isLocked}
            onClick={handleSaveAll}
            className={`flex items-center gap-2 px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl transition-all ${
              isLocked ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-brand-navy hover:bg-slate-800 text-white shadow-brand-navy/20'
            }`}
          >
            <Save size={16} /> {isLocked ? 'Sheet Locked' : 'Save Full Month'}
          </button>
        </div>
      </div>
    </div>
  );
}
