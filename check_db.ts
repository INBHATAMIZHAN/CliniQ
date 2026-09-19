import Database from "better-sqlite3";
const db = new Database("cliniq.db");
const patients = db.prepare("SELECT count(*) as count FROM patients").get();
const appointments = db.prepare("SELECT count(*) as count FROM appointments").get();
const alerts = db.prepare("SELECT count(*) as count FROM alerts").get();
console.log({ patients, appointments, alerts });
