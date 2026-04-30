import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createUIKitContextRoute } from '../src/UIKitContextRoute';
import { ForgeContextError, ForgeModuleKeyConflictError } from '../src/errors';

// createUIKitContextRoute accepts any useProductContext-compatible hook.
// In tests we pass a vi.fn() mock — no @forge/react or @forge/bridge needed.

type MockContext = { moduleKey: string; environmentType?: string; [key: string]: unknown } | undefined;

function makeContext (overrides: Exclude<MockContext, undefined> = { moduleKey: 'my-module' }): Exclude<MockContext, undefined> {
  return {
    moduleKey: 'my-module',
    environmentType: undefined,
    ...overrides,
  };
}

describe('createUIKitContextRoute', () => {
  describe('allowedModuleKeys conflict validation (at call time)', () => {
    it('throws ForgeModuleKeyConflictError immediately when two keys share a hyphen-prefix', () => {
      const useProductContext = vi.fn<[], MockContext>().mockReturnValue(undefined);
      expect(() =>
        createUIKitContextRoute(useProductContext, {
          allowedModuleKeys: ['my-macro', 'my-macro-v2'],
        })
      ).toThrow(ForgeModuleKeyConflictError);
    });

    it('the conflict error names both keys', () => {
      const useProductContext = vi.fn<[], MockContext>().mockReturnValue(undefined);
      let caught: unknown;
      try {
        createUIKitContextRoute(useProductContext, {
          allowedModuleKeys: ['my-macro', 'my-macro-v2'],
        });
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(ForgeModuleKeyConflictError);
      const error = caught as ForgeModuleKeyConflictError;
      expect(error.prefixKey).toBe('my-macro');
      expect(error.conflictingKey).toBe('my-macro-v2');
    });

    it('throws regardless of key order in the array', () => {
      const useProductContext = vi.fn<[], MockContext>().mockReturnValue(undefined);
      expect(() =>
        createUIKitContextRoute(useProductContext, {
          allowedModuleKeys: ['my-macro-v2', 'my-macro'],
        })
      ).toThrow(ForgeModuleKeyConflictError);
    });

    it('does NOT throw when no prefix conflicts exist', () => {
      const useProductContext = vi.fn<[], MockContext>().mockReturnValue(undefined);
      expect(() =>
        createUIKitContextRoute(useProductContext, {
          allowedModuleKeys: ['paste-code-macro', 'gist-code-macro', 'in-page-editor'],
        })
      ).not.toThrow();
    });

    it('does NOT throw when keys share a prefix but not a hyphen-prefix relationship', () => {
      // 'macro' and 'macroext' — 'macroext' does not start with 'macro-'
      const useProductContext = vi.fn<[], MockContext>().mockReturnValue(undefined);
      expect(() =>
        createUIKitContextRoute(useProductContext, {
          allowedModuleKeys: ['macro', 'macroext'],
        })
      ).not.toThrow();
    });
  });

  describe('UIKitContextRoute component', () => {
    let useProductContext: ReturnType<typeof vi.fn<[], MockContext>>;
    let UIKitContextRoute: ReturnType<typeof createUIKitContextRoute>['UIKitContextRoute'];
    let useModuleKeyMatch: ReturnType<typeof createUIKitContextRoute>['useModuleKeyMatch'];

    beforeEach(() => {
      useProductContext = vi.fn<[], MockContext>();
      ({ UIKitContextRoute, useModuleKeyMatch } = createUIKitContextRoute(useProductContext));
    });

    it('renders null while context is loading (useProductContext returns undefined)', () => {
      useProductContext.mockReturnValue(undefined);
      render(<UIKitContextRoute moduleKey="my-module"><div>content</div></UIKitContextRoute>);
      expect(screen.queryByText('content')).not.toBeInTheDocument();
    });

    describe('exact match (production)', () => {
      it('renders children when moduleKey matches exactly', () => {
        useProductContext.mockReturnValue(makeContext({ moduleKey: 'my-module', environmentType: 'PRODUCTION' }));
        render(<UIKitContextRoute moduleKey="my-module"><div>content</div></UIKitContextRoute>);
        expect(screen.getByText('content')).toBeInTheDocument();
      });

      it('renders null when moduleKey does not match', () => {
        useProductContext.mockReturnValue(makeContext({ moduleKey: 'other-module', environmentType: 'PRODUCTION' }));
        render(<UIKitContextRoute moduleKey="my-module"><div>content</div></UIKitContextRoute>);
        expect(screen.queryByText('content')).not.toBeInTheDocument();
      });

      it('does NOT prefix-match in PRODUCTION', () => {
        useProductContext.mockReturnValue(makeContext({ moduleKey: 'my-module-v2', environmentType: 'PRODUCTION' }));
        render(<UIKitContextRoute moduleKey="my-module"><div>content</div></UIKitContextRoute>);
        expect(screen.queryByText('content')).not.toBeInTheDocument();
      });
    });

    describe('prefix match (non-production environments)', () => {
      it('matches default dev suffix (-dev)', () => {
        useProductContext.mockReturnValue(makeContext({ moduleKey: 'my-module-dev', environmentType: 'DEVELOPMENT' }));
        render(<UIKitContextRoute moduleKey="my-module"><div>content</div></UIKitContextRoute>);
        expect(screen.getByText('content')).toBeInTheDocument();
      });

      it('matches staging suffix (-stg)', () => {
        useProductContext.mockReturnValue(makeContext({ moduleKey: 'my-module-stg', environmentType: 'STAGING' }));
        render(<UIKitContextRoute moduleKey="my-module"><div>content</div></UIKitContextRoute>);
        expect(screen.getByText('content')).toBeInTheDocument();
      });

      it('matches local suffix (-local)', () => {
        useProductContext.mockReturnValue(makeContext({ moduleKey: 'my-module-local', environmentType: 'DEVELOPMENT' }));
        render(<UIKitContextRoute moduleKey="my-module"><div>content</div></UIKitContextRoute>);
        expect(screen.getByText('content')).toBeInTheDocument();
      });

      it('matches arbitrary custom environment name (-alice)', () => {
        useProductContext.mockReturnValue(makeContext({ moduleKey: 'my-module-alice', environmentType: 'DEVELOPMENT' }));
        render(<UIKitContextRoute moduleKey="my-module"><div>content</div></UIKitContextRoute>);
        expect(screen.getByText('content')).toBeInTheDocument();
      });

      it('matches multi-segment custom environment name (-my-feature-branch)', () => {
        useProductContext.mockReturnValue(makeContext({ moduleKey: 'my-module-my-feature-branch', environmentType: 'DEVELOPMENT' }));
        render(<UIKitContextRoute moduleKey="my-module"><div>content</div></UIKitContextRoute>);
        expect(screen.getByText('content')).toBeInTheDocument();
      });

      it('does NOT prefix-match when environmentType is absent', () => {
        useProductContext.mockReturnValue(makeContext({ moduleKey: 'my-module-dev' })); // no environmentType
        render(<UIKitContextRoute moduleKey="my-module"><div>content</div></UIKitContextRoute>);
        expect(screen.queryByText('content')).not.toBeInTheDocument();
      });

      it('does NOT match a completely different key in DEVELOPMENT', () => {
        useProductContext.mockReturnValue(makeContext({ moduleKey: 'other-module-dev', environmentType: 'DEVELOPMENT' }));
        render(<UIKitContextRoute moduleKey="my-module"><div>content</div></UIKitContextRoute>);
        expect(screen.queryByText('content')).not.toBeInTheDocument();
      });
    });

    describe('console.warn on prefix-match', () => {
      let warnSpy: ReturnType<typeof vi.spyOn>;
      beforeEach(() => { warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {}); });
      afterEach(() => { warnSpy.mockRestore(); });

      it('emits console.warn on prefix-match when allowedModuleKeys is NOT provided', () => {
        useProductContext.mockReturnValue(makeContext({ moduleKey: 'my-module-dev', environmentType: 'DEVELOPMENT' }));
        render(<UIKitContextRoute moduleKey="my-module"><div>content</div></UIKitContextRoute>);
        expect(warnSpy).toHaveBeenCalledOnce();
        expect(warnSpy.mock.calls[0][0]).toContain('[forge-module-router]');
        expect(warnSpy.mock.calls[0][0]).toContain('my-module');
      });

      it('does NOT emit console.warn on exact match', () => {
        useProductContext.mockReturnValue(makeContext({ moduleKey: 'my-module', environmentType: 'DEVELOPMENT' }));
        render(<UIKitContextRoute moduleKey="my-module"><div>content</div></UIKitContextRoute>);
        expect(warnSpy).not.toHaveBeenCalled();
      });

      it('suppresses console.warn when allowedModuleKeys is provided', () => {
        const { UIKitContextRoute: StrictRoute } = createUIKitContextRoute(useProductContext, {
          allowedModuleKeys: ['my-module', 'other-module'],
        });
        useProductContext.mockReturnValue(makeContext({ moduleKey: 'my-module-dev', environmentType: 'DEVELOPMENT' }));
        render(<StrictRoute moduleKey="my-module"><div>content</div></StrictRoute>);
        expect(warnSpy).not.toHaveBeenCalled();
      });
    });

    describe('allowedModuleKeys — strict moduleKey validation at render time', () => {
      it('throws ForgeContextError when moduleKey is not in allowedModuleKeys', () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        const { UIKitContextRoute: StrictRoute } = createUIKitContextRoute(useProductContext, {
          allowedModuleKeys: ['other-module', 'another-module'],
        });
        useProductContext.mockReturnValue(makeContext({ moduleKey: 'my-module', environmentType: 'PRODUCTION' }));
        expect(() =>
          render(<StrictRoute moduleKey="my-module"><div>content</div></StrictRoute>)
        ).toThrow(ForgeContextError);
        consoleError.mockRestore();
      });

      it('renders children when moduleKey IS in allowedModuleKeys', () => {
        const { UIKitContextRoute: StrictRoute } = createUIKitContextRoute(useProductContext, {
          allowedModuleKeys: ['my-module', 'other-module'],
        });
        useProductContext.mockReturnValue(makeContext({ moduleKey: 'my-module', environmentType: 'PRODUCTION' }));
        render(<StrictRoute moduleKey="my-module"><div>content</div></StrictRoute>);
        expect(screen.getByText('content')).toBeInTheDocument();
      });
    });
  });

  describe('useModuleKeyMatch hook', () => {
    let useProductContext: ReturnType<typeof vi.fn<[], MockContext>>;
    let useModuleKeyMatch: ReturnType<typeof createUIKitContextRoute>['useModuleKeyMatch'];

    beforeEach(() => {
      useProductContext = vi.fn<[], MockContext>();
      ({ useModuleKeyMatch } = createUIKitContextRoute(useProductContext));
    });

    it('returns false when context is undefined', () => {
      useProductContext.mockReturnValue(undefined);
      function Consumer () {
        const matches = useModuleKeyMatch('my-module');
        return <div>{String(matches)}</div>;
      }
      render(<Consumer />);
      expect(screen.getByText('false')).toBeInTheDocument();
    });

    it('returns true on exact match', () => {
      useProductContext.mockReturnValue(makeContext({ moduleKey: 'my-module', environmentType: 'PRODUCTION' }));
      function Consumer () {
        const matches = useModuleKeyMatch('my-module');
        return <div>{String(matches)}</div>;
      }
      render(<Consumer />);
      expect(screen.getByText('true')).toBeInTheDocument();
    });

    it('returns true on prefix-match in DEVELOPMENT', () => {
      useProductContext.mockReturnValue(makeContext({ moduleKey: 'my-module-dev', environmentType: 'DEVELOPMENT' }));
      function Consumer () {
        const matches = useModuleKeyMatch('my-module');
        return <div>{String(matches)}</div>;
      }
      render(<Consumer />);
      expect(screen.getByText('true')).toBeInTheDocument();
    });

    it('returns false for non-matching key', () => {
      useProductContext.mockReturnValue(makeContext({ moduleKey: 'other-module', environmentType: 'DEVELOPMENT' }));
      function Consumer () {
        const matches = useModuleKeyMatch('my-module');
        return <div>{String(matches)}</div>;
      }
      render(<Consumer />);
      expect(screen.getByText('false')).toBeInTheDocument();
    });
  });
});
