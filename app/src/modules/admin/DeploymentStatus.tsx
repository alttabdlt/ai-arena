import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Badge } from '@/shared/components/ui/badge';
import { Progress } from '@/shared/components/ui/progress';
import { Loader2, RefreshCw, AlertCircle, CheckCircle, XCircle, Globe, Bot, Wrench } from 'lucide-react';
import {
  GET_DEPLOYMENT_STATUS,
  GET_WORLDS_STATUS,
  GET_FAILED_DEPLOYMENTS,
  DEPLOY_ALL_BOTS,
  CLEANUP_INVALID_SYNCS,
  INITIALIZE_WORLDS,
  RETRY_FAILED_DEPLOYMENTS
} from '@/graphql/queries/deployment';

interface WorldStatus {
  worldId: string;
  zone: string;
  active: boolean;
  botCount: number;
}

interface FailedDeployment {
  botId: string;
  botName: string;
  error: string;
  timestamp: string;
}

export const DeploymentStatus: React.FC = () => {
  const [forceDeployment, setForceDeployment] = useState(false);
  
  const { data: statusData, loading: statusLoading, refetch: refetchStatus } = useQuery(GET_DEPLOYMENT_STATUS, {
    pollInterval: 5000 // Poll every 5 seconds
  });
  
  const { data: worldsData, loading: worldsLoading } = useQuery(GET_WORLDS_STATUS);
  const { data: failedData } = useQuery(GET_FAILED_DEPLOYMENTS);
  
  const [deployAll, { loading: deployingAll }] = useMutation(DEPLOY_ALL_BOTS);
  const [cleanupSyncs, { loading: cleaningUp }] = useMutation(CLEANUP_INVALID_SYNCS);
  const [initWorlds, { loading: initializingWorlds }] = useMutation(INITIALIZE_WORLDS);
  const [retryFailed, { loading: retrying }] = useMutation(RETRY_FAILED_DEPLOYMENTS);
  
  const status = statusData?.getDeploymentStatus;
  const worlds: WorldStatus[] = Array.isArray(worldsData?.getWorldsStatus)
    ? (worldsData.getWorldsStatus as WorldStatus[])
    : [];
  const failed: FailedDeployment[] = Array.isArray(failedData?.getFailedDeployments)
    ? (failedData.getFailedDeployments as FailedDeployment[])
    : [];
  
  const deploymentProgress = status ? (status.deployedBots / status.totalBots) * 100 : 0;
  
  const handleDeployAll = async () => {
    try {
      const result = await deployAll({ variables: { force: forceDeployment } });
      if (result.data?.deployAllBots.success) {
        refetchStatus();
      }
    } catch (error) {
      console.error('Deployment failed:', error);
    }
  };
  
  const handleCleanup = async () => {
    try {
      const result = await cleanupSyncs();
      if (result.data?.cleanupInvalidSyncs.success) {
        refetchStatus();
      }
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  };
  
  const handleInitWorlds = async () => {
    try {
      const result = await initWorlds();
      if (result.data?.initializeWorlds.success) {
        refetchStatus();
      }
    } catch (error) {
      console.error('World initialization failed:', error);
    }
  };
  
  const handleRetryFailed = async () => {
    try {
      const result = await retryFailed();
      if (result.data?.retryFailedDeployments.success) {
        refetchStatus();
      }
    } catch (error) {
      console.error('Retry failed:', error);
    }
  };
  
  if (statusLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Deployment Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Bots</p>
              <p className="text-2xl font-bold">{status?.totalBots || 0}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Deployed</p>
              <p className="text-2xl font-bold text-green-600">{status?.deployedBots || 0}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">{status?.pendingBots || 0}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Failed</p>
              <p className="text-2xl font-bold text-red-600">{status?.failedBots || 0}</p>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Deployment Progress</span>
              <span>{deploymentProgress.toFixed(1)}%</span>
            </div>
            <Progress value={deploymentProgress} className="h-2" />
          </div>
          
          {status?.lastDeploymentAt && (
            <p className="text-sm text-muted-foreground">
              Last deployment: {new Date(status.lastDeploymentAt).toLocaleString()}
            </p>
          )}
        </CardContent>
      </Card>
      
      {/* World Instances */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            World Instances
          </CardTitle>
        </CardHeader>
        <CardContent>
          {status?.worldsReady ? (
            <Alert className="mb-4">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>World instances are initialized and ready</AlertDescription>
            </Alert>
          ) : (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>World instances not initialized</AlertDescription>
            </Alert>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {worlds.map((world) => (
              <div key={world.worldId} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant={world.active ? 'default' : 'secondary'}>
                    {world.zone}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {world.botCount} bots
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  ID: {world.worldId}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      
      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Deployment Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              onClick={handleInitWorlds}
              disabled={initializingWorlds || status?.worldsReady}
              className="w-full"
            >
              {initializingWorlds ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Globe className="h-4 w-4 mr-2" />
              )}
              Initialize Worlds
            </Button>
            
            <Button
              onClick={handleDeployAll}
              disabled={deployingAll || !status?.worldsReady || status?.pendingBots === 0}
              className="w-full"
            >
              {deployingAll ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Bot className="h-4 w-4 mr-2" />
              )}
              Deploy All Bots ({status?.pendingBots || 0})
            </Button>
            
            <Button
              onClick={handleCleanup}
              disabled={cleaningUp}
              variant="outline"
              className="w-full"
            >
              {cleaningUp ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Cleanup Invalid Syncs
            </Button>
            
            <Button
              onClick={handleRetryFailed}
              disabled={retrying || status?.failedBots === 0}
              variant="outline"
              className="w-full"
            >
              {retrying ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Retry Failed ({status?.failedBots || 0})
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="force-deployment"
              checked={forceDeployment}
              onChange={(e) => setForceDeployment(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="force-deployment" className="text-sm text-muted-foreground">
              Force deployment (resets failed syncs)
            </label>
          </div>
        </CardContent>
      </Card>
      
      {/* Failed Deployments */}
      {failed.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" />
              Failed Deployments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {failed.slice(0, 5).map((failure) => (
                <div key={failure.botId} className="border rounded p-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-sm">{failure.botName}</p>
                      <p className="text-xs text-muted-foreground">{failure.error}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(failure.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
