// Types for window.sandboxRunner — exposed by electron/preload.js in dev builds only.
// In packaged builds and web environments, window.sandboxRunner is undefined.

interface SandboxRunFilter {
  /** For type='unit': specific vitest file paths to run. */
  files?: string[];
  /** For type='e2e': the spec basename (without .spec.ts). */
  spec?: string;
}

interface SandboxRunnerApi {
  /** Run tests. Returns { ok, code } after the process exits. */
  run(type: 'unit' | 'e2e', filter?: SandboxRunFilter): Promise<{ ok: boolean; code: number | null }>;
  /** Invoke npm run sandbox:reset and stream output. */
  reset(): Promise<{ ok: boolean; code?: number | null }>;
  /** Kill the active test/reset process. */
  cancel(): Promise<{ ok: boolean; reason?: string }>;
  /** Subscribe to streamed output lines. Returns an unsubscribe function. */
  onOutput(callback: (line: string) => void): () => void;
}

declare global {
  interface Window {
    sandboxRunner?: SandboxRunnerApi;
  }
}

export {};
