import { useEffect, useState } from 'react';
import { AlertTriangle, XCircle, AlertCircle } from 'lucide-react';

interface HandMisreadAlertProps {
  misread: {
    handNumber: number;
    actual: string;
    aiThought: string;
    holeCards: string[];
    boardCards: string[];
    phase: string;
    severity: 'CRITICAL' | 'MAJOR' | 'MINOR';
    modelName: string;
    timestamp: number;
  };
}

const getIconForSeverity = (severity: string) => {
  switch (severity) {
    case 'CRITICAL':
      return <XCircle className="h-6 w-6" />;
    case 'MAJOR':
      return <AlertTriangle className="h-6 w-6" />;
    case 'MINOR':
      return <AlertCircle className="h-6 w-6" />;
    default:
      return <AlertCircle className="h-6 w-6" />;
  }
};

const getColorForSeverity = (severity: string) => {
  switch (severity) {
    case 'CRITICAL':
      return 'from-red-600 to-red-800';
    case 'MAJOR':
      return 'from-orange-600 to-orange-800';
    case 'MINOR':
      return 'from-yellow-600 to-yellow-800';
    default:
      return 'from-gray-600 to-gray-800';
  }
};

const getSeverityLabel = (severity: string) => {
  switch (severity) {
    case 'CRITICAL':
      return '🚨 CRITICAL MISREAD';
    case 'MAJOR':
      return '⚠️ MAJOR MISREAD';
    case 'MINOR':
      return '📝 MINOR MISREAD';
    default:
      return 'MISREAD';
  }
};

export function HandMisreadAlert({ misread }: HandMisreadAlertProps) {
  const [alerts, setAlerts] = useState<(typeof misread & { id: number; isVisible: boolean })[]>([]);
  const [nextId, setNextId] = useState(0);

  useEffect(() => {
    if (misread) {
      const newAlert = {
        ...misread,
        id: nextId,
        isVisible: false
      };
      
      setAlerts(prev => [...prev, newAlert]);
      setNextId(prev => prev + 1);

      // Animate in
      setTimeout(() => {
        setAlerts(prev => 
          prev.map(a => a.id === newAlert.id ? { ...a, isVisible: true } : a)
        );
      }, 10);

      // Animate out (longer duration for critical misreads)
      const duration = misread.severity === 'CRITICAL' ? 6000 : 4000;
      const timer = setTimeout(() => {
        setAlerts(prev => 
          prev.map(a => a.id === newAlert.id ? { ...a, isVisible: false } : a)
        );
        
        // Remove after transition
        setTimeout(() => {
          setAlerts(prev => prev.filter(a => a.id !== newAlert.id));
        }, 300);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [misread, nextId]);

  return (
    <div className="fixed bottom-24 left-8 z-50 space-y-4">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`transition-all duration-300 transform ${
            alert.isVisible 
              ? 'opacity-100 translate-x-0 scale-100' 
              : 'opacity-0 -translate-x-24 scale-75'
          }`}
        >
          <div className={`bg-gradient-to-r ${getColorForSeverity(alert.severity)} text-white rounded-lg shadow-xl p-4 min-w-[350px] max-w-[450px]`}>
            <div className="flex items-start gap-3">
              <div className="text-white/90 mt-1">
                {getIconForSeverity(alert.severity)}
              </div>
              <div className="flex-1">
                <div className="font-bold text-lg mb-1">
                  {getSeverityLabel(alert.severity)} - {alert.modelName}
                </div>
                <div className="text-sm text-white/90 mb-2">
                  Hand #{alert.handNumber} • {alert.phase}
                </div>
                <div className="space-y-1">
                  <div className="text-sm">
                    <span className="font-semibold">Actual:</span> {alert.actual}
                  </div>
                  <div className="text-sm">
                    <span className="font-semibold">AI Thought:</span> {alert.aiThought}
                  </div>
                  <div className="text-xs text-white/80 mt-2">
                    Cards: {alert.holeCards.join(' ')} | Board: {alert.boardCards.join(' ')}
                  </div>
                </div>
                {alert.severity === 'CRITICAL' && (
                  <div className="mt-2 text-xs font-bold text-yellow-200 animate-pulse">
                    ⚠️ AI missed the NUTS!
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}