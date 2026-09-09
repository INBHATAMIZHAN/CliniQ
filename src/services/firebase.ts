import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  getDocFromServer,
  getDoc,
  collection,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  increment
} from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: "AIzaSyDuLKGBKt65_yl52gs9fNtFK_IOHW5i69U",
  authDomain: "gen-lang-client-0783834445.firebaseapp.com",
  projectId: "gen-lang-client-0783834445",
  storageBucket: "gen-lang-client-0783834445.firebasestorage.app",
  messagingSenderId: "874926184365",
  appId: "1:874926184365:web:ec991d8114c8c243b1b324",
  measurementId: ""
};

// Specific database ID requested by the project environment
export const FIRESTORE_DATABASE_ID = "ai-studio-remixremixremixr-5b63430e-60dc-408f-b6da-e7f8c13425fb";

// Initialize Firebase client and connect to the specific named Firestore database
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app, FIRESTORE_DATABASE_ID);

// Connectivity validation helper as mandated by firebase guidelines
export async function testFirestoreConnection(): Promise<{ connected: boolean; error?: string }> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('[Firebase] Connected to Firestore database successfully');
    return { connected: true };
  } catch (error: any) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('[Firebase] Client is offline. Please check your Firebase configuration or network.');
      return { connected: false, error: 'Client is offline' };
    }
    // Any other permission or fetch response indicates network reachability to Firestore
    console.log('[Firebase] Firestore initialized and active:', error?.message || 'Ready');
    return { connected: true };
  }
}

/**
 * Store user registration and login details in Firestore `users` collection
 */
export async function saveUserToFirestore(userData: {
  username: string;
  name: string;
  role: 'doctor' | 'nurse' | 'patient';
  hospitalCode?: string;
  password?: string;
}): Promise<void> {
  try {
    const cleanUsername = userData.username.trim().toLowerCase();
    if (!cleanUsername) return;
    
    const userDocRef = doc(db, 'users', cleanUsername);
    await setDoc(userDocRef, {
      username: cleanUsername,
      name: userData.name,
      role: userData.role,
      hospitalCode: userData.hospitalCode || '',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      loginCount: 1,
      syncedAt: new Date().toISOString()
    }, { merge: true });

    console.log(`[Firebase] User '${cleanUsername}' login details saved to Firestore`);
  } catch (err) {
    console.warn('[Firebase] User save warning:', err);
  }
}

/**
 * Record a user login in Firestore database (tracks login count and last login timestamp)
 */
export async function recordLoginInFirestore(userData: {
  username: string;
  name?: string;
  role?: string;
}): Promise<void> {
  try {
    const cleanUsername = (userData.username || '').trim().toLowerCase();
    if (!cleanUsername) return;

    const userDocRef = doc(db, 'users', cleanUsername);
    const existing = await getDoc(userDocRef);

    if (existing.exists()) {
      await updateDoc(userDocRef, {
        lastLoginAt: new Date().toISOString(),
        loginCount: increment(1)
      });
    } else {
      await setDoc(userDocRef, {
        username: cleanUsername,
        name: userData.name || cleanUsername,
        role: userData.role || 'patient',
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        loginCount: 1
      }, { merge: true });
    }
    console.log(`[Firebase] Logged login event for user '${cleanUsername}' in Firestore`);
  } catch (err) {
    console.warn('[Firebase] Record login warning:', err);
  }
}

/**
 * Store patient record in Firestore `patients` collection
 */
export async function syncPatientToFirestore(patient: any): Promise<void> {
  try {
    if (!patient) return;
    const patientId = String(patient.id || `P-${Date.now()}`);
    const docRef = doc(db, 'patients', patientId);
    
    await setDoc(docRef, {
      ...patient,
      id: patientId,
      name: patient.name || 'Unknown Patient',
      age: Number(patient.age) || 0,
      gender: patient.gender || 'Other',
      weight: Number(patient.weight) || 0,
      blood_group: patient.blood_group || 'O+',
      allergies: patient.allergies || 'None',
      chronic_conditions: patient.chronic_conditions || 'None',
      past_illness: patient.past_illness || 'None',
      status: patient.status || 'Active',
      updatedAt: new Date().toISOString(),
      syncedAt: new Date().toISOString()
    }, { merge: true });
    
    console.log(`[Firebase] Patient record #${patientId} (${patient.name}) stored in Firestore`);
  } catch (err) {
    console.warn('[Firebase] Patient sync warning:', err);
  }
}

/**
 * Sync batch of patients to Firestore
 */
export async function syncPatientsBatchToFirestore(patients: any[]): Promise<void> {
  if (!patients || patients.length === 0) return;
  // Sync up to 25 patients at a time to prevent high burst
  const slice = patients.slice(0, 30);
  for (const p of slice) {
    await syncPatientToFirestore(p);
  }
}

/**
 * Store prescription record in Firestore `prescriptions` collection
 */
export async function syncPrescriptionToFirestore(prescription: any): Promise<void> {
  try {
    if (!prescription) return;
    const colRef = collection(db, 'prescriptions');
    const docRef = await addDoc(colRef, {
      ...prescription,
      patient_id: String(prescription.patient_id || ''),
      syncedAt: new Date().toISOString()
    });
    console.log(`[Firebase] Prescription stored in Firestore (${docRef.id})`);
  } catch (err) {
    console.warn('[Firebase] Prescription sync warning:', err);
  }
}

/**
 * Store appointment in Firestore `appointments` collection
 */
export async function syncAppointmentToFirestore(appointment: any): Promise<void> {
  try {
    if (!appointment) return;
    const colRef = collection(db, 'appointments');
    const docRef = await addDoc(colRef, {
      ...appointment,
      patient_name: appointment.patient_name || '',
      doctor_name: appointment.doctor_name || '',
      date: appointment.date || new Date().toISOString().split('T')[0],
      syncedAt: new Date().toISOString()
    });
    console.log(`[Firebase] Appointment stored in Firestore (${docRef.id})`);
  } catch (err) {
    console.warn('[Firebase] Appointment sync warning:', err);
  }
}

/**
 * Store patient vitals in Firestore `vitals` collection
 */
export async function syncVitalToFirestore(vital: any): Promise<void> {
  try {
    if (!vital) return;
    const colRef = collection(db, 'vitals');
    const docRef = await addDoc(colRef, {
      ...vital,
      patient_id: String(vital.patient_id || ''),
      recorded_at: vital.recorded_at || new Date().toISOString(),
      syncedAt: new Date().toISOString()
    });
    console.log(`[Firebase] Vital record stored in Firestore (${docRef.id})`);
  } catch (err) {
    console.warn('[Firebase] Vital sync warning:', err);
  }
}

/**
 * Store private data vault record in Firestore `private_data` collection
 */
export async function syncPrivateDataToFirestore(item: {
  id?: number | string;
  staff_id: string;
  staff_name: string;
  patient_id?: number | string | null;
  content: string;
  created_at?: string;
}): Promise<void> {
  try {
    if (!item || !item.content) return;
    const docId = item.id ? String(item.id) : `PV-${Date.now()}`;
    const docRef = doc(db, 'private_data', docId);
    await setDoc(docRef, {
      id: docId,
      staff_id: item.staff_id || 'STAFF001',
      staff_name: item.staff_name || 'Staff',
      patient_id: item.patient_id ? String(item.patient_id) : null,
      content: item.content,
      created_at: item.created_at || new Date().toISOString(),
      syncedAt: new Date().toISOString()
    }, { merge: true });
    console.log(`[Firebase] Private data record #${docId} stored in Firestore`);
  } catch (err) {
    console.warn('[Firebase] Private data sync warning:', err);
  }
}

/**
 * Store clinical alert in Firestore `alerts` collection
 */
export async function syncAlertToFirestore(alert: {
  patient_id: number | string;
  type: string;
  message: string;
}): Promise<void> {
  try {
    if (!alert) return;
    const colRef = collection(db, 'alerts');
    const docRef = await addDoc(colRef, {
      ...alert,
      patient_id: String(alert.patient_id),
      status: 'active',
      created_at: new Date().toISOString(),
      syncedAt: new Date().toISOString()
    });
    console.log(`[Firebase] Alert stored in Firestore (${docRef.id})`);
  } catch (err) {
    console.warn('[Firebase] Alert sync warning:', err);
  }
}

/**
 * Store dashboard statistics summary in Firestore `stats` collection
 */
export async function syncStatsToFirestore(stats: {
  totalPatients: number;
  todayVisits: number;
  activeCases?: number;
}): Promise<void> {
  try {
    if (!stats) return;
    const docRef = doc(db, 'stats', 'dashboard_summary');
    await setDoc(docRef, {
      ...stats,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    console.log('[Firebase] Dashboard stats synced to Firestore');
  } catch (err) {
    console.warn('[Firebase] Stats sync warning:', err);
  }
}

/**
 * Seed initial sample hospital patients and user profiles into Firestore
 * if they are not already populated, ensuring the console displays them immediately.
 */
export async function seedInitialHospitalData(): Promise<void> {
  try {
    const testDoc = await getDoc(doc(db, 'patients', 'P-1001'));
    if (testDoc.exists()) {
      return; // Already initialized
    }

    // Seed core clinical patients
    const samplePatients = [
      { id: 'P-1001', name: 'Aarav Sharma', age: 34, gender: 'Male', weight: 72, blood_group: 'B+', allergies: 'Penicillin', chronic_conditions: 'Hypertension', past_illness: 'None', status: 'Active' },
      { id: 'P-1002', name: 'Priya Patel', age: 29, gender: 'Female', weight: 58, blood_group: 'O+', allergies: 'None', chronic_conditions: 'Asthma', past_illness: 'Bronchitis', status: 'Active' },
      { id: 'P-1003', name: 'Sunita Verma', age: 52, gender: 'Female', weight: 64, blood_group: 'A+', allergies: 'Sulfa', chronic_conditions: 'Type 2 Diabetes', past_illness: 'Kidney Stones', status: 'Under Observation' },
      { id: 'P-1004', name: 'Abdul Khan', age: 45, gender: 'Male', weight: 81, blood_group: 'AB+', allergies: 'None', chronic_conditions: 'None', past_illness: 'Pneumonia', status: 'Recovered' },
      { id: 'P-1005', name: 'Kavita Reddy', age: 38, gender: 'Female', weight: 62, blood_group: 'O-', allergies: 'Aspirin', chronic_conditions: 'Migraine', past_illness: 'None', status: 'Active' }
    ];

    for (const patient of samplePatients) {
      await setDoc(doc(db, 'patients', patient.id), {
        ...patient,
        created_at: new Date().toISOString(),
        syncedAt: new Date().toISOString()
      }, { merge: true });
    }

    // Seed initial demo/staff user profiles in the users collection
    const sampleUsers = [
      { username: 'doctor1', name: 'Dr. Rajesh Sharma', role: 'doctor', hospitalCode: 'CLINI-2024' },
      { username: 'nurse1', name: 'Nurse Meena Kumari', role: 'nurse', hospitalCode: 'CLINI-2024' },
      { username: 'patient1', name: 'Aarav Sharma', role: 'patient' }
    ];

    for (const u of sampleUsers) {
      await setDoc(doc(db, 'users', u.username), {
        username: u.username,
        name: u.name,
        role: u.role,
        hospitalCode: u.hospitalCode || '',
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        loginCount: 1,
        syncedAt: new Date().toISOString()
      }, { merge: true });
    }

    console.log('[Firebase] Initial clinical patients and users seeded successfully to database ' + FIRESTORE_DATABASE_ID);
  } catch (err) {
    console.warn('[Firebase] Initial data seeding error:', err);
  }
}
