import React, { useState, useEffect } from "react";
import { 
  Plus, 
  Search, 
  Building2, 
  User, 
  Clock, 
  Calendar as CalendarIcon,
  CheckCircle2,
  X,
  AlertCircle,
  MoreVertical,
  Trash2,
  Edit3
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";

import { Link } from "react-router-dom";

export default function SiteAssignments() {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [guards, setGuards] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [newAssignment, setNewAssignment] = useState({
    guard_id: "",
    client_id: "",
    template_id: "",
    start_date: format(new Date(), "yyyy-MM-dd"),
    end_date: "",
    notes: "",
    rank: "",
    shift: "Day"
  });

  useEffect(() => {
    fetchAssignments();
    fetchGuards();
    fetchClients();
    fetchTemplates();
  }, []);

  const fetchAssignments = () => {
    fetch("/api/site-assignments")
      .then(res => res.json())
      .then(data => setAssignments(data));
  };

  const fetchGuards = () => {
    fetch("/api/guards")
      .then(res => res.json())
      .then(data => setGuards(data.filter((g: any) => g.status === 'Active')));
  };

  const fetchClients = () => {
    fetch("/api/clients")
      .then(res => res.json())
      .then(data => setClients(data.filter((c: any) => c.status === 'Active')));
  };

  const fetchTemplates = () => {
    fetch("/api/schedule-templates")
      .then(res => res.json())
      .then(data => setTemplates(data));
  };

  const handleAddAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    fetch("/api/site-assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...newAssignment,
        created_by: "Admin" // Should be logged-in user
      })
    })
      .then(async res => {
        const data = await res.json();
        if (res.ok) {
          setIsAdding(false);
          fetchAssignments();
          setNewAssignment({
            guard_id: "",
            client_id: "",
            template_id: "",
            start_date: format(new Date(), "yyyy-MM-dd"),
            end_date: "",
            notes: "",
            rank: "",
            shift: "Day"
          });
        } else {
          alert(data.error || "Failed to create assignment");
        }
      });
  };

  const filteredAssignments = assignments.filter(a => 
    a.guard_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.client_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-brand-navy tracking-tight">Site Assignments</h2>
          <p className="text-slate-500 font-medium">Link guards to client sites for permanent scheduling</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-brand-navy hover:bg-slate-800 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center gap-3 transition-all shadow-xl shadow-brand-navy/20"
        >
          <Plus size={20} />
          <span>New Assignment</span>
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <div className="relative flex-1">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
          <input 
            type="text" 
            placeholder="Search assignments by guard or site..." 
            className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-14 pr-6 text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/10 transition-all font-bold shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-[3rem] overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-slate-50 text-brand-navy text-[10px] uppercase tracking-widest font-black">
                <th className="px-10 py-6">Guard</th>
                <th className="px-6 py-6">Client / Site</th>
                <th className="px-6 py-6">Shift</th>
                <th className="px-6 py-6">Rank</th>
                <th className="px-6 py-6">Start Date</th>
                <th className="px-6 py-6">Status</th>
                <th className="px-10 py-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAssignments.map((assignment) => (
                <tr key={assignment.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-10 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-brand-navy shadow-inner">
                        <User size={24} />
                      </div>
                      <div>
                        <Link to={`/guards/${assignment.guard_id}`} className="text-base font-black text-brand-navy hover:text-brand-navy/70 transition-colors tracking-tight">
                          {assignment.guard_name}
                        </Link>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">TGS-{String(assignment.guard_id).padStart(4, '0')}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-brand-navy shadow-inner">
                        <Building2 size={24} />
                      </div>
                      <p className="text-base font-black text-brand-navy tracking-tight">{assignment.client_name}</p>
                    </div>
                  </td>
                  <td className="px-6 py-6">
                    <span className="text-sm font-black text-brand-navy">{assignment.shift || assignment.template_name || "—"}</span>
                  </td>
                  <td className="px-6 py-6">
                    <span className="text-sm font-black text-brand-navy">{assignment.rank || "—"}</span>
                  </td>
                  <td className="px-6 py-6">
                    <p className="text-sm font-black text-brand-navy tracking-tight">{format(new Date(assignment.start_date), "dd/MM/yyyy")}</p>
                    {assignment.end_date && (
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
                        to {format(new Date(assignment.end_date), "dd/MM/yyyy")}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-6">
                    <span className="px-4 py-1.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full text-[10px] font-black uppercase tracking-widest">
                      {assignment.status}
                    </span>
                  </td>
                  <td className="px-10 py-6 text-right">
                    <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all">
                      <button className="p-2.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-brand-navy transition-all" title="Edit">
                        <Edit3 size={20} />
                      </button>
                      <button className="p-2.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-red-500 transition-all" title="End Assignment">
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredAssignments.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-10 py-24 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-6">
                      <div className="bg-slate-50 p-8 rounded-full">
                        <AlertCircle size={64} className="text-slate-200" />
                      </div>
                      <div>
                        <p className="text-2xl font-black text-brand-navy tracking-tight">No site assignments found</p>
                        <p className="text-slate-500 font-medium mt-1">Create a new assignment to link guards to sites.</p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 bg-brand-navy/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white border border-slate-200 rounded-[3rem] w-full max-w-2xl overflow-hidden shadow-2xl"
            >
              <div className="p-10 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-3xl font-black text-brand-navy tracking-tight">New Site Assignment</h3>
                  <p className="text-slate-500 font-medium mt-1">Link a guard to a permanent site schedule</p>
                </div>
                <button onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-brand-navy transition-colors">
                  <X size={32} />
                </button>
              </div>

              <form onSubmit={handleAddAssignment} className="p-10 space-y-8">
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Guard</label>
                    <select 
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-6 text-brand-navy font-bold focus:outline-none focus:ring-2 focus:ring-brand-navy/10 transition-all appearance-none shadow-sm"
                      value={newAssignment.guard_id}
                      onChange={(e) => setNewAssignment({...newAssignment, guard_id: e.target.value})}
                    >
                      <option value="">Choose Guard...</option>
                      {guards.map(g => (
                        <option key={g.id} value={g.id}>{g.full_name} (TGS-{String(g.id).padStart(4, '0')})</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Client / Site</label>
                    <select 
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-6 text-brand-navy font-bold focus:outline-none focus:ring-2 focus:ring-brand-navy/10 transition-all appearance-none shadow-sm"
                      value={newAssignment.client_id}
                      onChange={(e) => setNewAssignment({...newAssignment, client_id: e.target.value})}
                    >
                      <option value="">Choose Client...</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Shift</label>
                    <select 
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-6 text-brand-navy font-bold focus:outline-none focus:ring-2 focus:ring-brand-navy/10 transition-all appearance-none shadow-sm"
                      value={newAssignment.shift}
                      onChange={(e) => setNewAssignment({...newAssignment, shift: e.target.value})}
                    >
                      <option value="Day">Day</option>
                      <option value="Night">Night</option>
                      <option value="Both">Both</option>
                    </select>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rank</label>
                    <select 
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-6 text-brand-navy font-bold focus:outline-none focus:ring-2 focus:ring-brand-navy/10 transition-all appearance-none shadow-sm"
                      value={newAssignment.rank}
                      onChange={(e) => setNewAssignment({...newAssignment, rank: e.target.value})}
                    >
                      <option value="">Select rank...</option>
                      <option value="SSO">SSO</option>
                      <option value="OIC">OIC</option>
                      <option value="Guard">Guard</option>
                      <option value="Supervisor">Supervisor</option>
                    </select>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Schedule Template</label>
                    <select 
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-6 text-brand-navy font-bold focus:outline-none focus:ring-2 focus:ring-brand-navy/10 transition-all appearance-none shadow-sm"
                      value={newAssignment.template_id}
                      onChange={(e) => setNewAssignment({...newAssignment, template_id: e.target.value})}
                    >
                      <option value="">Choose Template...</option>
                      {templates.map(t => {
                        const hours = t.start_time && t.end_time ? `${t.start_time} – ${t.end_time}` : "";
                        const label = hours ? `${t.name} (${hours})` : t.name;
                        return <option key={t.id} value={t.id}>{label}</option>;
                      })}
                    </select>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Start Date</label>
                    <input 
                      type="date"
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-6 text-brand-navy font-bold focus:outline-none focus:ring-2 focus:ring-brand-navy/10 transition-all shadow-sm"
                      value={newAssignment.start_date}
                      onChange={(e) => setNewAssignment({...newAssignment, start_date: e.target.value})}
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">End Date (Optional)</label>
                    <input 
                      type="date"
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-6 text-brand-navy font-bold focus:outline-none focus:ring-2 focus:ring-brand-navy/10 transition-all shadow-sm"
                      value={newAssignment.end_date}
                      onChange={(e) => setNewAssignment({...newAssignment, end_date: e.target.value})}
                    />
                  </div>

                  <div className="col-span-2 space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Notes / Instructions</label>
                    <textarea 
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-6 text-brand-navy font-bold focus:outline-none focus:ring-2 focus:ring-brand-navy/10 min-h-[120px] text-sm transition-all shadow-sm"
                      placeholder="Special instructions for this assignment..."
                      value={newAssignment.notes}
                      onChange={(e) => setNewAssignment({...newAssignment, notes: e.target.value})}
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full bg-brand-navy hover:bg-slate-800 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-brand-navy/20 transition-all flex items-center justify-center gap-3"
                >
                  <CheckCircle2 size={20} />
                  <span>Create Assignment</span>
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
