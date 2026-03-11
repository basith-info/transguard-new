import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const db = new Database("sgms.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT
  );

  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    brn TEXT,
    address TEXT,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    contract_start DATE,
    contract_end DATE,
    guards_required INTEGER,
    status TEXT DEFAULT 'Active'
  );

  CREATE TABLE IF NOT EXISTS guards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT,
    dob DATE,
    gender TEXT,
    nic TEXT,
    passport TEXT,
    phone TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    permanent_address TEXT,
    current_address TEXT,
    blood_group TEXT,
    profile_photo TEXT,
    joined_date DATE,
    designation TEXT,
    rank TEXT,
    guard_type TEXT DEFAULT 'Regular',
    client_id INTEGER,
    status TEXT DEFAULT 'Active',
    resigned_date DATE,
    resigned_reason TEXT,
    leave_start_date DATE,
    leave_expected_return_date DATE,
    basic_daily_rate REAL,
    day_shift_rate REAL,
    night_shift_rate REAL,
    monthly_basic_salary REAL,
    epf_enrolled INTEGER DEFAULT 0,
    epf_rate REAL,
    etf_rate REAL,
    uniform_deduction_amount REAL,
    uniform_installments INTEGER,
    FOREIGN KEY (client_id) REFERENCES clients(id)
  );

  CREATE TABLE IF NOT EXISTS catering_vendors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    status TEXT DEFAULT 'Active'
  );

  CREATE TABLE IF NOT EXISTS guard_food_tracking (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guard_id INTEGER,
    vendor_id INTEGER,
    month INTEGER,
    year INTEGER,
    amount REAL,
    payment_status TEXT DEFAULT 'Unpaid',
    paid_date DATE,
    FOREIGN KEY (guard_id) REFERENCES guards(id),
    FOREIGN KEY (vendor_id) REFERENCES catering_vendors(id),
    UNIQUE(guard_id, vendor_id, month, year)
  );

  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guard_id INTEGER,
    label TEXT,
    file_name TEXT,
    file_path TEXT,
    upload_date DATE,
    FOREIGN KEY (guard_id) REFERENCES guards(id)
  );

  CREATE TABLE IF NOT EXISTS status_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guard_id INTEGER,
    old_status TEXT,
    new_status TEXT,
    changed_by TEXT,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reason TEXT,
    FOREIGN KEY (guard_id) REFERENCES guards(id)
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guard_id INTEGER,
    date DATE,
    status TEXT,
    shift_type TEXT DEFAULT 'Day',
    FOREIGN KEY (guard_id) REFERENCES guards(id),
    UNIQUE(guard_id, date, shift_type)
  );

  CREATE TABLE IF NOT EXISTS advances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guard_id INTEGER,
    date DATE,
    amount REAL,
    reason TEXT,
    deduction_month TEXT,
    FOREIGN KEY (guard_id) REFERENCES guards(id)
  );

  CREATE TABLE IF NOT EXISTS payroll (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guard_id INTEGER,
    month INTEGER,
    year INTEGER,
    effective_days REAL,
    present_days INTEGER,
    absent_days INTEGER,
    half_days INTEGER,
    leave_days INTEGER,
    basic_salary REAL,
    allowances REAL,
    absent_deduction REAL,
    epf_deduction REAL,
    etf_contribution REAL,
    uniform_deduction REAL,
    advance_recovery REAL,
    food_deduction REAL DEFAULT 0,
    manual_adjustment REAL DEFAULT 0,
    adjustment_reason TEXT,
    net_salary REAL,
    status TEXT DEFAULT 'Draft',
    FOREIGN KEY (guard_id) REFERENCES guards(id),
    UNIQUE(guard_id, month, year)
  );

  CREATE TABLE IF NOT EXISTS schedule_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    start_time TEXT,
    end_time TEXT,
    duration REAL,
    pay_classification TEXT,
    color_code TEXT,
    notes TEXT,
    status TEXT DEFAULT 'Active'
  );

  CREATE TABLE IF NOT EXISTS site_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guard_id INTEGER,
    client_id INTEGER,
    template_id INTEGER,
    start_date DATE,
    end_date DATE,
    status TEXT DEFAULT 'Active',
    notes TEXT,
    created_by TEXT,
    created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guard_id) REFERENCES guards(id),
    FOREIGN KEY (client_id) REFERENCES clients(id),
    FOREIGN KEY (template_id) REFERENCES schedule_templates(id)
  );

  CREATE TABLE IF NOT EXISTS daily_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date DATE,
    guard_id INTEGER,
    client_id INTEGER,
    template_id INTEGER,
    type TEXT DEFAULT 'Regular',
    original_guard_id INTEGER,
    status TEXT DEFAULT 'Confirmed',
    notes TEXT,
    FOREIGN KEY (guard_id) REFERENCES guards(id),
    FOREIGN KEY (client_id) REFERENCES clients(id),
    FOREIGN KEY (template_id) REFERENCES schedule_templates(id),
    FOREIGN KEY (original_guard_id) REFERENCES guards(id),
    UNIQUE(date, guard_id)
  );

  CREATE TABLE IF NOT EXISTS gap_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date DATE,
    client_id INTEGER,
    guard_id INTEGER,
    template_id INTEGER,
    status TEXT DEFAULT 'Open',
    resolved_by_guard_id INTEGER,
    resolved_on TIMESTAMP,
    action_taken TEXT,
    FOREIGN KEY (client_id) REFERENCES clients(id),
    FOREIGN KEY (guard_id) REFERENCES guards(id),
    FOREIGN KEY (template_id) REFERENCES schedule_templates(id),
    FOREIGN KEY (resolved_by_guard_id) REFERENCES guards(id)
  );
`);

// Seed default schedule templates
const templates = [
  ["Day Shift", "06:00", "18:00", 12, "Full Day", "#3b82f6", "12-hour stationary post"],
  ["Night Shift", "18:00", "06:00", 12, "Full Day", "#1e293b", "12-hour overnight post"],
  ["24-Hour Post", "06:00", "06:00", 24, "Full Day", "#7c3aed", "Full 24-hour stationary guard"],
  ["Roving Patrol", "08:00", "17:00", 9, "Full Day", "#10b981", "Guard covers multiple sites"],
  ["Event Security", "08:00", "17:00", 9, "Full Day", "#f59e0b", "Temporary one-time assignment"]
];

for (const [name, start, end, dur, pay, color, notes] of templates) {
  const exists = db.prepare("SELECT id FROM schedule_templates WHERE name = ?").get(name);
  if (!exists) {
    db.prepare(`
      INSERT INTO schedule_templates (name, start_time, end_time, duration, pay_classification, color_code, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(name, start, end, dur, pay, color, notes);
  }
}

// Seed admin user if not exists
const admin = db.prepare("SELECT * FROM users WHERE username = ?").get("admin");
if (!admin) {
  db.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)").run("admin", "admin123", "Super Admin");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/debug/db", (req, res) => {
    const guards = db.prepare("SELECT id, full_name, status, basic_daily_rate FROM guards").all();
    const attendance = db.prepare("SELECT COUNT(*) as count FROM attendance").all();
    const payroll = db.prepare("SELECT COUNT(*) as count FROM payroll").all();
    res.json({ guards, attendance, payroll });
  });

  app.post("/api/debug/seed", (req, res) => {
    try {
      const clientInfo = db.prepare("INSERT INTO clients (name, brn, address, contact_person, phone, email, contract_start, contract_end, guards_required) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
        "Global Logistics Hub", "BRN-123456", "Port Road, Colombo", "Mr. Perera", "0771234567", "info@glh.lk", "2026-01-01", "2027-01-01", 10
      );
      const clientId = clientInfo.lastInsertRowid;

      const guardData = [
        ["John Doe", "1990-05-15", "Male", "901234567V", "0711111111", "2026-01-10", "Security Guard", 1500, 1, 8, 3],
        ["Jane Smith", "1992-08-20", "Female", "921234567V", "0722222222", "2026-01-15", "Senior Guard", 1800, 1, 8, 3],
        ["Robert Brown", "1985-03-10", "Male", "851234567V", "0733333333", "2026-02-01", "Security Guard", 1500, 0, 0, 0]
      ];

      for (const [name, dob, gender, nic, phone, joined, desig, rate, epf, epf_r, etf_r] of guardData) {
        db.prepare(`
          INSERT INTO guards (full_name, dob, gender, nic, phone, joined_date, designation, client_id, basic_daily_rate, epf_enrolled, epf_rate, etf_rate)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(name, dob, gender, nic, phone, joined, desig, clientId, rate, epf, epf_r, etf_r);
      }

      res.json({ success: true, message: "Demo data seeded successfully" });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/stats", (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const stats = {
      totalGuards: db.prepare("SELECT COUNT(*) as count FROM guards WHERE status = 'Active'").get().count,
      presentToday: db.prepare("SELECT COUNT(*) as count FROM attendance WHERE date = ? AND status = 'P'").get(today).count,
      absentToday: db.prepare("SELECT COUNT(*) as count FROM attendance WHERE date = ? AND status = 'A'").get(today).count,
      halfDayToday: db.prepare("SELECT COUNT(*) as count FROM attendance WHERE date = ? AND status = 'H'").get(today).count,
      onLeaveToday: db.prepare("SELECT COUNT(*) as count FROM attendance WHERE date = ? AND status = 'PL'").get(today).count,
      totalClients: db.prepare("SELECT COUNT(*) as count FROM clients WHERE status = 'Active'").get().count,
      pendingPayroll: db.prepare("SELECT COUNT(*) as count FROM payroll WHERE status = 'Draft'").get().count,
    };
    res.json(stats);
  });

  // Guards
  app.get("/api/guards", (req, res) => {
    const guards = db.prepare(`
      SELECT g.*, c.name as client_name 
      FROM guards g 
      LEFT JOIN clients c ON g.client_id = c.id
    `).all();
    res.json(guards);
  });

  app.post("/api/guards", (req, res) => {
    const { full_name, dob, gender, nic, passport, phone, emergency_contact_name, emergency_contact_phone, permanent_address, current_address, blood_group, joined_date, designation, rank, guard_type, client_id, basic_daily_rate, day_shift_rate, night_shift_rate, epf_enrolled, epf_rate, etf_rate, uniform_deduction_amount, uniform_installments } = req.body;
    const info = db.prepare(`
      INSERT INTO guards (full_name, dob, gender, nic, passport, phone, emergency_contact_name, emergency_contact_phone, permanent_address, current_address, blood_group, joined_date, designation, rank, guard_type, client_id, basic_daily_rate, day_shift_rate, night_shift_rate, epf_enrolled, epf_rate, etf_rate, uniform_deduction_amount, uniform_installments)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(full_name, dob, gender, nic, passport, phone, emergency_contact_name, emergency_contact_phone, permanent_address, current_address, blood_group, joined_date, designation, rank, guard_type || 'Regular', client_id, basic_daily_rate, day_shift_rate, night_shift_rate, epf_enrolled ? 1 : 0, epf_rate, etf_rate, uniform_deduction_amount, uniform_installments);
    res.json({ id: info.lastInsertRowid });
  });

  app.get("/api/guards/:id", (req, res) => {
    const guard = db.prepare(`
      SELECT g.*, c.name as client_name 
      FROM guards g 
      LEFT JOIN clients c ON g.client_id = c.id
      WHERE g.id = ?
    `).get(req.params.id);
    if (!guard) return res.status(404).json({ error: "Guard not found" });
    res.json(guard);
  });

  app.put("/api/guards/:id", (req, res) => {
    const fields = Object.keys(req.body).filter(f => f !== 'id' && f !== 'client_name');
    const values = fields.map(f => req.body[f]);
    const setClause = fields.map(f => `${f} = ?`).join(', ');
    
    db.prepare(`UPDATE guards SET ${setClause} WHERE id = ?`).run(...values, req.params.id);
    res.json({ success: true });
  });

  app.get("/api/guards/:id/advances", (req, res) => {
    const advances = db.prepare("SELECT * FROM advances WHERE guard_id = ? ORDER BY date DESC").all(req.params.id);
    res.json(advances);
  });

  app.post("/api/guards/:id/advances", (req, res) => {
    const { date, amount, reason, deduction_month } = req.body;
    db.prepare("INSERT INTO advances (guard_id, date, amount, reason, deduction_month) VALUES (?, ?, ?, ?, ?)").run(req.params.id, date, amount, reason, deduction_month);
    res.json({ success: true });
  });

  app.get("/api/guards/:id/documents", (req, res) => {
    const docs = db.prepare("SELECT * FROM documents WHERE guard_id = ?").all(req.params.id);
    res.json(docs);
  });

  app.post("/api/guards/:id/documents", (req, res) => {
    const { label, file_name, upload_date } = req.body;
    db.prepare("INSERT INTO documents (guard_id, label, file_name, upload_date) VALUES (?, ?, ?, ?)").run(req.params.id, label, file_name, upload_date);
    res.json({ success: true });
  });

  app.get("/api/guards/:id/history", (req, res) => {
    const history = db.prepare("SELECT * FROM status_history WHERE guard_id = ? ORDER BY changed_at DESC").all(req.params.id);
    res.json(history);
  });

  // Clients
  app.get("/api/clients", (req, res) => {
    const clients = db.prepare("SELECT * FROM clients").all();
    res.json(clients);
  });

  app.post("/api/clients", (req, res) => {
    const { name, brn, address, contact_person, phone, email, contract_start, contract_end, guards_required } = req.body;
    const info = db.prepare(`
      INSERT INTO clients (name, brn, address, contact_person, phone, email, contract_start, contract_end, guards_required)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, brn, address, contact_person, phone, email, contract_start, contract_end, guards_required);
    res.json({ id: info.lastInsertRowid });
  });

  // Attendance
  app.get("/api/attendance/lock-status", (req, res) => {
    const month = Number(req.query.month);
    const year = Number(req.query.year);
    const payroll = db.prepare("SELECT status FROM payroll WHERE month = ? AND year = ?").get(month, year);
    res.json({ locked: payroll?.status === 'Approved' });
  });

  app.get("/api/attendance", (req, res) => {
    const { month, year } = req.query;
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`; // Simplified
    const attendance = db.prepare(`
      SELECT * FROM attendance 
      WHERE date >= ? AND date <= ?
    `).all(startDate, endDate);
    res.json(attendance);
  });

  // Helper function for payroll calculation
  const calculatePayrollForGuard = (guardId: number, month: number, year: number) => {
    const guard = db.prepare("SELECT * FROM guards WHERE id = ?").get(guardId);
    if (!guard) return;

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

    const attendance = db.prepare("SELECT status, shift_type FROM attendance WHERE guard_id = ? AND date >= ? AND date <= ?").all(guard.id, startDate, endDate);
    
    let basicSalary = 0;
    let present = 0, absent = 0, half = 0, leave = 0, holiday = 0;
    
    attendance.forEach(a => {
      const rate = (a.shift_type === 'Night' ? guard.night_shift_rate : guard.day_shift_rate) || guard.basic_daily_rate || 0;
      
      if (a.status === 'P') {
        present++;
        basicSalary += rate;
      } else if (a.status === 'A') {
        absent++;
      } else if (a.status === 'H') {
        half++;
        basicSalary += (rate * 0.5);
      } else if (a.status === 'PL') {
        leave++;
        basicSalary += rate;
      } else if (a.status === 'PH') {
        holiday++;
        basicSalary += rate;
      }
    });

    const effectiveDays = present + (half * 0.5) + leave + holiday;
    const dailyRate = guard.basic_daily_rate || 0;
    const absentDeduction = dailyRate * absent;
    
    let epfDeduction = 0;
    let etfContribution = 0;
    if (guard.epf_enrolled) {
      epfDeduction = basicSalary * (guard.epf_rate / 100);
      etfContribution = basicSalary * ((guard.etf_rate || 3) / 100); 
    }

    const uniformDeduction = guard.uniform_deduction_amount ? (guard.uniform_deduction_amount / (guard.uniform_installments || 1)) : 0;
    
    const advance = db.prepare("SELECT amount FROM advances WHERE guard_id = ? AND deduction_month = ?").get(guard.id, `${year}-${String(month).padStart(2, '0')}`);
    const advanceRecovery = advance ? advance.amount : 0;

    // Food Deduction
    const food = db.prepare("SELECT SUM(amount) as total FROM guard_food_tracking WHERE guard_id = ? AND month = ? AND year = ?").get(guardId, month, year);
    const foodDeduction = food?.total || 0;

    // Get existing manual adjustment if any
    const existingPayroll = db.prepare("SELECT manual_adjustment FROM payroll WHERE guard_id = ? AND month = ? AND year = ?").get(guardId, month, year);
    const manualAdjustment = existingPayroll ? existingPayroll.manual_adjustment : 0;

    const netSalary = basicSalary - absentDeduction - epfDeduction - uniformDeduction - advanceRecovery - foodDeduction + manualAdjustment;

    db.prepare(`
      INSERT INTO payroll (
        guard_id, month, year, effective_days, present_days, absent_days, half_days, leave_days, 
        basic_salary, allowances, absent_deduction, epf_deduction, etf_contribution, 
        uniform_deduction, advance_recovery, food_deduction, net_salary, manual_adjustment
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(guard_id, month, year) DO UPDATE SET
        effective_days = excluded.effective_days,
        present_days = excluded.present_days,
        absent_days = excluded.absent_days,
        half_days = excluded.half_days,
        leave_days = excluded.leave_days,
        basic_salary = excluded.basic_salary,
        absent_deduction = excluded.absent_deduction,
        epf_deduction = excluded.epf_deduction,
        etf_contribution = excluded.etf_contribution,
        uniform_deduction = excluded.uniform_deduction,
        advance_recovery = excluded.advance_recovery,
        food_deduction = excluded.food_deduction,
        net_salary = excluded.net_salary
      WHERE status = 'Draft'
    `).run(
      guard.id, month, year, effectiveDays, present, absent, half, leave,
      basicSalary, 0, absentDeduction, epfDeduction, etfContribution,
      uniformDeduction, advanceRecovery, foodDeduction, netSalary, manualAdjustment
    );
  };

  app.post("/api/attendance", (req, res) => {
    const { guard_id, date, status, shift_type } = req.body;
    db.prepare(`
      INSERT INTO attendance (guard_id, date, status, shift_type)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(guard_id, date, shift_type) DO UPDATE SET status = excluded.status
    `).run(guard_id, date, status, shift_type || 'Day');
    
    // Auto-update payroll for this guard and month
    const dateObj = new Date(date);
    const month = dateObj.getMonth() + 1;
    const year = dateObj.getFullYear();
    
    try {
      calculatePayrollForGuard(guard_id, month, year);
    } catch (e) {
      console.error("Auto-payroll update failed:", e);
    }

    // Gap Alert Logic
    if (status === 'A') {
      const scheduled = db.prepare("SELECT * FROM daily_schedules WHERE guard_id = ? AND date = ?").get(guard_id, date);
      if (scheduled) {
        db.prepare(`
          INSERT INTO gap_alerts (date, client_id, guard_id, template_id, status)
          VALUES (?, ?, ?, ?, 'Open')
        `).run(date, scheduled.client_id, guard_id, scheduled.template_id);
      }
    } else if (status === 'P' || status === 'H' || status === 'PL' || status === 'PH') {
      // Resolve gap alert if it exists
      db.prepare("UPDATE gap_alerts SET status = 'Resolved', resolved_on = CURRENT_TIMESTAMP WHERE guard_id = ? AND date = ?").run(guard_id, date);
    }

    res.json({ success: true });
  });

  // Schedule Templates
  app.get("/api/schedule-templates", (req, res) => {
    const templates = db.prepare("SELECT * FROM schedule_templates WHERE status = 'Active'").all();
    res.json(templates);
  });

  app.post("/api/schedule-templates", (req, res) => {
    const { name, start_time, end_time, duration, pay_classification, color_code, notes } = req.body;
    const info = db.prepare(`
      INSERT INTO schedule_templates (name, start_time, end_time, duration, pay_classification, color_code, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(name, start_time, end_time, duration, pay_classification, color_code, notes);
    res.json({ id: info.lastInsertRowid });
  });

  // Site Assignments
  app.get("/api/site-assignments", (req, res) => {
    const assignments = db.prepare(`
      SELECT sa.*, g.full_name as guard_name, c.name as client_name, st.name as template_name, st.color_code
      FROM site_assignments sa
      JOIN guards g ON sa.guard_id = g.id
      JOIN clients c ON sa.client_id = c.id
      JOIN schedule_templates st ON sa.template_id = st.id
      WHERE sa.status = 'Active'
    `).all();
    res.json(assignments);
  });

  app.post("/api/site-assignments", (req, res) => {
    const { guard_id, client_id, template_id, start_date, end_date, notes, created_by } = req.body;
    
    // Check for double booking
    const overlap = db.prepare(`
      SELECT id FROM site_assignments 
      WHERE guard_id = ? AND status = 'Active'
      AND (
        (start_date <= ? AND (end_date IS NULL OR end_date >= ?))
        OR (start_date <= ? AND (end_date IS NULL OR end_date >= ?))
      )
    `).get(guard_id, start_date, start_date, end_date || '9999-12-31', end_date || '9999-12-31');

    if (overlap) {
      return res.status(400).json({ error: "Guard is already assigned to another site during this period." });
    }

    const info = db.prepare(`
      INSERT INTO site_assignments (guard_id, client_id, template_id, start_date, end_date, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(guard_id, client_id, template_id, start_date, end_date, notes, created_by);
    res.json({ id: info.lastInsertRowid });
  });

  app.put("/api/site-assignments/:id", (req, res) => {
    const { end_date, status, notes } = req.body;
    db.prepare(`
      UPDATE site_assignments SET end_date = ?, status = ?, notes = ?
      WHERE id = ?
    `).run(end_date, status || 'Active', notes, req.params.id);
    res.json({ success: true });
  });

  // Calendar Generation
  app.post("/api/scheduling/generate-calendar", (req, res) => {
    const { month, year } = req.body;
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

    const assignments = db.prepare(`
      SELECT * FROM site_assignments 
      WHERE status = 'Active' 
      AND start_date <= ? 
      AND (end_date IS NULL OR end_date >= ?)
    `).all(endDate, startDate);

    const daysInMonth = 31;
    
    db.transaction(() => {
      for (const sa of assignments) {
        for (let d = 1; d <= daysInMonth; d++) {
          const date = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          
          if (date >= sa.start_date && (sa.end_date === null || date <= sa.end_date)) {
            db.prepare(`
              INSERT INTO daily_schedules (date, guard_id, client_id, template_id, type)
              VALUES (?, ?, ?, ?, 'Regular')
              ON CONFLICT(date, guard_id) DO UPDATE SET 
                client_id = excluded.client_id,
                template_id = excluded.template_id,
                type = 'Regular'
            `).run(date, sa.guard_id, sa.client_id, sa.template_id);
          }
        }
      }
    })();

    res.json({ success: true });
  });

  // Daily Schedules
  app.get("/api/daily-schedules", (req, res) => {
    const { date, client_id, guard_id, month, year } = req.query;
    let query = `
      SELECT ds.*, g.full_name as guard_name, c.name as client_name, st.name as template_name, st.color_code, st.pay_classification
      FROM daily_schedules ds
      JOIN guards g ON ds.guard_id = g.id
      JOIN clients c ON ds.client_id = c.id
      JOIN schedule_templates st ON ds.template_id = st.id
      WHERE 1=1
    `;
    const params = [];

    if (date) {
      query += " AND ds.date = ?";
      params.push(date);
    }
    if (client_id) {
      query += " AND ds.client_id = ?";
      params.push(client_id);
    }
    if (guard_id) {
      query += " AND ds.guard_id = ?";
      params.push(guard_id);
    }
    if (month && year) {
      const start = `${year}-${String(month).padStart(2, '0')}-01`;
      const end = `${year}-${String(month).padStart(2, '0')}-31`;
      query += " AND ds.date >= ? AND ds.date <= ?";
      params.push(start, end);
    }

    const schedules = db.prepare(query).all(...params);
    res.json(schedules);
  });

  app.post("/api/daily-schedules/replace", (req, res) => {
    const { date, original_guard_id, replacement_guard_id, client_id, template_id, notes } = req.body;
    
    db.transaction(() => {
      db.prepare(`
        INSERT INTO attendance (guard_id, date, status)
        VALUES (?, ?, 'A')
        ON CONFLICT(guard_id, date) DO UPDATE SET status = 'A'
      `).run(original_guard_id, date);

      db.prepare(`
        INSERT INTO daily_schedules (date, guard_id, client_id, template_id, type, original_guard_id, status, notes)
        VALUES (?, ?, ?, ?, 'Replacement', ?, 'Confirmed', ?)
        ON CONFLICT(date, guard_id) DO UPDATE SET 
          client_id = excluded.client_id,
          template_id = excluded.template_id,
          type = 'Replacement',
          original_guard_id = excluded.original_guard_id,
          status = 'Confirmed'
      `).run(date, replacement_guard_id, client_id, template_id, original_guard_id, notes);

      db.prepare(`
        INSERT INTO attendance (guard_id, date, status)
        VALUES (?, ?, 'P')
        ON CONFLICT(guard_id, date) DO UPDATE SET status = 'P'
      `).run(replacement_guard_id, date);

      db.prepare(`
        UPDATE gap_alerts SET status = 'Resolved', resolved_by_guard_id = ?, resolved_on = CURRENT_TIMESTAMP
        WHERE date = ? AND client_id = ? AND guard_id = ?
      `).run(replacement_guard_id, date, client_id, original_guard_id);
    })();

    res.json({ success: true });
  });

  app.get("/api/guards/available", (req, res) => {
    const { date } = req.query;
    const available = db.prepare(`
      SELECT id, full_name, designation FROM guards 
      WHERE status = 'Active'
      AND id NOT IN (
        SELECT guard_id FROM daily_schedules WHERE date = ?
      )
      AND id NOT IN (
        SELECT guard_id FROM attendance WHERE date = ? AND status IN ('PL', 'PH', 'A')
      )
    `).all(date, date);
    res.json(available);
  });

  app.get("/api/gap-alerts", (req, res) => {
    const alerts = db.prepare(`
      SELECT ga.*, c.name as client_name, g.full_name as guard_name, st.name as template_name
      FROM gap_alerts ga
      JOIN clients c ON ga.client_id = c.id
      JOIN guards g ON ga.guard_id = g.id
      JOIN schedule_templates st ON ga.template_id = st.id
      ORDER BY ga.date DESC
    `).all();
    res.json(alerts);
  });

  // Catering Vendors
  app.get("/api/catering-vendors", (req, res) => {
    const vendors = db.prepare("SELECT * FROM catering_vendors").all();
    res.json(vendors);
  });

  app.post("/api/catering-vendors", (req, res) => {
    const { name, contact_person, phone, email, address } = req.body;
    const info = db.prepare(`
      INSERT INTO catering_vendors (name, contact_person, phone, email, address)
      VALUES (?, ?, ?, ?, ?)
    `).run(name, contact_person, phone, email, address);
    res.json({ id: info.lastInsertRowid });
  });

  // Food Tracking
  app.get("/api/food-tracking", (req, res) => {
    const { month, year, guard_id, vendor_id } = req.query;
    let query = `
      SELECT ft.*, g.full_name as guard_name, v.name as vendor_name
      FROM guard_food_tracking ft
      JOIN guards g ON ft.guard_id = g.id
      JOIN catering_vendors v ON ft.vendor_id = v.id
      WHERE 1=1
    `;
    const params = [];
    if (month) { query += " AND ft.month = ?"; params.push(month); }
    if (year) { query += " AND ft.year = ?"; params.push(year); }
    if (guard_id) { query += " AND ft.guard_id = ?"; params.push(guard_id); }
    if (vendor_id) { query += " AND ft.vendor_id = ?"; params.push(vendor_id); }
    
    const records = db.prepare(query).all(...params);
    res.json(records);
  });

  app.post("/api/food-tracking", (req, res) => {
    const { guard_id, vendor_id, month, year, amount } = req.body;
    db.prepare(`
      INSERT INTO guard_food_tracking (guard_id, vendor_id, month, year, amount)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(guard_id, vendor_id, month, year) DO UPDATE SET amount = excluded.amount
    `).run(guard_id, vendor_id, month, year, amount);
    
    // Auto-update payroll
    try {
      calculatePayrollForGuard(Number(guard_id), Number(month), Number(year));
    } catch (e) {
      console.error("Auto-payroll update (food) failed:", e);
    }
    
    res.json({ success: true });
  });

  // Payroll
  app.get("/api/payroll", (req, res) => {
    const month = Number(req.query.month);
    const year = Number(req.query.year);
    const payroll = db.prepare(`
      SELECT p.*, g.full_name, g.basic_daily_rate, g.nic, g.designation, c.name as client_name
      FROM payroll p
      JOIN guards g ON p.guard_id = g.id
      LEFT JOIN clients c ON g.client_id = c.id
      WHERE p.month = ? AND p.year = ?
    `).all(month, year);
    res.json(payroll);
  });

  app.post("/api/payroll/generate", (req, res) => {
    const month = Number(req.body.month);
    const year = Number(req.body.year);
    
    if (isNaN(month) || isNaN(year)) {
      return res.status(400).json({ error: "Invalid month or year" });
    }

    console.log(`Generating payroll for ${month}/${year}`);
    const guards = db.prepare("SELECT * FROM guards WHERE status = 'Active'").all();
    console.log(`Found ${guards.length} active guards`);
    
    if (guards.length === 0) {
      return res.json({ success: true, message: "No active guards found" });
    }

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

    for (const guard of guards) {
      try {
        calculatePayrollForGuard(guard.id, month, year);
      } catch (e) {
        console.error(`Failed to process payroll for guard ${guard.id}:`, e);
      }
    }
    res.json({ success: true });
  });

  app.put("/api/payroll/:id", (req, res) => {
    const { manual_adjustment, adjustment_reason, status } = req.body;
    const payroll = db.prepare("SELECT * FROM payroll WHERE id = ?").get(req.params.id);
    if (!payroll) return res.status(404).json({ error: "Payroll record not found" });
    if (payroll.status === 'Approved' && !status) return res.status(400).json({ error: "Cannot modify approved payroll" });

    const newAdjustment = manual_adjustment !== undefined ? manual_adjustment : payroll.manual_adjustment;
    const newNetSalary = payroll.basic_salary - payroll.absent_deduction - payroll.epf_deduction - payroll.uniform_deduction - payroll.advance_recovery + newAdjustment;

    db.prepare(`
      UPDATE payroll SET 
        manual_adjustment = ?, 
        adjustment_reason = ?, 
        net_salary = ?,
        status = COALESCE(?, status)
      WHERE id = ?
    `).run(newAdjustment, adjustment_reason || payroll.adjustment_reason, newNetSalary, status, req.params.id);
    
    res.json({ success: true });
  });

  app.post("/api/payroll/approve-all", (req, res) => {
    const month = Number(req.body.month);
    const year = Number(req.body.year);
    db.prepare("UPDATE payroll SET status = 'Approved' WHERE month = ? AND year = ? AND status = 'Draft'").run(month, year);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve("dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve("dist/index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
