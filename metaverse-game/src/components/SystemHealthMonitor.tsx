import React, { useEffect, useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';

type HealthStatus = 'healthy' | 'degraded' | 'critical' | 'failed';

interface SystemMetrics {
  inputBacklog: {
    total: number;
    unprocessed: number;
    oldestAge: number;
    status: HealthStatus;
  };
  documentCounts: {
    inputs: number;
    activityLogs: number;
    messages: number;
    memories: number;
    total: number;
    percentOfLimit: number;
    status: HealthStatus;
  };
  engineHealth: {
    running: boolean;
    lastStepTime: number;
    timeSinceLastStep: number;
    status: HealthStatus;
  };
  cleanupStatus: {
    lastCleanup: number;
    deletedLastRun: number;
    nextScheduled: number;
    status: HealthStatus;
  };
  overallHealth: HealthStatus;
  alerts: string[];
}

const SystemHealthMonitor: React.FC<{ worldId?: string }> = ({ worldId }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  // @ts-ignore - TypeScript depth issue
  const health = useQuery(api.monitoring.systemHealth.getSystemHealth, { worldId }) as SystemMetrics | undefined;
  
  // @ts-ignore - TypeScript depth issue
  const triggerCleanup = useMutation(api.monitoring.systemHealth.triggerEmergencyCleanup);
  
  // @ts-ignore - TypeScript depth issue
  const alertHistory = useQuery(api.monitoring.systemHealth.getAlertHistory, { limit: 10 });

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      // Query will auto-refresh
    }, 30000);
    
    return () => clearInterval(interval);
  }, [autoRefresh]);

  if (!health) {
    return (
      <div className="fixed bottom-4 right-4 bg-gray-800 text-white p-2 rounded-lg shadow-lg">
        <div className="flex items-center gap-2">
          <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
          <span className="text-xs">Loading health metrics...</span>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: HealthStatus) => {
    switch (status) {
      case 'healthy': return 'bg-green-500';
      case 'degraded': return 'bg-yellow-500';
      case 'critical': return 'bg-orange-500';
      case 'failed': return 'bg-red-500';
    }
  };

  const getStatusIcon = (status: HealthStatus) => {
    switch (status) {
      case 'healthy': return '✅';
      case 'degraded': return '⚠️';
      case 'critical': return '🚨';
      case 'failed': return '❌';
    }
  };

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
    return `${Math.round(ms / 3600000)}h`;
  };

  const handleEmergencyCleanup = async () => {
    if (!confirm('⚠️ This will delete old documents to free up space. Continue?')) {
      return;
    }
    
    try {
      const result = await triggerCleanup({ confirm: true, worldId: worldId as any });
      alert(`✅ Cleanup complete: ${result.deleted} documents deleted`);
    } catch (error: any) {
      alert(`❌ Cleanup failed: ${error.message}`);
    }
  };

  return (
    <div className={`fixed bottom-4 right-4 ${isExpanded ? 'w-96' : 'w-48'} transition-all duration-300`}>
      {/* Compact View */}
      <div 
        className={`${getStatusColor(health.overallHealth)} text-white p-3 rounded-lg shadow-lg cursor-pointer`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{getStatusIcon(health.overallHealth)}</span>
            <span className="font-semibold text-sm">System Health</span>
          </div>
          <span className="text-xs">{health.overallHealth.toUpperCase()}</span>
        </div>
        
        {/* Quick Stats */}
        {!isExpanded && (
          <div className="mt-2 text-xs opacity-90">
            <div>Inputs: {health.inputBacklog.unprocessed}/{health.inputBacklog.total}</div>
            <div>Docs: {Math.round(health.documentCounts.percentOfLimit)}% limit</div>
          </div>
        )}
      </div>

      {/* Expanded View */}
      {isExpanded && (
        <div className="mt-2 bg-gray-800 text-white rounded-lg shadow-lg p-4 max-h-96 overflow-y-auto">
          {/* Controls */}
          <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-700">
            <h3 className="font-bold">System Metrics</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`text-xs px-2 py-1 rounded ${autoRefresh ? 'bg-green-600' : 'bg-gray-600'}`}
              >
                {autoRefresh ? '🔄 Auto' : '⏸️ Paused'}
              </button>
              <button
                onClick={() => setIsExpanded(false)}
                className="text-xs px-2 py-1 rounded bg-gray-600 hover:bg-gray-700"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Alerts */}
          {health.alerts.length > 0 && (
            <div className="mb-3 p-2 bg-red-900 rounded">
              <div className="text-xs font-semibold mb-1">Active Alerts</div>
              {health.alerts.map((alert, i) => (
                <div key={i} className="text-xs opacity-90">{alert}</div>
              ))}
            </div>
          )}

          {/* Metrics */}
          <div className="space-y-3">
            {/* Input Backlog */}
            <div className="bg-gray-700 p-2 rounded">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-semibold">Input Backlog</span>
                <span className={`w-2 h-2 rounded-full ${getStatusColor(health.inputBacklog.status)}`} />
              </div>
              <div className="text-xs space-y-1 opacity-90">
                <div>Unprocessed: {health.inputBacklog.unprocessed}/{health.inputBacklog.total}</div>
                <div>Oldest: {formatTime(health.inputBacklog.oldestAge)} ago</div>
              </div>
            </div>

            {/* Document Counts */}
            <div className="bg-gray-700 p-2 rounded">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-semibold">Document Usage</span>
                <span className={`w-2 h-2 rounded-full ${getStatusColor(health.documentCounts.status)}`} />
              </div>
              <div className="text-xs space-y-1 opacity-90">
                <div>Total: {health.documentCounts.total.toLocaleString()} ({Math.round(health.documentCounts.percentOfLimit)}%)</div>
                <div className="flex justify-between">
                  <span>Inputs:</span>
                  <span>{health.documentCounts.inputs}</span>
                </div>
                <div className="flex justify-between">
                  <span>Logs:</span>
                  <span>{health.documentCounts.activityLogs}</span>
                </div>
                <div className="flex justify-between">
                  <span>Messages:</span>
                  <span>{health.documentCounts.messages}</span>
                </div>
              </div>
              {/* Progress Bar */}
              <div className="mt-2 h-2 bg-gray-600 rounded overflow-hidden">
                <div 
                  className={`h-full transition-all ${
                    health.documentCounts.percentOfLimit < 50 ? 'bg-green-500' :
                    health.documentCounts.percentOfLimit < 70 ? 'bg-yellow-500' :
                    health.documentCounts.percentOfLimit < 90 ? 'bg-orange-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(100, health.documentCounts.percentOfLimit)}%` }}
                />
              </div>
            </div>

            {/* Engine Health */}
            <div className="bg-gray-700 p-2 rounded">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-semibold">Engine Status</span>
                <span className={`w-2 h-2 rounded-full ${getStatusColor(health.engineHealth.status)}`} />
              </div>
              <div className="text-xs space-y-1 opacity-90">
                <div>Status: {health.engineHealth.running ? '🟢 Running' : '🔴 Stopped'}</div>
                <div>Last Step: {formatTime(health.engineHealth.timeSinceLastStep)} ago</div>
              </div>
            </div>

            {/* Cleanup Status */}
            <div className="bg-gray-700 p-2 rounded">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-semibold">Cleanup Status</span>
                <span className={`w-2 h-2 rounded-full ${getStatusColor(health.cleanupStatus.status)}`} />
              </div>
              <div className="text-xs space-y-1 opacity-90">
                <div>Last Run: {formatTime(Date.now() - health.cleanupStatus.lastCleanup)} ago</div>
                <div>Next Run: in {formatTime(health.cleanupStatus.nextScheduled - Date.now())}</div>
              </div>
            </div>
          </div>

          {/* Actions */}
          {(health.overallHealth === 'critical' || health.overallHealth === 'failed') && (
            <div className="mt-3 pt-3 border-t border-gray-700">
              <button
                onClick={handleEmergencyCleanup}
                className="w-full bg-red-600 hover:bg-red-700 text-white text-xs font-semibold py-2 px-3 rounded transition-colors"
              >
                🚨 Emergency Cleanup
              </button>
            </div>
          )}

          {/* Alert History */}
          {alertHistory && alertHistory.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-700">
              <div className="text-xs font-semibold mb-2">Recent Alerts</div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {alertHistory.map((alert: any, i: number) => (
                  <div key={i} className="text-xs opacity-70">
                    <span className="opacity-50">{new Date(alert.timestamp).toLocaleTimeString()}</span>
                    {' '}{alert.message}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SystemHealthMonitor;