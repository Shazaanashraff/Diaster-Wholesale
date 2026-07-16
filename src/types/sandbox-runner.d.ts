// Dev-only IPC surface for the Sandbox test runner (todo-011). Exposed by
// electron/preload.js only when the app is not packaged, so `sandboxRunner`
// is `undefined` in any packaged/web build.

export {};

interface SandboxRunResult {
  ok: boolean;
  code?: number;
  reason?: string;
}

interface SandboxRunFilter {
  files?: string[];
  spec?: string;
}

declare global {
  interface Window {
    sandboxRunner?: {
      run: (type: 'unit' | 'e2e', filter?: SandboxRunFilter) => Promise<SandboxRunResult>;
      reset: () => Promise<SandboxRunResult>;
      cancel: () => Promise<SandboxRunResult>;
      onOutput: (callback: (line: string) => void) => () => void;
    };
  }
}
