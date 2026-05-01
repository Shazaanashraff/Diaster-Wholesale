import { useCallback, useEffect, useState } from 'react';

export type UpdaterStatus =
  | 'checking'
  | 'update-available'
  | 'update-not-available'
  | 'download-progress'
  | 'update-downloaded'
  | 'error'
  | 'skipped'
  | 'idle';

interface UpdaterPayload {
  status: UpdaterStatus;
  version?: string;
  percent?: number;
  message?: string;
  reason?: string;
}

interface UpdaterApi {
  checkNow: () => Promise<unknown> | unknown;
  installNow: () => void;
  onStatus: (callback: (payload: UpdaterPayload) => void) => (() => void) | void;
}

export interface UpdaterState {
  status: UpdaterStatus;
  percent: number;
  version: string;
  message: string | null;
  lastCheckedAt: number | null;
}

const INITIAL_STATE: UpdaterState = {
  status: 'idle',
  percent: 0,
  version: '',
  message: null,
  lastCheckedAt: null,
};

let storeState: UpdaterState = INITIAL_STATE;
const subscribers = new Set<(state: UpdaterState) => void>();
let isSubscribed = false;

const getUpdater = (): UpdaterApi | null => {
  if (typeof window === 'undefined') return null;
  return ((window as any).desktop?.updater as UpdaterApi | undefined) ?? null;
};

const emitStoreUpdate = () => {
  for (const callback of subscribers) {
    callback(storeState);
  }
};

const updateStore = (next: Partial<UpdaterState>) => {
  storeState = { ...storeState, ...next };
  emitStoreUpdate();
};

const applyPayload = (payload: UpdaterPayload) => {
  const next: Partial<UpdaterState> = {
    status: payload.status,
  };

  if (payload.version) {
    next.version = payload.version;
  }

  if (typeof payload.percent === 'number') {
    next.percent = Math.round(payload.percent);
  }

  if (payload.status === 'checking') {
    next.percent = 0;
    next.message = null;
  }

  if (payload.status === 'update-available') {
    next.percent = 0;
    next.message = null;
  }

  if (payload.status === 'update-downloaded') {
    next.percent = 100;
    next.message = null;
  }

  if (payload.status === 'update-not-available') {
    next.lastCheckedAt = Date.now();
    next.message = null;
  }

  if (payload.status === 'error') {
    next.lastCheckedAt = Date.now();
    next.message = payload.message ?? 'An unknown error occurred.';
  }

  if (payload.status === 'skipped') {
    next.message = payload.reason ?? payload.message ?? 'Updater is unavailable.';
  }

  updateStore(next);
};

const ensureGlobalSubscription = () => {
  if (isSubscribed) return;
  const updater = getUpdater();
  if (!updater) return;

  isSubscribed = true;
  updater.onStatus((payload) => {
    applyPayload(payload);
  });
};

export const useUpdater = () => {
  const [state, setState] = useState<UpdaterState>(storeState);

  useEffect(() => {
    ensureGlobalSubscription();
    subscribers.add(setState);
    setState(storeState);
    return () => {
      subscribers.delete(setState);
    };
  }, []);

  const checkNow = useCallback(() => {
    const updater = getUpdater();
    if (!updater) return;
    updateStore({
      status: 'checking',
      percent: 0,
      message: null,
    });
    updater.checkNow();
  }, []);

  const installNow = useCallback(() => {
    const updater = getUpdater();
    if (!updater) return;
    updater.installNow();
  }, []);

  return {
    ...state,
    isDesktop: !!getUpdater(),
    checkNow,
    installNow,
  };
};
