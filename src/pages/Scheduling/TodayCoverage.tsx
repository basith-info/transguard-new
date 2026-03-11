import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import {
  Building2,
  User,
  UserX,
  ChevronRight,
  RefreshCw,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

export default function TodayCoverage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const today = format(new Date(), "yyyy-MM-dd");

  const load = () => {
    setLoading(true);
    fetch(`/api/scheduling/today-coverage?date=${today}`)
      .then((res) => res.json())
      .then(setData)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="animate-spin text-brand-navy" size={32} />
      </div>
    );
  }

  const sites = data?.sites || [];

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/scheduling"
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-brand-navy transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-brand-navy tracking-tight">
              Today's Coverage
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {format(new Date(), "EEEE, dd MMMM yyyy")} — Every site, every slot
            </p>
          </div>
        </div>
        <button
          onClick={load}
          className="p-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="grid gap-6">
        {sites.map((site: any) => {
          const slots = site.slots || [];
          const filled = slots.filter((s: any) => s.present !== false).length;
          const vacant = Math.max(0, site.guards_required - slots.length);
          const absent = slots.filter((s: any) => !s.present).length;
          const isGap = filled + absent < site.guards_required;

          return (
            <motion.div
              key={site.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      isGap ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"
                    }`}
                  >
                    <Building2 size={18} />
                  </div>
                  <div>
                    <h3 className="font-black text-brand-navy">{site.name}</h3>
                    <p className="text-xs text-slate-500 font-medium">
                      {filled} filled · {absent} absent · {vacant} vacant
                    </p>
                  </div>
                </div>
                <Link
                  to={`/scheduling/calendar?client=${site.id}`}
                  className="text-xs font-black text-brand-navy uppercase tracking-widest flex items-center gap-1 hover:text-slate-600"
                >
                  Manage <ChevronRight size={14} />
                </Link>
              </div>

              <div className="p-6 grid gap-4">
                {slots.map((slot: any) => (
                  <div
                    key={slot.id}
                    className="flex items-center justify-between py-3 px-4 rounded-xl border bg-white"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          slot.present ? "bg-emerald-50" : "bg-red-50"
                        }`}
                      >
                        {slot.present ? (
                          <CheckCircle2 size={14} className="text-emerald-500" />
                        ) : (
                          <UserX size={14} className="text-red-500" />
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-brand-navy">{slot.guard_name}</p>
                        <p className="text-xs text-slate-500">
                          {slot.template_name} · {slot.rank || "—"}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-xs font-black px-2.5 py-1 rounded-full ${
                        slot.present ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                      }`}
                    >
                      {slot.present ? "Present" : "Absent"}
                    </span>
                  </div>
                ))}
                {Array.from({ length: vacant }).map((_, i) => (
                  <div
                    key={`vacant-${i}`}
                    className="flex items-center justify-between py-3 px-4 rounded-xl border border-dashed border-amber-200 bg-amber-50/30"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                        <AlertTriangle size={14} className="text-amber-600" />
                      </div>
                      <div>
                        <p className="font-bold text-amber-800">VACANT</p>
                        <p className="text-xs text-amber-600">No guard assigned</p>
                      </div>
                    </div>
                    <Link
                      to={`/scheduling/calendar?client=${site.id}`}
                      className="text-xs font-black text-amber-700 uppercase tracking-widest hover:text-amber-800"
                    >
                      + Assign
                    </Link>
                  </div>
                ))}
                {slots.length === 0 && vacant === 0 && (
                  <p className="text-sm text-slate-500 py-4 text-center">
                    No slots configured for this site
                  </p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {sites.length === 0 && !loading && (
        <div className="text-center py-16 bg-slate-50 rounded-2xl border border-slate-100">
          <Building2 size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="font-bold text-slate-600">No active sites</p>
          <p className="text-sm text-slate-500 mt-1">Add clients and assignments to see coverage</p>
        </div>
      )}
    </div>
  );
}
