interface SandboxRunResult {
  ok: boolean;
  code?: number;
  reason?: string;
}

interface SandboxRunFilter {
  files?: string[];
  spec?: string;
}

interface Window {
  sandboxRunner?: {
    run(type: 'unit' | 'e2e', filter?: SandboxRunFilter): Promise<SandboxRunResult>;
    reset(): Promise<SandboxRunResult>;
    cancel(): Promise<{ ok: boolean; reason?: string }>;
    onOutput(cb: (line: string) => void): () => void;
  };
}
