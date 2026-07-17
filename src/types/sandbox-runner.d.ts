export interface SandboxRunFilter {
  files?: string[];
  spec?: string;
}

export interface SandboxRunResult {
  ok: boolean;
  code?: number;
  reason?: string;
}

export interface SandboxRunner {
  run: (type: 'unit' | 'e2e', filter?: SandboxRunFilter) => Promise<SandboxRunResult>;
  reset: () => Promise<SandboxRunResult>;
  cancel: () => Promise<SandboxRunResult>;
  onOutput: (callback: (line: string) => void) => () => void;
}

declare global {
  interface Window {
    sandboxRunner?: SandboxRunner;
  }
}

export {};
