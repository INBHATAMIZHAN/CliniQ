import { createWorker } from 'tesseract.js';
import jsQR from 'jsqr';

export interface ExtractedPrescriptionData {
  patientName: string;
  age: number;
  gender: string;
  weight: number;
  bloodGroup: string;
  bp: string;
  doctorName: string;
  date: string;
  symptoms: string;
  diagnosis: string;
  medicines: Array<{
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
    instructions: string;
  }>;
  rawText: string;
}

// Persistent shared Tesseract worker to avoid 6-10s cold-start on every scan
let sharedWorkerPromise: Promise<any> | null = null;
let activeProgressCallback: ((progress: number, status: string) => void) | null = null;

/**
 * Pre-warm the Tesseract OCR engine in the background
 */
export function prewarmOfflineOcrWorker(): void {
  if (!sharedWorkerPromise) {
    getSharedWorker().catch(() => {});
  }
}

async function getSharedWorker(): Promise<any> {
  if (!sharedWorkerPromise) {
    sharedWorkerPromise = (async () => {
      const isBrowser = typeof window !== 'undefined';
      try {
        const worker = await createWorker('eng', 1, {
          workerPath: isBrowser ? '/tesseract/worker.min.js' : undefined,
          corePath: isBrowser ? '/tesseract' : undefined,
          langPath: isBrowser ? '/tessdata' : undefined,
          workerBlobURL: false,
          gzip: false,
          logger: (m: any) => {
            if (m.status === 'recognizing text' && m.progress !== undefined) {
              const pct = Math.round(30 + m.progress * 60);
              activeProgressCallback?.(pct, `Recognizing text (${Math.round(m.progress * 100)}%)...`);
            } else if (m.status === 'loading language traineddata' && m.progress !== undefined) {
              const pct = Math.round(10 + m.progress * 20);
              activeProgressCallback?.(pct, `Loading OCR models (${Math.round(m.progress * 100)}%)...`);
            }
          }
        });
        return worker;
      } catch (localErr) {
        console.warn('[Offline OCR] Local worker initialization failed, attempting fallback:', localErr);
        try {
          const fallbackWorker = await createWorker('eng', 1, {
            logger: (m: any) => {
              if (m.status === 'recognizing text' && m.progress !== undefined) {
                const pct = Math.round(30 + m.progress * 60);
                activeProgressCallback?.(pct, `Recognizing text (${Math.round(m.progress * 100)}%)...`);
              }
            }
          });
          return fallbackWorker;
        } catch (err) {
          console.warn('[Offline OCR] Failed to initialize shared Tesseract worker:', err);
          sharedWorkerPromise = null;
          throw err;
        }
      }
    })();
  }
  return sharedWorkerPromise;
}

/**
 * Preprocesses an image to maximize offline OCR recognition accuracy.
 * Scales to an optimal 1600-1800px resolution, applies grayscale with dynamic range
 * contrast stretching to clarify faint ink, and outputs lossless PNG to eliminate JPEG artifacts.
 */
function preprocessImageForOcr(base64Image: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve(base64Image);
          return;
        }

        // Optimal dimension for high-fidelity character recognition (1600 - 1800 px)
        let width = img.width;
        let height = img.height;
        const maxDim = 1800;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        const imgData = ctx.getImageData(0, 0, width, height);
        const d = imgData.data;

        // Grayscale conversion and min/max luminance detection
        let minLum = 255;
        let maxLum = 0;
        const lumArr = new Uint8Array(d.length / 4);

        for (let i = 0, j = 0; i < d.length; i += 4, j++) {
          const r = d[i];
          const g = d[i + 1];
          const b = d[i + 2];
          const lum = (r * 77 + g * 150 + b * 29) >> 8;
          lumArr[j] = lum;
          if (lum < minLum) minLum = lum;
          if (lum > maxLum) maxLum = lum;
        }

        // Stretch contrast to clarify light or faint handwriting
        const range = maxLum - minLum;
        const shouldStretch = range > 30 && range < 220;

        for (let i = 0, j = 0; i < d.length; i += 4, j++) {
          let val = lumArr[j];
          if (shouldStretch) {
            val = Math.round(((val - minLum) / range) * 255);
          }
          // Gently enhance dark ink strokes against light paper
          if (val > 210) {
            val = 255;
          } else if (val < 130) {
            val = Math.max(0, Math.round(val * 0.85));
          }

          d[i] = val;
          d[i + 1] = val;
          d[i + 2] = val;
        }

        ctx.putImageData(imgData, 0, 0);
        // Use lossless PNG so no compression blocks degrade text edges
        resolve(canvas.toDataURL('image/png'));
      } catch (e) {
        console.warn('[Offline OCR] Preprocessing canvas error, using original:', e);
        resolve(base64Image);
      }
    };
    img.onerror = () => resolve(base64Image);
    img.src = base64Image;
  });
}

/**
 * Fast local QR extraction attempt using jsQR
 */
function tryExtractQrFromImage(base64: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return resolve(null);
        const w = Math.min(img.width, 800);
        const h = Math.min(img.height, 800);
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(img, 0, 0, w, h);
        const imgData = ctx.getImageData(0, 0, w, h);
        const qr = jsQR(imgData.data, w, h);
        resolve(qr ? qr.data : null);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = base64;
  });
}

/**
 * Runs offline OCR using Tesseract.js directly on-device with accurate text extraction.
 */
export async function recognizeTextOffline(
  base64Image: string,
  onProgress?: (progress: number, status: string) => void
): Promise<string> {
  if (!base64Image) return '';

  // 1. Check if prescription contains a structured ClinIQ QR code
  try {
    const qrData = await tryExtractQrFromImage(base64Image);
    if (qrData) {
      console.log('[Offline OCR] Instant QR detected on prescription:', qrData);
      try {
        const parsed = JSON.parse(qrData);
        if (parsed.medicines || parsed.name || parsed.patientName) {
          const medLines = Array.isArray(parsed.medicines)
            ? parsed.medicines.map((m: any) => `${m.name} ${m.dosage || ''} ${m.frequency || ''} ${m.duration || ''}`).join('\n')
            : '';
          return `Patient: ${parsed.name || parsed.patientName || ''}\nAge: ${parsed.age || ''}\nDoctor: ${parsed.doctor || ''}\nDate: ${parsed.date || ''}\n${medLines}`;
        }
      } catch {
        if (qrData.includes('Patient:') || qrData.includes('Rx:') || qrData.includes('Tab')) {
          return qrData;
        }
      }
    }
  } catch {}

  onProgress?.(15, 'Enhancing image for on-device OCR...');
  const processedImage = await preprocessImageForOcr(base64Image);

  onProgress?.(30, 'Connecting to on-device OCR engine...');
  activeProgressCallback = onProgress || null;

  try {
    const worker = await getSharedWorker();
    onProgress?.(45, 'Recognizing prescription document...');

    // Generous safety timeout (35 seconds) to accommodate on-device processing
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Offline OCR execution timeout')), 35000)
    );

    const result = await Promise.race([
      worker.recognize(processedImage),
      timeoutPromise
    ]);

    let text = (result?.data?.text || '').trim();

    // If processed image yielded very little text, fallback to testing original image
    if (text.length < 20 && base64Image !== processedImage) {
      try {
        const directResult = await worker.recognize(base64Image);
        const directText = (directResult?.data?.text || '').trim();
        if (directText.length > text.length) {
          text = directText;
        }
      } catch {}
    }

    onProgress?.(95, 'Structuring clinical data...');
    return text;
  } catch (error: any) {
    console.warn('[Offline OCR] Recognition error:', error?.message || error);
    // Attempt direct image recognition as last resort if preprocessing failed
    try {
      const worker = await getSharedWorker();
      const direct = await worker.recognize(base64Image);
      return (direct?.data?.text || '').trim();
    } catch {
      return '';
    }
  } finally {
    activeProgressCallback = null;
  }
}

/**
 * Parses raw text extracted from a prescription into structured clinical fields.
 * High-precision extraction for patient name, vitals, doctor, diagnosis, and medicines.
 */
export function parsePrescriptionTextOffline(ocrText: string): ExtractedPrescriptionData {
  const lines = ocrText.split('\n').map((l) => l.trim()).filter(Boolean);

  let patientName = '';
  let age = 0;
  let gender = 'Not specified';
  let weight = 0;
  let bloodGroup = '';
  let bp = '';
  let doctorName = '';
  let date = new Date().toISOString().split('T')[0];
  let symptoms = '';
  let diagnosis = '';
  const medicines: ExtractedPrescriptionData['medicines'] = [];

  const commonMeds = [
    'paracetamol', 'dolo', 'calpol', 'crocin', 'pan', 'pantocid', 'pantop', 'pantoprazole',
    'amoxicillin', 'amoxil', 'augmentin', 'clavam', 'azithromycin', 'azithral', 'ceftum',
    'cefixime', 'taxim', 'cefpodoxime', 'monocef', 'ofloxacin', 'levofloxacin', 'ciprofloxacin',
    'metronidazole', 'metrogyl', 'albendazole', 'ivermectin', 'doxycycline', 'metformin',
    'glycomet', 'glimepiride', 'januvia', 'teneligliptin', 'vildagliptin', 'telmisartan',
    'telma', 'amlodipine', 'amlong', 'losartan', 'atorvastatin', 'atorva', 'rosuvastatin',
    'rosuvas', 'ecosprin', 'aspirin', 'clopidogrel', 'deplatt', 'cetirizine', 'levocetirizine',
    'allegra', 'fexofenadine', 'montelukast', 'montair', 'combiflam', 'ibuprofen', 'brufen',
    'zerodol', 'aceclofenac', 'diclofenac', 'voveran', 'tramadol', 'ultram', 'ranitidine',
    'rantac', 'famotidine', 'omeprazole', 'omez', 'rabeprazole', 'razo', 'esomeprazole',
    'nexpro', 'ondansetron', 'emeset', 'domperidone', 'vomistop', 'cyclopam', 'meftal',
    'buscopan', 'grilinctus', 'ascoril', 'benadryl', 'alex', 'ambroxol', 'asthalin',
    'salbutamol', 'budecort', 'deriphyllin', 'prednisolone', 'omnacortil', 'deflazacort',
    'shelcal', 'calcium', 'calcirol', 'vitamin', 'neurobion', 'becosules', 'supradyn',
    'zincovit', 'limcee', 'folvite', 'folic', 'iron', 'autrin', 'thyronorm', 'eltroxin',
    'insulin', 'lasix', 'frusemide', 'spironolactone', 'aldactone', 'gabapentin', 'pregabalin',
    'clonazepam', 'alprazolam', 'zolpidem', 'sertraline', 'escitalopram'
  ];

  const dateRegex = /\b(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}|\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\b/;
  const bloodRegex = /\b(A|B|AB|O)\s*[\+\-](?:ve)?(?!\w)/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase();

    // Doctor name detection
    if (!doctorName && (lower.includes('dr.') || lower.includes('dr ') || lower.startsWith('doctor'))) {
      const match = line.match(/(?:dr\.?|doctor)\s+([A-Za-z\s\.]+)/i);
      if (match && match[1]) {
        let name = match[1].trim();
        name = name.replace(/[\-,;].*$/, '').trim();
        name = name.replace(/\b(?:mbbs|md|ms|frcs|bams|bhms|dnb|mrcp|facs|consultant|physician|surgeon|clinic|hospital|centre|center|department|opd|reg|regd|regn)\b.*/i, '').trim();
        if (name.length > 2 && !/^(hospital|clinic|centre|center|department|opd|prescription)$/i.test(name)) {
          doctorName = 'Dr. ' + name.replace(/^dr\.?\s*/i, '');
        }
      }
    }

    // Patient name detection
    if (!patientName) {
      const pMatch = line.match(/(?:patient(?:\s*name|\s*info)?|pt\.?(?:\s*name)?|name)[\s:\-]+([A-Za-z\s\.]+)/i);
      if (pMatch && pMatch[1]) {
        let cand = pMatch[1].trim();
        cand = cand.replace(/\b(?:age|sex|gender|wt|weight|bp|yrs|years|yo|y\/o|m|f|male|female)\b.*$/i, '').trim();
        cand = cand.replace(/[\-,;].*$/, '').trim();
        cand = cand.replace(/[^a-zA-Z\s]/g, '').trim();
        if (cand.length >= 2 && !/^(patient|patient record|record|instance|general intake|prescription|rx|opd|evaluation|consultation)$/i.test(cand)) {
          patientName = cand;
        }
      } else if (lower.includes('mr.') || lower.includes('mrs.') || lower.includes('ms.') || lower.includes('baby of')) {
        const salutationMatch = line.match(/(?:mr|mrs|ms|miss|master|baby of)\.?\s+([A-Za-z\s]+)/i);
        if (salutationMatch && salutationMatch[1]) {
          let cand = salutationMatch[1].trim();
          cand = cand.replace(/\b(?:age|sex|gender|wt|weight|bp|yrs|years|yo|y\/o|m|f|male|female)\b.*$/i, '').trim();
          cand = cand.replace(/[\-,;].*$/, '').trim();
          if (cand.length >= 2 && !/^(patient|record|prescription|opd)$/i.test(cand)) {
            patientName = cand;
          }
        }
      }
    }

    // Age
    if (!age) {
      const aMatch = line.match(/(?:age|years|yr|yrs|y\/o|yo)[\s:\-]*(\d{1,3})/i) ||
                     line.match(/\b(\d{1,3})\s*(?:years|yrs|yr|y\/o|yo)\b/i) ||
                     line.match(/\b(\d{1,3})\s*[\/\-]\s*(?:m|male|f|female)\b/i);
      if (aMatch && aMatch[1]) {
        const num = parseInt(aMatch[1], 10);
        if (num > 0 && num <= 120) age = num;
      }
    }

    // Gender
    if (gender === 'Not specified') {
      if (line.match(/(?:gender|sex)[\s:\-]+(?:female|f)\b/i) || line.match(/\b\d{1,3}\s*[\/\-]\s*(?:female|f)\b/i) || lower.includes('mrs.') || lower.includes('ms.')) {
        gender = 'Female';
      } else if (line.match(/(?:gender|sex)[\s:\-]+(?:male|m)\b/i) || line.match(/\b\d{1,3}\s*[\/\-]\s*(?:male|m)\b/i) || lower.includes('mr.') || lower.includes('master')) {
        gender = 'Male';
      } else if (/\bfemale\b/i.test(line)) {
        gender = 'Female';
      } else if (/\bmale\b/i.test(line) && !lower.includes('female')) {
        gender = 'Male';
      }
    }

    // Weight
    if (!weight) {
      const wMatch = line.match(/(?:weight|wt)[\s:\-]*(\d{1,3}(?:\.\d+)?)\s*(?:kg|kgs)?/i) ||
                     line.match(/\b(\d{1,3}(?:\.\d+)?)\s*(?:kg|kgs)\b/i);
      if (wMatch && wMatch[1]) {
        const num = parseFloat(wMatch[1]);
        if (num > 0 && num < 300) weight = num;
      }
    }

    // Blood Group
    if (!bloodGroup && (lower.includes('blood') || lower.includes('bg') || lower.includes('grp'))) {
      const bMatch = line.match(bloodRegex);
      if (bMatch) bloodGroup = bMatch[0].toUpperCase().replace(/\s+/g, '');
    }

    // Blood Pressure (only on lines indicating BP or mmHg to prevent mistaking dates for BP)
    if (!bp && (lower.includes('bp') || lower.includes('blood pressure') || lower.includes('mmhg'))) {
      const bpMatch = line.match(/(?:bp|blood\s*pressure)[\s:\-]*(\d{2,3}\s*[\/\-]\s*\d{2,3})/i) ||
                      line.match(/\b(\d{2,3}\s*[\/\-]\s*\d{2,3})\s*(?:mmhg)?\b/i);
      if (bpMatch && bpMatch[1]) {
        bp = bpMatch[1].replace(/\s+/g, '');
      }
    }

    // Date
    if (dateRegex.test(line)) {
      const dMatch = line.match(dateRegex);
      if (dMatch && dMatch[1]) {
        date = dMatch[1];
      }
    }

    // Symptoms or Diagnosis
    if (lower.includes('diagnosis') || lower.includes('dx:') || lower.includes('symptoms') || lower.includes('complaint') || lower.includes('c/o')) {
      const parts = line.split(/[:\-]/);
      let content = parts.slice(1).join(' ').trim();
      if (!content && i + 1 < lines.length && !lines[i + 1].startsWith('Rx') && !lines[i + 1].startsWith('1.') && !lines[i + 1].startsWith('*')) {
        content = lines[i + 1].trim();
      }
      if (content && content.length > 2) {
        if (!diagnosis) diagnosis = content;
        if (!symptoms) symptoms = content;
      }
    }

    // Medicine line parsing
    let cleanLine = line.replace(/^[\s\d\.\)\*\-\•\#\>]+/, '').trim();
    const cleanLower = cleanLine.toLowerCase();

    // Check if line indicates a prescribed medication
    const formMatch = cleanLine.match(/^(?:tab(?:\.|let)?|cap(?:\.|sule)?|syp(?:\.|rup)?|inj(?:\.|ection)?|ointment|oint(?:\.)?|cream|gel|drop(?:s)?|susp(?:\.|ension)?|lotion|inhaler)\s+/i);
    const hasDose = /\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|iu|units?|%)\b/i.test(cleanLine);
    const hasFreq = /\b([0123]\s*[\-\+\/]\s*[0123]\s*[\-\+\/]\s*[0123]|[0123]\s*[\-\+\/]\s*[0123]|\b(?:tds|tid|bd|bid|qid|qds|od|hs|qhs|sos|prn|stat|daily|once\s+daily|twice\s+daily)\b)/i.test(cleanLine);
    const hasKnownMed = commonMeds.some((m) => cleanLower.includes(m));

    const isMed = !!formMatch || (hasDose && hasFreq) || (hasKnownMed && (hasDose || hasFreq || cleanLine.length < 50));

    if (isMed) {
      let form = formMatch ? formMatch[0].trim() : '';
      if (form) {
        cleanLine = cleanLine.slice(formMatch[0].length).trim();
      }

      // Dose extraction
      const doseMatch = cleanLine.match(/(\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|iu|units?|%)\b|\b\d{2,4}\b(?=\s*(?:1|0|tds|bd|bid|tid|od|sos|hs|daily|-|\/)))/i);
      let dosage = doseMatch ? doseMatch[1].trim() : '';
      if (dosage && /^\d+$/.test(dosage)) dosage += 'mg';

      // Frequency extraction (uses word boundary so words like 'food' do not trigger 'od')
      const freqMatch = cleanLine.match(/\b([0123]\s*[\-\+\/]\s*[0123]\s*[\-\+\/]\s*[0123]|[0123]\s*[\-\+\/]\s*[0123]|\b(?:tds|tid|bd|bid|qid|qds|od|hs|qhs|sos|prn|stat|daily|once\s+daily|twice\s+daily|thrice\s+daily|three\s+times\s+daily|at\s+bedtime|morning\s+and\s+night)\b)/i);
      let frequency = freqMatch ? freqMatch[1].replace(/\s+/g, '').toUpperCase() : '';

      // Duration extraction
      const durMatch = cleanLine.match(/(?:x\s*|for\s*)?(\d+\s*(?:days?|weeks?|months?|d|w|m)\b)/i);
      let duration = durMatch ? durMatch[1].trim() : '';

      // Instructions extraction
      let instructions = '';
      if (cleanLower.includes('after food') || cleanLower.includes('after meal') || /\bpc\b/.test(cleanLower)) {
        instructions = 'After meals';
      } else if (cleanLower.includes('before food') || cleanLower.includes('before meal') || cleanLower.includes('empty stomach') || /\bac\b/.test(cleanLower) || /\bbf\b/.test(cleanLower)) {
        instructions = 'Before meals';
      } else if (cleanLower.includes('at night') || cleanLower.includes('at bedtime') || /\bhs\b/.test(cleanLower)) {
        instructions = 'At bedtime';
      } else if (cleanLower.includes('fever') || cleanLower.includes('pain') || /\bsos\b/.test(cleanLower)) {
        instructions = 'As needed (SOS)';
      }

      // Name extraction
      let name = cleanLine;
      if (dosage && cleanLine.includes(dosage)) {
        name = cleanLine.slice(0, cleanLine.indexOf(dosage)).trim();
      } else if (freqMatch && cleanLine.indexOf(freqMatch[0]) > 0) {
        name = cleanLine.slice(0, cleanLine.indexOf(freqMatch[0])).trim();
      }
      name = name.replace(/[\-–,;:\(\)]+/g, ' ').trim();
      name = name.replace(/\b\d+$/, '').trim();

      if (!name) {
        const parts = cleanLine.split(/\s+/);
        name = parts.slice(0, 2).join(' ');
      }

      // Capitalize medicine name
      name = name.charAt(0).toUpperCase() + name.slice(1);

      if (name.length >= 2 && !/^(patient|doctor|prescription|date|age|weight|bp|diagnosis|advice|rx|investigation)$/i.test(name)) {
        if (!medicines.some((m) => m.name.toLowerCase() === name.toLowerCase())) {
          medicines.push({
            name,
            dosage: dosage || 'As directed',
            frequency: frequency || '1-0-1',
            duration: duration || '5 days',
            instructions: instructions || (form.toLowerCase().includes('syp') ? 'With measuring cup' : 'With water')
          });
        }
      }
    }
  }

  // Sanitize patient name
  if (patientName && /^(patient record|patient record instance|patient|record|instance|general intake|prescription|rx|opd)$/i.test(patientName.trim())) {
    patientName = '';
  }

  return {
    patientName,
    age,
    gender,
    weight,
    bloodGroup,
    bp,
    doctorName,
    date,
    symptoms,
    diagnosis,
    medicines,
    rawText: ocrText
  };
}

