import Database from "better-sqlite3";
const db = new Database("cliniq.db");
const info = db.prepare("PRAGMA table_info(vitals)").all();
console.log(info);
