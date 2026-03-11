import React, { useState, useEffect } from "react";
import { 
  Plus, 
  Clock, 
  DollarSign, 
  Palette, 
  Trash2, 
  Edit3,
  CheckCircle2,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function ScheduleTemplates() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    start_time: "06:00",
    end_time: "18:00",
    duration: 12,
    pay_classification: "Full Day",
    color_code: "#3b82f6",
    notes: ""
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = () => {
    fetch("/api/schedule-templates")
      .then(res => res.json())
      .then(data => setTemplates(data));
  };

  const handleAddTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    fetch("/api/schedule-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newTemplate)
    })
      .then(res => res.json())
      .then(() => {
        setIsAdding(false);
        fetchTemplates();
        setNewTemplate({
          name: "",
          start_time: "06:00",
          end_time: "18:00",
          duration: 12,
          pay_classification: "Full Day",
          color_code: "#3b82f6",
          notes: ""
        });
      });
  };

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-black text-brand-navy tracking-tight">Schedule Templates</h2>
          <p className="text-slate-500 font-medium">Define shift types and pay classifications</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-brand-navy hover:bg-slate-800 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center gap-3 transition-all shadow-xl shadow-brand-navy/20"
        >
          <Plus size={20} />
          <span>Create Template</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {templates.map((template) => (
          <motion.div 
            key={template.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-xl hover:border-brand-navy/20 transition-all group"
          >
            <div className="flex items-start justify-between mb-8">
              <div className="flex items-center gap-4">
                <div 
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg"
                  style={{ backgroundColor: template.color_code }}
                >
                  <Clock size={28} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-brand-navy tracking-tight">{template.name}</h3>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">{template.pay_classification}</p>
                </div>
              </div>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                <button className="p-2.5 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-brand-navy transition-all">
                  <Edit3 size={20} />
                </button>
                <button className="p-2.5 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-red-500 transition-all">
                  <Trash2 size={20} />
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100 shadow-inner">
                <div className="flex items-center gap-3 text-slate-400">
                  <Clock size={18} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Shift Hours</span>
                </div>
                <span className="text-sm font-black text-brand-navy tracking-tight">{template.start_time} - {template.end_time}</span>
              </div>

              <div className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100 shadow-inner">
                <div className="flex items-center gap-3 text-slate-400">
                  <DollarSign size={18} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Duration</span>
                </div>
                <span className="text-sm font-black text-brand-navy tracking-tight">{template.duration} Hours</span>
              </div>
            </div>

            {template.notes && (
              <p className="mt-8 text-sm text-slate-500 font-medium line-clamp-2 italic border-t border-slate-100 pt-6">"{template.notes}"</p>
            )}
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 bg-brand-navy/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white border border-slate-200 rounded-[3rem] w-full max-w-xl overflow-hidden shadow-2xl"
            >
              <div className="p-10 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-3xl font-black text-brand-navy tracking-tight">New Template</h3>
                  <p className="text-slate-500 font-medium mt-1">Define a reusable shift pattern</p>
                </div>
                <button onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-brand-navy transition-colors">
                  <X size={32} />
                </button>
              </div>

              <form onSubmit={handleAddTemplate} className="p-10 space-y-8">
                <div className="grid grid-cols-2 gap-8">
                  <div className="col-span-2 space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Template Name</label>
                    <input 
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-6 text-brand-navy font-bold focus:outline-none focus:ring-2 focus:ring-brand-navy/10 transition-all shadow-sm"
                      placeholder="e.g., Night Shift"
                      value={newTemplate.name}
                      onChange={(e) => setNewTemplate({...newTemplate, name: e.target.value})}
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Start Time</label>
                    <input 
                      type="time"
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-6 text-brand-navy font-bold focus:outline-none focus:ring-2 focus:ring-brand-navy/10 transition-all shadow-sm"
                      value={newTemplate.start_time}
                      onChange={(e) => setNewTemplate({...newTemplate, start_time: e.target.value})}
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">End Time</label>
                    <input 
                      type="time"
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-6 text-brand-navy font-bold focus:outline-none focus:ring-2 focus:ring-brand-navy/10 transition-all shadow-sm"
                      value={newTemplate.end_time}
                      onChange={(e) => setNewTemplate({...newTemplate, end_time: e.target.value})}
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pay Classification</label>
                    <select 
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-6 text-brand-navy font-bold focus:outline-none focus:ring-2 focus:ring-brand-navy/10 transition-all appearance-none shadow-sm"
                      value={newTemplate.pay_classification}
                      onChange={(e) => setNewTemplate({...newTemplate, pay_classification: e.target.value})}
                    >
                      <option>Full Day</option>
                      <option>Half Day</option>
                      <option>Custom Rate</option>
                    </select>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Color Code</label>
                    <div className="flex gap-4">
                      <input 
                        type="color"
                        className="w-16 h-14 bg-white border border-slate-200 rounded-2xl p-1 cursor-pointer shadow-sm"
                        value={newTemplate.color_code}
                        onChange={(e) => setNewTemplate({...newTemplate, color_code: e.target.value})}
                      />
                      <input 
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl py-4 px-6 text-brand-navy font-mono text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy/10 transition-all shadow-sm"
                        value={newTemplate.color_code}
                        onChange={(e) => setNewTemplate({...newTemplate, color_code: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="col-span-2 space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Notes / Instructions</label>
                    <textarea 
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-6 text-brand-navy font-bold focus:outline-none focus:ring-2 focus:ring-brand-navy/10 min-h-[120px] text-sm transition-all shadow-sm"
                      placeholder="Special duties or site instructions..."
                      value={newTemplate.notes}
                      onChange={(e) => setNewTemplate({...newTemplate, notes: e.target.value})}
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full bg-brand-navy hover:bg-slate-800 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-brand-navy/20 transition-all flex items-center justify-center gap-3"
                >
                  <CheckCircle2 size={20} />
                  <span>Save Template</span>
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
