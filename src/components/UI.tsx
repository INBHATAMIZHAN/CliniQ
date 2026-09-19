import React from 'react';
import { motion } from 'motion/react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, className = '', hover = true, onClick }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    onClick={onClick}
    className={`glass rounded-2xl p-6 ${hover ? 'glass-hover' : ''} ${onClick ? 'cursor-pointer' : ''} transition-all duration-300 ${className}`}
  >
    {children}
  </motion.div>
);

export const NeonButton: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  variant?: 'primary' | 'danger' | 'outline';
  disabled?: boolean;
}> = ({ children, onClick, className = '', variant = 'primary', disabled }) => {
  const variants = {
    primary: 'bg-virtual-accent/10 border-virtual-accent/30 text-virtual-accent hover:bg-virtual-accent/20',
    danger: 'bg-virtual-danger/10 border-virtual-danger/30 text-virtual-danger hover:bg-virtual-danger/20',
    outline: 'bg-transparent border-virtual-border text-virtual-text-muted hover:border-virtual-accent hover:text-virtual-text',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 rounded-xl border transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

export const VirtualLogo: React.FC<{ className?: string; onClick?: () => void }> = ({ className = '', onClick }) => (
  <div onClick={onClick} className={`flex items-center gap-2 ${className}`}>
    <div className="relative w-10 h-10">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
        className="absolute inset-0 border-2 border-virtual-accent/30 rounded-lg"
      />
      <motion.div
        animate={{ rotate: -360 }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        className="absolute inset-2 border-2 border-virtual-accent/50 rounded-full"
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-virtual-accent font-bold text-xl">C</span>
      </div>
    </div>
    <span className="text-2xl font-bold tracking-tighter neon-text">
      ClinIQ <span className="text-virtual-accent">AI</span>
    </span>
  </div>
);

export const StatusBanner: React.FC<{
  type: 'warning' | 'error' | 'info';
  message: string;
  action?: { label: string; onClick: () => void };
}> = ({ type, message, action }) => {
  const styles = {
    warning: 'bg-virtual-warning/10 border-virtual-warning/20 text-virtual-warning',
    error: 'bg-virtual-danger/10 border-virtual-danger/20 text-virtual-danger',
    info: 'bg-virtual-blue/10 border-virtual-blue/20 text-virtual-blue',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-4 rounded-2xl border flex items-center gap-4 mb-6 ${styles[type]}`}
    >
      <div className="flex-1">
        <p className="text-sm font-medium">{message}</p>
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-all text-xs font-bold uppercase tracking-widest"
        >
          {action.label}
        </button>
      )}
    </motion.div>
  );
};

export const Toast: React.FC<{
  message: string;
  type?: 'success' | 'error' | 'info';
  onClose: () => void;
}> = ({ message, type = 'info', onClose }) => {
  const colors = {
    success: 'bg-virtual-accent/20 border-virtual-accent/50 text-virtual-accent',
    error: 'bg-virtual-danger/20 border-virtual-danger/50 text-virtual-danger',
    info: 'bg-virtual-blue/20 border-virtual-blue/50 text-virtual-blue',
  };

  React.useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
      className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[9999] px-6 py-3 rounded-2xl border shadow-2xl flex items-center gap-3 backdrop-blur-xl ${colors[type]}`}
    >
      <span className="text-sm font-bold tracking-wide">{message}</span>
    </motion.div>
  );
};
