interface SandboxRunFilter {
  files?: string[];
  spec?: string;
}

interface SandboxRunResult {
  ok: boolean;
  code?: number | null;
  reason?: string;
}

interface SandboxRunner {
  run(type: 'unit' | 'e2e', filter?: SandboxRunFilter): Promise<SandboxRunResult>;
  reset(): Promise<SandboxRunResult>;
  cancel(): Promise<SandboxRunResult>;
  onOutput(cb: (line: string) => void): () => void;
}

interface Window {
  sandboxRunner?: SandboxRunner;
}
