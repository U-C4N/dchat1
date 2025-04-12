'use client';

import * as React from 'react';
import { useEffect, useState, useMemo } from 'react';
import { Progress } from './ui/progress';
import { useDeepResearch } from '../lib/deep-research-context';

interface DeepResearchProgressProps {
  activity: Array<{
    type: string;
    status: string;
    message: string;
    timestamp: string;
    depth?: number;
    completedSteps?: number;
    totalSteps?: number;
  }>;
}

export function DeepResearchProgress({ activity }: DeepResearchProgressProps) {
  const { state: deepResearchState } = useDeepResearch();
  const [lastActivity, setLastActivity] = useState<string>('');
  const [startTime] = useState<number>(Date.now());
  const maxDuration = 120 * 1000; // 120 seconds in milliseconds (from user's timeout parameter)
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (activity && activity.length > 0) {
      const lastItem = activity[activity.length - 1];
      setLastActivity(lastItem.message);
    }
  }, [activity]);

  const progress = useMemo(() => {
    if (deepResearchState.totalExpectedSteps === 0) return 0;
    return Math.min(
      (deepResearchState.completedSteps /
        deepResearchState.totalExpectedSteps) *
        100,
      100,
    );
  }, [deepResearchState.completedSteps, deepResearchState.totalExpectedSteps]);

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const timeUntilTimeout = Math.max(maxDuration - (currentTime - startTime), 0);

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div className="flex flex-col gap-1">
          <span>Research in progress...</span>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span>{Math.round(progress)}%</span>
        </div>
      </div>
      <Progress value={progress} className="w-full" />
      <div className="flex items-center justify-end text-xs text-muted-foreground mt-2">
        <span>Time until timeout: {formatTime(timeUntilTimeout)}</span>
      </div>
      <div className="text-xs text-muted-foreground">{lastActivity}</div>
    </div>
  );
}
