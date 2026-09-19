import Database from "better-sqlite3";
const db = new Database("cliniq.db");
try {
  const totalPatients = db.prepare("SELECT count(*) as count FROM patients").get();
  console.log("totalPatients:", totalPatients);
  
  const todayStr = new Date().toISOString().split('T')[0];
  const todayVisits = db.prepare(`
    SELECT count(DISTINCT patient_id) as count 
    FROM (
      SELECT patient_id FROM appointments WHERE date = ? OR date = date('now', 'localtime')
      UNION 
      SELECT patient_id FROM vitals WHERE date(recorded_at) = ? OR date(recorded_at) = date('now', 'localtime')
    )
  `).get(todayStr, todayStr);
  console.log("todayVisits:", todayVisits);

  const activeCases = db.prepare("SELECT count(DISTINCT id) as count FROM patients WHERE status = 'Active'").get();
  console.log("activeCases:", activeCases);

  const pendingLabs = db.prepare("SELECT count(*) as count FROM pending_lab_results").get();
  console.log("pendingLabs:", pendingLabs);

} catch (e) {
  console.error("Error during check:", e);
}
