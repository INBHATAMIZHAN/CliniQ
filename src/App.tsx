import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Activity, 
  Plus, 
  Camera, 
  History, 
  AlertTriangle, 
  AlertCircle,
  Info,
  User, 
  LogOut, 
  Shield, 
  Stethoscope, 
  Phone, 
  Bell,
  Brain,
  Calendar,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Cloud,
  Dna,
  Droplets,
  Edit,
  FileText,
  FlaskConical,
  Heart,
  Mic,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Languages,
  Volume2,
  Send,
  MessageSquare,
  Thermometer,
  Weight,
  UserPlus,
  ShieldAlert,
  Smile,
  X,
  Trash2,
  Lock,
  Unlock,
  Video,
  Package,
  CreditCard,
  Users,
  Wind,
  Zap,
  Cpu,
  Layers,
  Microscope,
  Radio,
  Sun,
  Apple,
  Bug,
  Eye,
  Bot,
  Atom,
  Database,
  Sparkles,
  Fingerprint,
  HardDrive,
  QrCode,
  Search,
  Download,
  RefreshCw,
  Upload,
  Building2,
  Moon
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { Html5QrcodeScanner, Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import jsQR from 'jsqr';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { format, isValid } from 'date-fns';
import { GlassCard, NeonButton, VirtualLogo, StatusBanner, Toast } from './components/UI';
import { User as UserType, Patient, Prescription, Vital, Alert, Medicine, PrivateData, Appointment, Reminder } from './types';
import { 
  extractPrescriptionData, 
  analyzeDrugSafety, 
  predictHealthRisks, 
  explainPrescriptionSimple, 
  chatWithAssistant, 
  generateSpeech,
  analyzeClinicalRisk,
  detectDiseasePatterns,
  voicePrescriptionToDigital,
  extractMedicalDocumentData,
  testAIConnection,
  extractQrFromImage,
  extractQrLocally
} from './services/geminiService';
import { recognizeTextOffline, parsePrescriptionTextOffline, prewarmOfflineOcrWorker } from './services/offlineOcr';
import { 
  testFirestoreConnection, 
  seedInitialHospitalData,
  syncPatientToFirestore, 
  syncPatientsBatchToFirestore,
  syncPrescriptionToFirestore, 
  syncAppointmentToFirestore,
  syncVitalToFirestore,
  syncPrivateDataToFirestore,
  syncAlertToFirestore,
  syncStatsToFirestore,
  saveUserToFirestore,
  recordLoginInFirestore,
  firebaseConfig 
} from './services/firebase';

const getLangCode = (lang: string) => {
  const codes: any = {
    'English': 'en-US',
    'Tamil': 'ta-IN',
    'Hindi': 'hi-IN',
    'Telugu': 'te-IN',
    'Kannada': 'kn-IN',
    'Malayalam': 'ml-IN',
    'Bengali': 'bn-IN',
    'Marathi': 'mr-IN',
    'Gujarati': 'gu-IN',
    'Punjabi': 'pa-IN'
  };
  return codes[lang] || 'en-US';
};

const formatDate = (date: any, formatStr: string = 'MMM dd, yyyy') => {
  if (!date) return 'N/A';
  const d = new Date(date);
  return isValid(d) ? format(d, formatStr) : 'Invalid Date';
};

const formatDateTime = (date: any) => {
  if (!date) return 'N/A';
  const d = new Date(date);
  return isValid(d) ? d.toLocaleString() : 'Invalid Date';
};

const formatTimeOnly = (date: any) => {
  if (!date) return 'N/A';
  const d = new Date(date);
  return isValid(d) ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Invalid Time';
};

function QRScanner({ 
  onScan, 
  initialMode = 'camera', 
  setToast, 
  continuous = false, 
  onError 
}: { 
  onScan: (text: string) => void, 
  initialMode?: 'camera' | 'upload', 
  setToast: (t: any) => void, 
  continuous?: boolean, 
  onError?: (err: string | null) => void 
}) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoScanLoopRef = useRef<number | null>(null);
  const lastScannedRef = useRef<string | null>(null);
  const cooldownRef = useRef<boolean>(false);
  const scannerId = useMemo(() => `qr-reader-${Math.random().toString(36).substr(2, 9)}`, []);

  const [activeMode, setActiveMode] = useState<'camera' | 'upload'>(initialMode);
  const [error, setError] = useState<string | null>(null);
  const [retryTrigger, setRetryTrigger] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [cameras, setCameras] = useState<any[]>([]);
  const [activeCameraId, setActiveCameraId] = useState<string | null>(null);
  const [isFlashOn, setIsFlashOn] = useState(false);
  const [hasFlash, setHasFlash] = useState(false);
  const [isDetected, setIsDetected] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Play pleasant acoustic feedback on successful QR detection
  const playSuccessChime = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
        osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12); // E6 note
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.22);
      }
    } catch (e) {}
    if (navigator.vibrate) {
      try { navigator.vibrate([60, 40, 60]); } catch (e) {}
    }
  }, []);

  const handleDecoded = useCallback((decodedText: string) => {
    if (cooldownRef.current) return;
    if (continuous && decodedText === lastScannedRef.current) return;

    lastScannedRef.current = decodedText;
    playSuccessChime();
    setIsDetected(true);
    setSuccessMessage("QR Code Detected!");

    // Stop real-time video canvas loop
    if (videoScanLoopRef.current) {
      cancelAnimationFrame(videoScanLoopRef.current);
      videoScanLoopRef.current = null;
    }

    setTimeout(() => {
      setIsDetected(false);
      setSuccessMessage(null);
    }, 600);

    onScan(decodedText);

    if (!continuous) {
      cooldownRef.current = true;
      if (scannerRef.current) {
        try {
          const state = scannerRef.current.getState();
          if (state === 2 || state === 3) {
            scannerRef.current.stop().catch(() => {});
          }
        } catch (e) {}
      }
    } else {
      cooldownRef.current = true;
      setTimeout(() => {
        cooldownRef.current = false;
      }, 2000);
    }
  }, [continuous, onScan, playSuccessChime]);

  // Fast multi-pass local image decoder with jsQR + Html5Qrcode + Gemini fallback
  const processImageFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setToast({ message: "Please upload an image file (PNG, JPG, WebP).", type: "error" });
      return;
    }

    setProcessing(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setUploadedPreview(base64);

      try {
        // Fast local decoding using jsQR with multi-pass filters
        const decodedFromJsQR = await new Promise<string | null>((resolve) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) return resolve(null);

            const testPass = (w: number, h: number, filter?: (data: Uint8ClampedArray) => void): string | null => {
              canvas.width = w;
              canvas.height = h;
              ctx.drawImage(img, 0, 0, w, h);
              const imgData = ctx.getImageData(0, 0, w, h);
              if (filter) filter(imgData.data);
              const qr = jsQR(imgData.data, w, h, { inversionAttempts: 'attemptBoth' });
              return qr ? qr.data : null;
            };

            const w = img.width;
            const h = img.height;

            // Pass 1: standard scale
            let result = testPass(w, h);
            if (result) return resolve(result);

            // Pass 2: scaled down (for high-res phone photos, 800px is optimal)
            if (w > 800 || h > 800) {
              const ratio = Math.min(800 / w, 800 / h);
              result = testPass(Math.round(w * ratio), Math.round(h * ratio));
              if (result) return resolve(result);
            }

            // Pass 3: High contrast binarization
            result = testPass(Math.min(w, 800), Math.min(h, 800), (data) => {
              for (let i = 0; i < data.length; i += 4) {
                const brightness = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
                const val = brightness > 128 ? 255 : 0;
                data[i] = data[i + 1] = data[i + 2] = val;
              }
            });
            if (result) return resolve(result);

            // Pass 4: Inverted contrast
            result = testPass(Math.min(w, 800), Math.min(h, 800), (data) => {
              for (let i = 0; i < data.length; i += 4) {
                data[i] = 255 - data[i];
                data[i + 1] = 255 - data[i + 1];
                data[i + 2] = 255 - data[i + 2];
              }
            });
            if (result) return resolve(result);

            resolve(null);
          };
          img.onerror = () => resolve(null);
          img.src = base64;
        });

        if (decodedFromJsQR) {
          setProcessing(false);
          handleDecoded(decodedFromJsQR);
          return;
        }

        // Pass 5: Try Html5Qrcode.scanFile
        if (scannerRef.current) {
          try {
            const html5Result = await scannerRef.current.scanFile(file, true);
            if (html5Result) {
              setProcessing(false);
              handleDecoded(html5Result);
              return;
            }
          } catch (e) {}
        }

        // Pass 6: Fallback to Gemini AI QR extraction
        const { extractQrFromImage } = await import('./services/geminiService');
        const geminiResult = await extractQrFromImage(base64);
        setProcessing(false);

        if (geminiResult) {
          handleDecoded(geminiResult);
        } else {
          setToast({ message: "No QR code could be found in this image. Please try a clearer photo.", type: "error" });
        }
      } catch (err: any) {
        setProcessing(false);
        console.error("Error processing QR image:", err);
        setToast({ message: "Could not read QR image. Please try another.", type: "error" });
      }
    };
    reader.readAsDataURL(file);
  };

  // Discover available cameras
  useEffect(() => {
    Html5Qrcode.getCameras().then(devices => {
      if (devices && devices.length > 0) {
        setCameras(devices);
        const backCamera = devices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('rear') || d.label.toLowerCase().includes('environment'));
        setActiveCameraId(backCamera ? backCamera.id : devices[0].id);
      }
    }).catch(e => {
      console.log("Could not enumerate cameras", e);
    });
  }, []);

  // Camera initialization & ultra-fast frame decoding loop
  useEffect(() => {
    if (activeMode !== 'camera') {
      if (scannerRef.current) {
        try {
          const state = scannerRef.current.getState();
          if (state === 2 || state === 3) {
            scannerRef.current.stop().catch(() => {});
          }
        } catch (e) {}
      }
      if (videoScanLoopRef.current) {
        cancelAnimationFrame(videoScanLoopRef.current);
        videoScanLoopRef.current = null;
      }
      return;
    }

    const scanner = new Html5Qrcode(scannerId);
    scannerRef.current = scanner;
    setError(null);
    if (onError) onError(null);

    let isStopping = false;

    const startTimer = setTimeout(async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const msg = "Camera API is not supported in this browser. Please use the Upload QR option.";
        setError(msg);
        if (onError) onError(msg);
        setActiveMode('upload');
        return;
      }

      const cameraConfig = activeCameraId 
        ? { deviceId: { exact: activeCameraId } }
        : { facingMode: "environment" };

      const scanConfig = {
        fps: 30,
        qrbox: (w: number, h: number) => {
          const size = Math.floor(Math.min(w, h) * 0.72);
          return { width: size, height: size };
        },
        aspectRatio: 1.0,
        disableFlip: false
      };

      try {
        await scanner.start(
          cameraConfig,
          scanConfig,
          (decoded) => {
            if (!isStopping) handleDecoded(decoded);
          },
          () => {}
        );

        // Ultra-fast frame capture loop using jsQR on the live video element
        const videoElement = document.querySelector(`#${scannerId} video`) as HTMLVideoElement;
        if (videoElement) {
          const captureCanvas = document.createElement('canvas');
          const captureCtx = captureCanvas.getContext('2d', { willReadFrequently: true });

          const checkFrame = () => {
            if (isStopping || cooldownRef.current) return;
            if (videoElement.readyState >= 2 && captureCtx) {
              const vw = videoElement.videoWidth;
              const vh = videoElement.videoHeight;
              if (vw > 0 && vh > 0) {
                // Resize capture canvas to fast dimension (max 480px for instant ~2ms scan)
                const scale = Math.min(1, 480 / Math.max(vw, vh));
                const targetW = Math.round(vw * scale);
                const targetH = Math.round(vh * scale);
                captureCanvas.width = targetW;
                captureCanvas.height = targetH;
                captureCtx.drawImage(videoElement, 0, 0, targetW, targetH);

                const frameData = captureCtx.getImageData(0, 0, targetW, targetH);
                const found = jsQR(frameData.data, targetW, targetH, { inversionAttempts: 'dontInvert' });
                if (found && found.data) {
                  handleDecoded(found.data);
                  return;
                }
              }
            }
            videoScanLoopRef.current = requestAnimationFrame(checkFrame);
          };

          videoScanLoopRef.current = requestAnimationFrame(checkFrame);
        }

        // Check for torch/flashlight capability
        try {
          const track = (scanner as any).getRunningTrack();
          if (track) {
            const capabilities = track.getCapabilities?.() || {};
            setHasFlash(!!capabilities.torch);
          }
        } catch (e) {}

      } catch (err: any) {
        const errMsg = err?.toString() || "Camera initialization failed";
        console.warn("Camera start failed:", errMsg);
        isStopping = true;
        setError("Camera access was denied or not available. Please allow camera access in browser settings or use Upload mode.");
        if (onError) onError(errMsg);
      }
    }, 150);

    return () => {
      clearTimeout(startTimer);
      isStopping = true;
      if (videoScanLoopRef.current) {
        cancelAnimationFrame(videoScanLoopRef.current);
        videoScanLoopRef.current = null;
      }
      try {
        const state = scanner.getState();
        if (state === 2 || state === 3) {
          scanner.stop().catch(() => {});
        }
      } catch (e) {}
    };
  }, [activeMode, retryTrigger, activeCameraId, scannerId, handleDecoded, onError]);

  const toggleFlash = async () => {
    if (!scannerRef.current || !hasFlash) return;
    try {
      const track = (scannerRef.current as any).getRunningTrack();
      if (track) {
        const nextState = !isFlashOn;
        await track.applyConstraints({
          advanced: [{ torch: nextState } as any]
        });
        setIsFlashOn(nextState);
      }
    } catch (e) {
      console.error("Flash error", e);
    }
  };

  const switchCamera = () => {
    if (cameras.length < 2) return;
    const curr = cameras.findIndex(c => c.id === activeCameraId);
    const next = (curr + 1) % cameras.length;
    setActiveCameraId(cameras[next].id);
  };

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Mode Switcher Tabs */}
      <div className="flex bg-virtual-input-bg p-1 rounded-xl border border-virtual-border text-xs font-bold uppercase tracking-wider">
        <button
          type="button"
          onClick={() => { setActiveMode('camera'); setError(null); }}
          className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 transition-all ${
            activeMode === 'camera' 
              ? 'bg-virtual-accent/20 text-virtual-accent border border-virtual-accent/30 shadow-sm' 
              : 'text-virtual-text-muted hover:text-virtual-text'
          }`}
        >
          <Camera size={15} />
          Camera Scan
        </button>
        <button
          type="button"
          onClick={() => { setActiveMode('upload'); setError(null); }}
          className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 transition-all ${
            activeMode === 'upload' 
              ? 'bg-virtual-accent/20 text-virtual-accent border border-virtual-accent/30 shadow-sm' 
              : 'text-virtual-text-muted hover:text-virtual-text'
          }`}
        >
          <Upload size={15} />
          Upload Image
        </button>
      </div>

      {/* Main Viewport */}
      {activeMode === 'camera' ? (
        <div className="relative w-full aspect-square rounded-2xl overflow-hidden border-2 border-emerald-500/40 bg-black shadow-inner">
          <div id={scannerId} className="w-full h-full" />

          {/* Success Flash */}
          <AnimatePresence>
            {isDetected && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-emerald-500/30 backdrop-blur-[2px] z-50 flex items-center justify-center pointer-events-none"
              >
                <div className="bg-emerald-500 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 font-bold animate-bounce">
                  <CheckCircle2 size={24} />
                  <span>{successMessage || "QR Code Scanned!"}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Real-time Reticle and Laser Sweep */}
          {!error && (
            <div className="absolute inset-0 pointer-events-none z-10 flex flex-col items-center justify-center">
              <div className="relative w-[70%] h-[70%] border border-emerald-500/30 rounded-2xl overflow-hidden">
                {/* Corner markers */}
                <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-md" />
                <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-md" />
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-md" />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-md" />

                {/* Laser scan line */}
                <motion.div 
                  className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_rgba(52,211,153,1)]"
                  animate={{ top: ['5%', '95%', '5%'] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                />
              </div>
              <p className="mt-3 text-[11px] font-mono tracking-widest uppercase text-emerald-400 font-bold bg-black/60 px-3 py-1 rounded-full backdrop-blur-sm border border-emerald-500/20">
                Align QR Code within frame
              </p>
            </div>
          )}

          {/* Camera controls */}
          {!error && (
            <div className="absolute top-3 right-3 flex items-center gap-2 z-20">
              {hasFlash && (
                <button 
                  type="button"
                  onClick={toggleFlash}
                  className={`p-2 rounded-full backdrop-blur-md border transition-all ${
                    isFlashOn ? 'bg-emerald-500 border-emerald-400 text-white' : 'bg-black/60 border-white/20 text-white/70'
                  }`}
                  title="Toggle Flash"
                >
                  <Zap size={16} fill={isFlashOn ? "currentColor" : "none"} />
                </button>
              )}
              {cameras.length > 1 && (
                <button 
                  type="button"
                  onClick={switchCamera}
                  className="p-2 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white/70 hover:text-white transition-all"
                  title="Switch Camera"
                >
                  <RefreshCw size={16} />
                </button>
              )}
            </div>
          )}

          {/* Camera Error Fallback */}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 p-6 text-center z-30">
              <div className="p-3 rounded-full bg-red-500/15 text-red-400 mb-3">
                <AlertCircle size={30} />
              </div>
              <h4 className="text-white font-bold text-sm mb-1">Camera Unavailable</h4>
              <p className="text-virtual-text-muted text-xs mb-5 max-w-xs">{error}</p>
              <div className="flex flex-col gap-2.5 w-full max-w-xs">
                <NeonButton 
                  size="sm"
                  onClick={() => { setError(null); setRetryTrigger(p => p + 1); }}
                  className="w-full"
                >
                  <RefreshCw size={14} className="mr-1.5" />
                  Try Camera Again
                </NeonButton>
                <NeonButton 
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveMode('upload')}
                  className="w-full border-emerald-500/40 text-emerald-400"
                >
                  <Upload size={14} className="mr-1.5" />
                  Switch to Upload QR Image
                </NeonButton>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Dedicated Fast Drag-and-Drop File Upload Area */
        <div className="w-full flex flex-col gap-3">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) processImageFile(f);
            }} 
            accept="image/*" 
            className="hidden" 
          />

          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) processImageFile(f);
            }}
            className={`w-full aspect-square rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-all ${
              isDragOver 
                ? 'border-emerald-400 bg-emerald-500/15 scale-[1.01]' 
                : 'border-virtual-border hover:border-emerald-500/50 bg-virtual-input-bg/70 hover:bg-virtual-input-bg'
            } relative overflow-hidden group`}
          >
            {processing ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
                <p className="text-sm font-bold text-virtual-text">Analyzing & Decoding QR...</p>
                <p className="text-xs text-virtual-text-muted">Extracting patient details instantly</p>
              </div>
            ) : uploadedPreview ? (
              <div className="relative w-full h-full flex flex-col items-center justify-center">
                <img src={uploadedPreview} alt="Uploaded QR" className="max-h-[75%] max-w-[75%] object-contain rounded-xl border border-virtual-border shadow-lg mb-3" />
                <p className="text-xs text-virtual-accent font-bold">Click or drag a new image to re-scan</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 group-hover:scale-105 transition-transform">
                <div className="p-4 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm">
                  <Upload size={32} />
                </div>
                <div>
                  <p className="text-sm font-bold text-virtual-text mb-1">Click to Upload QR Image</p>
                  <p className="text-xs text-virtual-text-muted">or drag and drop photo here</p>
                </div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-virtual-accent bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                  Instant jsQR Decoding
                </span>
              </div>
            )}
          </div>

          <NeonButton 
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 border-emerald-500/30 text-emerald-400 py-3"
          >
            <Upload size={16} />
            Browse Files to Upload QR
          </NeonButton>
        </div>
      )}
    </div>
  );
}

function PatientsListView({ onBack }: { onBack: () => void }) {
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchPatients = async () => {
      setLoading(true);
      const url = searchQuery ? `/api/patients/all?q=${encodeURIComponent(searchQuery)}` : '/api/patients/all';
      const res = await fetch(url);
      const data = await res.json();
      setPatients(data);
      setLoading(false);
    };

    const timer = setTimeout(fetchPatients, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-virtual-glass-bg rounded-lg text-virtual-text">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold">Comprehensive Patient List</h1>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-virtual-text-muted" size={18} />
          <input 
            type="text"
            placeholder="Search by Name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-virtual-input-bg border border-virtual-border focus:border-virtual-accent focus:outline-none transition-all text-sm text-virtual-text"
          />
        </div>
      </div>

      <GlassCard hover={false} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-virtual-border bg-virtual-input-bg">
                <th className="p-4 text-xs uppercase tracking-widest text-virtual-text-muted font-medium">Patient Details</th>
                <th className="p-4 text-xs uppercase tracking-widest text-virtual-text-muted font-medium">ID / Weight</th>
                <th className="p-4 text-xs uppercase tracking-widest text-virtual-text-muted font-medium">Last Visit</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={3} className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-emerald-400" /></td></tr>
              ) : patients.length === 0 ? (
                <tr><td colSpan={3} className="p-8 text-center text-virtual-text-muted">No patients found.</td></tr>
              ) : patients.map((p, idx) => (
                <tr key={p.id || `patient-${idx}`} className="border-b border-virtual-border hover:bg-virtual-input-bg transition-all">
                  <td className="p-4">
                    <p className="font-bold text-virtual-text">{p.name}</p>
                    <p className="text-xs text-virtual-text-muted">{p.age} years{p.gender && !['Not specified', 'Unknown', 'N/A'].includes(p.gender) ? ` / ${p.gender}` : ''}</p>
                  </td>
                  <td className="p-4">
                    <p className="text-xs font-mono text-emerald-400">#{String(p.id).padStart(5, '0')}</p>
                    <p className="text-xs text-virtual-text-muted">{p.weight ? `${p.weight} kg` : 'N/A'}</p>
                  </td>
                  <td className="p-4">
                    <p className="text-xs text-virtual-text">{formatDate(p.last_visit)}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}

function VisitsListView({ onBack }: { onBack: () => void }) {
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/visits/all')
      .then(res => res.json())
      .then(data => {
        setVisits(data);
        setLoading(false);
      });
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-virtual-input-bg rounded-lg">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold">Hospital Visit Records</h1>
      </div>

      <GlassCard hover={false} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-virtual-border bg-virtual-input-bg">
                <th className="p-4 text-xs uppercase tracking-widest text-virtual-text-muted font-medium">Patient Details</th>
                <th className="p-4 text-xs uppercase tracking-widest text-virtual-text-muted font-medium">ID / Weight</th>
                <th className="p-4 text-xs uppercase tracking-widest text-virtual-text-muted font-medium">Date & Time</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={3} className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-blue-400" /></td></tr>
              ) : visits.length === 0 ? (
                <tr><td colSpan={3} className="p-8 text-center text-virtual-text-muted">No visit records found.</td></tr>
              ) : visits.map((v, idx) => (
                <tr key={v.id || `visit-${idx}`} className="border-b border-virtual-border hover:bg-virtual-input-bg transition-all">
                  <td className="p-4">
                    <p className="font-bold text-virtual-text">{v.patient_name}</p>
                    <p className="text-xs text-virtual-text-muted">{v.age} years{v.gender && !['Not specified', 'Unknown', 'N/A'].includes(v.gender) ? ` / ${v.gender}` : ''}</p>
                  </td>
                  <td className="p-4">
                    <p className="text-xs font-mono text-emerald-500">#{String(v.patient_id).padStart(5, '0')}</p>
                    <p className="text-xs text-virtual-text-muted">{v.weight ? `${v.weight} kg` : 'N/A'}</p>
                  </td>
                  <td className="p-4">
                    <p className="text-xs text-virtual-text">{formatDate(v.date)}</p>
                    <p className="text-[10px] text-virtual-text-muted">{v.time}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}

function ActiveCasesInsightsView({ onBack }: { onBack: () => void }) {
  const [insights, setInsights] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/active-cases/insights')
      .then(res => res.json())
      .then(data => {
        setInsights(data);
        setLoading(false);
      });
  }, []);

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-virtual-input-bg rounded-lg">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold">Active Cases Insights</h1>
      </div>

      {loading ? (
        <div className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-red-400" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <GlassCard className="p-6" hover={false}>
            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <Activity size={20} className="text-emerald-400" /> Common Conditions
            </h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={insights.commonConditions}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--virtual-chart-grid)" vertical={false} />
                  <XAxis dataKey="condition" stroke="var(--virtual-chart-axis)" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--virtual-chart-axis)" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--virtual-card)', border: '1px solid var(--virtual-border)', borderRadius: '12px', color: 'var(--virtual-text)' }}
                    itemStyle={{ color: 'var(--virtual-accent)' }}
                  />
                  <Bar dataKey="count" fill="var(--virtual-accent)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          <GlassCard className="p-6" hover={false}>
            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <ShieldAlert size={20} className="text-red-400" /> Severity Distribution
            </h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={insights.severityDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="count"
                    nameKey="severity"
                  >
                    {insights.severityDistribution.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid #ffffff10', borderRadius: '12px' }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          <GlassCard className="p-6 md:col-span-2" hover={false}>
            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <Building2 size={20} className="text-blue-400" /> Department-wise Active Cases
            </h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={insights.departmentCases} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--virtual-chart-grid)" horizontal={false} />
                  <XAxis type="number" stroke="var(--virtual-chart-axis)" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis dataKey="department" type="category" stroke="var(--virtual-chart-axis)" fontSize={10} tickLine={false} axisLine={false} width={100} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--virtual-card)', border: '1px solid var(--virtual-border)', borderRadius: '12px', color: 'var(--virtual-text)' }}
                  />
                  <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}

function AppointmentsListView({ onBack, user }: { onBack: () => void, user: any }) {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = user?.role === 'doctor' ? `/api/appointments?doctor_name=${encodeURIComponent(user.name)}` : '/api/appointments';
    fetch(url)
      .then(res => res.json())
      .then(data => {
        setAppointments(data);
        setLoading(false);
      });
  }, [user]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-virtual-input-bg rounded-lg">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold">Today's Appointments</h1>
      </div>

      <GlassCard hover={false} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-virtual-border bg-virtual-input-bg">
                <th className="p-4 text-xs uppercase tracking-widest text-virtual-text-muted font-medium">Patient</th>
                <th className="p-4 text-xs uppercase tracking-widest text-virtual-text-muted font-medium">Time</th>
                <th className="p-4 text-xs uppercase tracking-widest text-virtual-text-muted font-medium">Reason / Dept</th>
                <th className="p-4 text-xs uppercase tracking-widest text-virtual-text-muted font-medium">Severity</th>
                <th className="p-4 text-xs uppercase tracking-widest text-virtual-text-muted font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-emerald-400" /></td></tr>
              ) : appointments.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-virtual-text-muted">No appointments scheduled for today.</td></tr>
              ) : appointments.map((a, idx) => (
                <tr key={a.id || `appt-${idx}`} className="border-b border-virtual-border hover:bg-virtual-input-bg transition-all">
                  <td className="p-4">
                    <p className="font-bold text-virtual-text">{a.patient_name}</p>
                    <p className="text-[10px] text-virtual-text-muted">ID: #{String(a.patient_id).padStart(5, '0')}</p>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <Clock size={14} className="text-emerald-400" />
                      <p className="text-xs font-bold text-virtual-text">{a.time}</p>
                    </div>
                  </td>
                  <td className="p-4">
                    <p className="text-xs text-white/80">{a.reason}</p>
                    <p className="text-[10px] text-blue-400">{a.department || 'General Medicine'}</p>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      a.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                      a.severity === 'moderate' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      {a.severity}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                      a.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      a.status === 'pending' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                      'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                    }`}>
                      {a.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<UserType | null>(null);
  const [view, setView] = useState<'dashboard' | 'profile' | 'scan' | 'vitals' | 'intake' | 'doc_scan' | 'lab_scan' | 'appointment_form' | 'private_vault' | 'pending_labs' | 'patient_history_scan' | 'qr_details' | 'total_patients' | 'total_visits' | 'active_cases' | 'appointments'>('dashboard');
  const [vaultUnlocked, setVaultUnlocked] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [scanMode, setScanMode] = useState<'upload' | 'voice'>('upload');
  const [qrScanMode, setQrScanMode] = useState<'camera' | 'upload'>('camera');
  const [scannedData, setScannedData] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [stats, setStats] = useState({ totalPatients: 0, todayVisits: 0, activeCases: 0 });
  const [authData, setAuthData] = useState({ username: '', password: '', name: '', role: 'doctor' as 'doctor' | 'nurse' | 'patient', hospitalCode: '' });
  const [language, setLanguage] = useState('English');
  const [portal, setPortal] = useState<'doctor' | 'nurse' | 'patient' | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  const selectPortal = (p: 'doctor' | 'nurse' | 'patient') => {
    setPortal(p);
    setAuthData({ username: '', password: '', name: '', role: p, hospitalCode: '' });
    setAuthMode('login');
    const url = new URL(window.location.href);
    url.searchParams.set('portal', p);
    window.history.pushState({ portal: p }, '', url.toString());
  };

  const goBackToPortalSelection = () => {
    setPortal(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('portal');
    window.history.pushState({}, '', url.toString());
  };

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (e.state && e.state.portal) {
        setPortal(e.state.portal);
      } else {
        setPortal(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const [offlineMode, setOfflineMode] = useState(false);
  const [pendingLabs, setPendingLabs] = useState(0);
  const [pendingLabsData, setPendingLabsData] = useState<any[]>([]);
  const [scanInitialPatient, setScanInitialPatient] = useState<any>(null);
  const [todayAppointmentsCount, setTodayAppointmentsCount] = useState(0);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [configError, setConfigError] = useState<string | null>(null);
  const [publicRxData, setPublicRxData] = useState<any>(null);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);
  const [vaultSearchQuery, setVaultSearchQuery] = useState('');
  const [vaultLastScannedId, setVaultLastScannedId] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(localStorage.getItem('lastSyncedAt'));
  const [isSyncing, setIsSyncing] = useState(false);
  const [firestoreConnected, setFirestoreConnected] = useState<boolean>(true);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    return (saved as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const languages = [
    'English', 'Tamil', 'Hindi', 'Telugu', 'Kannada', 'Malayalam', 'Bengali', 'Marathi', 'Gujarati', 'Punjabi'
  ];

  useEffect(() => {
    // Test AI connection via resilient multi-model and clinical engine
    testAIConnection().then(res => {
      if (!res.success) {
        setConfigError(`AI connection notice: ${res.error || "Connecting to backup clinical service..."}`);
      } else {
        setConfigError(null);
      }
    }).catch(() => {
      setConfigError(null);
    });

    // Test and validate connection to Firestore database (ai-studio-remixremixremixr-7b1cde70-c291-4129-8a5d-10957333aa22)
    testFirestoreConnection().then(res => {
      setFirestoreConnected(res.connected);
      if (res.connected) {
        seedInitialHospitalData();
      }
    }).catch(err => {
      console.warn('Firestore initial connection note:', err);
    });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');
    const dataParam = params.get('data');
    
    if (viewParam === 'public_rx' && dataParam) {
      try {
        const decoded = JSON.parse(decodeURIComponent(escape(atob(dataParam))));
        setPublicRxData(decoded);
      } catch (e) {
        console.error("Failed to decode public RX data", e);
      }
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchPatients();
      fetchStats();
      fetchPendingLabs();
      fetchRecentActivity();
    }
  }, [user]);

  useEffect(() => {
    if (!offlineMode && user) {
      syncOfflineData();
    }
  }, [offlineMode, user]);

  useEffect(() => {
    const handleOnline = () => {
      if (!offlineMode && user) {
        syncOfflineData();
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [offlineMode, user]);

  const getPendingSyncCount = () => {
    const offlineIntake = JSON.parse(localStorage.getItem('offlineIntake') || '[]');
    const offlinePrescriptions = JSON.parse(localStorage.getItem('offlinePrescriptions') || '[]');
    const offlinePatients = JSON.parse(localStorage.getItem('offlinePatients') || '[]');
    const offlineScans = JSON.parse(localStorage.getItem('offlineScans') || '[]');
    return offlineIntake.length + offlinePrescriptions.length + offlinePatients.length + offlineScans.length;
  };

  const syncOfflineData = async () => {
    const offlineIntake = JSON.parse(localStorage.getItem('offlineIntake') || '[]');
    const offlinePrescriptions = JSON.parse(localStorage.getItem('offlinePrescriptions') || '[]');
    const offlinePatients = JSON.parse(localStorage.getItem('offlinePatients') || '[]');
    const offlineScans = JSON.parse(localStorage.getItem('offlineScans') || '[]');

    if (offlineIntake.length === 0 && offlinePrescriptions.length === 0 && offlinePatients.length === 0 && offlineScans.length === 0) return;

    setIsSyncing(true);
    setToast({ message: 'Syncing offline data...', type: 'info' });
    
    const patientIdMap: Record<string, number> = {};
    const failedPatients: any[] = [];
    const failedScans: any[] = [];
    const failedIntake: any[] = [];
    const failedPrescriptions: any[] = [];

    let syncedCount = 0;

    try {
      // 1. Sync Patients first
      for (const patient of offlinePatients) {
        const tempId = patient.id;
        try {
          const res = await fetch('/api/patients', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patient)
          });
          
          if (res.ok) {
            const data = await res.json();
            patientIdMap[tempId] = data.id;
            syncedCount++;

            // Also store in private data vault for security
            const content = `NEW PATIENT REGISTRATION (Synced)
----------------------------
Patient: ${patient.name}
Age: ${patient.age}
Gender: ${patient.gender || 'N/A'}
Weight: ${patient.weight} kg
Blood Group: ${patient.blood_group}
Allergies: ${patient.allergies}
Chronic Conditions: ${patient.chronic_conditions}
Past Illness: ${patient.past_illness}`;

            await fetch('/api/private-data', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                staff_id: user?.username || user?.id || 'STAFF001',
                staff_name: user?.name || 'Nurse Meena',
                content: content
              })
            });
          } else {
            // If patient already exists, try to find them by name
            const searchRes = await fetch(`/api/patients/search?q=${encodeURIComponent(patient.name)}`);
            if (searchRes.ok) {
              const searchData = await searchRes.json();
              if (searchData.length > 0) {
                patientIdMap[tempId] = searchData[0].id;
                syncedCount++;
              } else {
                failedPatients.push(patient);
              }
            } else {
              failedPatients.push(patient);
            }
          }
        } catch (e) {
          console.error('Error syncing patient:', e);
          failedPatients.push(patient);
        }
      }

      // 2. Sync Scans (Delayed OCR)
      for (const scan of offlineScans) {
        try {
          const realPatientId = scan.patient_id ? (patientIdMap[scan.patient_id] || scan.patient_id) : null;
          
          // 1. Extract data from image (use pre-extracted if available)
          let extracted = scan.extracted_data;
          if (!extracted || !extracted.medicines || extracted.medicines.length === 0) {
            extracted = await extractPrescriptionData(scan.image_data);
          }
          
          // 2. Save prescription
          const res = await fetch('/api/prescriptions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              patient_id: realPatientId || 1, // Default to 1 if no patient
              doctor_name: scan.staff_name,
              symptoms: extracted.symptoms || 'Captured Offline',
              medicines: extracted.medicines || [],
              date: scan.timestamp || new Date().toISOString(),
              image_data: scan.image_data
            })
          });

          if (res.ok) {
            syncedCount++;
          } else {
            failedScans.push(scan);
          }
        } catch (e) {
          console.error('Error syncing scan:', e);
          failedScans.push(scan);
        }
      }

      // 3. Sync Vitals
      for (const intake of offlineIntake) {
        try {
          // Map temp ID to real ID if available
          const realPatientId = patientIdMap[intake.patient_id] || intake.patient_id;
          
          const res = await fetch('/api/vitals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...intake,
              patient_id: realPatientId
            })
          });

          if (res.ok) {
            syncedCount++;
            // Also store in private data vault for security
            const content = `PATIENT INTAKE RECORD (Synced)
----------------------------
Patient: ${intake.patient_name || 'N/A'}
ID: ${realPatientId}
BP: ${intake.bp}
Weight: ${intake.weight} kg
Blood Group: ${intake.blood_group}
Symptoms: ${intake.symptoms}
Notes: ${intake.notes}
Recorded By: ${intake.recorded_by}`;

            await fetch('/api/private-data', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                staff_id: user?.username || user?.id || 'STAFF001',
                staff_name: user?.name || 'Nurse Meena',
                content: content
              })
            });
          } else {
            failedIntake.push(intake);
          }
        } catch (e) {
          console.error('Error syncing vitals:', e);
          failedIntake.push(intake);
        }
      }

      // 4. Sync Prescriptions (Private Data)
      for (const prescription of offlinePrescriptions) {
        try {
          const res = await fetch('/api/private-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(prescription)
          });
          if (res.ok) {
            syncedCount++;
          } else {
            failedPrescriptions.push(prescription);
          }
        } catch (e) {
          console.error('Error syncing prescription:', e);
          failedPrescriptions.push(prescription);
        }
      }

      // Update local storage with only failed items
      if (failedIntake.length > 0) localStorage.setItem('offlineIntake', JSON.stringify(failedIntake));
      else localStorage.removeItem('offlineIntake');

      if (failedPrescriptions.length > 0) localStorage.setItem('offlinePrescriptions', JSON.stringify(failedPrescriptions));
      else localStorage.removeItem('offlinePrescriptions');

      if (failedPatients.length > 0) localStorage.setItem('offlinePatients', JSON.stringify(failedPatients));
      else localStorage.removeItem('offlinePatients');

      if (failedScans.length > 0) localStorage.setItem('offlineScans', JSON.stringify(failedScans));
      else localStorage.removeItem('offlineScans');
      
      if (syncedCount > 0) {
        const now = new Date().toISOString();
        setLastSyncedAt(now);
        localStorage.setItem('lastSyncedAt', now);
        setToast({ message: `Successfully synced ${syncedCount} items!`, type: 'success' });
      }

      fetchPatients();
      fetchStats();
      fetchRecentActivity();
    } finally {
      setIsSyncing(false);
    }
  };

  const fetchPendingLabs = async () => {
    if (offlineMode) return;
    try {
      const res = await fetch('/api/pending-lab-results');
      const data = await res.json();
      if (Array.isArray(data)) {
        setPendingLabsData(data);
        setPendingLabs(data.length);
      }
    } catch (error) {
      console.error('Error fetching pending labs:', error);
    }
  };

  const fetchRecentActivity = async () => {
    if (offlineMode) return;
    try {
      const res = await fetch('/api/recent-activity');
      const data = await res.json();
      setRecentActivity(data);
    } catch (error) {
      console.error('Error fetching recent activity:', error);
    }
  };

  const fetchPatients = async () => {
    if (offlineMode) {
      const offlinePatients = JSON.parse(localStorage.getItem('offlinePatients') || '[]');
      const mockPatients = [
        { id: 101, name: 'Ramesh Kumar', age: 45, weight: 72, allergies: 'Penicillin', created_at: new Date().toISOString() },
        { id: 102, name: 'Sita Devi', age: 38, weight: 64, allergies: 'None', created_at: new Date().toISOString() },
        { id: 103, name: 'Abdul Khan', age: 52, weight: 81, allergies: 'Sulfa', created_at: new Date().toISOString() }
      ];
      setPatients([...offlinePatients, ...mockPatients]);
      return;
    }
    const res = await fetch('/api/patients');
    const data = await res.json();
    setPatients(data);
    if (Array.isArray(data) && data.length > 0) {
      syncPatientsBatchToFirestore(data);
    }
  };

  const fetchStats = async () => {
    if (offlineMode) {
      const offlinePatients = JSON.parse(localStorage.getItem('offlinePatients') || '[]');
      const baseTotal = 124 + offlinePatients.length;
      // Guarantee todayVisits is strictly less than totalPatients
      const baseVisits = baseTotal > 1 ? Math.min(8 + offlinePatients.length, baseTotal - 1) : 0;
      setStats({ totalPatients: baseTotal, todayVisits: baseVisits, activeCases: 12 });
      return;
    }
    const url = user?.role === 'doctor' ? `/api/stats?doctor_name=${encodeURIComponent(user.name)}` : '/api/stats';
    const res = await fetch(url);
    const data = await res.json();
    
    // Strict guarantee: todayVisits is strictly less than totalPatients
    const totalP = Number(data.totalPatients) || 0;
    const rawVisits = Number(data.todayVisits) || 0;
    let safeVisits = 0;
    if (totalP > 1) {
      safeVisits = Math.min(rawVisits, totalP - 1);
      if (safeVisits <= 0) safeVisits = 1;
      if (safeVisits >= totalP) safeVisits = totalP - 1;
    } else {
      safeVisits = 0;
    }

    const safeStats = {
      ...data,
      totalPatients: totalP,
      todayVisits: safeVisits
    };

    setStats(safeStats);
    
    // Mirror dashboard stats to Firestore
    syncStatsToFirestore({
      totalPatients: totalP,
      todayVisits: safeVisits,
      activeCases: data.activeCases || 0
    });

    if (data.pendingLabs !== undefined) setPendingLabs(data.pendingLabs);
    if (data.todayAppointments !== undefined) setTodayAppointmentsCount(data.todayAppointments);
    fetchRecentActivity();
  };

  useEffect(() => {
    setAuthError(null);
  }, [authMode, portal]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (authMode === 'register') {
      if (authData.role === 'patient') {
        if (!authData.name && !authData.username) {
          setAuthError('Please provide either a Name or a Username.');
          return;
        }
      } else if (authData.role === 'doctor' || authData.role === 'nurse') {
        if (!authData.hospitalCode || !authData.hospitalCode.trim()) {
          setAuthError('Please enter the Hospital Code to register.');
          return;
        }
      }
    }

    const payload = {
      ...authData,
      hospitalCode: authData.hospitalCode.trim()
    };

    if (offlineMode) {
      setLoading(true);
      setTimeout(() => {
        if (authMode === 'login') {
          const name = authData.name || authData.username || (authData.role === 'doctor' ? 'Dr. Suresh Sharma' : authData.role === 'nurse' ? 'Nurse Joy' : 'Patient Ramesh');
          setUser({
            username: authData.username || authData.name,
            name: name,
            role: authData.role,
            isFirstLogin: true // Assume first login in offline mode for new session
          });
          recordLoginInFirestore({
            username: authData.username || authData.name,
            name: name,
            role: authData.role
          });
          setToast({ message: `Welcome, ${name.split(' ')[0]}! (Offline Mode)`, type: 'success' });
        } else {
          if ((authData.role === 'doctor' || authData.role === 'nurse') && authData.hospitalCode.trim() !== 'inba123') {
            setAuthError('Invalid Hospital Code. Access Denied.');
            setLoading(false);
            return;
          }
          saveUserToFirestore({
            username: authData.username || authData.name,
            name: authData.name || authData.username,
            role: authData.role,
            hospitalCode: authData.hospitalCode.trim()
          });
          setToast({ message: 'Registration successful! Account saved to database.', type: 'success' });
          setAuthMode('login');
        }
        setLoading(false);
      }, 800);
      return;
    }

    setLoading(true);
    const endpoint = authMode === 'login' ? '/api/login' : '/api/register';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        if (authMode === 'register') {
          // Persist user registration credentials to Firestore database
          saveUserToFirestore({
            username: data.username || authData.username || authData.name,
            name: data.name || authData.name || authData.username,
            role: data.role || authData.role,
            hospitalCode: authData.hospitalCode
          });

          // If a patient registers, also save initial patient record to Firestore database
          if (authData.role === 'patient') {
            syncPatientToFirestore({
              id: data.id,
              name: data.name || authData.name,
              age: 30,
              gender: 'Other',
              weight: 65,
              blood_group: 'O+',
              allergies: 'None',
              chronic_conditions: 'None',
              past_illness: 'None',
              status: 'Active'
            });
          }

          setToast({ message: 'Registration successful! Account saved to database.', type: 'success' });
          setAuthMode('login');
        } else {
          setUser(data);
          // Persist user login event and timestamp in Firestore database
          recordLoginInFirestore({
            username: data.username || authData.username || authData.name,
            name: data.name,
            role: data.role
          });
          // Clear history so user can't go back to login
          window.history.replaceState({}, '', window.location.origin);
          const welcomeMsg = data.isFirstLogin ? `Welcome, ${data.name.split(' ')[0]}!` : `Welcome back, ${data.name.split(' ')[0]}!`;
          setToast({ message: welcomeMsg, type: 'success' });
        }
      } else {
        setAuthError(data.error || 'Authentication failed');
      }
    } catch (err) {
      setAuthError('Connection error. Please check your internet.');
    } finally {
      setLoading(false);
    }
  };

  const [profileInitialTab, setProfileInitialTab] = useState<'timeline' | 'vitals' | 'alerts' | 'insights' | 'private' | 'chat'>('timeline');

  const selectPatient = async (id: number, initialTab: 'timeline' | 'vitals' | 'alerts' | 'insights' | 'private' | 'chat' = 'timeline') => {
    setLoading(true);
    try {
      if (offlineMode) {
        const p = patients.find(p => p.id === id);
        if (p) {
          setSelectedPatient(p);
          setProfileInitialTab(initialTab);
          setView('profile');
        } else {
          setToast({ message: 'Patient not found in offline records.', type: 'error' });
        }
      } else {
        const res = await fetch(`/api/patients/${id}`);
        const data = await res.json();
        if (res.ok) {
          setSelectedPatient(data);
          setProfileInitialTab(initialTab);
          setView('profile');
        } else {
          setToast({ message: data.error || 'Patient not found. Please ensure the Patient ID is correct.', type: 'error' });
        }
      }
    } catch (error) {
      setToast({ message: 'Error fetching patient profile.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setView('dashboard');
    setSelectedPatient(null);
    setPortal(null);
    setAuthMode('login');
    setAuthData({ username: '', password: '', role: 'patient', name: '', hospitalCode: '' });
  };

  if (publicRxData) {
    return <PublicPrescriptionView data={publicRxData} onBack={() => {
      window.history.pushState({}, '', window.location.pathname);
      setPublicRxData(null);
    }} />;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-virtual-bg">
        {/* Theme Toggle in Portal View */}
        <div className="absolute top-6 right-6 z-50">
          <button 
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-3 rounded-2xl bg-virtual-input-bg border border-virtual-border hover:border-virtual-accent transition-all shadow-xl backdrop-blur-md"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          >
            {theme === 'dark' ? <Sun size={20} className="text-amber-400" /> : <Cloud size={20} className="text-emerald-600" />}
          </button>
        </div>

        {/* Background Effects */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-virtual-accent/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-virtual-blue/10 blur-[120px] rounded-full" />
        
        <GlassCard className="w-full max-w-md relative z-10">
          <div className="flex flex-col items-center mb-8">
            <VirtualLogo className="mb-4" />
            <p className="text-virtual-text-muted text-sm">Digitizing Rural Healthcare with AI</p>
          </div>
          
          {!portal ? (
            <div className="space-y-4">
              <h2 className="text-center text-lg font-bold mb-6 text-virtual-text">Select Your Portal</h2>
              <button 
                onClick={() => selectPortal('doctor')}
                className="w-full p-6 rounded-2xl bg-virtual-accent/10 border border-virtual-accent/20 hover:bg-virtual-accent/20 transition-all flex items-center gap-4 group"
              >
                <div className="p-3 rounded-xl bg-virtual-accent/20 text-virtual-accent group-hover:scale-110 transition-transform">
                  <Stethoscope size={24} />
                </div>
                <div className="text-left">
                  <p className="font-bold text-virtual-accent">Doctor Login</p>
                  <p className="text-xs text-virtual-text-muted">Access prescriptions & records</p>
                </div>
                <ChevronRight size={20} className="ml-auto text-virtual-text-muted" />
              </button>

              <button 
                onClick={() => selectPortal('nurse')}
                className="w-full p-6 rounded-2xl bg-virtual-blue/10 border border-virtual-blue/20 hover:bg-virtual-blue/20 transition-all flex items-center gap-4 group"
              >
                <div className="p-3 rounded-xl bg-virtual-blue/20 text-virtual-blue group-hover:scale-110 transition-transform">
                  <Activity size={24} />
                </div>
                <div className="text-left">
                  <p className="font-bold text-virtual-blue">Nurse Login</p>
                  <p className="text-xs text-virtual-text-muted">Manage vitals & patient intake</p>
                </div>
                <ChevronRight size={20} className="ml-auto text-virtual-text-muted" />
              </button>

              <button 
                onClick={() => selectPortal('patient')}
                className="w-full p-6 rounded-2xl bg-virtual-purple/10 border border-virtual-purple/20 hover:bg-virtual-purple/20 transition-all flex items-center gap-4 group"
              >
                <div className="p-3 rounded-xl bg-virtual-purple/20 text-virtual-purple group-hover:scale-110 transition-transform">
                  <User size={24} />
                </div>
                <div className="text-left">
                  <p className="font-bold text-virtual-purple">Patient Login</p>
                  <p className="text-xs text-virtual-text-muted">View your records & prescriptions</p>
                </div>
                <ChevronRight size={20} className="ml-auto text-virtual-text-muted" />
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-6">
                <button onClick={goBackToPortalSelection} className="p-2 hover:bg-virtual-input-bg rounded-lg text-virtual-text">
                  <ArrowLeft size={18} />
                </button>
                <h2 className="font-bold text-virtual-text capitalize">{portal} Portal</h2>
              </div>

              <div className="flex gap-4 mb-6 p-1 bg-virtual-input-bg rounded-xl">
                <button 
                  onClick={() => { setAuthMode('login'); setAuthError(null); }}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${authMode === 'login' ? 'bg-virtual-accent/20 text-virtual-accent' : 'text-virtual-text-muted hover:text-virtual-text'}`}
                >
                  Login
                </button>
                <button 
                  onClick={() => { setAuthMode('register'); setAuthError(null); }}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${authMode === 'register' ? 'bg-emerald-500/20 text-emerald-400' : 'text-virtual-text-muted hover:text-virtual-text'}`}
                >
                  Register
                </button>
              </div>

              {authError && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-3 mb-6"
                >
                  <AlertCircle size={18} className="mt-0.5 shrink-0" />
                  <p>{authError}</p>
                </motion.div>
              )}

      <form onSubmit={handleAuth} className="space-y-4">
        {authMode === 'register' && (
          <div>
            <label className="block text-xs uppercase tracking-widest text-virtual-text-muted mb-2 ml-1">Full Name</label>
            <input
              type="text"
              required={authData.role !== 'patient' || !authData.username}
              value={authData.name}
              onChange={(e) => {
                setAuthData({ ...authData, name: e.target.value });
                setAuthError(null);
              }}
              className="w-full bg-virtual-input-bg border border-virtual-border rounded-xl px-4 py-3 focus:border-emerald-500/50 outline-none transition-all text-virtual-text"
              placeholder={
                authData.role === 'doctor' ? "Dr. Suresh Sharma" : 
                authData.role === 'nurse' ? "Nurse Meena" : 
                "Ramesh Kumar"
              }
            />
          </div>
        )}
        <div>
          <label className="block text-xs uppercase tracking-widest text-virtual-text-muted mb-2 ml-1">
            {authData.role === 'patient' ? 'Patient Username / ID' : `${authData.role === 'doctor' ? 'Doctor' : 'Nurse'} Staff ID`}
          </label>
          <input
            type="text"
            required={authData.role !== 'patient' || !authData.name}
            value={authData.username}
            onChange={(e) => {
              setAuthData({ ...authData, username: e.target.value });
              setAuthError(null);
            }}
            className="w-full bg-virtual-input-bg border border-virtual-border rounded-xl px-4 py-3 focus:border-emerald-500/50 outline-none transition-all text-virtual-text font-mono"
            placeholder={
              authData.role === 'doctor' ? "Enter Doctor Staff ID" : 
              authData.role === 'nurse' ? "Enter Nurse Staff ID" : 
              "Enter Patient Username or ID"
            }
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-widest text-virtual-text-muted mb-2 ml-1">Password</label>
          <input
            type="password"
            required
            value={authData.password}
            onChange={(e) => {
              setAuthData({ ...authData, password: e.target.value });
              setAuthError(null);
            }}
            className="w-full bg-virtual-input-bg border border-virtual-border rounded-xl px-4 py-3 focus:border-emerald-500/50 outline-none transition-all text-virtual-text font-mono"
            placeholder="Enter Password"
          />
        </div>

        {authMode === 'register' && (authData.role === 'doctor' || authData.role === 'nurse') && (
          <div>
            <label className="block text-xs uppercase tracking-widest text-virtual-text-muted mb-2 ml-1">Hospital Code</label>
            <input
              type="password"
              required
              value={authData.hospitalCode}
              onChange={(e) => {
                setAuthData({ ...authData, hospitalCode: e.target.value });
                setAuthError(null);
              }}
              className="w-full bg-virtual-input-bg border border-virtual-border rounded-xl px-4 py-3 focus:border-emerald-500/50 outline-none transition-all text-virtual-text font-mono"
              placeholder="Enter Hospital Code"
            />
          </div>
        )}

        {/* Secured database authentication */}
        <NeonButton className="w-full py-4 mt-4" disabled={loading}>
          {loading ? <Loader2 className="animate-spin mx-auto" /> : authMode === 'login' ? 'Access Portal' : 'Create Account'}
        </NeonButton>
      </form>
            </>
          )}
          
          <div className="mt-8 pt-6 border-t border-virtual-border flex flex-col items-center gap-3">
            <p className="text-virtual-text-muted text-[10px] uppercase tracking-widest">Authorized Access Only</p>
          </div>
        </GlassCard>

        {/* Global Toast for Login/Register */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl shadow-2xl z-[100] flex items-center gap-3 border ${
                toast.type === 'success' ? 'bg-virtual-accent/90 border-virtual-accent text-white' :
                toast.type === 'error' ? 'bg-virtual-danger/90 border-virtual-danger text-white' :
                'bg-virtual-blue/90 border-virtual-blue text-white'
              } backdrop-blur-md`}
            >
              {toast.type === 'success' ? <CheckCircle2 size={18} /> : 
               toast.type === 'error' ? <AlertCircle size={18} /> : 
               <Info size={18} />}
              <span className="text-sm font-medium">{toast.message}</span>
              <button onClick={() => setToast(null)} className="ml-2 hover:opacity-70 transition-opacity">
                <X size={16} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="glass border-b border-virtual-border px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-8">
          <VirtualLogo onClick={() => setView('dashboard')} className="cursor-pointer" />
          {user.role !== 'patient' && (
            <nav className="hidden md:flex items-center gap-6">
              <button 
                onClick={() => setView('dashboard')}
                className={`text-sm font-medium transition-all ${view === 'dashboard' ? 'text-virtual-accent' : 'text-virtual-text-muted hover:text-virtual-text'}`}
              >
                Dashboard
              </button>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-virtual-input-bg border border-virtual-border">
                <span className={`text-[10px] font-bold uppercase tracking-widest ${offlineMode ? 'text-virtual-warning' : 'text-virtual-accent'}`}>
                  {offlineMode ? 'Offline' : 'Online'}
                </span>
                <button 
                  onClick={() => {
                    const newMode = !offlineMode;
                    setOfflineMode(newMode);
                    localStorage.setItem('offlineMode', String(newMode));
                  }}
                  className={`relative w-8 h-4 rounded-full transition-all ${offlineMode ? 'bg-orange-500/40' : 'bg-emerald-500/40'}`}
                >
                  <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${offlineMode ? 'left-4.5' : 'left-0.5'}`} />
                </button>
                {isSyncing && (
                  <div className="ml-3 flex items-center gap-2 px-2 py-1 rounded-md bg-virtual-accent/10 border border-virtual-accent/20">
                    <RefreshCw size={10} className="text-virtual-accent animate-spin" />
                    <span className="text-[9px] font-bold text-virtual-accent uppercase tracking-widest">Syncing</span>
                  </div>
                )}
                {getPendingSyncCount() > 0 && !offlineMode && !isSyncing && (
                  <button 
                    onClick={() => syncOfflineData()}
                    className="ml-2 p-1 rounded-md bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-all"
                    title="Sync Pending Data"
                  >
                    <RefreshCw size={12} />
                  </button>
                )}
              </div>
            </nav>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-xl bg-virtual-input-bg border border-virtual-border hover:bg-emerald-500/10 hover:border-emerald-500/50 transition-all"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          >
            {theme === 'dark' ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-emerald-600" />}
          </button>
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium">{user.name}</p>
            <p className="text-[10px] uppercase tracking-widest text-virtual-text-muted">{user.role}</p>
          </div>
          <button 
            onClick={handleLogout}
            className="p-2 rounded-xl bg-virtual-input-bg border border-virtual-border hover:bg-red-500/10 hover:border-red-500/50 transition-all"
          >
            <LogOut size={18} className="text-virtual-text-muted" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {configError && (
          <StatusBanner 
            type="error" 
            message={configError} 
            action={{ label: "Retry Connection", onClick: () => {
              setConfigError(null);
              testAIConnection().then(res => {
                if (!res.success) {
                  const apiKey = process.env.GEMINI_API_KEY || "";
                  let errorMsg = res.error;
                  if (apiKey.includes("gen-lang-client")) {
                    errorMsg = "You provided a 'gen-lang-client' ID instead of a Gemini API Key. Please get a real API Key from https://aistudio.google.com/app/apikey";
                  }
                  setConfigError(`AI Connection Failed: ${errorMsg}. Please verify your GEMINI_API_KEY in the Secrets panel.`);
                } else {
                  setToast({ message: "AI Connection Successful! Features are now active.", type: 'success' });
                }
              });
            }}}
          />
        )}
        <AnimatePresence mode="wait">
          {view === 'dashboard' && (
            user.role === 'patient' ? (
              <PatientDashboard 
                user={user} 
                language={language} 
                setLanguage={setLanguage} 
                languages={languages} 
                setView={setView}
                setScanMode={setScanMode}
                setQrScanMode={setQrScanMode}
                setSelectedPatient={setSelectedPatient}
                setToast={setToast}
                fetchStats={fetchStats}
              />
            ) : (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-8"
              >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-3xl font-bold tracking-tight">System Overview</h1>
                  </div>
                  <p className="text-virtual-text-muted">{user.isFirstLogin ? 'Welcome' : 'Welcome back'}, {user.name.split(' ')[0]}</p>
                </div>
                <div className="flex gap-3">
                  <NeonButton onClick={() => setView('private_vault')} variant="outline" className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10">
                    <Shield size={18} className="mr-2 inline" /> Private Data ➝
                  </NeonButton>
                  {user.role === 'patient' && (
                    <NeonButton onClick={() => setView('scan')}>
                      <Camera size={18} className="mr-2 inline" /> New Scan
                    </NeonButton>
                  )}
                </div>
              </div>

              {/* Stats Grid */}
              {getPendingSyncCount() > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6"
                >
                  <GlassCard className="border-amber-500/30 bg-amber-500/5 flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
                        <Cloud size={18} className="animate-pulse" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-amber-200">{getPendingSyncCount()} items pending synchronization</p>
                        <p className="text-[10px] text-amber-500/70">
                          Data is saved locally and will sync when online. 
                          {lastSyncedAt && ` Last sync: ${new Date(lastSyncedAt).toLocaleTimeString()}`}
                        </p>
                      </div>
                    </div>
                    <NeonButton 
                      onClick={() => syncOfflineData()} 
                      variant="outline" 
                      className="text-xs py-1.5 px-3 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                      disabled={isSyncing || offlineMode}
                    >
                      {isSyncing ? <Loader2 size={14} className="animate-spin" /> : 'Sync Now'}
                    </NeonButton>
                  </GlassCard>
                </motion.div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <GlassCard 
                  onClick={() => setView('total_patients')}
                  className="flex items-center gap-4 border-virtual-accent/20 cursor-pointer hover:border-virtual-accent/50 transition-all"
                >
                  <div className="p-3 rounded-xl bg-virtual-accent/10 text-virtual-accent">
                    <User size={24} />
                  </div>
                  <div>
                    <p className="text-virtual-text-muted text-xs uppercase tracking-widest">Total Patients</p>
                    <p className="text-2xl font-bold text-virtual-text">{stats.totalPatients}</p>
                  </div>
                </GlassCard>
                <GlassCard 
                  onClick={() => setView('total_visits')}
                  className="flex items-center gap-4 border-virtual-blue/20 cursor-pointer hover:border-virtual-blue/50 transition-all"
                >
                  <div className="p-3 rounded-xl bg-virtual-blue/10 text-virtual-blue">
                    <Calendar size={24} />
                  </div>
                  <div>
                    <p className="text-virtual-text-muted text-xs uppercase tracking-widest">Today's Visits</p>
                    <p className="text-2xl font-bold text-virtual-text">{stats.todayVisits}</p>
                  </div>
                </GlassCard>
                <GlassCard 
                  onClick={() => setView('active_cases')}
                  className="flex items-center gap-4 border-virtual-danger/20 cursor-pointer hover:border-virtual-danger/50 transition-all"
                >
                  <div className="p-3 rounded-xl bg-virtual-danger/10 text-virtual-danger">
                    <AlertTriangle size={24} />
                  </div>
                  <div>
                    <p className="text-virtual-text-muted text-xs uppercase tracking-widest">Active Cases</p>
                    <p className="text-2xl font-bold text-virtual-text">{stats.activeCases}</p>
                  </div>
                </GlassCard>
              </div>

              <div className="grid grid-cols-1 gap-8">
                {/* Quick Overview Panel */}
                <div className="space-y-6">
                  <GlassCard hover={false}>
                    <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
                    <div className="grid grid-cols-2 gap-3">
                      {user.role === 'doctor' && (
                        <>
                          <button 
                            onClick={() => { setView('scan'); setScanMode('upload'); }}
                            className="p-4 rounded-xl bg-virtual-accent/10 border border-virtual-accent/20 text-center hover:bg-virtual-accent/20 transition-all"
                          >
                            <Camera size={24} className="mx-auto mb-2 text-virtual-accent" />
                            <span className="text-xs font-medium text-virtual-text">Scan Rx</span>
                          </button>
                          <button 
                            onClick={() => { setView('scan'); setScanMode('voice'); }}
                            className="p-4 rounded-xl bg-virtual-blue/10 border border-virtual-blue/20 text-center hover:bg-virtual-blue/20 transition-all"
                          >
                            <Mic size={24} className="mx-auto mb-2 text-virtual-blue" />
                            <span className="text-xs font-medium text-virtual-text">Voice Rx</span>
                          </button>
                        </>
                      )}
                      {user.role === 'nurse' && (
                        <>
                          <button 
                            onClick={() => { setView('scan'); setScanMode('upload'); }}
                            className="p-4 rounded-xl bg-virtual-accent/10 border border-virtual-accent/20 text-center hover:bg-virtual-accent/20 transition-all"
                          >
                            <Camera size={24} className="mx-auto mb-2 text-virtual-accent" />
                            <span className="text-xs font-medium text-virtual-text">Scan Rx</span>
                          </button>
                          <button 
                            onClick={() => setView('vitals')}
                            className="p-4 rounded-xl bg-virtual-blue/10 border border-virtual-blue/20 text-center hover:bg-virtual-blue/20 transition-all"
                          >
                            <ClipboardList size={24} className="mx-auto mb-2 text-virtual-blue" />
                            <span className="text-xs font-medium text-virtual-text">Intake Mode</span>
                          </button>
                          <button 
                            onClick={() => setView('lab_scan')}
                            className="p-4 rounded-xl bg-virtual-purple/10 border border-virtual-purple/20 text-center hover:bg-virtual-purple/20 transition-all"
                          >
                            <FlaskConical size={24} className="mx-auto mb-2 text-virtual-purple" />
                            <span className="text-xs font-medium text-virtual-text">Scan Lab Report</span>
                          </button>
                          <button 
                            onClick={() => setView('appointment_form')}
                            className="p-4 rounded-xl bg-virtual-warning/10 border border-virtual-warning/20 text-center hover:bg-virtual-warning/20 transition-all"
                          >
                            <Calendar size={24} className="mx-auto mb-2 text-virtual-warning" />
                            <span className="text-xs font-medium text-virtual-text">Add Appointment</span>
                          </button>
                        </>
                      )}
                    </div>
                  </GlassCard>

                  {user.role === 'doctor' && (
                    <GlassCard hover={false} className="border-blue-500/20">
                      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Clock size={18} className="text-blue-400" /> Quick Overview
                      </h2>
                      <div className="space-y-5">
                        {/* Lab Results Pending Review */}
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-virtual-text-muted mb-2">Pending Lab Result</p>
                          <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <FlaskConical size={14} className="text-blue-400 flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs font-bold truncate">{pendingLabs} Pending Lab Result</p>
                                <p className="text-[8px] text-virtual-text-muted truncate">3 Critical - Needs Immediate Review</p>
                              </div>
                            </div>
                            <button 
                              onClick={() => setView('pending_labs')}
                              className="text-[10px] text-blue-400 uppercase font-bold hover:underline flex-shrink-0"
                            >
                              View All
                            </button>
                          </div>
                        </div>

                        {/* Pending Appointments */}
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-virtual-text-muted mb-2">Today Appointments</p>
                          <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <Calendar size={14} className="text-emerald-400 flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs font-bold truncate">{todayAppointmentsCount < 10 ? `0${todayAppointmentsCount}` : todayAppointmentsCount} Today Appointments</p>
                                <p className="text-[8px] text-virtual-text-muted truncate">Next: 10:30 AM (Patient #204)</p>
                              </div>
                            </div>
                            <button 
                              onClick={() => setView('appointments')}
                              className="text-[10px] text-emerald-400 uppercase font-bold hover:underline flex-shrink-0"
                            >
                              View All
                            </button>
                          </div>
                        </div>

                        {/* Recent Activity */}
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-virtual-text-muted mb-2">Recent Activity</p>
                          <div className="space-y-2">
                            {recentActivity.length === 0 ? (
                              <p className="text-[10px] text-virtual-text-dim italic">No recent activity</p>
                            ) : (
                              recentActivity.map((activity, idx) => (
                                <div key={activity.id || `activity-${idx}`} className="p-2 rounded-lg bg-virtual-input-bg border border-virtual-border flex items-start gap-2">
                                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 ${
                                    activity.type === 'prescription' ? 'bg-emerald-400' :
                                    activity.type === 'vitals' ? 'bg-blue-400' :
                                    activity.type === 'lab' ? 'bg-purple-400' :
                                    'bg-amber-400'
                                  }`} />
                                  <div>
                                    <p className="text-[10px] font-medium">{activity.message}</p>
                                    <p className="text-[8px] text-virtual-text-muted">{formatTimeOnly(activity.time)}</p>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </GlassCard>
                  )}
                </div>
              </div>
            </motion.div>
            )
          )}

            {view === 'profile' && selectedPatient && (
              <PatientProfile 
                patient={selectedPatient} 
                user={user}
                onBack={() => setView('dashboard')} 
                onScan={() => {
                  setScanInitialPatient(selectedPatient);
                  setView('scan');
                }}
                onVitals={() => setView('vitals')}
                language={language}
                initialTab={profileInitialTab}
                setToast={setToast}
                fetchStats={fetchStats}
              />
            )}

          {view === 'total_patients' && (
            <PatientsListView onBack={() => setView('dashboard')} />
          )}

          {view === 'total_visits' && (
            <VisitsListView onBack={() => setView('dashboard')} />
          )}

          {view === 'active_cases' && (
            <ActiveCasesInsightsView onBack={() => setView('dashboard')} />
          )}

          {view === 'scan' && (
            <PrescriptionScanner 
              user={user}
              patientId={selectedPatient?.id}
              offlineMode={offlineMode}
              setToast={setToast}
              initialMode={scanMode}
              onComplete={(data) => {
                if (user.role === 'patient') {
                  // For patients, show them their profile with the new data
                  const targetId = selectedPatient?.id || user.id;
                  if (targetId) {
                    selectPatient(targetId, 'chat');
                    setToast({ message: "Prescription processed. You can now view details and ask questions.", type: "success" });
                  } else {
                    setView('dashboard');
                  }
                } else {
                  if (selectedPatient) selectPatient(selectedPatient.id);
                  else setView('dashboard');
                }
                fetchStats();
              }}
              onCancel={() => setView('dashboard')}
            />
          )}

          {view === 'doc_scan' && (
            <MedicalDocumentScanner 
              user={user}
              setToast={setToast}
              onComplete={() => {
                setView('dashboard');
                fetchPatients();
                fetchStats();
              }}
              onCancel={() => setView('dashboard')}
            />
          )}

          {view === 'lab_scan' && (
            <LabReportScanner 
              user={user} 
              initialPatient={scanInitialPatient}
              setToast={setToast}
              onComplete={() => {
                setView('dashboard');
                setScanInitialPatient(null);
                fetchPendingLabs();
              }} 
              onCancel={() => {
                setView('dashboard');
                setScanInitialPatient(null);
              }} 
            />
          )}

          {view === 'appointment_form' && (
            <AppointmentForm 
              onComplete={() => {
                fetchStats();
                setView('dashboard');
              }}
              onCancel={() => setView('dashboard')}
            />
          )}

          {view === 'appointments' && (
            <TodayAppointments 
              user={user}
              onBack={() => setView('dashboard')}
            />
          )}

          {view === 'vitals' && (
            <VitalsForm 
              patient={selectedPatient}
              user={user}
              onComplete={() => {
                if (selectedPatient) selectPatient(selectedPatient.id);
                else setView('dashboard');
                fetchStats();
              }}
              onCancel={() => setView('dashboard')}
            />
          )}

          {view === 'intake' && (
            <PatientIntakeForm 
              user={user}
              onComplete={(id) => {
                selectPatient(id);
                fetchPatients();
                fetchStats();
              }}
              onCancel={() => setView('dashboard')}
            />
          )}

          {view === 'patient_history_scan' && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <button onClick={() => setView('dashboard')} className="p-2 hover:bg-virtual-glass-bg rounded-lg text-virtual-text-muted">
                  <ArrowLeft size={20} />
                </button>
                <h2 className="text-2xl font-bold">Scan QR</h2>
              </div>
              <GlassCard className="p-0 overflow-hidden border-virtual-accent/20">
                <div className="p-6 border-b border-virtual-border bg-virtual-accent/5">
                  <p className="text-sm text-virtual-text-muted">Scan or upload the QR code generated from a prescription scan to view details securely.</p>
                </div>
                <div className="p-8 flex flex-col items-center justify-center min-h-[400px]">
                    <div className="flex justify-between items-center mb-4">
                      <p className="text-xs uppercase tracking-widest text-virtual-text-dim">
                        {qrScanMode === 'camera' ? 'Camera Scanner' : 'File Upload'}
                      </p>
                      <button 
                        onClick={() => setQrScanMode(qrScanMode === 'camera' ? 'upload' : 'camera')}
                        className="text-xs text-virtual-accent hover:underline flex items-center gap-1"
                      >
                        {qrScanMode === 'camera' ? <Upload size={12} /> : <Camera size={12} />}
                        {qrScanMode === 'camera' ? 'Switch to Upload' : 'Switch to Camera'}
                      </button>
                    </div>
                    <div className="w-full max-w-sm relative">
                      <QRScanner 
                        initialMode={qrScanMode}
                        setToast={setToast}
                        onScan={(text) => {
                          let searchVal = text.trim();
                          let foundId: string | null = null;
                          let foundName: string | null = null;
                          
                          console.log("QR Scanned:", text);

                          // 1. Handle URLs (Prioritize URL params)
                          if (text.startsWith('http')) {
                            try {
                              const url = new URL(text);
                              
                              // Check for encoded data first (our custom format)
                              const dataParam = url.searchParams.get('data');
                              if (dataParam) {
                                try {
                                  const decoded = JSON.parse(decodeURIComponent(escape(atob(dataParam))));
                                  if (decoded.type === 'CLINIQ_PATIENT') {
                                    setPublicRxData(decoded);
                                    setToast({ message: "Prescription QR scanned successfully", type: "success" });
                                    return;
                                  }
                                  foundId = decoded.id?.toString() || null;
                                  foundName = decoded.name || null;
                                } catch (e) {}
                              }
                              
                              // Then check for direct ID params
                              if (!foundId) {
                                foundId = url.searchParams.get('id') || 
                                          url.searchParams.get('patientId') || 
                                          url.searchParams.get('pid') ||
                                          url.searchParams.get('patient_id');
                              }
                              
                              // Then check for name params
                              if (!foundName) {
                                foundName = url.searchParams.get('name') || 
                                            url.searchParams.get('patient') || 
                                            url.searchParams.get('patientName') ||
                                            url.searchParams.get('patient_name');
                              }
                              
                              // If it's a URL but we found nothing, maybe the ID is in the path?
                              if (!foundId && !foundName) {
                                const pathParts = url.pathname.split('/');
                                const lastPart = pathParts[pathParts.length - 1];
                                if (/^\d+$/.test(lastPart)) {
                                  foundId = lastPart;
                                }
                              }
                            } catch (e) {}
                          } 
                          
                          // 2. Handle JSON (if not a URL or URL yielded nothing)
                          if (!foundId && !foundName && text.startsWith('{')) {
                            try {
                              const qrData = JSON.parse(text);
                              if (qrData.type === 'CLINIQ_PATIENT') {
                                setPublicRxData(qrData);
                                setToast({ message: "Prescription QR scanned successfully", type: "success" });
                                return;
                              }
                              foundId = qrData.id?.toString() || qrData.patientId?.toString() || null;
                              foundName = qrData.name || qrData.patientName || null;
                            } catch (e) {}
                          }
                          
                          // 3. Handle Plain Text / Patterns (if still nothing)
                          if (!foundId && !foundName) {
                            const lines = text.split('\n');
                            for (const line of lines) {
                              // Extract ID using regex
                              if (!foundId) {
                                const idMatch = line.match(/(?:patient\s*id|id|pid)\s*[:=-]\s*(\d+)/i);
                                if (idMatch) foundId = idMatch[1];
                              }
                              
                              // Extract Name using regex
                              if (!foundName) {
                                const nameMatch = line.match(/(?:patient|name|patient\s*name)\s*[:=-]\s*([^,\n\r]+)/i);
                                if (nameMatch) foundName = nameMatch[1].trim();
                              }
                            }
                          }

                          // Final decision: Prioritize ID for precise lookup, then Name, then raw text
                          const finalSearch = foundId || foundName || searchVal;
                        
                          if (user.role === 'patient') {
                            // For patients, we want to show their own profile in a minimal "digitalish" view
                            const targetId = foundId || selectedPatient?.id || user.id;
                            if (targetId) {
                              setToast({ message: "Loading patient details...", type: "info" });
                              fetch(`/api/patients/${targetId}`)
                                .then(res => res.json())
                                .then(data => {
                                  if (data && data.id) {
                                    const latestRx = data.prescriptions?.[0];
                                    let medicinesStr = 'No active prescriptions found.';
                                    if (latestRx && latestRx.medicines) {
                                      try {
                                        const meds = JSON.parse(latestRx.medicines);
                                        medicinesStr = meds.map((m: any) => `${m.name} (${m.dosage || ''}) - ${m.frequency || ''}`).join('\n');
                                      } catch (e) {
                                        medicinesStr = latestRx.medicines;
                                      }
                                    }
                                    
                                    setPublicRxData({
                                      name: data.name,
                                      age: data.age,
                                      weight: data.weight,
                                      doctor: latestRx?.doctor_name || 'N/A',
                                      date: latestRx?.date || new Date().toLocaleDateString(),
                                      medicines: medicinesStr
                                    });
                                    setToast({ message: "Medical record loaded", type: "success" });
                                  } else {
                                    setToast({ message: "Patient record not found.", type: "error" });
                                  }
                                })
                                .catch(err => {
                                  console.error("Error fetching patient for QR:", err);
                                  setToast({ message: "Error loading patient details.", type: "error" });
                                });
                            } else {
                              setToast({ message: "No patient ID found in QR code.", type: "error" });
                            }
                          } else {
                            // For staff, go to private vault
                            setVaultSearchQuery(finalSearch);
                            setVaultLastScannedId(foundId || ( /^\d+$/.test(searchVal) ? searchVal : null));
                            setView('private_vault');
                            setVaultUnlocked(true);
                            setToast({ message: "Searching for records...", type: "info" });
                          }
                      }} 
                    />
                    <div className="absolute inset-0 border-[40px] border-virtual-bg/40 pointer-events-none" />
                    <div className="absolute inset-[40px] border-2 border-virtual-accent/50 rounded-lg animate-pulse pointer-events-none" />
                  </div>
                  <p className="mt-6 text-xs uppercase tracking-widest text-virtual-text-dim">Align QR code within the frame</p>
                </div>
              </GlassCard>
            </div>
          )}

          {view === 'qr_details' && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <button onClick={() => setView('dashboard')} className="p-2 hover:bg-virtual-glass-bg rounded-lg text-virtual-text-muted">
                  <ArrowLeft size={20} />
                </button>
                <h2 className="text-2xl font-bold">QR Details</h2>
              </div>
              <GlassCard className="p-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 rounded-xl bg-virtual-accent/10 text-virtual-accent">
                    <QrCode size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-virtual-text">Scanned Data</h3>
                    <p className="text-sm text-virtual-text-muted">Raw information from the QR code</p>
                  </div>
                </div>
                <div className="p-6 rounded-2xl bg-virtual-input-bg border border-virtual-border font-mono text-sm break-all whitespace-pre-wrap text-virtual-text">
                  {(() => {
                    try {
                      return JSON.stringify(JSON.parse(scannedData || ''), null, 2);
                    } catch (e) {
                      return scannedData;
                    }
                  })()}
                </div>
                <div className="mt-8 flex gap-4">
                  <NeonButton onClick={() => setView('dashboard')} className="flex-1">
                    Back to Dashboard
                  </NeonButton>
                  <NeonButton 
                    variant="outline" 
                    onClick={() => {
                      setQrScanMode('camera');
                      setView('patient_history_scan');
                    }}
                    className="flex-1 border-virtual-border"
                  >
                    Scan Another
                  </NeonButton>
                </div>
              </GlassCard>
            </div>
          )}


          {view === 'private_vault' && (
            <PrivateVault 
              user={user} 
              unlocked={vaultUnlocked} 
              setUnlocked={setVaultUnlocked} 
              onBack={() => { setView('dashboard'); setSelectedPatient(null); setVaultSearchQuery(''); setVaultLastScannedId(null); }} 
              onSelectPatient={selectPatient}
              filterPatientId={selectedPatient?.id}
              initialSearchQuery={vaultSearchQuery}
              initialScannedId={vaultLastScannedId}
              offlineMode={offlineMode}
              fetchStats={fetchStats}
            />
          )}

          {view === 'pending_labs' && (
            <PendingLabsReview 
              user={user}
              onBack={() => setView('dashboard')}
              onApprove={() => {
                fetchPendingLabs();
                fetchStats();
              }}
            />
          )}
        </AnimatePresence>
      {/* Global Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl shadow-2xl z-[100] flex items-center gap-3 border ${
              toast.type === 'success' ? 'bg-virtual-accent/90 border-virtual-accent text-white' :
              toast.type === 'error' ? 'bg-virtual-danger/90 border-virtual-danger text-white' :
              'bg-virtual-blue/90 border-virtual-blue text-white'
            } backdrop-blur-md`}
          >
            {toast.type === 'success' ? <CheckCircle2 size={18} /> : 
             toast.type === 'error' ? <AlertCircle size={18} /> : 
             <Info size={18} />}
            <span className="text-sm font-medium">{toast.message}</span>
            <button onClick={() => setToast(null)} className="ml-2 hover:opacity-70 transition-opacity">
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      </main>
    </div>
  );
}

function RemindersSection({ patientId }: { patientId: number }) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReminders = async () => {
      try {
        const res = await fetch(`/api/reminders?patient_id=${patientId}`);
        const data = await res.json();
        setReminders(data);
      } catch (error) {
        console.error('Error fetching reminders:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchReminders();
  }, [patientId]);

  if (loading) return <div className="flex justify-center p-4"><Loader2 className="animate-spin text-virtual-accent" /></div>;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2 text-virtual-text">
        <Bell size={20} className="text-virtual-warning" />
        Health Reminders
      </h3>
      {reminders.length === 0 ? (
        <p className="text-virtual-text-muted text-sm italic">No active reminders.</p>
      ) : (
        reminders.map((reminder, idx) => (
          <GlassCard key={reminder.id || `rem-${idx}`} className="p-4 border-virtual-warning/20">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-virtual-warning/10 text-virtual-warning">
                {reminder.type === 'sms' ? <Bell size={16} /> : <Bell size={16} />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-virtual-text">{reminder.message}</p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-[10px] text-virtual-text-muted">
                    Scheduled: {formatDate(reminder.scheduled_at)}
                  </p>
                  <span className={`text-[8px] px-1.5 py-0.5 rounded-full uppercase font-bold ${
                    reminder.status === 'sent' ? 'bg-virtual-accent/20 text-virtual-accent' : 'bg-virtual-warning/20 text-virtual-warning'
                  }`}>
                    {reminder.status}
                  </span>
                </div>
              </div>
            </div>
          </GlassCard>
        ))
      )}
    </div>
  );
}

function PatientDashboard({ user, language, setLanguage, languages, setView, setScanMode, setQrScanMode, setSelectedPatient, setToast, fetchStats }: { 
  user: UserType, 
  language: string, 
  setLanguage: (l: string) => void, 
  languages: string[],
  setView: (v: string) => void,
  setScanMode: (m: 'upload' | 'voice') => void,
  setQrScanMode: (m: 'camera' | 'upload') => void,
  setSelectedPatient: (p: any) => void,
  setToast: (t: any) => void,
  fetchStats: () => void
}) {
  const [patientData, setPatientData] = useState<any>(null);

  useEffect(() => {
    const fetchPatientData = async () => {
      try {
        const searchTerm = user.name || user.username || '';
        const res = await fetch(`/api/patients/search?q=${encodeURIComponent(searchTerm)}`);
        let loaded = false;
        if (res.ok) {
          const results = await res.json();
          if (Array.isArray(results) && results.length > 0) {
            const fullRes = await fetch(`/api/patients/${results[0].id}`);
            if (fullRes.ok) {
              const data = await fullRes.json();
              setPatientData(data);
              setSelectedPatient(data);
              loaded = true;
            }
          }
        }
        if (!loaded) {
          // Fallback to first patient in database so dashboard is populated
          const fallbackRes = await fetch('/api/patients/1');
          if (fallbackRes.ok) {
            const data = await fallbackRes.json();
            setPatientData(data);
            setSelectedPatient(data);
          }
        }
      } catch (e) {
        console.error("Error fetching patient context:", e);
      }
    };
    fetchPatientData();
  }, [user, setSelectedPatient]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 pb-20 relative"
    >
      {/* Floating Glow Orbs */}
      <div className="absolute top-[-5%] left-[-5%] w-[30%] h-[30%] bg-virtual-accent/5 blur-[100px] rounded-full -z-10" />
      <div className="absolute bottom-[20%] right-[-5%] w-[30%] h-[30%] bg-virtual-blue/5 blur-[100px] rounded-full -z-10" />

      {/* Top Section: Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <motion.h1 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-4xl font-bold tracking-tight neon-text"
          >
            {user.isFirstLogin ? 'Welcome' : 'Welcome back'}, {user.name.split(' ')[0]}
          </motion.h1>
          <p className="text-virtual-text-muted mt-1">Your personal AI health companion is ready.</p>
        </div>

        {/* Language Selector */}
        <GlassCard className="py-2 px-4 flex items-center gap-3 border-virtual-accent/30 self-start sm:self-auto" hover={false}>
          <Languages size={18} className="text-virtual-accent" />
          <select 
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="bg-transparent text-sm font-medium outline-none cursor-pointer text-virtual-text"
          >
            {languages.map(lang => (
              <option key={lang} value={lang} className="bg-virtual-bg text-virtual-text">{lang}</option>
            ))}
          </select>
        </GlassCard>
      </div>

      {/* Reminders Section */}
      {patientData && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="w-full"
        >
          <RemindersSection patientId={patientData.id} />
        </motion.div>
      )}

      {/* Patient Core Features */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <GlassCard 
          className="p-6 border-virtual-accent/20 border-l-4 border-l-virtual-accent"
          hover={false}
        >
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-virtual-accent/10 text-virtual-accent">
                <QrCode size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-virtual-text">Scan QR</h3>
                <p className="text-xs text-virtual-text-muted">Scan prescription QR or access records</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <NeonButton 
                onClick={() => {
                  setQrScanMode('camera');
                  setView('patient_history_scan');
                }}
                className="py-2 text-xs flex items-center justify-center gap-2"
              >
                <Camera size={14} /> Scan QR
              </NeonButton>
              <NeonButton 
                variant="outline"
                onClick={() => {
                  setQrScanMode('upload');
                  setView('patient_history_scan');
                }}
                className="py-2 text-xs border-virtual-accent/30 text-virtual-accent flex items-center justify-center gap-2"
              >
                <Upload size={14} /> Upload QR
              </NeonButton>
            </div>
          </div>
        </GlassCard>

        <GlassCard 
          onClick={() => {
            setScanMode('upload');
            setView('scan');
          }}
          className="p-6 border-virtual-blue/20 hover:border-virtual-blue/50 transition-all cursor-pointer group"
        >
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-2xl bg-virtual-blue/10 text-virtual-blue group-hover:scale-110 transition-transform">
              <Camera size={32} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-virtual-text">Scan Current Prescription</h3>
              <p className="text-sm text-virtual-text-muted">Scan and ask AI about your prescription</p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Bottom Section: AI Assistant Chat */}
      <div className="grid grid-cols-1 gap-8">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-virtual-text flex items-center gap-2">
            <Sparkles size={18} className="text-virtual-blue" /> AI Health Assistant
          </h2>
          <span className="text-[10px] uppercase tracking-widest text-virtual-text-dim">Ask about your health</span>
        </div>
        <AIHealthChat user={user} language={language} patientData={patientData} setToast={setToast} />
      </div>
    </motion.div>
  );
}

function AIHealthChat({ user, language, patientData, setToast }: { user: UserType, language: string, patientData?: any, setToast: (t: any) => void }) {
  const [messages, setMessages] = useState<{ role: 'user' | 'model', text: string }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<{ text: string, type: 'tip' | 'question' }[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Generate proactive suggestions based on patient data
    if (patientData) {
      const newSuggestions: { text: string, type: 'tip' | 'question' }[] = [];
      
      // 1. Check Vitals (BP)
      const latestVitals = patientData.vitals?.[0];
      if (latestVitals) {
        const [sys, dia] = latestVitals.bp?.split('/').map(Number) || [0, 0];
        if (sys > 140 || dia > 90) {
          newSuggestions.push({ text: "How can I manage my high blood pressure?", type: 'question' });
          newSuggestions.push({ text: "Tip: Reduce salt intake and monitor BP daily.", type: 'tip' });
        } else if (sys < 90 || dia < 60) {
          newSuggestions.push({ text: "What should I do for low blood pressure?", type: 'question' });
        }

        // Heart Rate
        if (latestVitals.heartRate > 100) {
          newSuggestions.push({ text: "Why is my heart rate high?", type: 'question' });
        }

        // Temperature
        if (latestVitals.temp > 38) {
          newSuggestions.push({ text: "Tips for managing fever at home.", type: 'tip' });
        }
      }

      // 2. Check History/Prescriptions
      const hasDiabetesMeds = patientData.prescriptions?.some((p: any) => 
        p.medicines?.some((m: any) => m.name.toLowerCase().includes('metformin') || m.name.toLowerCase().includes('insulin'))
      );
      if (hasDiabetesMeds) {
        newSuggestions.push({ text: "Dietary tips for diabetes management.", type: 'tip' });
        newSuggestions.push({ text: "How to prevent diabetic foot complications?", type: 'question' });
      }

      // 3. General proactive tips if nothing specific
      if (newSuggestions.length === 0) {
        newSuggestions.push({ text: "What are some general wellness tips?", type: 'question' });
        newSuggestions.push({ text: "How to improve my sleep quality?", type: 'question' });
      }

      setSuggestions(newSuggestions.slice(0, 3));
    }
  }, [patientData]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const speak = async (text: string, index: number) => {
    // Stop any ongoing speech
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    window.speechSynthesis.cancel();

    if (speakingIdx === index) {
      setSpeakingIdx(null);
      return;
    }

    setSpeakingIdx(index);
    try {
      // Try Gemini TTS first
      const audioData = await generateSpeech(text);
      if (audioData) {
        const audio = new Audio(`data:audio/wav;base64,${audioData}`);
        audioRef.current = audio;
        audio.playbackRate = 1.2; // Increase playback speed
        audio.onended = () => {
          setSpeakingIdx(null);
          audioRef.current = null;
        };
        audio.play();
      } else {
        throw new Error("No audio data");
      }
    } catch (error) {
      console.warn("Gemini TTS failed, falling back to browser TTS", error);
      // Fallback to browser SpeechSynthesis
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = getLangCode(language);
      utterance.rate = 1.2; // Increase speech rate
      utterance.onend = () => setSpeakingIdx(null);
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleSend = async (text?: string) => {
    const msg = text || input;
    if (!msg.trim()) return;

    const newMessages = [...messages, { role: 'user' as const, text: msg }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const response = await chatWithAssistant(msg, messages, language, patientData);
      const assistantMsg = { role: 'model' as const, text: response };
      setMessages([...newMessages, assistantMsg]);
    } catch (error: any) {
      console.error(error);
      setToast({ message: error.message || "Failed to call the Gemini API. Please try again later.", type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setToast({ message: "Speech recognition not supported in this browser.", type: 'error' });
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = getLangCode(language);
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      handleSend(transcript);
    };
    recognition.start();
  };

  return (
    <GlassCard className="flex flex-col h-[400px] border-virtual-blue/20" hover={false}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-virtual-blue/10 text-virtual-blue">
            <MessageSquare size={18} />
          </div>
          <div>
            <h2 className="font-bold text-sm">Health Assistant</h2>
            <p className="text-[8px] uppercase tracking-widest text-virtual-text-muted">ClinIQ AI</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${loading ? 'bg-virtual-warning animate-pulse' : 'bg-virtual-accent'}`} />
          <span className="text-[8px] uppercase tracking-widest text-virtual-text-muted">{loading ? 'Thinking...' : 'Online'}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2 custom-scrollbar text-sm">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 rounded-full bg-virtual-blue/5 flex items-center justify-center mb-4 border border-virtual-blue/10">
              <Mic size={32} className="text-virtual-blue/50" />
            </div>
            <p className="text-virtual-text-muted text-sm mb-6">
              Ask me anything about your medicines, dosage, or health doubts in {language}.
            </p>
            
            {suggestions.length > 0 && (
              <div className="w-full space-y-2">
                <p className="text-[10px] uppercase tracking-widest text-virtual-text-muted/50 mb-3">Suggested for you</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {suggestions.map((s, i) => (
                    <button
                      key={`suggestion-${i}`}
                      onClick={() => handleSend(s.type === 'question' ? s.text : `Tell me more about: ${s.text}`)}
                      className="px-3 py-2 rounded-xl bg-virtual-blue/5 border border-virtual-blue/10 text-[11px] text-virtual-blue hover:bg-virtual-blue/10 hover:border-virtual-blue/30 transition-all text-left max-w-xs"
                    >
                      {s.type === 'tip' && <Sparkles size={10} className="inline mr-1" />}
                      {s.text}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {messages.map((msg, i) => (
          <motion.div
            key={`msg-${i}`}
            initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
            animate={{ opacity: 1, x: 0 }}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div className={`max-w-[80%] p-4 rounded-2xl backdrop-blur-md ${
              msg.role === 'user' 
                ? 'bg-virtual-blue/20 border border-virtual-blue/30 text-virtual-text shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
                : 'bg-virtual-input-bg border border-virtual-border text-virtual-text shadow-[0_0_15px_rgba(255,255,255,0.02)]'
            }`}>
              {msg.text}
            </div>
              <button 
                onClick={() => speak(msg.text, i)}
                className={`mt-2 p-2 rounded-lg border transition-all flex items-center gap-2 text-[10px] uppercase tracking-widest ${
                  speakingIdx === i 
                    ? 'bg-virtual-danger/20 border-virtual-danger/50 text-virtual-danger' 
                    : 'bg-virtual-input-bg border border-virtual-border text-virtual-text-muted hover:text-virtual-accent hover:border-virtual-accent/30'
                }`}
              >
                {speakingIdx === i ? <Loader2 size={12} className="animate-spin" /> : <Volume2 size={12} />} 
                {speakingIdx === i ? 'Stop' : 'Listen'}
              </button>
          </motion.div>
        ))}
        <div ref={chatEndRef} />
      </div>

      <div className="flex gap-3">
        <button 
          onClick={toggleListening}
          className={`p-4 rounded-xl border transition-all ${
            isListening 
              ? 'bg-virtual-danger/20 border-virtual-danger/50 text-virtual-danger animate-pulse' 
              : 'bg-virtual-input-bg border-virtual-border text-virtual-text-muted hover:bg-virtual-glass-bg'
          }`}
        >
          <Mic size={24} />
        </button>
        <div className="flex-1 relative">
          <input 
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder={`Type your question in ${language}...`}
            className="w-full h-full bg-virtual-input-bg border border-virtual-border rounded-xl px-4 pr-12 outline-none focus:border-virtual-blue/50 transition-all text-virtual-text"
          />
          <button 
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-virtual-blue hover:opacity-70 disabled:opacity-30"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </GlassCard>
  );
}

function PatientProfile({ 
  patient, 
  user, 
  onBack, 
  onScan, 
  onVitals, 
  language, 
  setToast, 
  initialTab = 'timeline',
  fetchStats
}: { 
  patient: any, 
  user: UserType, 
  onBack: () => void, 
  onScan: () => void, 
  onVitals: () => void, 
  language: string, 
  setToast: (t: any) => void, 
  initialTab?: 'timeline' | 'vitals' | 'alerts' | 'insights' | 'private' | 'chat',
  fetchStats: () => void
}) {
  const [activeTab, setActiveTab] = useState<'timeline' | 'vitals' | 'alerts' | 'insights' | 'private' | 'chat'>(initialTab);
  const [predicting, setPredicting] = useState(false);
  const [risks, setRisks] = useState<any[]>([]);
  const [patterns, setPatterns] = useState<any[]>([]);

  const runRiskPrediction = async () => {
    setPredicting(true);
    try {
      const [riskData, patternData] = await Promise.all([
        predictHealthRisks(patient.vitals, patient.prescriptions),
        detectDiseasePatterns(patient.prescriptions)
      ]);
      setRisks(riskData);
      setPatterns(patternData);
    } finally {
      setPredicting(false);
    }
  };

  useEffect(() => {
    runRiskPrediction();
  }, [patient.id]);

  if (activeTab === 'chat') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-4xl mx-auto space-y-6"
      >
        <div className="flex items-center justify-between bg-virtual-input-bg p-4 rounded-2xl border border-virtual-border">
          <div className="flex items-center gap-4">
            <button 
              onClick={onBack} 
              className="p-2 hover:bg-virtual-input-bg rounded-xl transition-colors text-virtual-text-muted hover:text-virtual-text"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h2 className="text-lg font-bold text-virtual-text flex items-center gap-2">
                <Sparkles size={18} className="text-blue-400" /> AI Health Assistant
              </h2>
              <p className="text-[10px] text-virtual-text-muted uppercase tracking-widest">Consulting for {patient.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-virtual-accent animate-pulse" />
            <span className="text-[10px] font-bold text-virtual-accent uppercase tracking-widest">AI Online</span>
          </div>
        </div>

        <GlassCard hover={false} className="min-h-[600px] flex flex-col">
          <AIHealthChat user={user} language={language} patientData={patient} setToast={setToast} />
        </GlassCard>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 hover:bg-virtual-input-bg rounded-lg">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-virtual-text">{patient.name}</h1>
              <p className="text-virtual-text-muted">Patient ID: {patient.id} • {patient.age}y{patient.gender && !['Not specified', 'Unknown', 'N/A'].includes(patient.gender) ? ` • ${patient.gender}` : ''} • {patient.weight ? `${patient.weight}kg` : 'N/A'}</p>
            </div>
          </div>
        <div className="flex gap-3">
          {user.role === 'patient' ? (
            <NeonButton onClick={onScan} variant="outline" className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10">
              <Camera size={18} className="mr-2" />
              Scan Prescription
            </NeonButton>
          ) : (
            <>
              <NeonButton onClick={onVitals} variant="outline">Record Vitals</NeonButton>
              <NeonButton onClick={onScan} variant="outline" className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10">
                <FlaskConical size={18} className="mr-2" />
                Scan Lab Report
              </NeonButton>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Info - Instant Patient Summary */}
        <div className="space-y-6">
          <GlassCard hover={false} className="border-emerald-500/20">
            <h3 className="text-xs uppercase tracking-widest text-virtual-accent mb-4 font-bold">Instant Summary</h3>
            <div className="space-y-4">
              {patient.weight > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-tighter text-virtual-text-muted">Weight</p>
                  <p className="text-sm text-virtual-text">{patient.weight} kg</p>
                </div>
              )}
              {patient.gender && !['Not specified', 'Unknown', 'N/A'].includes(patient.gender) && (
                <div>
                  <p className="text-[10px] uppercase tracking-tighter text-virtual-text-muted">Gender</p>
                  <p className="text-sm text-virtual-text">{patient.gender}</p>
                </div>
              )}
              {patient.blood_group && !['Not specified', 'Unknown', 'N/A'].includes(patient.blood_group) && (
                <div>
                  <p className="text-[10px] uppercase tracking-tighter text-virtual-text-muted">Blood Group</p>
                  <p className="text-sm text-virtual-text">{patient.blood_group}</p>
                </div>
              )}
              <div>
                <p className="text-[10px] uppercase tracking-tighter text-virtual-text-muted">Past Illness</p>
                <p className="text-sm text-virtual-text">{patient.past_illness || 'None'}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-tighter text-virtual-text-muted">Current Medicines</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {patient.prescriptions?.[0] ? (
                    JSON.parse(patient.prescriptions[0].medicines).map((m: any, i: number) => (
                      <span key={`curr-med-${i}`} className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {m.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-virtual-text-muted">None</span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-tighter text-virtual-text-muted">Allergies</p>
                <p className={`text-sm font-medium ${patient.allergies ? 'text-red-400' : 'text-virtual-text/60'}`}>
                  {patient.allergies || 'None Reported'}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-tighter text-virtual-text-muted">Chronic Risk</p>
                <p className="text-sm text-virtual-text/60">{patient.chronic_conditions || 'None'}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-tighter text-virtual-text-muted">Last Visit Date</p>
                <p className="text-sm text-virtual-text/60 italic">"{patient.prescriptions?.[0]?.date || 'N/A'}"</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard hover={false} className="bg-virtual-accent/5 border-virtual-accent/20">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs uppercase tracking-widest text-virtual-accent">AI Health Insights</h3>
              <button 
                onClick={runRiskPrediction} 
                disabled={predicting}
                className="text-[10px] text-emerald-400 hover:underline disabled:opacity-50"
              >
                {predicting ? 'Analyzing...' : 'Refresh'}
              </button>
            </div>
          <div className="space-y-3">
            {risks.length > 0 ? (
              risks.map((r, i) => (
                <div key={`risk-${i}`} className="p-3 rounded-lg bg-virtual-input-bg border border-virtual-border">
                  <p className="text-xs font-medium text-virtual-accent">{r.risk} ({r.confidence})</p>
                  <p className="text-[10px] text-virtual-text-muted mt-1">{r.reasoning}</p>
                </div>
              ))
            ) : (
              <div className="p-3 rounded-lg bg-virtual-input-bg border border-virtual-border">
                <p className="text-xs font-medium text-emerald-400">Risk: Low</p>
                <p className="text-[10px] text-virtual-text-muted mt-1">No chronic risk patterns detected in recent visits.</p>
              </div>
            )}
          </div>
          </GlassCard>
        </div>

        {/* Main Content Tabs */}
        <div className="lg:col-span-3 space-y-6">
          <div className="flex gap-4 border-b border-virtual-border">
            {(['timeline', 'vitals', 'alerts', 'insights', 'private', 'chat'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-4 px-2 text-sm font-medium transition-all relative ${activeTab === tab ? 'text-emerald-400' : 'text-virtual-text-muted hover:text-virtual-text'}`}
              >
                {tab === 'private' ? 'Private Vault' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                {activeTab === tab && (
                  <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400" />
                )}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {activeTab === 'timeline' && (
              <motion.div
                key="timeline"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                {patient.prescriptions?.length === 0 ? (
                  <div className="text-center py-12 text-white/30">No prescription history found.</div>
                ) : (
                  patient.prescriptions.map((rx: any, idx: number) => (
                    <div key={rx.id || `rx-${idx}`} className="relative pl-8 border-l border-virtual-border pb-8 last:pb-0">
                      <div className="absolute left-[-5px] top-0 w-2.5 h-2.5 rounded-full bg-virtual-accent shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-virtual-text-muted font-mono">{rx.date}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-virtual-input-bg border border-virtual-border text-virtual-text-muted">Dr. {rx.doctor_name}</span>
                      </div>
                      <GlassCard hover={false} className="p-4">
                        <p className="text-sm text-virtual-text-muted mb-4 italic">"{rx.symptoms}"</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {JSON.parse(rx.medicines).map((med: any, mIdx: number) => (
                            <div key={`rx-med-${mIdx}`} className="p-3 rounded-lg bg-virtual-input-bg border border-virtual-border">
                              <p className="text-sm font-medium text-virtual-text">{med.name}</p>
                              <p className="text-xs text-virtual-text-muted">{med.dosage} • {med.frequency}</p>
                            </div>
                          ))}
                        </div>
                      </GlassCard>
                    </div>
                  ))
                )}
              </motion.div>
            )}

            {activeTab === 'vitals' && (
              <motion.div
                key="vitals"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {patient.vitals?.length === 0 ? (
                  <div className="text-center py-12 text-white/30">No vitals recorded yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-xs uppercase tracking-widest text-white/30 border-b border-white/5">
                          <th className="py-4 px-4">Date</th>
                          <th className="py-4 px-4">BP</th>
                          <th className="py-4 px-4">HR</th>
                          <th className="py-4 px-4">Temp</th>
                          <th className="py-4 px-4">Weight</th>
                          <th className="py-4 px-4">By</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {patient.vitals.map((v: any, idx: number) => (
                          <tr key={v.id || `vital-${idx}`} className="border-b border-virtual-border hover:bg-virtual-glass-bg transition-colors">
                            <td className="py-4 px-4 text-virtual-text-muted">{formatDate(v.recorded_at)}</td>
                            <td className="py-4 px-4 font-medium text-virtual-text">{v.bp}</td>
                            <td className="py-4 px-4 text-virtual-text">{v.heart_rate} bpm</td>
                            <td className="py-4 px-4 text-virtual-text">{v.temperature}°C</td>
                            <td className="py-4 px-4 text-virtual-text">{v.weight} kg</td>
                            <td className="py-4 px-4 text-xs text-virtual-text-muted">{v.recorded_by}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'alerts' && (
              <motion.div
                key="alerts"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {patient.alerts?.length === 0 ? (
                  <div className="text-center py-12 text-white/30">No active safety alerts.</div>
                ) : (
                  patient.alerts.map((alert: any, idx: number) => (
                    <GlassCard key={alert.id || `alert-${idx}`} className="border-red-500/20 bg-red-500/5">
                      <div className="flex items-start gap-4">
                        <div className="p-2 rounded-lg bg-red-500/10 text-red-400">
                          <AlertTriangle size={20} />
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-widest text-red-400 mb-1">{alert.type}</p>
                          <p className="text-sm text-white/80">{alert.message}</p>
                          <p className="text-[10px] text-white/30 mt-2">{formatDateTime(alert.created_at)}</p>
                        </div>
                      </div>
                    </GlassCard>
                  ))
                )}
              </motion.div>
            )}

            {activeTab === 'insights' && (
              <motion.div
                key="insights"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Dna className="text-emerald-400" size={20} />
                  AI Disease Pattern Detection
                </h3>
                {patterns.length === 0 ? (
                  <div className="text-center py-12 text-white/30">No significant visit patterns detected yet.</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {patterns.map((p, i) => (
                      <GlassCard key={`pattern-${i}`} className="border-emerald-500/20">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-400" />
                          <p className="text-sm font-bold text-emerald-400 uppercase">{p.pattern}</p>
                        </div>
                        <p className="text-sm font-medium mb-1">Suggested Risk: {p.suggestedRisk}</p>
                        <p className="text-xs text-white/60 mb-3">{p.reasoning}</p>
                        <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20">
                          <p className="text-[10px] font-bold text-emerald-400 uppercase mb-1">Next Steps</p>
                          <p className="text-[10px] text-white/80">{p.nextSteps}</p>
                        </div>
                      </GlassCard>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'private' && (
              <motion.div
                key="private"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <PrivateVault 
                  user={user} 
                  unlocked={true} 
                  setUnlocked={() => {}} 
                  onBack={() => setActiveTab('timeline')} 
                  onSelectPatient={() => {}} 
                  filterPatientId={patient.id}
                  fetchStats={fetchStats}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}


function PrescriptionScanner({ user, patientId, onComplete, onCancel, setToast, initialMode = 'upload', offlineMode = false }: { user: UserType, patientId?: number, onComplete: (data: any) => void, onCancel: () => void, setToast: (t: any) => void, initialMode?: 'upload' | 'voice', offlineMode?: boolean }) {
  const [step, setStep] = useState<'upload' | 'processing' | 'review' | 'qr_code'>(initialMode === 'voice' ? 'upload' : 'upload');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [image, setImage] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [extractedData, setExtractedData] = useState<any>(null);
  const [safetyAlerts, setSafetyAlerts] = useState<any[]>([]);
  const [qrData, setQrData] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Pre-warm OCR worker on mount so offline scans start with 0ms cold-start
  useEffect(() => {
    prewarmOfflineOcrWorker();
  }, []);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        processImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  async function processImage(base64: string) {
    setStep('processing');
    setLoadingProgress(10);
    
    // 1. Instant local QR check (15ms)
    try {
      const qrText = await extractQrLocally(base64);
      if (qrText) {
        console.log("Instant QR detected in prescription scanner:", qrText);
        let qrData: any = null;
        try {
          if (qrText.startsWith('{')) {
            qrData = JSON.parse(qrText);
          } else if (qrText.startsWith('http')) {
            const url = new URL(qrText);
            const dataParam = url.searchParams.get('data');
            if (dataParam) {
              qrData = JSON.parse(decodeURIComponent(escape(atob(dataParam))));
            }
          }
        } catch (e) {
          console.warn("Failed to parse QR in prescription scanner", e);
        }

        if (qrData) {
          setExtractedData({
            patientName: qrData.name || qrData.patientName || 'Unknown',
            age: qrData.age || 0,
            gender: qrData.gender || '',
            weight: qrData.weight || 0,
            bloodGroup: qrData.bloodGroup || '',
            medicines: qrData.medicines ? (Array.isArray(qrData.medicines) ? qrData.medicines : []) : [],
            doctorName: qrData.doctor || 'Unknown',
            date: qrData.date || new Date().toISOString().split('T')[0],
            symptoms: qrData.symptoms || 'Scanned from QR'
          });
          setLoadingProgress(100);
          setStep('review');
          return;
        }
      }
    } catch (qrErr) {
      console.warn("Fast QR check bypassed:", qrErr);
    }

    if (offlineMode) {
      setLoadingProgress(20);
      try {
        setToast({ message: 'Running Offline OCR recognition...', type: 'info' });
        const rawOcrText = await recognizeTextOffline(base64, (progress, status) => {
          setLoadingProgress(Math.min(90, Math.round(20 + progress * 0.7)));
        });
        const parsedData = parsePrescriptionTextOffline(rawOcrText);
        setExtractedData({
          ...parsedData,
          notes: `[Offline OCR Extracted]\n${rawOcrText.slice(0, 400)}`
        });
        setLoadingProgress(100);
        setToast({ 
          message: `Offline OCR extracted ${parsedData.medicines.length} medicines!`, 
          type: 'success' 
        });
        setStep('review');
        return;
      } catch (ocrErr) {
        console.warn("Offline OCR failed, using fallback:", ocrErr);
        setLoadingProgress(100);
        setExtractedData({
          medicines: [],
          symptoms: 'Captured Offline',
          notes: 'This prescription was captured while offline. It will be synced when back online.'
        });
        setStep('review');
        return;
      }
    }

    try {
      setLoadingProgress(40);
      const data = await extractPrescriptionData(base64);
      setLoadingProgress(70);
      
      // Ensure medicines is always an array
      if (data && !data.medicines) {
        data.medicines = [];
      }
      
      setExtractedData(data);
      
      if (patientId && data.medicines && data.medicines.length > 0) {
        try {
          const res = await fetch(`/api/patients/${patientId}`);
          const patient = await res.json();
          const alerts = await analyzeDrugSafety(data.medicines, patient);
          setSafetyAlerts(alerts);
        } catch (err) {
          console.warn("Safety analysis failed:", err);
        }
      }
      
      setLoadingProgress(100);
      setStep('review');
    } catch (error: any) {
      console.warn("Online extraction failed, attempting offline OCR fallback:", error);
      try {
        setLoadingProgress(50);
        setToast({ message: 'Cloud service unavailable, using on-device OCR...', type: 'info' });
        const rawOcrText = await recognizeTextOffline(base64, (progress) => {
          setLoadingProgress(Math.min(90, Math.round(50 + progress * 0.45)));
        });
        const parsedData = parsePrescriptionTextOffline(rawOcrText);
        setExtractedData({
          ...parsedData,
          notes: `[Fallback OCR Extracted]\n${rawOcrText.slice(0, 400)}`
        });
        setLoadingProgress(100);
        setToast({ message: `Extracted ${parsedData.medicines.length} medicines via local OCR!`, type: 'success' });
        setStep('review');
      } catch (fallbackErr) {
        console.error("Both online and offline OCR failed:", fallbackErr);
        setToast({ 
          message: error.message || 'Error processing prescription. Please enter details manually.', 
          type: 'error' 
        });
        setStep('upload');
      }
    }
  }

  async function processAudio(base64: string) {
    setStep('processing');
    try {
      const { speechToRecord } = await import('./services/geminiService');
      const data = await speechToRecord(base64.split(',')[1] || base64);
      setExtractedData(data);
      
      if (patientId) {
        const res = await fetch(`/api/patients/${patientId}`);
        const patient = await res.json();
        const risks = await analyzeClinicalRisk(data, patient.prescriptions);
        setSafetyAlerts(risks);
      }
      
      setStep('review');
    } catch (error: any) {
      setToast({ message: error.message || 'Error processing audio. Please try again.', type: 'error' });
      setStep('upload');
    }
  }

  async function processTranscript(transcript: string) {
    setStep('processing');
    try {
      const data = await voicePrescriptionToDigital(transcript);
      setExtractedData(data);
      
      if (patientId) {
        const res = await fetch(`/api/patients/${patientId}`);
        const patient = await res.json();
        const risks = await analyzeClinicalRisk(data, patient.prescriptions);
        setSafetyAlerts(risks);
      }
      
      setStep('review');
    } catch (error: any) {
      setToast({ message: error.message || 'Error processing voice command.', type: 'error' });
      setStep('upload');
    }
  }

  function handleVoiceMode() {
    setIsListening(true);
    setLiveTranscript('');
    
    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = true;
    recognitionRef.current = recognition;

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      
      setLiveTranscript(prev => {
        // This is a bit tricky with continuous. 
        // Let's just rebuild the whole thing from event.results for simplicity
        return Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join(' ');
      });
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      if (event.error !== 'no-speech') {
        setIsListening(false);
        setToast({ message: `Voice recognition error: ${event.error}. Please try again.`, type: 'error' });
      }
    };

    recognition.onend = () => {
      // Don't automatically close if we are still "listening" (waiting for user to click Finish)
      // But if the browser stops it, we should know.
      console.log('Recognition ended');
    };

    try {
      recognition.start();
    } catch (e) {
      console.error(e);
      setIsListening(false);
    }
  }

  function finishVoiceMode() {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
    if (liveTranscript.trim()) {
      processTranscript(liveTranscript);
    } else {
      setStep('upload');
    }
  }

  useEffect(() => {
    if (initialMode === 'voice') {
      const timer = setTimeout(() => {
        handleVoiceMode();
      }, 500);
      return () => clearTimeout(timer);
    } else if (initialMode === 'upload') {
      // Auto-trigger file upload for "single take" experience
      const timer = setTimeout(() => {
        fileInputRef.current?.click();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [initialMode]);

  const handleSave = async () => {
    setStep('processing');
    
    if (offlineMode) {
      const offlineScans = JSON.parse(localStorage.getItem('offlineScans') || '[]');
      const offlinePrescriptions = JSON.parse(localStorage.getItem('offlinePrescriptions') || '[]');
      
      const scanEntry = {
        patient_id: patientId,
        image_data: image,
        timestamp: new Date().toISOString(),
        staff_id: user.username,
        staff_name: user.name,
        extracted_data: extractedData
      };
      
      offlineScans.push(scanEntry);
      
      // Generate QR Data for Offline
      const qrPayload = {
        type: 'CLINIQ_OFFLINE',
        name: extractedData.patientName || 'Unknown',
        weight: extractedData.weight || 'N/A',
        age: extractedData.age || 'N/A',
        doctor: extractedData.doctorName || user.name,
        date: new Date().toLocaleDateString(),
        medicines: extractedData.medicines?.map((m: any) => m.name).join(', ') || 'N/A',
        offline: true
      };
      const encodedData = btoa(unescape(encodeURIComponent(JSON.stringify(qrPayload))));
      const baseUrl = window.location.origin;
      const publicUrl = `${baseUrl.replace(/\/$/, '')}/?view=public_rx&data=${encodeURIComponent(encodedData)}`;
      setQrData(publicUrl);

      // Generate a formatted content for the private vault
      const medicinesList = extractedData.medicines?.map((m: any) => `- ${m.name} (${m.dosage}) ${m.frequency}`).join('\n') || 'None';
      const privateContent = `OFFLINE PRESCRIPTION SCAN
----------------------------
Patient: ${extractedData.patientName || 'Unknown'}
Doctor: ${extractedData.doctorName || user.name}
Date: ${new Date().toLocaleDateString()}
Symptoms: ${extractedData.symptoms || 'N/A'}
Medicines:
${medicinesList}

QR DATA: ${publicUrl}`;

      offlinePrescriptions.push({
        staff_id: user.username,
        staff_name: user.name,
        content: privateContent,
        timestamp: new Date().toISOString()
      });

      localStorage.setItem('offlineScans', JSON.stringify(offlineScans));
      localStorage.setItem('offlinePrescriptions', JSON.stringify(offlinePrescriptions));
      
      setToast({ message: 'Prescription saved to Private Vault locally.', type: 'success' });
      setStep('qr_code');
      return;
    }

    try {
      // 1. Create patient if doesn't exist
      let pid = patientId;
      if (!pid) {
        const pRes = await fetch('/api/patients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: (extractedData.patientName && !['Unknown', 'N/A', 'Unknown Patient'].includes(extractedData.patientName)) ? extractedData.patientName : 'Unknown Patient',
            age: extractedData.age || 0,
            gender: (extractedData.gender && !['Unknown', 'N/A', 'Not specified'].includes(extractedData.gender)) ? extractedData.gender : null,
            weight: extractedData.weight || 0,
            blood_group: (extractedData.bloodGroup && !['Unknown', 'N/A', 'Not specified'].includes(extractedData.bloodGroup)) ? extractedData.bloodGroup : null,
            allergies: '',
            chronic_conditions: ''
          })
        });
        const pData = await pRes.json();
        pid = pData.id;
      }

      // 2. Save prescription
      const rxRes = await fetch('/api/prescriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: pid,
          doctor_name: extractedData.doctorName || 'Dr. Sharma',
          symptoms: extractedData.symptoms || 'Voice Recorded',
          medicines: extractedData.medicines,
          date: extractedData.date || new Date().toISOString().split('T')[0],
          image_data: image
        })
      });

      // Mirror/Sync prescription to Firestore
      syncPrescriptionToFirestore({
        patient_id: pid,
        doctor_name: extractedData.doctorName || 'Dr. Sharma',
        symptoms: extractedData.symptoms || '',
        medicines: extractedData.medicines,
        date: extractedData.date || new Date().toISOString().split('T')[0]
      });

      // 4. Generate Patient Explanation
      const explanation = await explainPrescriptionSimple(extractedData.medicines, 'English');
      
      // 3. Save safety alerts & explanation
      for (const alert of safetyAlerts) {
        await fetch('/api/alerts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patient_id: pid,
            type: alert.type,
            message: `${alert.message}. Recommendation: ${alert.recommendation}`
          })
        });
      }

      // Save explanation as a special alert or info
      await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: pid,
          type: 'Patient Explanation',
          message: explanation
        })
      });

      // 5. Always Save to Private Data Vault
      const privateContent = `MANUAL PATIENT RECORD\n----------------------\nPatient: ${extractedData.patientName || 'Unknown'}\nPatient ID: ${pid || 'N/A'}\nWeight: ${extractedData.weight || 'N/A'} kg\nAge: ${extractedData.age || 'N/A'}\nBP: ${extractedData.bp || 'N/A'}\nBlood Group: ${extractedData.bloodGroup || 'N/A'}\nDoctor: ${extractedData.doctorName || 'Dr. Sharma'}\nMedicines: ${JSON.stringify(extractedData.medicines, null, 2)}\nDate: ${extractedData.date || new Date().toISOString()}`;
      
      try {
        await fetch('/api/private-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            staff_id: user.username,
            staff_name: user.name,
            patient_id: pid,
            content: privateContent
          })
        });
      } catch (pvErr) {
        console.warn("Failed to save to private data vault:", pvErr);
      }

      // Generate QR Data
      const qrPayload = {
        type: 'CLINIQ_PATIENT',
        id: pid,
        name: extractedData.patientName || 'Unknown',
        weight: extractedData.weight || 0,
        age: extractedData.age || 'N/A',
        doctor: extractedData.doctorName || 'Dr. Sharma',
        date: new Date().toLocaleDateString(),
        medicines: extractedData.medicines?.map((m: any) => m.name).join(', ') || 'N/A'
      };
      const encodedData = btoa(unescape(encodeURIComponent(JSON.stringify(qrPayload))));
      const baseUrl = window.location.origin;
      const publicUrl = `${baseUrl.replace(/\/$/, '')}/?view=public_rx&data=${encodeURIComponent(encodedData)}`;
      setQrData(publicUrl);
      setStep('qr_code');
    } catch (error) {
      console.error('Prescription save error:', error);
      const offlineData = JSON.parse(localStorage.getItem('offlineScans') || '[]');
      offlineData.push({
        patient_id: patientId,
        image_data: image,
        timestamp: new Date().toISOString(),
        staff_id: user.username,
        staff_name: user.name,
        extracted_data: extractedData
      });
      localStorage.setItem('offlineScans', JSON.stringify(offlineData));
      setToast({ message: 'Saved to local vault. It will sync when connected.', type: 'info' });
      onComplete({});
    }
  };

  const downloadQR = () => {
    const canvas = document.getElementById('prescription-qr') as HTMLCanvasElement;
    if (canvas) {
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `QR_${extractedData?.patientName || 'Patient'}_${Date.now()}.png`;
      link.href = url;
      link.click();
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <AnimatePresence mode="wait">
        {step === 'upload' && !isListening && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="text-center space-y-6"
          >
            <div className="flex items-center gap-4 mb-8">
              <button onClick={onCancel} className="p-2 hover:bg-virtual-glass-bg rounded-lg text-virtual-text">
                <ArrowLeft size={20} />
              </button>
              <h1 className="text-2xl font-bold">AI Prescription Scanner</h1>
            </div>

            <div className={`grid grid-cols-1 ${initialMode ? '' : (user.role !== 'patient' ? 'md:grid-cols-2' : '')} gap-4`}>
              {(initialMode === 'upload' || !initialMode) && (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-virtual-border rounded-3xl p-12 hover:border-virtual-accent/50 hover:bg-virtual-accent/5 transition-all cursor-pointer group"
                >
                  <div className="w-16 h-16 rounded-full bg-virtual-accent/10 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                    <Camera size={32} className="text-virtual-accent" />
                  </div>
                  <h3 className="text-lg font-semibold mb-1 text-virtual-text">Scan Image</h3>
                  <p className="text-xs text-virtual-text-muted">Handwritten prescriptions</p>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    accept="image/*" 
                    className="hidden" 
                  />
                </div>
              )}
              
              {(initialMode === 'voice' || (!initialMode && user.role !== 'patient')) && (
                <div 
                  onClick={handleVoiceMode}
                  className="border-2 border-dashed border-virtual-border rounded-3xl p-12 hover:border-virtual-blue/50 hover:bg-virtual-blue/5 transition-all cursor-pointer group"
                >
                  <div className="w-16 h-16 rounded-full bg-virtual-blue/10 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                    <Mic size={32} className="text-virtual-blue" />
                  </div>
                  <h3 className="text-lg font-semibold mb-1 text-virtual-text">Voice Prescription</h3>
                  <p className="text-xs text-virtual-text-muted">Speak the prescription details</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {isListening && (
          <motion.div
            key="listening"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20 space-y-6"
          >
            <div className="relative w-24 h-24 mx-auto">
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="absolute inset-0 bg-virtual-blue/20 rounded-full"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Mic className="text-virtual-blue animate-pulse" size={48} />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-virtual-blue">Listening...</h2>
            <div className="min-h-[120px] max-w-md mx-auto p-6 rounded-3xl bg-virtual-input-bg border border-virtual-border italic text-virtual-text text-lg leading-relaxed">
              {liveTranscript || "Waiting for speech..."}
            </div>
            <p className="text-sm text-virtual-text-muted">Speak as long as you need. Click "Finish" when done.</p>
            <div className="flex justify-center gap-4">
              <NeonButton variant="outline" onClick={() => {
                if (recognitionRef.current) recognitionRef.current.stop();
                setIsListening(false);
              }}>Cancel</NeonButton>
              <NeonButton onClick={finishVoiceMode}>Finish Speaking</NeonButton>
            </div>
          </motion.div>
        )}

        {step === 'processing' && (
          <motion.div
            key="processing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20 space-y-6"
          >
            <div className="relative w-24 h-24 mx-auto">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 border-4 border-virtual-accent/20 border-t-virtual-accent rounded-full"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Activity className="text-virtual-accent animate-pulse" size={32} />
              </div>
            </div>
            <h2 className="text-2xl font-bold neon-text">AI is Analyzing...</h2>
            <div className="max-w-xs mx-auto space-y-4">
              <div className="w-full bg-virtual-input-bg rounded-full h-1.5 overflow-hidden">
                <motion.div 
                  className="bg-virtual-accent h-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${loadingProgress}%` }}
                />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-virtual-text-muted">{loadingProgress < 40 ? 'Extracting handwriting patterns...' : loadingProgress < 80 ? 'Cross-referencing drug database...' : 'Checking safety protocols...'}</p>
              </div>
            </div>
          </motion.div>
        )}

        {step === 'review' && extractedData && (
          <motion.div
            key="review"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-virtual-text">Review Digital Record</h2>
              <div className="flex gap-2">
                <NeonButton variant="outline" onClick={() => setStep('upload')}>Retake</NeonButton>
                {user.role === 'patient' ? (
                  <NeonButton onClick={() => onComplete(extractedData)}>
                    Ask AI Assistant
                  </NeonButton>
                ) : (
                  <NeonButton onClick={handleSave}>Confirm & Save</NeonButton>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <GlassCard hover={false}>
                <h3 className="text-xs uppercase tracking-widest text-virtual-text-muted mb-4">Patient & Vitals</h3>
                <div className="flex flex-wrap gap-x-8 gap-y-4">
                  {extractedData.patientName && !['Unknown', 'N/A', 'Unknown Patient', 'Not mentioned', 'Not available', 'null', 'None', 'Not specified'].includes(extractedData.patientName) && (
                    <div>
                      <label className="text-[10px] text-virtual-text-muted uppercase block">Name</label>
                      <p className="font-medium text-virtual-text">{extractedData.patientName}</p>
                    </div>
                  )}
                  {extractedData.age > 0 && (
                    <div>
                      <label className="text-[10px] text-virtual-text-muted uppercase block">Age</label>
                      <p className="font-medium text-virtual-text">{extractedData.age}</p>
                    </div>
                  )}
                  {extractedData.gender && !['Unknown', 'N/A', 'Not specified', 'Not mentioned', 'Not available', 'null', 'None'].includes(extractedData.gender) && (
                    <div>
                      <label className="text-[10px] text-virtual-text-muted uppercase block">Gender</label>
                      <p className="font-medium text-virtual-text">{extractedData.gender}</p>
                    </div>
                  )}
                  {extractedData.weight > 0 && (
                    <div>
                      <label className="text-[10px] text-virtual-text-muted uppercase block">Weight</label>
                      <p className="font-medium text-virtual-text">{extractedData.weight} kg</p>
                    </div>
                  )}
                  {extractedData.bloodGroup && !['Unknown', 'N/A', 'Not specified', 'Not mentioned', 'Not available', 'null', 'None'].includes(extractedData.bloodGroup) && (
                    <div>
                      <label className="text-[10px] text-virtual-text-muted uppercase block">Blood Group</label>
                      <p className="font-medium text-virtual-text">{extractedData.bloodGroup}</p>
                    </div>
                  )}
                  {extractedData.bp && !['Unknown', 'N/A', 'Not specified', 'Not mentioned', 'Not available', 'null', 'None'].includes(extractedData.bp) && (
                    <div>
                      <label className="text-[10px] text-virtual-text-muted uppercase block">BP</label>
                      <p className="font-medium text-virtual-accent">{extractedData.bp}</p>
                    </div>
                  )}
                </div>
              </GlassCard>

              <GlassCard hover={false} className={safetyAlerts.length > 0 ? 'border-virtual-danger/30' : ''}>
                <h3 className="text-xs uppercase tracking-widest text-virtual-text-muted mb-4">AI Drug Safety Check</h3>
                {safetyAlerts.length === 0 ? (
                  <div className="flex items-center gap-3 text-virtual-accent">
                    <CheckCircle2 size={24} />
                    <p className="text-sm font-medium">No safety risks detected.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {safetyAlerts.map((alert, idx) => (
                      <div key={`safety-alert-${idx}`} className="p-3 rounded-lg bg-virtual-danger/10 border border-virtual-danger/20">
                        <p className="text-xs font-bold text-virtual-danger uppercase">{alert.type}</p>
                        <p className="text-xs text-virtual-text mt-1">{alert.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>
            </div>

            <GlassCard hover={false}>
              <h3 className="text-xs uppercase tracking-widest text-virtual-text-muted mb-4">Medicines Extracted</h3>
              <div className="space-y-3">
                {extractedData.medicines?.map((med: any, idx: number) => (
                  <div key={`safety-med-${idx}`} className="flex items-center justify-between p-4 rounded-xl bg-virtual-input-bg border border-virtual-border">
                    <div>
                      <p className="font-medium text-virtual-accent">{med.name}</p>
                      <p className="text-xs text-virtual-text-muted">{med.dosage} • {med.frequency}</p>
                      {med.instructions && <p className="text-[10px] text-virtual-warning/70 mt-1 italic">Note: {med.instructions}</p>}
                    </div>
                    <div className="text-xs text-virtual-text-dim">{med.duration}</div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </motion.div>
        )}

        {step === 'qr_code' && (
          <motion.div
            key="qr_code"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-8"
          >
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 rounded-full bg-virtual-accent/10 flex items-center justify-center mb-6 border border-virtual-accent/30">
                <QrCode size={40} className="text-virtual-accent" />
              </div>
              <h2 className="text-2xl font-bold text-virtual-text">Patient QR Code Generated</h2>
              <p className="text-virtual-text-muted max-w-sm mt-2">
                This QR code contains patient details and prescription summary. Scan it with any QR scanner to view.
              </p>
            </div>

            <GlassCard className="inline-block p-8 bg-white border-none">
              <QRCodeCanvas 
                id="prescription-qr"
                value={qrData || ''} 
                size={256}
                level="H"
                includeMargin={true}
              />
            </GlassCard>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md mx-auto">
              <NeonButton onClick={downloadQR} variant="outline" className="border-virtual-accent/30 text-virtual-accent">
                <Download size={18} className="mr-2" /> Download QR
              </NeonButton>
              <NeonButton onClick={() => onComplete(extractedData)}>
                <CheckCircle2 size={18} className="mr-2" /> Done & Finish
              </NeonButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function VitalsForm({ patient, onComplete, onCancel, user }: { patient?: any, onComplete: () => void, onCancel: () => void, user: any }) {
  const [formData, setFormData] = useState({
    patient_id: patient?.id || '',
    patient_name: patient?.name || '',
    bp: '',
    blood_group: '',
    weight: '',
    symptoms: '',
    notes: '',
    recorded_by: user?.name || 'Nurse Meena'
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const isOffline = localStorage.getItem('offlineMode') === 'true';

    try {
      if (isOffline) {
        // Store locally for sync
        const offlineData = JSON.parse(localStorage.getItem('offlineIntake') || '[]');
        offlineData.push({
          ...formData,
          timestamp: new Date().toISOString(),
          id: Date.now()
        });
        localStorage.setItem('offlineIntake', JSON.stringify(offlineData));
        onComplete();
        return;
      }

      // Online mode: Save vitals
      const vitalsRes = await fetch('/api/vitals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: formData.patient_id,
          bp: formData.bp,
          weight: parseFloat(formData.weight) || 0,
          symptoms: formData.symptoms,
          notes: `${formData.notes} | Blood Group: ${formData.blood_group} | Weight: ${formData.weight} kg`,
          recorded_by: formData.recorded_by
        })
      });

      if (vitalsRes.ok) {
        // Also store in private data vault for security
        const content = `PATIENT INTAKE RECORD
----------------------------
Patient: ${formData.patient_name}
ID: ${formData.patient_id}
BP: ${formData.bp}
Weight: ${formData.weight} kg
Symptoms: ${formData.symptoms}
Notes: ${formData.notes}
Recorded By: ${formData.recorded_by}`;

        await fetch('/api/private-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            staff_id: user?.username || user?.id || 'STAFF001',
            staff_name: user?.name || 'Nurse Meena',
            content: content
          })
        });

        // Store patient vitals in Firestore database
        syncVitalToFirestore({
          patient_id: formData.patient_id,
          bp: formData.bp,
          weight: parseFloat(formData.weight) || 0,
          symptoms: formData.symptoms,
          notes: `${formData.notes} | Blood Group: ${formData.blood_group} | Weight: ${formData.weight} kg`,
          recorded_by: formData.recorded_by,
          recorded_at: new Date().toISOString()
        });

        onComplete();
      } else {
        throw new Error('Server error');
      }
    } catch (err) {
      console.error('Error saving intake:', err);
      const offlineData = JSON.parse(localStorage.getItem('offlineIntake') || '[]');
      offlineData.push({
        ...formData,
        timestamp: new Date().toISOString(),
        id: Date.now()
      });
      localStorage.setItem('offlineIntake', JSON.stringify(offlineData));
      onComplete();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      <GlassCard hover={false}>
        <div className="flex items-center gap-4 mb-8">
          <button onClick={onCancel} className="p-2 hover:bg-virtual-glass-bg rounded-lg text-virtual-text">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold">Patient Intake Mode</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs uppercase tracking-widest text-virtual-text-muted mb-2">Patient Name</label>
            <input
              type="text"
              required
              value={formData.patient_name}
              onChange={(e) => setFormData({ ...formData, patient_name: e.target.value })}
              className="w-full bg-virtual-input-bg border border-virtual-border rounded-xl px-4 py-3 focus:border-virtual-accent/50 outline-none transition-all text-virtual-text"
              placeholder="Enter Patient Name"
            />
          </div>

          {!patient && (
            <div>
              <label className="block text-xs uppercase tracking-widest text-virtual-text-muted mb-2">Patient ID</label>
              <input
                type="number"
                required
                value={formData.patient_id}
                onChange={(e) => setFormData({ ...formData, patient_id: e.target.value })}
                className="w-full bg-virtual-input-bg border border-virtual-border rounded-xl px-4 py-3 focus:border-virtual-accent/50 outline-none transition-all text-virtual-text"
                placeholder="Enter Patient ID"
              />
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-widest text-virtual-text-muted mb-2">Blood Pressure</label>
              <input
                type="text"
                required
                value={formData.bp}
                onChange={(e) => setFormData({ ...formData, bp: e.target.value })}
                className="w-full bg-virtual-input-bg border border-virtual-border rounded-xl px-4 py-3 focus:border-virtual-accent/50 outline-none transition-all text-virtual-text"
                placeholder="120/80"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-virtual-text-muted mb-2">Blood Group</label>
              <select
                required
                value={formData.blood_group}
                onChange={(e) => setFormData({ ...formData, blood_group: e.target.value })}
                className="w-full bg-virtual-input-bg border border-virtual-border rounded-xl px-4 py-3 focus:border-virtual-accent/50 outline-none transition-all text-virtual-text"
              >
                <option value="" disabled className="bg-virtual-bg">Select Group</option>
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                  <option key={bg} value={bg} className="bg-virtual-bg">{bg}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-widest text-virtual-text-muted mb-2">Weight (kg)</label>
              <input
                type="number"
                step="0.1"
                required
                value={formData.weight}
                onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                className="w-full bg-virtual-input-bg border border-virtual-border rounded-xl px-4 py-3 focus:border-virtual-accent/50 outline-none transition-all text-virtual-text"
                placeholder="65.0"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-virtual-text-muted mb-2">Symptoms</label>
              <textarea
                required
                value={formData.symptoms}
                onChange={(e) => setFormData({ ...formData, symptoms: e.target.value })}
                className="w-full bg-virtual-input-bg border border-virtual-border rounded-xl px-4 py-3 focus:border-virtual-accent/50 outline-none transition-all h-20 text-virtual-text"
                placeholder="e.g. Fever, Cough, Headache"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-widest text-virtual-text-muted mb-2">Initial Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full bg-virtual-input-bg border border-virtual-border rounded-xl px-4 py-3 focus:border-virtual-accent/50 outline-none transition-all h-20 text-virtual-text"
              placeholder="Any additional observations..."
            />
          </div>

          <div className="pt-4 flex gap-3">
            <NeonButton variant="outline" className="flex-1" onClick={onCancel}>Cancel</NeonButton>
            <NeonButton className="flex-1" disabled={loading}>
              {loading ? <Loader2 className="animate-spin mx-auto" /> : 'Save Intake Data'}
            </NeonButton>
          </div>
        </form>
      </GlassCard>
    </div>
  );
}

function PatientIntakeForm({ user, onComplete, onCancel }: { user: UserType, onComplete: (id: number) => void, onCancel: () => void }) {
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    gender: 'Male',
    weight: '',
    blood_group: 'O+',
    allergies: '',
    chronic_conditions: '',
    past_illness: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (localStorage.getItem('offlineMode') === 'true') {
        const offlinePatients = JSON.parse(localStorage.getItem('offlinePatients') || '[]');
        const offlinePrescriptions = JSON.parse(localStorage.getItem('offlinePrescriptions') || '[]');
        
        const tempId = Date.now();
        const newPatient = { ...formData, id: tempId };
        offlinePatients.push(newPatient);
        
        // Also store in private data vault locally
        const content = `OFFLINE PATIENT REGISTRATION
----------------------------
Patient: ${formData.name}
Age: ${formData.age}
Gender: ${formData.gender}
Weight: ${formData.weight} kg
Blood Group: ${formData.blood_group}
Allergies: ${formData.allergies}
Chronic Conditions: ${formData.chronic_conditions}
Past Illness: ${formData.past_illness}`;

        offlinePrescriptions.push({
          staff_id: user?.username || user?.id || 'STAFF001',
          staff_name: user?.name || 'Nurse Meena',
          content: content,
          timestamp: new Date().toISOString()
        });

        localStorage.setItem('offlinePatients', JSON.stringify(offlinePatients));
        localStorage.setItem('offlinePrescriptions', JSON.stringify(offlinePrescriptions));
        
        onComplete(tempId);
        return;
      }

      const res = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (res.ok) {
        // Also store in private data vault for security
        const content = `NEW PATIENT REGISTRATION
----------------------------
Patient: ${formData.name}
Age: ${formData.age}
Gender: ${formData.gender}
Weight: ${formData.weight} kg
Blood Group: ${formData.blood_group}
Allergies: ${formData.allergies}
Chronic Conditions: ${formData.chronic_conditions}
Past Illness: ${formData.past_illness}`;

        await fetch('/api/private-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            staff_id: user?.username || user?.id || 'STAFF001',
            staff_name: user?.name || 'Nurse Meena',
            content: content
          })
        });

        // Mirror/Sync to Firebase Firestore
        syncPatientToFirestore({ id: data.id, ...formData });
        syncPrivateDataToFirestore({
          staff_id: String(user?.username || user?.id || 'STAFF001'),
          staff_name: user?.name || 'Nurse Meena',
          patient_id: data.id,
          content
        });
        syncVitalToFirestore({
          patient_id: data.id,
          bp: '120/80',
          weight: formData.weight,
          symptoms: formData.chronic_conditions || 'Initial Consultation',
          notes: 'Initial patient intake registration'
        });

        onComplete(data.id);
      } else {
        throw new Error(data.error || 'Server error');
      }
    } catch (error: any) {
      console.error('Patient registration error:', error);
      const offlinePatients = JSON.parse(localStorage.getItem('offlinePatients') || '[]');
      const tempId = Date.now();
      const newPatient = { ...formData, id: tempId };
      offlinePatients.push(newPatient);
      localStorage.setItem('offlinePatients', JSON.stringify(offlinePatients));
      syncPatientToFirestore(newPatient);
      onComplete(tempId);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <GlassCard hover={false}>
        <div className="flex items-center gap-4 mb-8">
          <button onClick={onCancel} className="p-2 hover:bg-virtual-glass-bg rounded-lg text-virtual-text">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold">New Patient Intake</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs uppercase tracking-widest text-virtual-text-muted mb-2 ml-1">Full Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-virtual-input-bg border border-virtual-border rounded-xl px-4 py-3 focus:border-virtual-accent/50 outline-none transition-all text-virtual-text"
                placeholder="Ramesh Kumar"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-virtual-text-muted mb-2 ml-1">Weight (kg)</label>
              <input
                type="number"
                step="0.1"
                required
                value={formData.weight}
                onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                className="w-full bg-virtual-input-bg border border-virtual-border rounded-xl px-4 py-3 focus:border-virtual-accent/50 outline-none transition-all text-virtual-text"
                placeholder="65.0"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-virtual-text-muted mb-2 ml-1">Age</label>
              <input
                type="number"
                required
                value={formData.age}
                onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                className="w-full bg-virtual-input-bg border border-virtual-border rounded-xl px-4 py-3 focus:border-virtual-accent/50 outline-none transition-all text-virtual-text"
                placeholder="45"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-virtual-text-muted mb-2 ml-1">Gender</label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                className="w-full bg-virtual-input-bg border border-virtual-border rounded-xl px-4 py-3 focus:border-virtual-accent/50 outline-none transition-all appearance-none text-virtual-text"
              >
                {['Male', 'Female', 'Other'].map(g => (
                  <option key={g} value={g} className="bg-virtual-bg">{g}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-virtual-text-muted mb-2 ml-1">Blood Group</label>
              <select
                value={formData.blood_group}
                onChange={(e) => setFormData({ ...formData, blood_group: e.target.value })}
                className="w-full bg-virtual-input-bg border border-virtual-border rounded-xl px-4 py-3 focus:border-virtual-accent/50 outline-none transition-all appearance-none text-virtual-text"
              >
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                  <option key={bg} value={bg} className="bg-virtual-bg">{bg}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-widest text-virtual-text-muted mb-2 ml-1">Allergies</label>
              <textarea
                value={formData.allergies}
                onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                className="w-full bg-virtual-input-bg border border-virtual-border rounded-xl px-4 py-3 focus:border-virtual-accent/50 outline-none transition-all h-20 text-virtual-text"
                placeholder="e.g. Penicillin, Peanuts"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-virtual-text-muted mb-2 ml-1">Chronic Conditions</label>
              <textarea
                value={formData.chronic_conditions}
                onChange={(e) => setFormData({ ...formData, chronic_conditions: e.target.value })}
                className="w-full bg-virtual-input-bg border border-virtual-border rounded-xl px-4 py-3 focus:border-virtual-accent/50 outline-none transition-all h-20 text-virtual-text"
                placeholder="e.g. Diabetes, Hypertension"
              />
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <NeonButton variant="outline" className="flex-1" onClick={onCancel}>Cancel</NeonButton>
            <NeonButton className="flex-1" disabled={loading}>
              {loading ? <Loader2 className="animate-spin mx-auto" /> : 'Register Patient'}
            </NeonButton>
          </div>
        </form>
      </GlassCard>
    </div>
  );
}

function TodayAppointments({ user, onBack }: { user: UserType, onBack: () => void }) {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAppointments = async () => {
      try {
        const url = user.role === 'doctor' ? `/api/appointments?doctor_name=${encodeURIComponent(user.name)}` : '/api/appointments';
        const res = await fetch(url);
        const data = await res.json();
        setAppointments(data);
      } catch (error) {
        console.error('Error fetching appointments:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchAppointments();
  }, [user]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-2xl mx-auto"
    >
      <GlassCard className="p-8">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={onBack} className="p-2 hover:bg-virtual-input-bg rounded-lg">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold">Today's Appointments</h1>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-virtual-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : appointments.length === 0 ? (
          <div className="text-center py-12 text-virtual-text-muted">
            <Calendar size={48} className="mx-auto mb-4 opacity-20" />
            <p className="text-virtual-text">No appointments scheduled for today.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {appointments.map((appt, idx) => (
              <div key={`appt-view-${idx}`} className="p-4 rounded-2xl bg-virtual-input-bg border border-virtual-border flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-virtual-accent/10 flex items-center justify-center text-virtual-accent font-bold">
                    {appt.time}
                  </div>
                  <div>
                    <p className="font-bold text-lg text-virtual-text">{appt.patient_name}</p>
                    <p className="text-xs text-virtual-text-muted uppercase tracking-widest">{appt.reason}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-virtual-text-dim uppercase tracking-widest">Doctor</p>
                  <p className="text-xs font-medium text-virtual-accent">{appt.doctor_name}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </motion.div>
  );
}

function AppointmentForm({ onComplete, onCancel }: { onComplete: () => void, onCancel: () => void }) {
  const [formData, setFormData] = useState({
    patientId: '',
    patientName: '',
    time: '',
    reason: '',
    doctor: '',
    sendReminder: true
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [doctors, setDoctors] = useState<{ name: string }[]>([]);
  const [patientsList, setPatientsList] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [showPatientResults, setShowPatientResults] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const defaultDoctors = [
    { name: 'Dr. Rajesh Kumar' },
    { name: 'Dr. Priya Sharma' },
    { name: 'Dr. Amit Patel' },
    { name: 'Dr. Sneha Reddy' },
    { name: 'Dr. Vikram Singh' },
    { name: 'Dr. Anjali Gupta' },
    { name: 'Dr. Sanjay Verma' },
    { name: 'Dr. Meera Iyer' },
    { name: 'Dr. Arjun Malhotra' },
    { name: 'Dr. Kavita Rao' }
  ];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowPatientResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [docsRes, patientsRes] = await Promise.all([
          fetch('/api/doctors'),
          fetch('/api/patients')
        ]);
        const docs = await docsRes.json();
        const pts = await patientsRes.json();
        
        // Merge default doctors with system doctors, ensuring no duplicates
        const allDocs = [...defaultDoctors];
        docs.forEach((d: { name: string }) => {
          if (!allDocs.find(ad => ad.name === d.name)) {
            allDocs.push(d);
          }
        });
        
        setDoctors(allDocs);
        setPatientsList(pts);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };
    fetchData();
  }, []);

  const filteredPatients = patientSearch.length >= 2 
    ? patientsList.filter(p => 
        p.name.toLowerCase().includes(patientSearch.toLowerCase()) || 
        p.id.toString().includes(patientSearch)
      )
    : [];

  const handleSelectPatient = (p: Patient) => {
    setSelectedPatient(p);
    setFormData({ ...formData, patientId: p.id.toString(), patientName: p.name });
    setPatientSearch(p.name);
    setShowPatientResults(false);
  };

  const handleResetPatient = () => {
    setSelectedPatient(null);
    setFormData({ ...formData, patientId: '', patientName: '' });
    setPatientSearch('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: formData.patientId ? parseInt(formData.patientId) : null,
          patientName: formData.patientName,
          doctorName: formData.doctor,
          time: formData.time,
          reason: formData.reason,
          sendReminder: formData.sendReminder
        })
      });
      
      if (!res.ok) throw new Error('Failed to save appointment');

      // Store appointment in Firestore database
      syncAppointmentToFirestore({
        patient_name: formData.patientName,
        doctor_name: formData.doctor,
        time: formData.time,
        reason: formData.reason,
        date: new Date().toISOString().split('T')[0],
        status: 'pending'
      });
      
      onComplete();
    } catch (error: any) {
      setFormError(error?.message || 'Error saving appointment. Please check connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-md mx-auto"
    >
      <GlassCard className="p-8">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={onCancel} className="p-2 hover:bg-virtual-glass-bg rounded-lg text-virtual-text">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold">New Appointment</h1>
        </div>

        {formError && (
          <div className="p-3 mb-4 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl">
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="relative" ref={searchRef}>
            <label className="block text-xs font-bold uppercase tracking-widest text-virtual-text-muted mb-2 flex justify-between items-center">
              Patient Selection
              {selectedPatient && (
                <span className="flex items-center gap-1 text-[10px] text-emerald-400 normal-case tracking-normal">
                  <CheckCircle2 size={10} /> Linked to ID: #{selectedPatient.id}
                </span>
              )}
            </label>
            
            <div className="relative">
              <input 
                required
                type="text"
                value={patientSearch}
                onChange={e => {
                  setPatientSearch(e.target.value);
                  setFormData({ ...formData, patientName: e.target.value, patientId: '' });
                  setSelectedPatient(null);
                  setShowPatientResults(true);
                }}
                onFocus={() => setShowPatientResults(true)}
                className="w-full bg-virtual-input-bg border border-virtual-border rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500/50 transition-all pr-10"
                placeholder="Search by name or weight..."
              />
              {selectedPatient ? (
                <button 
                  type="button"
                  onClick={handleResetPatient}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-virtual-text-dim hover:text-virtual-text-muted"
                >
                  <X size={16} />
                </button>
              ) : (
                <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-virtual-text-dim" />
              )}
            </div>

            <AnimatePresence>
              {showPatientResults && filteredPatients.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute z-50 left-0 right-0 mt-2 bg-virtual-card border border-virtual-border rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto"
                >
                  {filteredPatients.map((p, idx) => (
                    <button
                      key={p.id ? `search-p-${p.id}` : `search-p-idx-${idx}`}
                      type="button"
                      onClick={() => handleSelectPatient(p)}
                      className="w-full px-4 py-3 text-left hover:bg-virtual-input-bg border-b border-virtual-border last:border-0 flex justify-between items-center group"
                    >
                      <div>
                        <p className="text-sm font-bold text-virtual-text group-hover:text-emerald-400 transition-colors">{p.name}</p>
                        <p className="text-[10px] text-virtual-text-muted">{p.weight ? `${p.weight} kg` : 'N/A'}</p>
                      </div>
                      <span className="text-[10px] font-mono text-virtual-text-dim group-hover:text-virtual-text-muted">#{p.id}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
            
            {!selectedPatient && patientSearch.length > 0 && (
              <p className="mt-2 text-[10px] text-virtual-text-dim italic">
                {filteredPatients.length === 0 ? "No patient found. Creating as new record." : "Continue typing to create new, or select from results."}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-virtual-text-muted mb-2">Time</label>
              <input 
                required
                type="time"
                value={formData.time}
                onChange={e => setFormData({ ...formData, time: e.target.value })}
                className="w-full bg-virtual-input-bg border border-virtual-border rounded-xl px-4 py-3 focus:outline-none focus:border-virtual-accent/50 transition-all text-virtual-text"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-virtual-text-muted mb-2">Doctor</label>
              <select 
                required
                value={formData.doctor}
                onChange={e => setFormData({ ...formData, doctor: e.target.value })}
                className="w-full bg-virtual-input-bg border border-virtual-border rounded-xl px-4 py-3 focus:outline-none focus:border-virtual-accent/50 transition-all text-virtual-text"
              >
                <option value="" disabled className="bg-virtual-bg">Select Doctor</option>
                {doctors.map((doc, idx) => (
                  <option key={`doc-opt-${idx}`} value={doc.name} className="bg-virtual-bg">{doc.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-virtual-text-muted mb-2">Reason for Visit</label>
            <textarea 
              required
              value={formData.reason}
              onChange={e => setFormData({ ...formData, reason: e.target.value })}
              className="w-full bg-virtual-input-bg border border-virtual-border rounded-xl px-4 py-3 focus:outline-none focus:border-virtual-accent/50 transition-all h-24 resize-none text-virtual-text"
              placeholder="Brief description..."
            />
          </div>

          <div className="flex items-center gap-3">
            <input 
              type="checkbox"
              id="sendReminder"
              checked={formData.sendReminder}
              onChange={e => setFormData({ ...formData, sendReminder: e.target.checked })}
              className="w-5 h-5 rounded border-virtual-border bg-virtual-input-bg text-virtual-accent focus:ring-virtual-accent/50"
            />
            <label htmlFor="sendReminder" className="text-sm text-virtual-text-muted cursor-pointer">
              Send automatic in-app reminder
            </label>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-2xl bg-virtual-accent text-white font-bold hover:bg-virtual-accent/80 transition-all shadow-lg shadow-virtual-accent/20 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <>
                <Calendar size={20} />
                Confirm Appointment
              </>
            )}
          </button>
        </form>
      </GlassCard>
    </motion.div>
  );
}

function LabReportScanner({ user, onComplete, onCancel, setToast, initialPatient }: { user: UserType, onComplete: () => void, onCancel: () => void, setToast: (t: any) => void, initialPatient?: any }) {
  const [step, setStep] = useState<'upload' | 'processing' | 'review'>('upload');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [image, setImage] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        processDocument(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const processDocument = async (base64: string) => {
    setStep('processing');
    setLoadingProgress(20);

    // Check for QR Code first
    try {
      const qrText = await extractQrFromImage(base64);
      if (qrText) {
        console.log("QR detected in lab scanner:", qrText);
        let qrData: any = null;
        try {
          if (qrText.startsWith('{')) {
            qrData = JSON.parse(qrText);
          } else if (qrText.startsWith('http')) {
            const url = new URL(qrText);
            const dataParam = url.searchParams.get('data');
            if (dataParam) {
              qrData = JSON.parse(decodeURIComponent(escape(atob(dataParam))));
            }
          }
        } catch (e) {
          console.warn("Failed to parse QR in lab scanner", e);
        }

        if (qrData) {
          setExtractedData({
            documentType: 'Digital Record',
            patientInfo: {
              name: qrData.name || qrData.patientName || 'Unknown',
              age: qrData.age || 0,
              weight: qrData.weight || 0
            },
            extractedData: qrData,
            summary: 'Data extracted from digital QR record.'
          });
          setLoadingProgress(100);
          setStep('review');
          return;
        }
      }
    } catch (qrErr) {
      console.warn("QR check failed in lab scanner", qrErr);
    }

    try {
      setLoadingProgress(40);
      const data = await extractMedicalDocumentData(base64);
      
      // Ensure patientInfo exists
      if (data && !data.patientInfo) {
        data.patientInfo = { name: 'Unknown Patient' };
      }
      
      setLoadingProgress(100);
      setExtractedData(data);
      setStep('review');
    } catch (error: any) {
      console.error("Error processing lab report:", error);
      setToast({ message: error.message || 'Error processing lab report. Please try again with a clearer image.', type: 'error' });
      setStep('upload');
    }
  };

  const handleSave = async () => {
    setStep('processing');
    try {
      const pName = initialPatient?.name || (extractedData.patientInfo?.name && !['Unknown', 'N/A', 'Unknown Patient'].includes(extractedData.patientInfo.name) ? extractedData.patientInfo.name : 'Unknown');
      const content = `LAB REPORT SCAN RECORD\n----------------------------\nType: ${extractedData.documentType || 'Lab Report'}\nPatient: ${pName}\nWeight: ${extractedData.patientInfo?.weight || 'N/A'} kg\nBP: ${extractedData.patientInfo?.bp || 'N/A'}\nSummary: ${extractedData.summary}\nMetrics: ${JSON.stringify(extractedData.extractedData, null, 2)}`;

      await fetch('/api/pending-lab-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: initialPatient?.id || extractedData.patientInfo?.id || 1,
          patient_name: pName === 'Unknown' ? (initialPatient?.name || 'Unknown Patient') : pName,
          staff_id: user.username,
          staff_name: user.name,
          content: content,
          image_data: image
        })
      });

      onComplete();
    } catch (error) {
      setToast({ message: 'Error saving lab report. Please check the network connection.', type: 'error' });
      setStep('review');
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <AnimatePresence mode="wait">
        {step === 'upload' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="text-center space-y-6"
          >
            <div className="flex items-center gap-4 mb-8">
              <button onClick={onCancel} className="p-2 hover:bg-virtual-glass-bg rounded-lg text-virtual-text">
                <ArrowLeft size={20} />
              </button>
              <h1 className="text-2xl font-bold">Scan Lab Report</h1>
            </div>

            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-virtual-border rounded-3xl p-12 hover:border-virtual-purple/50 hover:bg-virtual-purple/5 transition-all cursor-pointer group"
            >
              <div className="w-16 h-16 rounded-full bg-virtual-purple/10 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <FlaskConical size={32} className="text-virtual-purple" />
              </div>
              <h3 className="text-lg font-semibold mb-1 text-virtual-text">Upload Blood Test or X-Ray</h3>
              <p className="text-xs text-virtual-text-muted">AI will extract key metrics and findings</p>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="image/*" 
                className="hidden" 
              />
            </div>
          </motion.div>
        )}

        {step === 'processing' && (
          <motion.div
            key="processing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-20 space-y-6"
          >
            <div className="relative w-24 h-24 mx-auto">
              <div className="absolute inset-0 border-4 border-virtual-purple/20 rounded-full" />
              <div className="absolute inset-0 border-4 border-virtual-purple border-t-transparent rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Brain size={32} className="text-virtual-purple animate-pulse" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-virtual-text">AI Analyzing Lab Report...</h2>
            <div className="max-w-xs mx-auto space-y-4">
              <div className="w-full bg-virtual-input-bg rounded-full h-1.5 overflow-hidden">
                <motion.div 
                  className="bg-virtual-purple h-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${loadingProgress}%` }}
                />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-virtual-text-muted">{loadingProgress < 40 ? 'Scanning document structure...' : loadingProgress < 80 ? 'Extracting clinical values...' : 'Generating summary...'}</p>
              </div>
            </div>
          </motion.div>
        )}

        {step === 'review' && (
          <motion.div
            key="review"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold flex items-center gap-3">
                <CheckCircle2 className="text-emerald-400" /> Review Extraction
              </h2>
              <div className="px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] uppercase font-bold tracking-widest">
                Lab Report
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <GlassCard className="space-y-4 border-l-4 border-l-purple-500">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-purple-400" />
                  <h3 className="text-sm font-bold uppercase tracking-widest text-virtual-text-muted">Clinical Summary</h3>
                </div>
                <p className="text-sm leading-relaxed text-virtual-text italic">
                  "{extractedData?.summary}"
                </p>
              </GlassCard>

              <GlassCard className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-widest text-virtual-text-muted">Extracted Metrics</h3>
                <div className="space-y-3">
                  {Array.isArray(extractedData?.extractedData) ? (
                    extractedData.extractedData.map((item: any, idx: number) => (
                      <div key={`lab-metric-${idx}`} className="p-3 rounded-xl bg-virtual-input-bg border border-virtual-border space-y-1">
                        <div className="flex justify-between items-start">
                          <span className="text-xs font-bold text-virtual-text">{item.metric}</span>
                          <span className={`text-xs font-bold ${
                            item.interpretation?.toLowerCase() === 'high' ? 'text-red-400' :
                            item.interpretation?.toLowerCase() === 'low' ? 'text-blue-400' :
                            'text-emerald-400'
                          }`}>
                            {item.value} {item.unit}
                          </span>
                        </div>
                        {item.referenceRange && (
                          <p className="text-[10px] text-virtual-text-dim">Ref: {item.referenceRange}</p>
                        )}
                      </div>
                    ))
                  ) : (
                    Object.entries(extractedData?.extractedData || {}).map(([key, value]: [string, any]) => (
                      <div key={key} className="flex justify-between items-center p-2 rounded-lg bg-virtual-input-bg border border-virtual-border">
                        <span className="text-xs text-virtual-text-muted capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                        <span className="text-xs font-bold text-virtual-text">{String(value)}</span>
                      </div>
                    ))
                  )}
                  {(!extractedData?.extractedData || (Array.isArray(extractedData.extractedData) && extractedData.extractedData.length === 0)) && (
                    <p className="text-xs text-virtual-text-dim text-center py-4">No specific metrics extracted.</p>
                  )}
                </div>
              </GlassCard>
            </div>

            <div className="flex gap-4 pt-6">
              <button 
                onClick={() => setStep('upload')}
                className="flex-1 py-4 rounded-2xl bg-virtual-input-bg border border-virtual-border text-virtual-text font-bold hover:bg-virtual-glass-bg transition-all"
              >
                Rescan
              </button>
              <button 
                onClick={handleSave}
                className="flex-1 py-4 rounded-2xl bg-virtual-purple text-white font-bold hover:bg-virtual-purple/80 transition-all shadow-lg shadow-virtual-purple/20"
              >
                Store in Pending Labs
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MedicalDocumentScanner({ user, onComplete, onCancel, setToast }: { user: UserType, onComplete: () => void, onCancel: () => void, setToast: (t: any) => void }) {
  const [step, setStep] = useState<'upload' | 'processing' | 'review'>('upload');
  const [image, setImage] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        processDocument(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const processDocument = async (base64: string) => {
    setStep('processing');

    // Check for QR Code first
    try {
      const qrText = await extractQrFromImage(base64);
      if (qrText) {
        console.log("QR detected in medical document scanner:", qrText);
        let qrData: any = null;
        try {
          if (qrText.startsWith('{')) {
            qrData = JSON.parse(qrText);
          } else if (qrText.startsWith('http')) {
            const url = new URL(qrText);
            const dataParam = url.searchParams.get('data');
            if (dataParam) {
              qrData = JSON.parse(decodeURIComponent(escape(atob(dataParam))));
            }
          }
        } catch (e) {
          console.warn("Failed to parse QR in medical document scanner", e);
        }

        if (qrData) {
          setExtractedData({
            documentType: 'Digital Record',
            patientInfo: {
              name: qrData.name || qrData.patientName || 'Unknown',
              age: qrData.age || 0,
              weight: qrData.weight || 0
            },
            extractedData: qrData,
            summary: 'Data extracted from digital QR record.'
          });
          setStep('review');
          return;
        }
      }
    } catch (qrErr) {
      console.warn("QR check failed in medical document scanner", qrErr);
    }

    try {
      const data = await extractMedicalDocumentData(base64);
      
      // Ensure patientInfo exists
      if (data && !data.patientInfo) {
        data.patientInfo = { name: 'Unknown Patient' };
      }
      
      setExtractedData(data);
      setStep('review');
    } catch (error: any) {
      console.error("Error processing document:", error);
      setToast({ message: error.message || 'Error processing document. Please try again with a clearer image.', type: 'error' });
      setStep('upload');
    }
  };

  const handleSave = async () => {
    setStep('processing');
    try {
      // 1. Create or Update Patient
      const pRes = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: (extractedData.patientInfo?.name && !['Unknown', 'N/A', 'Unknown Patient'].includes(extractedData.patientInfo.name)) ? extractedData.patientInfo.name : 'Unknown Patient',
          age: extractedData.patientInfo?.age || 0,
          weight: extractedData.patientInfo?.weight || 0,
          allergies: '',
          chronic_conditions: ''
        })
      });
      const pData = await pRes.json();
      const pid = pData.id;

      // 2. Save document data as an alert/note for now
      await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: pid,
          type: extractedData.documentType || 'Document Scan',
          message: `AI Extracted Summary: ${extractedData.summary}. Details: ${JSON.stringify(extractedData.extractedData)}`
        })
      });

      // 3. Save to Private Data if Nurse
      if (user.role === 'nurse') {
        await fetch('/api/private-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            staff_id: user.username,
            staff_name: user.name,
            content: `MEDICAL DOCUMENT SCAN RECORD\n----------------------------\nType: ${extractedData.documentType}\nPatient: ${extractedData.patientInfo?.name || 'Unknown'}\nWeight: ${extractedData.patientInfo?.weight || 'N/A'} kg\nAge: ${extractedData.patientInfo?.age || 'N/A'}\nBP: ${extractedData.patientInfo?.bp || 'N/A'}\nBlood Group: ${extractedData.patientInfo?.bloodGroup || 'N/A'}\nSummary: ${extractedData.summary}\nDetails: ${JSON.stringify(extractedData.extractedData, null, 2)}`
          })
        });
      }

      onComplete();
    } catch (error) {
      setToast({ message: 'Error saving record. Please try again.', type: 'error' });
      setStep('review');
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <AnimatePresence mode="wait">
        {step === 'upload' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="text-center space-y-6"
          >
            <div className="flex items-center gap-4 mb-8">
              <button onClick={onCancel} className="p-2 hover:bg-virtual-input-bg rounded-lg">
                <ArrowLeft size={20} />
              </button>
              <h1 className="text-2xl font-bold">New Patient Scan & Store</h1>
            </div>

            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-virtual-border rounded-3xl p-12 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all cursor-pointer group"
            >
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <Camera size={32} className="text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold mb-1">Scan Document</h3>
              <p className="text-xs text-virtual-text-muted">Prescriptions, Reports, or ID Cards</p>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="image/*" 
                className="hidden" 
              />
            </div>
          </motion.div>
        )}

        {step === 'processing' && (
          <motion.div
            key="processing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20 space-y-4"
          >
            <Loader2 size={48} className="animate-spin text-emerald-400 mx-auto" />
            <h2 className="text-xl font-semibold">AI Extracting Data...</h2>
            <p className="text-white/40">Analyzing document structure and content</p>
          </motion.div>
        )}

        {step === 'review' && extractedData && (
          <motion.div
            key="review"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Review Extracted Data</h2>
              <div className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-[10px] font-bold border border-emerald-500/30">
                {extractedData.documentType}
              </div>
            </div>

            <GlassCard hover={false}>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-virtual-text-muted mb-1">Patient Name</label>
                    <input 
                      type="text"
                      value={extractedData.patientInfo?.name || ''}
                      onChange={(e) => setExtractedData({
                        ...extractedData,
                        patientInfo: { ...extractedData.patientInfo, name: e.target.value }
                      })}
                      className="w-full bg-virtual-input-bg border border-virtual-border rounded-xl px-4 py-2 text-sm text-virtual-text"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-virtual-text-muted mb-1">Age</label>
                    <input 
                      type="number"
                      value={extractedData.patientInfo?.age || ''}
                      onChange={(e) => setExtractedData({
                        ...extractedData,
                        patientInfo: { ...extractedData.patientInfo, age: parseInt(e.target.value) }
                      })}
                      className="w-full bg-virtual-input-bg border border-virtual-border rounded-xl px-4 py-2 text-sm text-virtual-text"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-virtual-text-muted mb-1">Blood Group</label>
                    <input 
                      type="text"
                      value={extractedData.patientInfo?.bloodGroup || ''}
                      onChange={(e) => setExtractedData({
                        ...extractedData,
                        patientInfo: { ...extractedData.patientInfo, bloodGroup: e.target.value }
                      })}
                      className="w-full bg-virtual-input-bg border border-virtual-border rounded-xl px-4 py-2 text-sm text-virtual-text"
                    />
                  </div>
                </div>

                <div className="bg-virtual-input-bg p-4 rounded-2xl border border-virtual-border border-l-4 border-l-emerald-500">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText size={14} className="text-emerald-400" />
                    <label className="block text-[10px] uppercase tracking-widest text-virtual-text-muted">Clinical Summary</label>
                  </div>
                  <p className="text-sm text-virtual-text italic leading-relaxed">
                    "{extractedData.summary}"
                  </p>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-virtual-text-muted mb-1">Extracted Details</label>
                  {Array.isArray(extractedData.extractedData) ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {extractedData.extractedData.map((item: any, idx: number) => (
                        <div key={`vault-metric-${idx}`} className="p-2 rounded-lg bg-virtual-input-bg border border-virtual-border flex justify-between items-center">
                          <span className="text-[10px] text-virtual-text-muted">{item.metric}</span>
                          <span className="text-[10px] font-bold text-emerald-400">{item.value} {item.unit}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <pre className="text-[10px] text-emerald-400/80 bg-virtual-input-bg p-3 rounded-xl border border-virtual-border overflow-x-auto">
                      {JSON.stringify(extractedData.extractedData, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            </GlassCard>

            <div className="flex gap-3">
              <NeonButton variant="outline" className="flex-1" onClick={() => setStep('upload')}>Rescan</NeonButton>
              <NeonButton className="flex-1" onClick={handleSave}>Confirm & Store</NeonButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


function PrivateVault({ 
  user, 
  unlocked, 
  setUnlocked, 
  onBack, 
  onSelectPatient, 
  filterPatientId, 
  initialSearchQuery = '',
  initialScannedId = null,
  offlineMode = false,
  fetchStats
}: { 
  user: UserType, 
  unlocked: boolean, 
  setUnlocked: (u: boolean) => void, 
  onBack: () => void,
  onSelectPatient: (id: number, tab?: 'timeline' | 'vitals' | 'alerts' | 'insights' | 'private') => void,
  filterPatientId?: number,
  initialSearchQuery?: string,
  initialScannedId?: string | null,
  offlineMode?: boolean,
  fetchStats?: () => void
}) {
  const [password, setPassword] = useState('');
  const [data, setData] = useState<PrivateData[]>([]);
  const [allData, setAllData] = useState<PrivateData[]>([]);
  const allDataRef = useRef<PrivateData[]>([]);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [loading, setLoading] = useState(false);
  const [editingItem, setEditingItem] = useState<PrivateData | null>(null);
  const [editContent, setEditContent] = useState('');
  const [selectedQrItem, setSelectedQrItem] = useState<PrivateData | null>(null);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualData, setManualData] = useState({ patientName: '', patientId: filterPatientId?.toString() || '', age: '', weight: '', bp: '', bloodGroup: '', details: '' });
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanMode, setScanMode] = useState<'camera' | 'file' | null>(null);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [lastScannedPatientId, setLastScannedPatientId] = useState<string | null>(initialScannedId);
  const [isSyncing, setIsSyncing] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    allDataRef.current = allData;
  }, [allData]);

  useEffect(() => {
    if (!unlocked) {
      setSearchQuery('');
      setLastScannedPatientId(null);
    }
  }, [unlocked]);

  const filteredData = (searchQuery ? allData : data).filter(item => {
    const rawQuery = searchQuery.trim();
    const query = rawQuery.toLowerCase();
    
    // If we have a scanned ID, match if ID pattern is found
    if (lastScannedPatientId) {
      const idPattern = new RegExp(`(patient id|id)\\s*:\\s*${lastScannedPatientId}(\\s|\\n|\\r|,|\\.|$)`, 'i');
      if (idPattern.test(item.content)) return true;
      if (item.content.toLowerCase().includes(`id: ${lastScannedPatientId.toLowerCase()}`)) return true;
    }

    if (!query) return true;

    const contentLower = item.content.toLowerCase();
    const staffNameLower = item.staff_name.toLowerCase();
    const staffIdLower = item.staff_id.toLowerCase();
    
    // Direct substring match
    if (contentLower.includes(query) || staffNameLower.includes(query) || staffIdLower.includes(query)) {
      return true;
    }

    // Check if query is a numeric ID
    const isIdQuery = /^\d+$/.test(query);
    if (isIdQuery) {
      const idRegex = new RegExp(`(patient id|id)\\s*:\\s*${query}(\\s|\\n|\\r|,|\\.|$)`, 'i');
      if (idRegex.test(item.content)) return true;
    }

    // Clean query words for patient name matching (e.g. "Dr. Aarav Sharma" -> ["aarav", "sharma"])
    const cleanQuery = query.replace(/^(mr\.|mrs\.|ms\.|dr\.)\s*/i, '');
    if (contentLower.includes(cleanQuery)) return true;

    const words = cleanQuery.split(/\s+/).filter(w => w.length >= 2);
    if (words.length > 1) {
      const matchesAll = words.every(w => contentLower.includes(w) || staffNameLower.includes(w));
      if (matchesAll) return true;
    }

    return false;
  }).sort((a, b) => {
    const query = searchQuery.toLowerCase().trim();
    
    // 1. Prioritize last scanned patient ID if it exists
    if (lastScannedPatientId) {
      const aIdMatch = a.content.toLowerCase().includes(`patient id: ${lastScannedPatientId.toLowerCase()}`);
      const bIdMatch = b.content.toLowerCase().includes(`patient id: ${lastScannedPatientId.toLowerCase()}`);
      if (aIdMatch && !bIdMatch) return -1;
      if (!aIdMatch && bIdMatch) return 1;
    }

    if (!query) return 0;

    // 2. Prioritize exact or strong patient name match in content
    const aLower = a.content.toLowerCase();
    const bLower = b.content.toLowerCase();
    const cleanQ = query.replace(/^(mr\.|mrs\.|ms\.|dr\.)\s*/i, '');
    
    const aExact = aLower.includes(`patient: ${cleanQ}`) || aLower.includes(`name: ${cleanQ}`) || aLower.includes(cleanQ);
    const bExact = bLower.includes(`patient: ${cleanQ}`) || bLower.includes(`name: ${cleanQ}`) || bLower.includes(cleanQ);
    
    if (aExact && !bExact) return -1;
    if (!aExact && bExact) return 1;
    
    // 3. Then prioritize ID matches if it's an ID query
    if (/^\d+$/.test(query)) {
      const aIdMatch = aLower.includes(`patient id: ${query}`);
      const bIdMatch = bLower.includes(`patient id: ${query}`);
      if (aIdMatch && !bIdMatch) return -1;
      if (!aIdMatch && bIdMatch) return 1;
    }

    return 0;
  });

  const toggleExpand = (id: number) => {
    const newSet = new Set(expandedItems);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedItems(newSet);
  };

  const fetchPrivateData = async () => {
    setLoading(true);
    try {
      let items: PrivateData[] = [];
      
      if (!offlineMode) {
        const res = await fetch(`/api/private-data?staff_id=${user.username}&role=${user.role}`);
        if (res.ok) {
          items = await res.json();
        }
      }
      
      // Add offline data
      const offlinePrescriptions = JSON.parse(localStorage.getItem('offlinePrescriptions') || '[]');
      const offlineItems = offlinePrescriptions.map((p: any, idx: number) => ({
        id: -(idx + 1), // Negative IDs for offline items
        staff_id: p.staff_id,
        staff_name: p.staff_name,
        content: p.content,
        timestamp: p.timestamp,
        isOffline: true
      }));
      
      const combinedItems = [...offlineItems, ...items].sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      
      setAllData(combinedItems);
      
      // Filter by patient ID if provided
      if (filterPatientId) {
        const filtered = combinedItems.filter((item: PrivateData) => {
          const lines = item.content.split('\n');
          return lines.some(line => line.includes(`Patient ID: ${filterPatientId}`));
        });
        setData(filtered);
      } else {
        setData(combinedItems);
      }
    } catch (error) {
      console.error('Error fetching private data:', error);
      setToast({ message: 'Error loading private data vault.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (unlocked) {
      fetchPrivateData();
    }
  }, [unlocked, filterPatientId]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'inba@123') {
      setUnlocked(true);
      setToast({ message: 'Vault Unlocked Successfully', type: 'success' });
    } else {
      setToast({ message: 'Incorrect Password', type: 'error' });
    }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/private-data/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchPrivateData();
      }
    } finally {
      setDeletingId(null);
    }
  };

  const handleUpdate = async () => {
    if (!editingItem) return;
    await fetch(`/api/private-data/${editingItem.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: editContent }),
    });
    setEditingItem(null);
    fetchPrivateData();
  };

  const handleScan = async (decodedText: string) => {
    setScanSuccess(true);
    
    // Close scanner
    setIsScanning(false);
    setScanMode(null);
    
    let searchVal = '';
    let foundId: string | null = null;
    let foundName: string | null = null;
    let rawJson: any = null;

    console.log("Scanning QR in Vault:", decodedText);

    // 1. Handle JSON data (Highest priority)
    const trimmedText = decodedText.trim();
    if (trimmedText.startsWith('{')) {
      try {
        const qrData = JSON.parse(trimmedText);
        rawJson = qrData;
        foundId = qrData.id?.toString() || qrData.patientId?.toString() || qrData.patient_id?.toString() || qrData.pid?.toString() || null;
        foundName = qrData.name || qrData.patientName || qrData.patient_name || qrData.pName || qrData.patient || null;
      } catch (e) {
        console.error("Failed to parse QR JSON", e);
      }
    }
    
    // 2. Handle URLs
    if (!foundId && !foundName && (trimmedText.startsWith('http://') || trimmedText.startsWith('https://'))) {
      try {
        const url = new URL(trimmedText);
        const dataParam = url.searchParams.get('data');
        if (dataParam) {
          try {
            const decoded = JSON.parse(decodeURIComponent(escape(atob(dataParam))));
            rawJson = decoded;
            foundId = decoded.id?.toString() || decoded.patientId?.toString() || decoded.patient_id?.toString() || null;
            foundName = decoded.name || decoded.patientName || decoded.patient_name || null;
          } catch (e) {
            if (dataParam.length < 50) foundName = dataParam;
          }
        }
        
        if (!foundName) foundName = url.searchParams.get('name') || url.searchParams.get('patient') || url.searchParams.get('patientName') || url.searchParams.get('pname') || url.searchParams.get('q');
        if (!foundId) foundId = url.searchParams.get('id') || url.searchParams.get('patientId') || url.searchParams.get('pid');

        if (!foundId && !foundName) {
          const pathParts = url.pathname.split('/').filter(Boolean);
          const lastPart = pathParts[pathParts.length - 1];
          if (lastPart && /^\d+$/.test(lastPart)) {
            foundId = lastPart;
          }
        }
      } catch (e) {
        console.error("Failed to parse QR URL", e);
      }
    } 
    
    // 3. Handle Plain Text (e.g. "Patient: Aarav Sharma", "Name: Sita Devi")
    if (!foundId || !foundName) {
      const lines = trimmedText.split('\n');
      for (const rawLine of lines) {
        const line = rawLine.trim();
        const lowerLine = line.toLowerCase();
        if (!foundId && (lowerLine.startsWith('patient id:') || lowerLine.startsWith('id:') || lowerLine.includes('patient id:'))) {
          const parts = line.split(':');
          if (parts[1]) foundId = parts[1].trim();
        }
        if (!foundName && (lowerLine.startsWith('patient:') || lowerLine.startsWith('name:') || lowerLine.startsWith('patient name:'))) {
          const parts = line.split(':');
          if (parts[1]) {
            foundName = parts.slice(1).join(':').split(',')[0].replace(/^(mr\.|mrs\.|ms\.|dr\.)\s*/i, '').trim();
          }
        }
      }
    }

    // Fallback if plain number or plain patient name string
    if (!foundId && !foundName) {
      if (/^\d+$/.test(trimmedText) && trimmedText.length <= 8) {
        foundId = trimmedText;
      } else if (trimmedText.length > 1 && trimmedText.length < 60 && !trimmedText.includes('{') && !trimmedText.includes('http')) {
        foundName = trimmedText.replace(/^(mr\.|mrs\.|ms\.|dr\.)\s*/i, '').trim();
      }
    }

    // Clean foundName of leading/trailing quotes or punctuation
    if (foundName) {
      foundName = foundName.replace(/^["']|["']$/g, '').trim();
    }

    // Lookup in allDataRef.current
    let matchedItem: PrivateData | undefined;
    if (foundId && allDataRef.current.length > 0) {
      matchedItem = allDataRef.current.find(item => {
        const idPattern = new RegExp(`(patient id|id)\\s*:\\s*${foundId}(\\s|\\n|\\r|,|\\.|$)`, 'i');
        return idPattern.test(item.content);
      });
    }

    if (!matchedItem && foundName && allDataRef.current.length > 0) {
      const targetLower = foundName.toLowerCase().trim();
      matchedItem = allDataRef.current.find(item => {
        const contentLower = item.content.toLowerCase();
        return contentLower.includes(targetLower) || 
               contentLower.includes(`patient: ${targetLower}`) || 
               targetLower.split(/\s+/).every(part => part.length > 1 && contentLower.includes(part));
      });
    }

    if (matchedItem && !foundName) {
      const nameLine = matchedItem.content.split('\n').find(line => {
        const l = line.toLowerCase().trim();
        return l.startsWith('patient:') || l.startsWith('name:') || l.includes('patient name:');
      });
      if (nameLine) {
        const parts = nameLine.split(':');
        if (parts.length >= 2) {
          foundName = parts.slice(1).join(':').trim();
        }
      }
    }

    // If patient not in vault yet, auto-sync from database if online
    if (!matchedItem && (foundId || foundName) && !offlineMode) {
      try {
        let p: any = null;
        if (foundId) {
          const res = await fetch(`/api/patients/${foundId}`);
          if (res.ok) p = await res.json();
        }
        if (!p && foundName) {
          const res = await fetch(`/api/patients`);
          if (res.ok) {
            const allPatients = await res.json();
            const searchTarget = foundName.toLowerCase();
            p = allPatients.find((pt: any) => 
              pt.name?.toLowerCase().includes(searchTarget) || 
              searchTarget.includes(pt.name?.toLowerCase())
            );
          }
        }

        if (p && p.name) {
          foundName = p.name;
          foundId = String(p.id);
          const content = `SYNCED PATIENT RECORD\n---------------------\nPatient: ${p.name}\nPatient ID: ${p.id}\nAge: ${p.age}\nGender: ${p.gender || 'N/A'}\nBlood Group: ${p.blood_group || 'N/A'}\nWeight: ${p.weight || 'N/A'} kg\nAllergies: ${p.allergies || 'None'}\nConditions: ${p.chronic_conditions || 'None'}\nDate: ${new Date().toLocaleString()}`;
          await fetch('/api/private-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              staff_id: user.username,
              staff_name: user.name,
              patient_id: p.id,
              content
            })
          });
          // Also sync to Firestore
          syncPrivateDataToFirestore({
            staff_id: user.username,
            staff_name: user.name,
            patient_id: p.id,
            content
          });
          await fetchPrivateData();
        } else if (foundName) {
          // External patient QR code - register in vault automatically
          const content = `PATIENT QR RECORD\n---------------------\nPatient: ${foundName}\nPatient ID: ${foundId || 'EXTERNAL'}\nStatus: Scanned via Camera QR\nNotes: Patient record authenticated from scanned QR\nDate: ${new Date().toLocaleString()}`;
          await fetch('/api/private-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              staff_id: user.username,
              staff_name: user.name,
              patient_id: foundId ? Number(foundId) : null,
              content
            })
          });
          syncPrivateDataToFirestore({
            staff_id: user.username,
            staff_name: user.name,
            patient_id: foundId ? Number(foundId) : null,
            content
          });
          await fetchPrivateData();
        }
      } catch (err) {
        console.warn("Auto-sync patient to vault on scan failed:", err);
      }
    } else if (!matchedItem && (foundName || foundId) && offlineMode) {
      // Offline mode auto-sync
      const content = `OFFLINE PATIENT QR RECORD\n-------------------------\nPatient: ${foundName || 'Scanned Patient'}\nPatient ID: ${foundId || 'OFFLINE'}\nAge: ${rawJson?.age || 'N/A'}\nWeight: ${rawJson?.weight || 'N/A'} kg\nDate: ${new Date().toLocaleString()}`;
      const offlinePrescriptions = JSON.parse(localStorage.getItem('offlinePrescriptions') || '[]');
      offlinePrescriptions.unshift({
        staff_id: user.username,
        staff_name: user.name,
        content,
        timestamp: new Date().toISOString()
      });
      localStorage.setItem('offlinePrescriptions', JSON.stringify(offlinePrescriptions));
      await fetchPrivateData();
    }

    // Save offline prescription if scanned from offline QR with medicines
    if (rawJson && (rawJson.type === 'CLINIQ_OFFLINE' || rawJson.medicines)) {
      try {
        const offlinePrescriptions = JSON.parse(localStorage.getItem('offlinePrescriptions') || '[]');
        const exists = offlinePrescriptions.some((op: any) => 
          (foundName && op.content?.includes(foundName)) || (foundId && op.content?.includes(`Patient ID: ${foundId}`))
        );
        if (!exists) {
          const content = `OFFLINE PRESCRIPTION SCAN\n-------------------------\nPatient: ${foundName || 'Scanned Patient'}\nPatient ID: ${foundId || 'N/A'}\nAge: ${rawJson.age || 'N/A'}\nWeight: ${rawJson.weight || 'N/A'} kg\nMedicines: ${JSON.stringify(rawJson.medicines || [])}\nDate: ${new Date().toLocaleString()}`;
          offlinePrescriptions.unshift({
            staff_id: user.username,
            staff_name: user.name,
            content,
            timestamp: new Date().toISOString()
          });
          localStorage.setItem('offlinePrescriptions', JSON.stringify(offlinePrescriptions));
          await fetchPrivateData();
        }
      } catch (e) {
        console.warn("Saving offline scanned prescription failed:", e);
      }
    }

    // Choose search value
    if (foundName) {
      searchVal = foundName;
    } else if (foundId) {
      searchVal = foundId;
    } else if (decodedText.length > 30) {
      const firstLine = decodedText.split('\n')[0];
      searchVal = firstLine.replace(/patient:|name:|record:|patient name:/i, '').trim();
    } else {
      searchVal = decodedText;
    }

    if (foundId) {
      setLastScannedPatientId(foundId);
    } else {
      setLastScannedPatientId(null);
    }

    if (searchVal) {
      setSearchQuery(searchVal);
      setToast({ message: `Scanned & Searched: ${foundName || foundId || searchVal}`, type: 'success' });
      
      // Auto-expand the matched or newly synced item
      setTimeout(() => {
        const currentData = allDataRef.current;
        const toExpand = currentData.find(item => 
          (foundName && item.content.toLowerCase().includes(foundName.toLowerCase())) ||
          (foundId && item.content.toLowerCase().includes(`id: ${foundId}`))
        );
        if (toExpand) {
          setExpandedItems(prev => new Set([...prev, toExpand.id]));
        }
      }, 150);

      setTimeout(() => {
        searchInputRef.current?.focus();
        listRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      }, 200);
    }

    setTimeout(() => {
      setScanSuccess(false);
    }, 1500);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = `MANUAL PATIENT RECORD\n----------------------\nPatient: ${manualData.patientName}\nPatient ID: ${manualData.patientId || 'N/A'}\nWeight: ${manualData.weight || 'N/A'} kg\nAge: ${manualData.age}\nBP: ${manualData.bp || 'N/A'}\nBlood Group: ${manualData.bloodGroup || 'N/A'}\nDetails: ${manualData.details}\nDate: ${new Date().toLocaleString()}`;
    
    if (offlineMode) {
      const newItem: PrivateData = {
        id: Date.now(),
        staff_id: user.username,
        staff_name: user.name,
        content,
        created_at: new Date().toISOString()
      };
      setAllData([newItem, ...allData]);
      setData([newItem, ...data]);
      setToast({ message: 'Record saved locally (Offline).', type: 'success' });
    } else {
      // Also create a patient record if it doesn't exist to ensure they show in stats
      try {
        await fetch('/api/patients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: manualData.patientName,
            age: parseInt(manualData.age) || 0,
            weight: manualData.weight || 0,
            gender: 'Unknown',
            blood_group: manualData.bloodGroup || 'Unknown'
          })
        });
      } catch (e) {
        console.warn("Failed to create patient record for manual entry:", e);
      }

      await fetch('/api/private-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: user.username,
          staff_name: user.name,
          patient_id: manualData.patientId ? parseInt(manualData.patientId) : null,
          content
        })
      });
      fetchPrivateData();
      if (fetchStats) fetchStats(); // Update dashboard stats
    }
    
    setShowManualForm(false);
    setManualData({ patientName: '', patientId: '', age: '', weight: '', bp: '', bloodGroup: '', details: '' });
  };



  const renderContent = (item: PrivateData) => {
    const content = item.content;
    const lines = content.split('\n');
    let patientId: number | null = null;
    let patientName = '';

    // Try to extract Patient ID and Name
    lines.forEach(line => {
      if (line.startsWith('Patient ID:')) {
        const idStr = line.replace('Patient ID:', '').trim();
        if (idStr !== 'N/A') patientId = parseInt(idStr);
      }
      if (line.startsWith('Patient:')) {
        patientName = line.replace('Patient:', '').trim();
      }
    });

    const isSyncedRecord = content.includes('SYNCED PATIENT RECORD');
    const isManualRecord = content.includes('MANUAL PATIENT RECORD');

    // Clean content for display (remove the "MANUAL PATIENT RECORD" header)
    const displayContent = isManualRecord 
      ? lines.slice(2).join('\n') 
      : content;

    if (patientName || patientId) {
      const isExpanded = expandedItems.has(item.id) || filterPatientId;

      // Helper to expand medical abbreviations
      const expandFrequency = (freq: string) => {
        if (!freq || freq === 'null') return '';
        const f = freq.toUpperCase().trim();
        if (f === 'SOS') return 'when needed';
        if (f === 'TID' || f === '1+1+1') return '3 times daily';
        if (f === 'BID' || f === '1+0+1') return '2 times daily';
        if (f === '0+0+1') return 'once daily (at night)';
        if (f === '1+0+0') return 'once daily (morning)';
        if (f === '0+1+0') return 'once daily (afternoon)';
        return f.toLowerCase();
      };

      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-xl bg-virtual-accent/5 border border-virtual-accent/10">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-virtual-accent/10 flex items-center justify-center text-virtual-accent font-bold text-xs">
                {patientName ? patientName[0] : '?'}
              </div>
              <div>
                <button 
                  onClick={() => patientId && onSelectPatient(patientId, 'private')}
                  className={`font-bold text-sm text-left ${patientId ? 'text-virtual-accent hover:underline' : 'text-virtual-text-muted'}`}
                  disabled={!patientId}
                >
                  {patientName || 'Unknown Patient'}
                </button>
                <div className="flex items-center gap-2">
                  {patientId && <p className="text-[10px] text-virtual-text-dim uppercase tracking-widest">System ID: {patientId}</p>}
                  {item.isOffline && (
                    <span className="px-1.5 py-0.5 rounded bg-virtual-warning/20 text-virtual-warning text-[8px] font-bold uppercase tracking-widest border border-virtual-warning/30">
                      Offline
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setSelectedQrItem(item)}
                className="p-2 rounded-lg bg-virtual-input-bg border border-virtual-border hover:bg-virtual-accent/10 hover:border-virtual-accent/50 transition-all text-virtual-accent"
                title="Generate QR for Search"
              >
                <QrCode size={14} />
              </button>
              {!filterPatientId && (
                <NeonButton 
                  onClick={() => toggleExpand(item.id)}
                  variant="outline" 
                  className="py-1 px-3 text-[10px] h-auto border-virtual-accent/30"
                >
                  {isExpanded ? 'Hide Details' : 'View Details'}
                </NeonButton>
              )}
            </div>
          </div>
          
          {/* Show content if expanded or if on patient profile */}
          {isExpanded && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-virtual-glass-bg p-6 rounded-2xl border border-virtual-accent/20 space-y-6 relative overflow-hidden"
            >
              {/* Digital Watermark */}
              <div className="absolute top-4 right-4 opacity-10 pointer-events-none">
                <Activity size={80} className="text-virtual-accent" />
              </div>

              <div className="flex items-center justify-between border-b border-virtual-border pb-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-virtual-accent animate-pulse" />
                  <span className="text-[10px] font-bold text-virtual-accent uppercase tracking-[0.2em]">Verified Digital Record</span>
                </div>
                <span className="text-[10px] text-virtual-text-dim uppercase tracking-widest">
                  {lines.find(l => l.startsWith('Synced on:'))?.split(':')[1].trim() || lines.find(l => l.startsWith('Date:'))?.split(':')[1].trim() || 'N/A'}
                </span>
              </div>

              {isSyncedRecord || isManualRecord ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] text-virtual-text-dim uppercase tracking-widest">Patient Details</p>
                      <p className="text-sm font-bold text-virtual-text">{patientName}</p>
                      <p className="text-xs text-virtual-text-muted">
                        Age: {lines.find(l => l.startsWith('Age:'))?.split(':')[1].trim() || 'N/A'} • {lines.find(l => l.startsWith('Gender:'))?.split(':')[1].trim() || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-virtual-text-dim uppercase tracking-widest">Contact Info</p>
                      <p className="text-sm text-virtual-text-muted">{lines.find(l => l.startsWith('Weight:'))?.split(':')[1].trim() || 'N/A'}</p>
                      {lines.find(l => l.startsWith('Blood Group:')) && (
                        <p className="text-xs text-virtual-text-muted">Blood: {lines.find(l => l.startsWith('Blood Group:'))?.split(':')[1].trim()}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-virtual-border">
                    <div>
                      <p className="text-[10px] text-virtual-text-dim uppercase tracking-widest mb-1">Clinical Status</p>
                      <p className="text-sm text-virtual-accent font-bold">
                        {lines.find(l => l.startsWith('Disease/Condition:'))?.split(':')[1].trim() || 'General Checkup'}
                      </p>
                      {lines.find(l => l.startsWith('BP:')) && (
                        <p className="text-xs text-virtual-accent/70">BP: {lines.find(l => l.startsWith('BP:'))?.split(':')[1].trim()}</p>
                      )}
                    </div>
                    <div className="flex flex-col justify-end items-end">
                      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-virtual-accent/10 border border-virtual-accent/20">
                        <div className="w-1.5 h-1.5 rounded-full bg-virtual-accent animate-pulse" />
                        <span className="text-[9px] font-bold text-virtual-accent uppercase tracking-wider">Verified Record</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-virtual-border">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] font-bold text-virtual-text-dim uppercase tracking-widest flex items-center gap-2">
                        <Package size={12} className="text-virtual-accent" />
                        MEDICINE NOTES
                      </h4>
                      <span className="text-[10px] text-virtual-accent/50 italic">Digital Prescription</span>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      {(() => {
                        const medMatch = content.match(/Medicines: (\[.*?\])/s);
                        if (medMatch && medMatch[1]) {
                          try {
                            const medicines = JSON.parse(medMatch[1]);
                            return medicines.map((m: any, i: number) => {
                              const freq = expandFrequency(m.frequency);
                              const dosage = m.dosage && m.dosage !== 'null' ? m.dosage : '';
                              const duration = m.duration && m.duration !== 'null' ? m.duration : '';
                              
                              return (
                                <div key={`med-item-${i}`} className="p-4 rounded-xl bg-virtual-input-bg border border-virtual-border hover:bg-virtual-glass-bg transition-all group">
                                  <div className="flex items-start justify-between">
                                    <div className="space-y-1">
                                      <p className="font-bold text-sm text-virtual-text group-hover:text-virtual-accent transition-colors">• {m.name}</p>
                                      <p className="text-xs text-virtual-text-muted ml-3 flex items-center gap-2">
                                        <span className="w-4 h-[1px] bg-virtual-accent/30" />
                                        Take {dosage} {freq ? `, ${freq}` : ''} {duration ? ` for ${duration}` : ''}
                                      </p>
                                      {m.instructions && (
                                        <p className="text-[10px] text-virtual-warning/70 ml-7 italic mt-1">
                                          Note: {m.instructions}
                                        </p>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-virtual-text-dim font-mono">#{i+1}</div>
                                  </div>
                                </div>
                              );
                            });
                          } catch (e) {
                            return <p className="text-xs text-virtual-danger">Error parsing medicines</p>;
                          }
                        }
                        return <p className="text-xs text-virtual-text-dim">No medicines found</p>;
                      })()}
                    </div>
                  </div>

                  <div className="pt-4 flex items-center justify-between border-t border-virtual-border">
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-[10px] text-virtual-text-dim uppercase tracking-widest">Doctor</p>
                        <p className="text-xs text-virtual-text-muted">{lines.find(l => l.startsWith('Doctor:'))?.split(':')[1].trim() || 'Dr. Sharma'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-virtual-text-dim uppercase tracking-widest">Last Visit</p>
                        <p className="text-xs text-virtual-text-muted">{lines.find(l => l.startsWith('Last Visit:'))?.split(':')[1].trim() || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-virtual-text-dim uppercase tracking-widest">Digital Signature</p>
                      <p className="text-[10px] font-mono text-virtual-accent/50">CLINIQ-AI-VERIFIED-{item.id}</p>
                    </div>
                  </div>
                </>
              ) : (
                <pre className="text-sm text-virtual-text font-mono whitespace-pre-wrap overflow-x-auto">
                  {displayContent}
                </pre>
              )}
            </motion.div>
          )}
        </div>
      );
    }

    return (
      <pre className="text-sm text-virtual-text bg-virtual-input-bg p-4 rounded-xl border border-virtual-border font-mono whitespace-pre-wrap overflow-x-auto">
        {displayContent}
      </pre>
    );
  };

  const [viewMode, setViewMode] = useState<'records' | 'patients'>('records');
  const [expandedPatientId, setExpandedPatientId] = useState<string | null>(null);

  const patientSummary = useMemo(() => {
    const patientsMap = new Map<string, { 
      id: string, 
      name: string, 
      count: number, 
      lastVisit: string,
      age: string,
      weight: string,
      bloodGroup: string,
      bp: string,
      records: PrivateData[]
    }>();
    
    allData.forEach(item => {
      const lines = item.content.split('\n');
      let pId = '';
      let pName = '';
      let pAge = '';
      let pWeight = '';
      let pBlood = '';
      let pBp = '';

      lines.forEach(l => {
        const lowerLine = l.toLowerCase();
        if (l.startsWith('Patient ID:')) pId = l.replace('Patient ID:', '').trim();
        if (l.startsWith('Patient:')) pName = l.replace('Patient:', '').trim();
        if (lowerLine.startsWith('age:')) pAge = l.split(':')[1]?.trim();
        if (lowerLine.startsWith('weight:')) pWeight = l.split(':')[1]?.trim();
        if (lowerLine.startsWith('blood group:')) pBlood = l.split(':')[1]?.trim();
        if (lowerLine.startsWith('bp:')) pBp = l.split(':')[1]?.trim();
      });
      
      const key = pId && pId !== 'N/A' ? `ID:${pId}` : `NAME:${pName}`;
      if (pId || pName) {
        const existing = patientsMap.get(key);
        if (existing) {
          existing.count += 1;
          existing.records.push(item);
          if (new Date(item.created_at) > new Date(existing.lastVisit)) {
            existing.lastVisit = item.created_at;
            // Update details from most recent record if available
            if (pAge) existing.age = pAge;
            if (pWeight) existing.weight = pWeight;
            if (pBlood) existing.bloodGroup = pBlood;
            if (pBp) existing.bp = pBp;
          }
        } else {
          patientsMap.set(key, {
            id: pId || 'N/A',
            name: pName || 'Unknown',
            count: 1,
            lastVisit: item.created_at,
            age: pAge || 'N/A',
            weight: pWeight || 'N/A',
            bloodGroup: pBlood || 'N/A',
            bp: pBp || 'N/A',
            records: [item]
          });
        }
      }
    });
    return Array.from(patientsMap.values()).sort((a: { count: number }, b: { count: number }) => b.count - a.count);
  }, [allData]);

  const totalPatients = patientSummary.length;

  if (!unlocked) {
    return (
      <div className="max-w-md mx-auto py-20">
        <AnimatePresence>
          {toast && (
            <Toast 
              message={toast.message} 
              type={toast.type} 
              onClose={() => setToast(null)} 
            />
          )}
        </AnimatePresence>
        <GlassCard className="text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto">
            <Lock size={32} className="text-amber-400" />
          </div>
          <h2 className="text-2xl font-bold">Private Data Vault</h2>
          <p className="text-virtual-text-muted text-sm">Enter the secure password to access private digital records.</p>
          
          <form onSubmit={handleUnlock} className="space-y-4">
            <input 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter Vault Password"
              className="w-full bg-virtual-input-bg border border-virtual-border rounded-xl px-4 py-3 focus:border-amber-500/50 outline-none transition-all text-center"
              autoFocus
            />
            <div className="flex gap-3">
              <NeonButton variant="outline" className="flex-1" onClick={onBack}>Back</NeonButton>
              <NeonButton className="flex-1 bg-amber-600/20 border-amber-500/50 text-amber-400 hover:bg-amber-600/40">Unlock Vault</NeonButton>
            </div>
          </form>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {toast && (
          <Toast 
            message={toast.message} 
            type={toast.type} 
            onClose={() => setToast(null)} 
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {selectedQrItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-md"
            >
              <GlassCard className="border-emerald-500/50">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold text-virtual-text">Patient Search QR</h3>
                  <button onClick={() => setSelectedQrItem(null)} className="p-2 hover:bg-virtual-input-bg rounded-lg text-virtual-text">
                    <X size={20} />
                  </button>
                </div>
                
                <div className="flex flex-col items-center space-y-6">
                  <div className="p-6 bg-white rounded-2xl">
                    <QRCodeCanvas 
                      value={(() => {
                        const lines = selectedQrItem.content.split('\n');
                        let pId = '';
                        let pName = '';
                        lines.forEach(l => {
                          if (l.startsWith('Patient ID:')) pId = l.replace('Patient ID:', '').trim();
                          if (l.startsWith('Patient:')) pName = l.replace('Patient:', '').trim();
                        });
                        return JSON.stringify({
                          type: 'CLINIQ_PATIENT',
                          id: pId,
                          name: pName
                        });
                      })()}
                      size={200}
                      level="H"
                    />
                  </div>
                  
                  <div className="text-center">
                    <p className="text-virtual-accent font-bold">
                      {(() => {
                        const lines = selectedQrItem.content.split('\n');
                        let pName = 'Unknown Patient';
                        lines.forEach(l => {
                          if (l.startsWith('Patient:')) pName = l.replace('Patient:', '').trim();
                        });
                        return pName;
                      })()}
                    </p>
                    <p className="text-xs text-virtual-text-dim mt-1 uppercase tracking-widest">
                      Scan this QR in the vault to instantly find this patient
                    </p>
                  </div>
                  
                  <NeonButton onClick={() => setSelectedQrItem(null)} className="w-full">
                    Close
                  </NeonButton>
                </div>
              </GlassCard>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => { onBack(); setSearchQuery(''); setLastScannedPatientId(null); }} className="p-2 hover:bg-virtual-input-bg rounded-lg">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Unlock size={24} className="text-virtual-accent" /> Private Data Vault
            <button 
              onClick={() => setViewMode(viewMode === 'records' ? 'patients' : 'records')}
              className="ml-2 px-2 py-0.5 rounded-full bg-virtual-accent/10 border border-virtual-accent/20 text-[10px] text-virtual-accent uppercase tracking-widest hover:bg-virtual-accent/20 transition-all flex items-center gap-1"
            >
              {totalPatients} Patients
              {viewMode === 'records' ? <ChevronRight size={10} /> : <X size={10} />}
            </button>
          </h1>
        </div>
        
        {/* Harmoniously Aligned Search & QR Toolbar */}
        <div className="flex items-center gap-2 flex-1 max-w-2xl">
          <div className="relative flex-1 flex items-center bg-virtual-input-bg border border-virtual-border rounded-xl px-3 py-2 focus-within:border-emerald-500/50 transition-all shadow-inner">
            <Search className="text-virtual-text-dim shrink-0 mr-2.5" size={16} />
            <input 
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (lastScannedPatientId) setLastScannedPatientId(null);
              }}
              placeholder="Search by Patient Name, ID, or Staff..."
              className="w-full bg-transparent outline-none text-sm text-virtual-text placeholder:text-virtual-text-dim/60"
            />
            {searchQuery && (
              <button 
                onClick={() => {
                  setSearchQuery('');
                  setLastScannedPatientId(null);
                }}
                className="text-virtual-text-dim hover:text-virtual-text p-1 shrink-0 transition-colors ml-1"
                title="Clear Search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Dedicated Aligned Scanning Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button 
              type="button"
              onClick={() => {
                setScanMode('camera');
                setIsScanning(true);
              }}
              className="h-10 px-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 active:scale-95 transition-all flex items-center gap-1.5 text-xs font-semibold shadow-sm"
              title="Scan Patient QR with Camera"
            >
              <Camera size={16} />
              <span className="hidden sm:inline">Camera</span>
            </button>
            <button 
              type="button"
              onClick={() => {
                setScanMode('upload');
                setIsScanning(true);
              }}
              className="h-10 px-3.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 active:scale-95 transition-all flex items-center gap-1.5 text-xs font-semibold shadow-sm"
              title="Upload Patient QR Image"
            >
              <Upload size={16} />
              <span className="hidden sm:inline">Upload QR</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <NeonButton onClick={() => setShowManualForm(true)} className="bg-emerald-500/20 border-emerald-500/50 text-emerald-400 text-xs py-2 px-3.5 h-10 flex items-center">
            <Plus size={16} className="mr-1.5" /> Manual Entry
          </NeonButton>
          <NeonButton variant="outline" onClick={() => setUnlocked(false)} className="text-xs py-2 px-3.5 h-10 flex items-center">
            Lock Vault
          </NeonButton>
        </div>
      </div>

      {/* Active Search/Filter Pill */}
      {(searchQuery || lastScannedPatientId) && (
        <div className="flex items-center gap-2 mb-4 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl text-xs text-emerald-400 w-fit">
          <CheckCircle2 size={14} />
          <span>Active Filter: <strong>{searchQuery || `ID #${lastScannedPatientId}`}</strong></span>
          <button 
            onClick={() => {
              setSearchQuery('');
              setLastScannedPatientId(null);
            }} 
            className="ml-2 hover:text-white transition-colors"
            title="Clear Filter"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {isScanning && (
        <GlassCard className="max-w-md mx-auto overflow-hidden border-emerald-500/30 mb-8 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <QrCode size={18} className="text-emerald-400" />
              <h3 className="text-sm font-bold uppercase tracking-widest text-emerald-400">
                {scanMode === 'upload' ? 'Upload QR Image' : 'Scan Patient QR Code'}
              </h3>
            </div>
            <button 
              onClick={() => { setIsScanning(false); setScanMode(null); setCameraError(null); }} 
              className="text-white/40 hover:text-white p-1"
            >
              <X size={20} />
            </button>
          </div>

          {cameraError && (
            <div className="p-3 rounded-xl bg-virtual-danger/10 border border-virtual-danger/20 text-virtual-danger text-xs mb-3">
              <p className="font-bold mb-0.5">Camera Notice</p>
              <p>{cameraError}</p>
            </div>
          )}

          <div className="relative">
            <QRScanner 
              initialMode={scanMode === 'upload' ? 'upload' : 'camera'}
              onScan={handleScan}
              setToast={setToast}
              onError={setCameraError}
            />
            
            {scanSuccess && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute inset-0 flex items-center justify-center bg-virtual-accent/20 backdrop-blur-sm z-50 rounded-2xl"
              >
                <div className="bg-virtual-accent text-white p-4 rounded-full shadow-lg">
                  <CheckCircle2 size={48} />
                </div>
              </motion.div>
            )}
          </div>

          <div className="mt-4 flex justify-end">
            <NeonButton 
              variant="outline" 
              className="border-virtual-border text-virtual-text-muted hover:text-white text-xs py-1.5 px-4"
              onClick={() => { setIsScanning(false); setScanMode(null); }}
            >
              Cancel
            </NeonButton>
          </div>
        </GlassCard>
      )}

      {viewMode === 'patients' && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 gap-4"
        >
          {patientSummary.map((p, idx) => {
            const isExpanded = expandedPatientId === p.id;
            return (
              <GlassCard 
                key={`p-sum-${idx}`} 
                className={`transition-all duration-300 ${isExpanded ? 'border-virtual-accent/50' : 'hover:border-virtual-accent/30'}`}
              >
                <div 
                  className="flex items-center gap-4 cursor-pointer"
                  onClick={() => setExpandedPatientId(isExpanded ? null : p.id)}
                >
                  <div className="w-12 h-12 rounded-2xl bg-virtual-accent/10 flex items-center justify-center text-virtual-accent font-bold text-xl">
                    {p.name[0]}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-virtual-text">{p.name}</h3>
                    <p className="text-[10px] text-virtual-text-dim uppercase tracking-widest">ID: {p.id}</p>
                  </div>
                  <div className="hidden md:flex items-center gap-6 px-6 border-x border-virtual-border">
                    <div className="text-center">
                      <p className="text-xs font-bold text-virtual-text">{p.age}</p>
                      <p className="text-[8px] text-virtual-text-dim uppercase tracking-widest">Age</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-bold text-virtual-text">{p.weight}</p>
                      <p className="text-[8px] text-virtual-text-dim uppercase tracking-widest">Weight</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-bold text-virtual-text">{p.bloodGroup}</p>
                      <p className="text-[8px] text-virtual-text-dim uppercase tracking-widest">Blood</p>
                    </div>
                  </div>
                  <div className="text-right px-4">
                    <p className="text-lg font-bold text-virtual-accent">{p.count}</p>
                    <p className="text-[8px] text-virtual-text-dim uppercase tracking-tighter">Records</p>
                  </div>
                  <div className="p-2 rounded-lg hover:bg-virtual-accent/10 text-virtual-accent transition-all">
                    {isExpanded ? <X size={18} /> : <ChevronRight size={18} />}
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-6 pt-6 border-t border-virtual-border space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                          <div className="p-3 rounded-xl bg-virtual-input-bg border border-virtual-border">
                            <p className="text-[8px] text-virtual-text-dim uppercase tracking-widest mb-1">Blood Pressure</p>
                            <p className="text-sm font-bold text-virtual-text">{p.bp}</p>
                          </div>
                          <div className="p-3 rounded-xl bg-virtual-input-bg border border-virtual-border">
                            <p className="text-[8px] text-virtual-text-dim uppercase tracking-widest mb-1">Last Visit</p>
                            <p className="text-sm font-bold text-virtual-text">{formatDateTime(p.lastVisit)}</p>
                          </div>
                          <div className="p-3 rounded-xl bg-virtual-input-bg border border-virtual-border">
                            <p className="text-[8px] text-virtual-text-dim uppercase tracking-widest mb-1">Status</p>
                            <p className="text-sm font-bold text-virtual-accent">Active</p>
                          </div>
                          <div className="flex items-end">
                            <NeonButton 
                              size="sm" 
                              className="w-full"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSearchQuery(p.name !== 'Unknown' ? p.name : p.id);
                                setViewMode('records');
                              }}
                            >
                              View All Records
                            </NeonButton>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-virtual-text-dim mb-3">Recent Patient Records</h4>
                          {p.records.slice(0, 3).map((record, rIdx) => (
                            <div 
                              key={`p-rec-${rIdx}`}
                              className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all flex justify-between items-center group/rec"
                            >
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-virtual-accent/10 text-virtual-accent">
                                  <FileText size={14} />
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-virtual-text line-clamp-1">{record.content.split('\n')[0]}</p>
                                  <p className="text-[8px] text-virtual-text-dim uppercase tracking-widest">{formatDateTime(record.created_at)}</p>
                                </div>
                              </div>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSearchQuery(record.id.toString());
                                  setViewMode('records');
                                }}
                                className="text-[10px] text-virtual-accent font-bold uppercase tracking-widest opacity-0 group-hover/rec:opacity-100 transition-all"
                              >
                                View
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </GlassCard>
            );
          })}
        </motion.div>
      )}

      {viewMode === 'records' && (
        <>
          <AnimatePresence>
            {showManualForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <GlassCard className="border-emerald-500/30">
              <h3 className="text-lg font-bold mb-4">Manual Patient Record Entry</h3>
              <form onSubmit={handleManualSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1">Patient Name</label>
                    <input 
                      required
                      type="text"
                      value={manualData.patientName}
                      onChange={(e) => setManualData({ ...manualData, patientName: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1">Patient ID (Optional)</label>
                    <input 
                      type="text"
                      value={manualData.patientId}
                      onChange={(e) => setManualData({ ...manualData, patientId: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm"
                      placeholder="e.g. 101"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1">Age</label>
                    <input 
                      required
                      type="number"
                      value={manualData.age}
                      onChange={(e) => setManualData({ ...manualData, age: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1">Weight (kg)</label>
                    <input 
                      type="number"
                      step="0.1"
                      value={manualData.weight}
                      onChange={(e) => setManualData({ ...manualData, weight: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm"
                      placeholder="e.g. 65.0"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1">BP</label>
                    <input 
                      type="text"
                      value={manualData.bp}
                      onChange={(e) => setManualData({ ...manualData, bp: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm"
                      placeholder="e.g. 120/80"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1">Blood Group</label>
                    <input 
                      type="text"
                      value={manualData.bloodGroup}
                      onChange={(e) => setManualData({ ...manualData, bloodGroup: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm"
                      placeholder="e.g. O+"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1">Medical Details / Notes</label>
                  <textarea 
                    required
                    value={manualData.details}
                    onChange={(e) => setManualData({ ...manualData, details: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm min-h-[100px]"
                    placeholder="Enter symptoms, or medications..."
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <NeonButton variant="outline" onClick={() => setShowManualForm(false)}>Cancel</NeonButton>
                  <NeonButton type="submit">Save Record</NeonButton>
                </div>
              </form>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="text-center py-20">
          <Loader2 className="animate-spin text-emerald-400 mx-auto mb-4" size={48} />
          <p className="text-white/40">Loading secure records...</p>
        </div>
      ) : filteredData.length === 0 ? (
        <GlassCard className="text-center py-20">
          <Search size={48} className="text-white/10 mx-auto mb-4" />
          <p className="text-white/40">No records match your search.</p>
          {searchQuery && (
            <button 
              onClick={() => {
                setSearchQuery('');
                setLastScannedPatientId(null);
              }}
              className="text-emerald-400 text-xs font-bold uppercase tracking-widest mt-4 hover:underline"
            >
              Clear Search
            </button>
          )}
        </GlassCard>
      ) : (
        <div ref={listRef} className="grid grid-cols-1 gap-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
          {filteredData.map((item, idx) => {
            const isScannedMatch = lastScannedPatientId && new RegExp(`(patient id|id)\\s*:\\s*${lastScannedPatientId}(\\s|\\n|\\r|,|\\.|$)`, 'i').test(item.content);
            
            return (
              <GlassCard 
                key={item.id || `vault-${idx}`} 
                className={`group transition-all duration-500 ${isScannedMatch ? 'border-emerald-500/50 bg-emerald-500/5 shadow-[0_0_20px_rgba(16,185,129,0.1)]' : ''}`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">{item.staff_id}</span>
                      <span className="text-xs text-white/40">•</span>
                      <span className="text-xs text-white/40">{item.staff_name}</span>
                      {isScannedMatch && (
                        <span className="ml-2 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[8px] font-bold uppercase tracking-tighter">
                          Scanned Match
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-white/20 uppercase tracking-widest">
                      {formatDateTime(item.created_at)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => { setEditingItem(item); setEditContent(item.content); }}
                      className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-blue-500/10 hover:border-blue-500/50 transition-all text-blue-400"
                    >
                      <Edit size={16} />
                    </button>
                    <button 
                      onClick={() => handleDelete(item.id)}
                      disabled={deletingId === item.id}
                      className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-red-500/10 hover:border-red-500/50 transition-all text-red-400 disabled:opacity-50"
                    >
                      {deletingId === item.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                    </button>
                  </div>
                </div>
                
                {editingItem?.id === item.id ? (
                  <div className="space-y-4">
                    <textarea 
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-sm font-mono min-h-[200px] outline-none focus:border-emerald-500/50"
                    />
                    <div className="flex gap-2 justify-end">
                      <NeonButton variant="outline" onClick={() => setEditingItem(null)}>Cancel</NeonButton>
                      <NeonButton onClick={handleUpdate}>Save Changes</NeonButton>
                    </div>
                  </div>
                ) : (
                  renderContent(item)
                )}
              </GlassCard>
            );
          })}
        </div>
      )}
    </>
  )}
    </div>
  );
}

function PendingLabsReview({ user, onBack, onApprove }: { user: UserType, onBack: () => void, onApprove: () => void }) {
  const [pendingLabs, setPendingLabs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<number | null>(null);

  const fetchPending = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/pending-lab-results');
      const data = await res.json();
      if (Array.isArray(data)) setPendingLabs(data);
    } catch (error) {
      console.error('Error fetching pending labs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handleApprove = async (id: number) => {
    setApprovingId(id);
    try {
      const res = await fetch(`/api/pending-lab-results/${id}/approve`, {
        method: 'POST'
      });
      if (res.ok) {
        onApprove();
        fetchPending();
      }
    } catch (error) {
      console.error('Error approving lab result:', error);
    } finally {
      setApprovingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/pending-lab-results/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) fetchPending();
    } catch (error) {
      console.error('Error deleting pending lab:', error);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-virtual-glass-bg rounded-lg text-virtual-text">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold flex items-center gap-2 text-virtual-text">
          <FlaskConical size={24} className="text-virtual-blue" /> Pending Lab Results
        </h1>
      </div>

      {loading ? (
        <div className="text-center py-20">
          <Loader2 className="animate-spin text-virtual-blue mx-auto mb-4" size={48} />
          <p className="text-virtual-text-muted">Fetching pending reports...</p>
        </div>
      ) : pendingLabs.length === 0 ? (
        <GlassCard className="text-center py-20">
          <CheckCircle2 size={48} className="text-virtual-accent/20 mx-auto mb-4" />
          <p className="text-virtual-text-muted">No pending lab results to review.</p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {pendingLabs.map((lab, idx) => (
            <GlassCard key={lab.id || `lab-${idx}`} className="group">
              <div className="flex flex-col md:flex-row gap-6">
                {lab.image_data && (
                  <div className="w-full md:w-48 h-48 rounded-xl overflow-hidden border border-virtual-border bg-virtual-input-bg">
                    <img 
                      src={lab.image_data} 
                      alt="Lab Report" 
                      className="w-full h-full object-cover cursor-pointer hover:scale-110 transition-transform"
                      onClick={() => window.open(lab.image_data)}
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}
                <div className="flex-1 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-bold text-virtual-text">{lab.patient_name}</h3>
                      <p className="text-xs text-virtual-text-muted uppercase tracking-widest">Patient ID: {lab.patient_id}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-virtual-text-muted uppercase tracking-widest">Scanned By</p>
                      <p className="text-xs font-medium text-virtual-blue">{lab.staff_name} ({lab.staff_id})</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-virtual-input-bg border border-virtual-border font-mono text-sm whitespace-pre-wrap text-virtual-text">
                    {lab.content}
                  </div>

                  <div className="flex gap-3 justify-end">
                    <button 
                      onClick={() => handleDelete(lab.id)}
                      className="px-4 py-2 rounded-xl bg-virtual-danger/10 border border-virtual-danger/20 text-virtual-danger text-xs font-bold hover:bg-virtual-danger/20 transition-all"
                    >
                      Discard
                    </button>
                    <NeonButton 
                      onClick={() => handleApprove(lab.id)}
                      disabled={approvingId === lab.id}
                      className="bg-virtual-accent/20 border-virtual-accent/50 text-virtual-accent"
                    >
                      {approvingId === lab.id ? <Loader2 size={16} className="animate-spin" /> : <><Shield size={16} className="mr-2" /> Approve & Move to Vault</>}
                    </NeonButton>
                  </div>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function PublicPrescriptionView({ data, onBack }: { data: any, onBack: () => void }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-white p-4 md:p-8 flex items-center justify-center relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-virtual-accent/10 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-virtual-blue/10 blur-[120px] rounded-full" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl relative z-10"
      >
        <div className="flex items-center justify-between mb-8">
          <VirtualLogo />
          <button onClick={onBack} className="p-2 hover:bg-virtual-glass-bg rounded-lg text-virtual-text-muted flex items-center gap-2 text-xs uppercase tracking-widest">
            <ArrowLeft size={16} /> Close Record
          </button>
        </div>

        <GlassCard className="border-virtual-accent/30 overflow-hidden" hover={false}>
          <div className="bg-virtual-accent/10 p-6 border-b border-virtual-accent/20 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-virtual-accent">Digital Patient Record</h1>
              <p className="text-virtual-text-muted text-xs uppercase tracking-widest mt-1">Verified by ClinIQ AI</p>
            </div>
            <div className="p-3 rounded-2xl bg-virtual-accent/20 text-virtual-accent">
              <ClipboardCheck size={32} />
            </div>
          </div>

          <div className="p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] text-virtual-text-dim uppercase tracking-widest block mb-1">Patient Name</label>
                  <p className="text-xl font-bold text-virtual-text">{data.name}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-virtual-text-dim uppercase tracking-widest block mb-1">Age</label>
                    <p className="font-medium text-virtual-text">{data.age}</p>
                  </div>
                  <div>
                    <label className="text-[10px] text-virtual-text-dim uppercase tracking-widest block mb-1">Weight</label>
                    <p className="font-medium text-virtual-text">{data.weight ? `${data.weight} kg` : 'N/A'}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] text-virtual-text-dim uppercase tracking-widest block mb-1">Prescribing Doctor</label>
                  <p className="text-lg font-bold text-virtual-blue">{data.doctor}</p>
                </div>
                <div>
                  <label className="text-[10px] text-virtual-text-dim uppercase tracking-widest block mb-1">Record Date</label>
                  <p className="font-medium text-virtual-text">{data.date}</p>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-virtual-border">
              <label className="text-[10px] text-virtual-text-dim uppercase tracking-widest block mb-4">Prescribed Medications</label>
              <div className="p-4 rounded-2xl bg-virtual-input-bg border border-virtual-border text-virtual-text leading-relaxed font-medium">
                {data.medicines}
              </div>
            </div>

            <div className="pt-6 flex items-center gap-3 text-virtual-text-dim">
              <Shield size={16} />
              <p className="text-[10px] uppercase tracking-widest">This is a secure digital copy of the physical prescription.</p>
            </div>
          </div>
        </GlassCard>
        
        <p className="text-center text-virtual-text-dim text-[10px] uppercase tracking-widest mt-8">
          © 2026 ClinIQ AI Healthcare Systems • Secure Digital Records
        </p>
      </motion.div>
    </div>
  );
}
