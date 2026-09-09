export interface User {
  id: number;
  username: string;
  role: 'doctor' | 'nurse' | 'admin' | 'asha' | 'patient';
  name: string;
  isFirstLogin?: boolean;
}

export interface Patient {
  id: number;
  name: string;
  age: number;
  gender?: string;
  weight: number;
  blood_group: string;
  allergies: string;
  chronic_conditions: string;
  past_illness: string;
  created_at: string;
}

export interface Medicine {
  name: string;
  dosage: string;
  frequency: string;
  duration?: string;
}

export interface Prescription {
  id: number;
  patient_id: number;
  doctor_name: string;
  symptoms: string;
  medicines: string; // JSON string
  date: string;
  image_data?: string;
}

export interface Vital {
  id: number;
  patient_id: number;
  bp: string;
  heart_rate: number;
  temperature: number;
  weight: number;
  recorded_at: string;
  recorded_by: string;
}

export interface Alert {
  id: number;
  patient_id: number;
  type: string;
  message: string;
  status: 'active' | 'resolved';
  created_at: string;
}

export interface PrivateData {
  id: number;
  staff_id: string;
  staff_name: string;
  content: string;
  created_at: string;
  timestamp?: string;
  isOffline?: boolean;
}

export interface Appointment {
  id: number;
  patient_id?: number;
  patient_name: string;
  doctor_name: string;
  department?: string;
  time: string;
  reason: string;
  diagnosis?: string;
  treatment?: string;
  date: string;
  status: 'pending' | 'completed' | 'cancelled';
  severity?: 'mild' | 'moderate' | 'critical';
  created_at: string;
}

export interface Reminder {
  id: number;
  appointment_id?: number;
  patient_id: number;
  message: string;
  type: 'sms' | 'in-app';
  status: 'pending' | 'sent' | 'failed';
  scheduled_at: string;
  created_at: string;
}
