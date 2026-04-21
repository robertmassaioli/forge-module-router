/**
 * Stub for @forge/bridge used in the version matrix fixture tests.
 *
 * By aliasing @forge/bridge to this file in vitest.config.ts, we prevent
 * the real bridge from executing its connection logic at module load time,
 * which would fail outside of an Atlassian Forge environment.
 *
 * The vi.fn() stubs are reset between tests via mockReset: true in vitest.config.ts.
 */
import { vi } from 'vitest';

export const view = {
  getContext: vi.fn(),
  createHistory: vi.fn(),
};
