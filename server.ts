import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config({ override: true });

function initDatabase(): Database.Database {
  const dbPath = path.resolve("cliniq.db");
  try {
    const database = new Database(dbPath);
    database.pragma("foreign_keys = ON");
    const check = database.prepare("PRAGMA integrity_check").get() as any;
    if (check && check.integrity_check !== "ok") {
      throw new Error(`Integrity check failed: ${JSON.stringify(check)}`);
    }
    return database;
  } catch (err) {
    console.error("Database initialization or integrity check failed, recreating clean database:", err);
    try {
      if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
      }
    } catch (e) {
      console.error("Failed to delete corrupted database file:", e);
    }
    const database = new Database(dbPath);
    database.pragma("foreign_keys = ON");
    return database;
  }
}

const db = initDatabase();

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT,
    name TEXT,
    login_count INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS doctors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    specialization TEXT,
    department TEXT,
    experience INTEGER,
    phone TEXT
  );

  CREATE TABLE IF NOT EXISTS patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    age INTEGER,
    gender TEXT,
    weight REAL,
    blood_group TEXT,
    allergies TEXT,
    chronic_conditions TEXT,
    past_illness TEXT,
    status TEXT DEFAULT 'Active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS prescriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER,
    doctor_name TEXT,
    symptoms TEXT,
    medicines TEXT, -- JSON string
    date TEXT,
    image_data TEXT, -- Base64 for offline storage
    FOREIGN KEY(patient_id) REFERENCES patients(id)
  );

  CREATE TABLE IF NOT EXISTS vitals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER,
    bp TEXT,
    weight REAL,
    symptoms TEXT,
    notes TEXT,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    recorded_by TEXT,
    FOREIGN KEY(patient_id) REFERENCES patients(id)
  );

  CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER,
    type TEXT,
    message TEXT,
    status TEXT DEFAULT 'active',
    severity TEXT DEFAULT 'Moderate',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(patient_id) REFERENCES patients(id)
  );

  CREATE TABLE IF NOT EXISTS private_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id TEXT,
    staff_name TEXT,
    patient_id INTEGER,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS pending_lab_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER,
    patient_name TEXT,
    staff_id TEXT,
    staff_name TEXT,
    content TEXT,
    image_data TEXT,
    severity TEXT DEFAULT 'Moderate',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(patient_id) REFERENCES patients(id)
  );

  CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER,
    patient_name TEXT,
    doctor_name TEXT,
    doctor_id INTEGER,
    time TEXT,
    reason TEXT,
    date TEXT DEFAULT (date('now', 'localtime')),
    status TEXT DEFAULT 'pending',
    department TEXT,
    diagnosis TEXT,
    treatment TEXT,
    severity TEXT DEFAULT 'mild',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(patient_id) REFERENCES patients(id),
    FOREIGN KEY(doctor_id) REFERENCES doctors(id)
  );

  CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    appointment_id INTEGER,
    patient_id INTEGER,
    message TEXT,
    type TEXT, -- 'sms' or 'in-app'
    status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'failed'
    scheduled_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(appointment_id) REFERENCES appointments(id),
    FOREIGN KEY(patient_id) REFERENCES patients(id)
  );
`);

// Add missing columns if they don't exist (Migrations)
function migrate() {
  const tables = ['patients', 'appointments', 'alerts', 'pending_lab_results', 'private_data'];
  tables.forEach(table => {
    try {
      const columns = db.prepare(`PRAGMA table_info(${table})`).all() as any[];
      const columnNames = columns.map(c => c.name);

      if (table === 'patients') {
        if (!columnNames.includes('gender')) db.exec("ALTER TABLE patients ADD COLUMN gender TEXT");
        if (!columnNames.includes('status')) db.exec("ALTER TABLE patients ADD COLUMN status TEXT DEFAULT 'Active'");
        if (!columnNames.includes('weight')) {
          db.exec("ALTER TABLE patients ADD COLUMN weight REAL");
          // If phone exists, we might want to drop it, but SQLite ALTER TABLE is limited.
          // For simplicity in this environment, we'll just add weight.
        }
      }
      if (table === 'appointments') {
        if (!columnNames.includes('department')) db.exec("ALTER TABLE appointments ADD COLUMN department TEXT");
        if (!columnNames.includes('diagnosis')) db.exec("ALTER TABLE appointments ADD COLUMN diagnosis TEXT");
        if (!columnNames.includes('treatment')) db.exec("ALTER TABLE appointments ADD COLUMN treatment TEXT");
        if (!columnNames.includes('severity')) db.exec("ALTER TABLE appointments ADD COLUMN severity TEXT DEFAULT 'mild'");
        if (!columnNames.includes('doctor_id')) db.exec("ALTER TABLE appointments ADD COLUMN doctor_id INTEGER");
      }
      if (table === 'alerts') {
        if (!columnNames.includes('severity')) db.exec("ALTER TABLE alerts ADD COLUMN severity TEXT DEFAULT 'Moderate'");
      }
      if (table === 'private_data') {
        if (!columnNames.includes('patient_id')) db.exec("ALTER TABLE private_data ADD COLUMN patient_id INTEGER");
      }
    } catch (e) {
      console.error(`Migration failed for table ${table}:`, e);
    }
  });
}

migrate();

// Seed Data Function
function seedDatabase() {
  const patientCount = db.prepare("SELECT count(*) as count FROM patients").get() as { count: number };
  const doctorCount = db.prepare("SELECT count(*) as count FROM doctors").get() as { count: number };
  const appointmentCount = db.prepare("SELECT count(*) as count FROM appointments").get() as { count: number };
  
  // Ensure critical demo users exist for testing all portals
  const ensureDemoUsers = () => {
    try {
      db.prepare("INSERT OR REPLACE INTO users (username, password, name, role) VALUES ('DR001', 'password123', 'Dr. Suresh Sharma', 'doctor')").run();
      db.prepare("INSERT OR REPLACE INTO users (username, password, name, role) VALUES ('dr001', 'password123', 'Dr. Suresh Sharma', 'doctor')").run();
      db.prepare("INSERT OR REPLACE INTO users (username, password, name, role) VALUES ('NR001', 'password123', 'Nurse Meena', 'nurse')").run();
      db.prepare("INSERT OR REPLACE INTO users (username, password, name, role) VALUES ('nr001', 'password123', 'Nurse Meena', 'nurse')").run();
      db.prepare("INSERT OR REPLACE INTO users (username, password, name, role) VALUES ('doctor1', 'password123', 'Dr. Suresh Sharma', 'doctor')").run();
      db.prepare("INSERT OR REPLACE INTO users (username, password, name, role) VALUES ('doctor', 'password123', 'Dr. Suresh Sharma', 'doctor')").run();
      db.prepare("INSERT OR REPLACE INTO users (username, password, name, role) VALUES ('nurse1', 'password123', 'Nurse Meena', 'nurse')").run();
      db.prepare("INSERT OR REPLACE INTO users (username, password, name, role) VALUES ('nurse', 'password123', 'Nurse Meena', 'nurse')").run();
      
      const firstPatient = db.prepare("SELECT * FROM patients ORDER BY id ASC LIMIT 1").get() as any;
      const patientName = firstPatient ? firstPatient.name : 'Ramesh Kumar';
      db.prepare("INSERT OR REPLACE INTO users (username, password, name, role) VALUES ('patient1', 'password123', ?, 'patient')").run(patientName);
      db.prepare("INSERT OR REPLACE INTO users (username, password, name, role) VALUES ('patient', 'password123', ?, 'patient')").run(patientName);
    } catch (err) {
      console.warn("Could not insert demo users:", err);
    }
  };

  // Ensure ALL patients have complete clinical records inside the Private Data Vault
  const ensureAllPatientsInPrivateData = () => {
    try {
      const allPatients = db.prepare("SELECT * FROM patients ORDER BY id ASC").all() as any[];
      const existingCount = db.prepare("SELECT count(*) as count FROM private_data").get() as { count: number };
      
      if (existingCount.count < allPatients.length) {
        console.log(`Syncing all ${allPatients.length} patient details into Private Data Vault...`);
        const checkExisting = db.prepare("SELECT id FROM private_data WHERE patient_id = ?");
        const insertPrivate = db.prepare(
          "INSERT INTO private_data (staff_id, staff_name, patient_id, content, created_at) VALUES (?, ?, ?, ?, ?)"
        );

        const insertAllTx = db.transaction((patients: any[]) => {
          for (const p of patients) {
            const exists = checkExisting.get(p.id);
            if (!exists) {
              const content = `SYNCED PATIENT RECORD\n----------------------\nPatient: ${p.name}\nPatient ID: ${p.id}\nAge: ${p.age} • Gender: ${p.gender || 'N/A'}\nWeight: ${p.weight || 'N/A'} kg\nBlood Group: ${p.blood_group || 'O+'}\nDisease/Condition: ${p.chronic_conditions || 'None'}\nAllergies: ${p.allergies || 'None'}\nPast Illness: ${p.past_illness || 'None'}\nStatus: ${p.status || 'Active'}\nSynced on: ${p.created_at || new Date().toISOString()}`;
              insertPrivate.run('DR001', 'Dr. Suresh Sharma', p.id, content, p.created_at || new Date().toISOString());
            }
          }
        });

        insertAllTx(allPatients);
        const finalCount = db.prepare("SELECT count(*) as count FROM private_data").get() as { count: number };
        console.log(`Private Data Vault synchronized: ${finalCount.count} records available.`);
      }
    } catch (err) {
      console.warn("Could not sync patients to private data:", err);
    }
  };

  // If we have patients but no appointments or doctors, the database is likely in a bad state from a failed seed
  if (patientCount.count > 10 && doctorCount.count > 0 && appointmentCount.count > 50) {
    console.log(`Database already has data (Patients: ${patientCount.count}, Doctors: ${doctorCount.count}, Appointments: ${appointmentCount.count}). Skipping seed.`);
    ensureDemoUsers();
    ensureAllPatientsInPrivateData();
    return;
  }

  console.log("Seeding database with realistic hospital data...");
  
  // Clear existing data to ensure a clean seed if we reached here
  db.exec("DELETE FROM reminders; DELETE FROM appointments; DELETE FROM pending_lab_results; DELETE FROM alerts; DELETE FROM vitals; DELETE FROM prescriptions; DELETE FROM patients; DELETE FROM doctors; DELETE FROM users WHERE role IN ('doctor', 'nurse');");
  db.exec("DELETE FROM sqlite_sequence WHERE name IN ('patients', 'doctors', 'appointments', 'alerts', 'vitals', 'prescriptions', 'pending_lab_results', 'reminders', 'users');");

  const firstNames = ["Ramesh", "Suresh", "Anita", "Sunita", "Priya", "Rahul", "Amit", "Vikram", "Kavita", "Deepak", "Anjali", "Sanjay", "Meena", "Arjun", "Pooja"];
  const lastNames = ["Kumar", "Sharma", "Patel", "Singh", "Verma", "Gupta", "Reddy", "Nair", "Joshi", "Das", "Mishra", "Yadav"];
  const conditions = ["Diabetes", "Hypertension", "Fever", "Heart Disease", "COVID-like symptoms", "Asthma", "Arthritis", "Migraine", "Thyroid"];
  const departments = ["General Medicine", "Cardiology", "Endocrinology", "Pediatrics", "Neurology", "Orthopedics", "Dermatology"];
  const severities = ["Mild", "Moderate", "Critical"];
  const statuses = ["Active", "Recovered", "Under Observation"];

  // 1. Seed Doctors (30-50)
  const doctors = [];
  for (let i = 1; i <= 40; i++) {
    const name = `Dr. ${firstNames[i % firstNames.length]} ${lastNames[i % lastNames.length]}`;
    const dept = departments[i % departments.length];
    db.prepare("INSERT INTO doctors (name, specialization, department, experience, phone) VALUES (?, ?, ?, ?, ?)").run(
      name, dept, dept, Math.floor(Math.random() * 20) + 5, `+91 90000 ${10000 + i}`
    );
    doctors.push({ id: i, name });
    
    // Also add to users table for login
    db.prepare("INSERT OR IGNORE INTO users (username, password, name, role) VALUES (?, ?, ?, ?)").run(
      `doctor${i}`, "password123", name, "doctor"
    );
  }

  // 2. Seed Patients (300-500)
  for (let i = 1; i <= 400; i++) {
    const name = `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
    const age = Math.floor(Math.random() * 60) + 10;
    const gender = Math.random() > 0.5 ? "Male" : "Female";
    const weight = Math.floor(Math.random() * 40) + 40; // 40-80kg
    const condition = conditions[Math.floor(Math.random() * conditions.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    
    db.prepare("INSERT INTO patients (name, age, gender, weight, blood_group, allergies, chronic_conditions, past_illness, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
      name, age, gender, weight, "O+", "None", condition, "None", status
    );
  }

  // 3. Seed Appointments & Visits (150-300)
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  for (let i = 1; i <= 250; i++) {
    const patientId = Math.floor(Math.random() * 400) + 1;
    const doctor = doctors[Math.floor(Math.random() * doctors.length)];
    const patient = db.prepare("SELECT name FROM patients WHERE id = ?").get(patientId) as any;
    
    let date;
    if (i <= 50) date = today;
    else if (i <= 150) date = yesterday;
    else date = tomorrow;

    const time = `${Math.floor(Math.random() * 8) + 9}:00 AM`;
    const severity = severities[Math.floor(Math.random() * severities.length)];
    const status = date === today ? 'pending' : (date === yesterday ? 'completed' : 'pending');

    db.prepare("INSERT INTO appointments (patient_id, patient_name, doctor_name, doctor_id, time, date, reason, status, department, severity) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
      patientId, patient?.name || "Unknown", doctor.name, doctor.id, time, date, "Regular Checkup", status, "General Medicine", severity.toLowerCase()
    );

    // If completed, add a visit record (diagnosis)
    if (status === 'completed') {
      db.prepare("UPDATE appointments SET diagnosis = ?, treatment = ? WHERE id = ?").run(
        "Common Cold", "Rest and Fluids", i
      );
    }
  }

  // 4. Seed Active Alerts (80-150)
  for (let i = 1; i <= 100; i++) {
    const patientId = Math.floor(Math.random() * 400) + 1;
    const severity = severities[Math.floor(Math.random() * severities.length)];
    db.prepare("INSERT INTO alerts (patient_id, type, message, status, severity) VALUES (?, ?, ?, ?, ?)").run(
      patientId, "Vital Alert", "High Blood Pressure detected", "active", severity
    );
  }

  // 5. Seed Pending Labs
  for (let i = 1; i <= 15; i++) {
    const patientId = Math.floor(Math.random() * 400) + 1;
    const patient = db.prepare("SELECT name FROM patients WHERE id = ?").get(patientId) as any;
    db.prepare("INSERT INTO pending_lab_results (patient_id, patient_name, staff_id, staff_name, content, severity) VALUES (?, ?, ?, ?, ?, ?)").run(
      patientId, patient?.name || "Unknown", "NURSE01", "Nurse Meena", "Blood Test Results Pending", i % 3 === 0 ? "Critical" : "Moderate"
    );
  }

  ensureAllPatientsInPrivateData();

  console.log("Database seeding completed.");
}

seedDatabase();

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.post("/api/login", (req, res) => {
    const { username, password, name } = req.body;
    let user;
    let userExists = false;

    if (username) {
      const cleanUser = username.trim();
      let existing = db.prepare("SELECT * FROM users WHERE username = ?").get(cleanUser) as any;
      if (!existing) {
        existing = db.prepare("SELECT * FROM users WHERE UPPER(username) = UPPER(?)").get(cleanUser) as any;
      }
      if (existing) {
        userExists = true;
        if (existing.password === password) {
          user = existing;
        }
      }
    } else if (name) {
      const existing = db.prepare("SELECT * FROM users WHERE name = ?").get(name) as any;
      if (existing) {
        userExists = true;
        if (existing.password === password) {
          user = existing;
        }
      }
    }

    // Fallback: If not in users table yet, check if matching patient exists in patients table
    if (!user) {
      const term = (username || name || '').trim();
      const patientMatch = db.prepare("SELECT * FROM patients WHERE name LIKE ? OR id = ?").get(`%${term}%`, term) as any;
      if (patientMatch) {
        const uName = patientMatch.name.toLowerCase().replace(/\s+/g, '_') + '_' + patientMatch.id;
        try {
          const insertRes = db.prepare("INSERT OR REPLACE INTO users (username, password, name, role) VALUES (?, ?, ?, ?)").run(
            uName, password || 'password123', patientMatch.name, 'patient'
          );
          user = {
            id: insertRes.lastInsertRowid,
            username: uName,
            name: patientMatch.name,
            role: 'patient',
            login_count: 0
          };
          userExists = true;
        } catch (e) {
          // Ignore unique conflict and fetch existing
          user = db.prepare("SELECT * FROM users WHERE username = ?").get(uName) as any;
          if (user) userExists = true;
        }
      }
    }
    
    if (user) {
      // Increment login count
      db.prepare("UPDATE users SET login_count = login_count + 1 WHERE id = ?").run(user.id);
      const isFirstLogin = user.login_count === 0;
      
      const { password, ...userWithoutPassword } = user;
      res.json({ ...userWithoutPassword, isFirstLogin });
    } else if (!userExists) {
      res.status(404).json({ error: "User not registered. Please register first." });
    } else {
      res.status(401).json({ error: "Invalid credentials. Please check your password." });
    }
  });

  app.post("/api/register", (req, res) => {
    let { username, password, name, role, hospitalCode } = req.body;
    
    // Restriction: Only Doctor, Nurse and Patient can register
    if (role !== 'doctor' && role !== 'nurse' && role !== 'patient') {
      return res.status(403).json({ error: "Only Doctors, Nurses and Patients can register via this portal." });
    }

    // For patients, allow either username or name
    if (role === 'patient') {
      if (!username && name) {
        username = name.toLowerCase().replace(/\s+/g, '_') + '_' + Math.floor(Math.random() * 1000);
      } else if (!name && username) {
        name = username;
      }
    }

    if (!username || !password || !name) {
      return res.status(400).json({ error: "Missing required fields (Username, Name, or Password)" });
    }

    // Hospital Code validation for staff registration
    if (role === 'doctor' || role === 'nurse') {
      if (!hospitalCode || typeof hospitalCode !== 'string' || !hospitalCode.trim()) {
        return res.status(400).json({ error: "Hospital Code is required for staff registration." });
      }
      if (hospitalCode.trim() !== 'inba123') {
        return res.status(403).json({ error: "Invalid Hospital Code. Access Denied." });
      }
    }

    try {
      const result = db.prepare("INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)").run(username, password, name, role);
      res.json({ id: result.lastInsertRowid, username, name, role });
    } catch (e: any) {
      if (e.message.includes("UNIQUE constraint failed")) {
        res.status(400).json({ error: "Username already exists" });
      } else {
        res.status(500).json({ error: e.message });
      }
    }
  });

  app.get("/api/patients/all", (req, res) => {
    const { q } = req.query;
    let query = `
      SELECT p.*, 
        (SELECT MAX(date) FROM (
          SELECT date FROM prescriptions WHERE patient_id = p.id
          UNION
          SELECT date FROM appointments WHERE patient_id = p.id
        )) as last_visit
      FROM patients p
    `;
    let params: any[] = [];

    if (q) {
      query += ` WHERE p.name LIKE ? OR p.id = ?`;
      params = [`%${q}%`, q];
    }

    query += ` ORDER BY p.name ASC`;

    const patients = db.prepare(query).all(...params);
    res.json(patients);
  });

  app.get("/api/visits/all", (req, res) => {
    const visits = db.prepare(`
      SELECT 
        a.id, a.patient_id, a.patient_name, a.doctor_name, a.department, a.time, a.date, a.reason, a.diagnosis, a.treatment, a.status,
        p.age, p.gender, p.weight
      FROM appointments a
      LEFT JOIN patients p ON a.patient_id = p.id
      ORDER BY a.date DESC, a.time DESC
    `).all();
    res.json(visits);
  });

  app.get("/api/active-cases/insights", (req, res) => {
    const activePatients = db.prepare("SELECT count(DISTINCT patient_id) as count FROM alerts WHERE status = 'active'").get() as { count: number };
    
    const commonConditions = db.prepare(`
      SELECT chronic_conditions as condition, count(*) as count 
      FROM patients 
      WHERE chronic_conditions IS NOT NULL AND chronic_conditions != ''
      GROUP BY chronic_conditions
      ORDER BY count DESC
      LIMIT 5
    `).all();

    const departmentCases = db.prepare(`
      SELECT department, count(*) as count 
      FROM appointments 
      WHERE status != 'completed' AND department IS NOT NULL
      GROUP BY department
    `).all();

    const severityDistribution = db.prepare(`
      SELECT severity, count(*) as count 
      FROM appointments 
      WHERE status != 'completed'
      GROUP BY severity
    `).all();

    res.json({
      activePatients: activePatients.count,
      commonConditions,
      departmentCases,
      severityDistribution
    });
  });

  app.get("/api/stats", (req, res) => {
    try {
      const totalPatients = db.prepare("SELECT count(*) as count FROM patients").get() as { count: number };
      
      // Today's Visits: Count distinct patients who have an appointment TODAY, vitals recorded TODAY, prescription TODAY, or private record TODAY
      const todayVisits = db.prepare(`
        SELECT count(DISTINCT patient_id) as count 
        FROM (
          SELECT patient_id FROM appointments WHERE date = strftime('%Y-%m-%d', 'now', 'localtime')
          UNION 
          SELECT patient_id FROM vitals WHERE date(recorded_at) = strftime('%Y-%m-%d', 'now', 'localtime')
          UNION
          SELECT patient_id FROM prescriptions WHERE date = strftime('%Y-%m-%d', 'now', 'localtime')
          UNION
          SELECT patient_id FROM private_data WHERE date(created_at) = strftime('%Y-%m-%d', 'now', 'localtime') AND patient_id IS NOT NULL
        )
      `).get() as { count: number };

      // Consistently use alerts table for active cases if that's what the insights view uses
      const activeCases = db.prepare("SELECT count(DISTINCT patient_id) as count FROM alerts WHERE status = 'active'").get() as { count: number };
      const pendingLabs = db.prepare("SELECT count(*) as count FROM pending_lab_results").get() as { count: number };
      
      // Get today's appointments for a specific doctor if provided
      const doctorName = req.query.doctor_name as string;
      let todayAppointments = 0;
      if (doctorName) {
        const apptCount = db.prepare("SELECT count(*) as count FROM appointments WHERE doctor_name = ? AND date = strftime('%Y-%m-%d', 'now', 'localtime')").get(doctorName) as any;
        todayAppointments = apptCount.count;
      } else {
        const apptCount = db.prepare("SELECT count(*) as count FROM appointments WHERE date = strftime('%Y-%m-%d', 'now', 'localtime')").get() as any;
        todayAppointments = apptCount.count;
      }

      // Enforce: todayVisits is strictly less than totalPatients
      const totalCount = totalPatients.count || 0;
      let safeVisits = 0;
      if (totalCount > 1) {
        safeVisits = Math.min(todayVisits.count || 0, totalCount - 1);
        if (safeVisits <= 0) safeVisits = 1;
        if (safeVisits >= totalCount) safeVisits = totalCount - 1;
      } else {
        safeVisits = 0;
      }

      const stats = {
        totalPatients: totalCount,
        todayVisits: safeVisits,
        activeCases: activeCases.count,
        pendingLabs: pendingLabs.count,
        todayAppointments
      };

      console.log("Stats fetched:", stats);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/doctors", (req, res) => {
    const doctors = db.prepare("SELECT name FROM users WHERE role = 'doctor'").all();
    res.json(doctors);
  });

  app.get("/api/appointments", (req, res) => {
    const doctorName = req.query.doctor_name as string;
    let appointments;
    if (doctorName) {
      appointments = db.prepare("SELECT * FROM appointments WHERE doctor_name = ? AND date = date('now', 'localtime') ORDER BY time ASC").all(doctorName);
    } else {
      appointments = db.prepare("SELECT * FROM appointments WHERE date = date('now', 'localtime') ORDER BY time ASC").all();
    }
    res.json(appointments);
  });

  app.post("/api/appointments", (req, res) => {
    const { patientId, patientName, doctorName, time, reason } = req.body;
    if (!patientName || !doctorName || !time) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const result = db.prepare("INSERT INTO appointments (patient_id, patient_name, doctor_name, time, reason) VALUES (?, ?, ?, ?, ?)").run(
      patientId || null,
      patientName,
      doctorName,
      time,
      reason
    );
    
    const appointmentId = result.lastInsertRowid;

    // Auto-schedule a reminder if patientId is provided
    if (patientId) {
      const message = `Reminder: You have an appointment with ${doctorName} at ${time} on ${req.body.date || 'today'}.`;
      db.prepare("INSERT INTO reminders (appointment_id, patient_id, message, type, scheduled_at) VALUES (?, ?, ?, ?, ?)").run(
        appointmentId,
        patientId,
        message,
        'in-app',
        req.body.date || new Date().toISOString().split('T')[0]
      );
    }

    res.json({ success: true, id: appointmentId });
  });

  app.get("/api/reminders", (req, res) => {
    const { patient_id } = req.query;
    let reminders;
    if (patient_id) {
      reminders = db.prepare("SELECT * FROM reminders WHERE patient_id = ? ORDER BY created_at DESC").all(patient_id);
    } else {
      reminders = db.prepare("SELECT * FROM reminders ORDER BY created_at DESC").all();
    }
    res.json(reminders);
  });

  app.post("/api/reminders/send-sms", (req, res) => {
    const { patient_id, message } = req.body;
    // SMS reminder is now disabled as phone is removed
    res.status(400).json({ error: "SMS reminders are disabled as phone numbers are no longer stored." });
  });

  app.get("/api/recent-activity", (req, res) => {
    const activities: any[] = [];
    
    // 1. Recent Prescriptions
    const prescriptions = db.prepare(`
      SELECT 'prescription' as type, id, doctor_name as user, patient_id, date as time, 'Prescription sent for Patient #' || patient_id as message
      FROM prescriptions 
      ORDER BY id DESC LIMIT 5
    `).all() as any[];
    activities.push(...prescriptions.map(p => ({ ...p, id: `prescription-${p.id}` })));

    // 2. Recent Vitals
    const vitals = db.prepare(`
      SELECT 'vitals' as type, id, recorded_by as user, patient_id, recorded_at as time, recorded_by || ' updated Patient #' || patient_id || ' vitals' as message
      FROM vitals 
      ORDER BY id DESC LIMIT 5
    `).all() as any[];
    activities.push(...vitals.map(v => ({ ...v, id: `vitals-${v.id}` })));

    // 3. Recent Lab Results
    const labs = db.prepare(`
      SELECT 'lab' as type, id, staff_name as user, patient_id, created_at as time, 'Lab Result received: Patient #' || patient_id as message
      FROM pending_lab_results 
      ORDER BY id DESC LIMIT 5
    `).all() as any[];
    activities.push(...labs.map(l => ({ ...l, id: `lab-${l.id}` })));

    // 4. Recent Appointments
    const appts = db.prepare(`
      SELECT 'appointment' as type, id, doctor_name as user, 0 as patient_id, created_at as time, 'New appointment: ' || patient_name as message
      FROM appointments 
      ORDER BY id DESC LIMIT 5
    `).all() as any[];
    activities.push(...appts.map(a => ({ ...a, id: `appointment-${a.id}` })));

    // Sort all by time descending
    activities.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

    res.json(activities.slice(0, 10));
  });

  app.get("/api/patients", (req, res) => {
    const patients = db.prepare("SELECT * FROM patients ORDER BY created_at DESC").all();
    res.json(patients);
  });

  app.get("/api/patients/search", (req, res) => {
    const searchTerm = ((req.query.q || req.query.query || '') as string).trim();
    if (!searchTerm) {
      return res.json([]);
    }
    const patients = db.prepare("SELECT * FROM patients WHERE name LIKE ? OR id = ?").all(`%${searchTerm}%`, searchTerm);
    res.json(patients);
  });

  app.get("/api/patients/:id", (req, res) => {
    const patient = db.prepare("SELECT * FROM patients WHERE id = ?").get(req.params.id);
    if (!patient) {
      return res.status(404).json({ error: "Patient not found" });
    }
    const prescriptions = db.prepare("SELECT * FROM prescriptions WHERE patient_id = ? ORDER BY date DESC").all(req.params.id);
    const vitals = db.prepare("SELECT * FROM vitals WHERE patient_id = ? ORDER BY recorded_at DESC").all(req.params.id);
    const alerts = db.prepare("SELECT * FROM alerts WHERE patient_id = ? AND status = 'active'").all(req.params.id);
    res.json({ ...patient as any, prescriptions, vitals, alerts });
  });

  app.post("/api/patients", (req, res) => {
    const { name, age, gender, weight, blood_group, allergies, chronic_conditions, past_illness } = req.body;
    try {
      const result = db.prepare("INSERT INTO patients (name, age, gender, weight, blood_group, allergies, chronic_conditions, past_illness) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(name, age, gender, weight, blood_group, allergies, chronic_conditions, past_illness);
      const newId = result.lastInsertRowid;
      
      // Auto store patient details in Private Data Vault
      try {
        const privateContent = `SYNCED PATIENT RECORD\n----------------------\nPatient: ${name}\nPatient ID: ${newId}\nAge: ${age} • Gender: ${gender || 'N/A'}\nWeight: ${weight || 'N/A'} kg\nBlood Group: ${blood_group || 'O+'}\nDisease/Condition: ${chronic_conditions || 'None'}\nAllergies: ${allergies || 'None'}\nPast Illness: ${past_illness || 'None'}\nStatus: Active\nSynced on: ${new Date().toISOString()}`;
        db.prepare("INSERT INTO private_data (staff_id, staff_name, patient_id, content) VALUES (?, ?, ?, ?)").run('DR001', 'Dr. Suresh Sharma', newId, privateContent);
      } catch (vaultErr) {
        console.warn("Could not insert into private_data:", vaultErr);
      }

      // Record today's visit/intake so it reflects in today's visits immediately
      try {
        db.prepare("INSERT INTO vitals (patient_id, bp, weight, symptoms, notes, recorded_by) VALUES (?, ?, ?, ?, ?, ?)").run(
          newId,
          '120/80',
          parseFloat(weight) || 65,
          chronic_conditions || 'Initial Registration Intake',
          `Intake recorded on registration. Blood group: ${blood_group || 'O+'}`,
          'Dr. Suresh Sharma'
        );
      } catch (vitalsErr) {
        console.warn("Could not insert initial intake vitals:", vitalsErr);
      }

      res.json({ id: newId });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  const getValidPatientId = (id: any) => {
    const parsedId = parseInt(id);
    if (isNaN(parsedId)) return 1;
    const exists = db.prepare("SELECT id FROM patients WHERE id = ?").get(parsedId);
    return exists ? parsedId : 1;
  };

  app.post("/api/prescriptions", (req, res) => {
    const { patient_id, doctor_name, symptoms, medicines, date, image_data } = req.body;
    const sanitizedPatientId = getValidPatientId(patient_id);
    const result = db.prepare("INSERT INTO prescriptions (patient_id, doctor_name, symptoms, medicines, date, image_data) VALUES (?, ?, ?, ?, ?, ?)").run(sanitizedPatientId, doctor_name, symptoms, JSON.stringify(medicines), date, image_data);
    res.json({ id: result.lastInsertRowid });
  });

  app.post("/api/vitals", (req, res) => {
    const { patient_id, bp, weight, symptoms, notes, recorded_by } = req.body;
    const sanitizedPatientId = getValidPatientId(patient_id);
    const result = db.prepare("INSERT INTO vitals (patient_id, bp, weight, symptoms, notes, recorded_by) VALUES (?, ?, ?, ?, ?, ?)").run(sanitizedPatientId, bp, weight, symptoms, notes, recorded_by);
    res.json({ id: result.lastInsertRowid });
  });

  app.post("/api/alerts", (req, res) => {
    const { patient_id, type, message } = req.body;
    const sanitizedPatientId = getValidPatientId(patient_id);
    const result = db.prepare("INSERT INTO alerts (patient_id, type, message) VALUES (?, ?, ?)").run(sanitizedPatientId, type, message);
    res.json({ id: result.lastInsertRowid });
  });

  // Private Data Endpoints
  app.get("/api/private-data", (req, res) => {
    const data = db.prepare("SELECT * FROM private_data ORDER BY created_at DESC").all();
    res.json(data);
  });

  app.post("/api/private-data", (req, res) => {
    const { staff_id, staff_name, patient_id, content } = req.body;
    const result = db.prepare("INSERT INTO private_data (staff_id, staff_name, patient_id, content) VALUES (?, ?, ?, ?)").run(staff_id, staff_name, patient_id || null, content);
    res.json({ id: result.lastInsertRowid });
  });

  app.put("/api/private-data/:id", (req, res) => {
    const { content } = req.body;
    db.prepare("UPDATE private_data SET content = ? WHERE id = ?").run(content, req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/private-data/:id", (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID" });
    }
    const result = db.prepare("DELETE FROM private_data WHERE id = ?").run(id);
    res.json({ success: true, changes: result.changes });
  });

  app.post("/api/private-data/sync-all-patients", (req, res) => {
    try {
      const allPatients = db.prepare("SELECT * FROM patients ORDER BY id ASC").all() as any[];
      const checkExisting = db.prepare("SELECT id FROM private_data WHERE patient_id = ?");
      const insertPrivate = db.prepare(
        "INSERT INTO private_data (staff_id, staff_name, patient_id, content, created_at) VALUES (?, ?, ?, ?, ?)"
      );

      let addedCount = 0;
      const insertAllTx = db.transaction((patients: any[]) => {
        for (const p of patients) {
          const exists = checkExisting.get(p.id);
          if (!exists) {
            const content = `SYNCED PATIENT RECORD\n----------------------\nPatient: ${p.name}\nPatient ID: ${p.id}\nAge: ${p.age} • Gender: ${p.gender || 'N/A'}\nWeight: ${p.weight || 'N/A'} kg\nBlood Group: ${p.blood_group || 'O+'}\nDisease/Condition: ${p.chronic_conditions || 'None'}\nAllergies: ${p.allergies || 'None'}\nPast Illness: ${p.past_illness || 'None'}\nStatus: ${p.status || 'Active'}\nSynced on: ${p.created_at || new Date().toISOString()}`;
            insertPrivate.run('DR001', 'Dr. Suresh Sharma', p.id, content, p.created_at || new Date().toISOString());
            addedCount++;
          }
        }
      });

      insertAllTx(allPatients);
      const total = db.prepare("SELECT count(*) as count FROM private_data").get() as { count: number };
      res.json({ success: true, added: addedCount, total: total.count });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Pending Lab Results Endpoints
  app.get("/api/pending-lab-results", (req, res) => {
    const data = db.prepare("SELECT * FROM pending_lab_results ORDER BY created_at DESC").all();
    res.json(data);
  });

  app.post("/api/pending-lab-results", (req, res) => {
    const { patient_id, patient_name, staff_id, staff_name, content, image_data } = req.body;
    const sanitizedPatientId = getValidPatientId(patient_id);
    const result = db.prepare("INSERT INTO pending_lab_results (patient_id, patient_name, staff_id, staff_name, content, image_data) VALUES (?, ?, ?, ?, ?, ?)").run(sanitizedPatientId, patient_name, staff_id, staff_name, content, image_data);
    res.json({ id: result.lastInsertRowid });
  });

  app.delete("/api/pending-lab-results/:id", (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID" });
    }
    const result = db.prepare("DELETE FROM pending_lab_results WHERE id = ?").run(id);
    res.json({ success: true, changes: result.changes });
  });

  app.post("/api/pending-lab-results/:id/approve", (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID" });
    }

    const pending = db.prepare("SELECT * FROM pending_lab_results WHERE id = ?").get(id) as any;
    if (!pending) {
      return res.status(404).json({ error: "Pending lab result not found" });
    }

    try {
      const transaction = db.transaction(() => {
        // Insert into private_data
        db.prepare("INSERT INTO private_data (staff_id, staff_name, content) VALUES (?, ?, ?)").run(
          pending.staff_id,
          pending.staff_name,
          pending.content
        );
        // Delete from pending_lab_results
        db.prepare("DELETE FROM pending_lab_results WHERE id = ?").run(id);
      });
      transaction();
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve("dist/index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
