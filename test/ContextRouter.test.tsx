import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ContextRoute } from '../src/ContextRouter';
import { ForgeContextError } from '../src/errors';
import { ForgeContextInternal } from '../src/ViewContext';
import type { ForgeContext } from '../src/types';

vi.mock('@forge/bridge', () => ({
  view: { getContext: vi.fn() },
}));

// Helper: build a ForgeContext with sensible defaults, overridable per-test
function makeContext (overrides: Partial<ForgeContext> & { environmentType?: string } = {}): ForgeContext & { environmentType?: string } {
  const { environmentType, ...rest } = overrides;
  return {
    accountId: 'account-1',
    cloudId: 'cloud-1',
    extension: {},
    localId: 'local-1',
    locale: 'en-US',
    moduleKey: 'my-module',
    siteUrl: 'https://example.atlassian.net',
    timezone: 'UTC',
    ...(environmentType !== undefined ? { environmentType } : {}),
    ...rest,
  } as ForgeContext & { environmentType?: string };
}

// Helper: render a ContextRoute with a specific context value injected directly
function renderWithContext (
  context: ForgeContext,
  routeProps: Omit<React.ComponentProps<typeof ContextRoute>, 'children'>,
  child = <div>content</div>
) {
  const InternalProvider = (ForgeContextInternal as unknown as { Provider: React.Provider<ForgeContext | undefined> }).Provider;
  return render(
    <InternalProvider value={context}>
      <ContextRoute {...routeProps}>{child}</ContextRoute>
    </InternalProvider>
  );
}

describe('ContextRoute', () => {
  describe('wildcard (no filter props)', () => {
    it('renders children when no props are specified', () => {
      renderWithContext(makeContext(), {});
      expect(screen.getByText('content')).toBeInTheDocument();
    });
  });

  describe('moduleKey filtering — exact match (production behaviour)', () => {
    it('renders children when moduleKey matches exactly', () => {
      renderWithContext(makeContext({ moduleKey: 'my-module' }), { moduleKey: 'my-module' });
      expect(screen.getByText('content')).toBeInTheDocument();
    });

    it('renders null when moduleKey does not match', () => {
      renderWithContext(makeContext({ moduleKey: 'other-module' }), { moduleKey: 'my-module' });
      expect(screen.queryByText('content')).not.toBeInTheDocument();
    });

    it('does NOT prefix-match in production (environmentType=PRODUCTION)', () => {
      // 'my-module-v2' starts with 'my-module-' but we are in PRODUCTION — must not match
      renderWithContext(
        makeContext({ moduleKey: 'my-module-v2', environmentType: 'PRODUCTION' }),
        { moduleKey: 'my-module' }
      );
      expect(screen.queryByText('content')).not.toBeInTheDocument();
    });
  });

  describe('moduleKey filtering — prefix match (non-production environments)', () => {
    it('matches default dev suffix (-dev)', () => {
      renderWithContext(
        makeContext({ moduleKey: 'my-module-dev', environmentType: 'DEVELOPMENT' }),
        { moduleKey: 'my-module' }
      );
      expect(screen.getByText('content')).toBeInTheDocument();
    });

    it('matches staging suffix (-stg)', () => {
      renderWithContext(
        makeContext({ moduleKey: 'my-module-stg', environmentType: 'STAGING' }),
        { moduleKey: 'my-module' }
      );
      expect(screen.getByText('content')).toBeInTheDocument();
    });

    it('matches local suffix (-local)', () => {
      renderWithContext(
        makeContext({ moduleKey: 'my-module-local', environmentType: 'DEVELOPMENT' }),
        { moduleKey: 'my-module' }
      );
      expect(screen.getByText('content')).toBeInTheDocument();
    });

    it('matches arbitrary custom environment name (-alice)', () => {
      renderWithContext(
        makeContext({ moduleKey: 'my-module-alice', environmentType: 'DEVELOPMENT' }),
        { moduleKey: 'my-module' }
      );
      expect(screen.getByText('content')).toBeInTheDocument();
    });

    it('matches arbitrary multi-segment custom environment name (-my-feature-branch)', () => {
      renderWithContext(
        makeContext({ moduleKey: 'my-module-my-feature-branch', environmentType: 'DEVELOPMENT' }),
        { moduleKey: 'my-module' }
      );
      expect(screen.getByText('content')).toBeInTheDocument();
    });

    it('does not match when environmentType is undefined (unknown env — conservative fallback)', () => {
      // When environmentType is absent we cannot confirm we are non-production,
      // so we must not prefix-match (conservative: only exact match applies).
      renderWithContext(
        makeContext({ moduleKey: 'my-module-dev' }), // no environmentType
        { moduleKey: 'my-module' }
      );
      expect(screen.queryByText('content')).not.toBeInTheDocument();
    });

    it('does not match a completely different module key even in DEVELOPMENT', () => {
      renderWithContext(
        makeContext({ moduleKey: 'other-module-dev', environmentType: 'DEVELOPMENT' }),
        { moduleKey: 'my-module' }
      );
      expect(screen.queryByText('content')).not.toBeInTheDocument();
    });
  });

  describe('moduleKey filtering — console.warn on prefix-match', () => {
    let warnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    it('emits a console.warn when prefix-match fires in DEVELOPMENT', () => {
      renderWithContext(
        makeContext({ moduleKey: 'my-module-dev', environmentType: 'DEVELOPMENT' }),
        { moduleKey: 'my-module' }
      );
      expect(warnSpy).toHaveBeenCalledOnce();
      expect(warnSpy.mock.calls[0][0]).toContain('[forge-module-router]');
      expect(warnSpy.mock.calls[0][0]).toContain('my-module');
    });

    it('does NOT emit a console.warn on exact match', () => {
      renderWithContext(
        makeContext({ moduleKey: 'my-module', environmentType: 'DEVELOPMENT' }),
        { moduleKey: 'my-module' }
      );
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('does NOT emit a console.warn in production builds (NODE_ENV=production)', () => {
      const originalEnv = process.env.NODE_ENV;
      // @ts-expect-error — overriding read-only env for test
      process.env.NODE_ENV = 'production';
      try {
        // Exact match in production — no warn expected
        renderWithContext(
          makeContext({ moduleKey: 'my-module', environmentType: 'PRODUCTION' }),
          { moduleKey: 'my-module' }
        );
        expect(warnSpy).not.toHaveBeenCalled();
      } finally {
        // @ts-expect-error
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

  describe('modalType filtering', () => {
    it('renders children when modalType matches context modal type', () => {
      renderWithContext(
        makeContext({ extension: { modal: { type: 'confirm-delete' } } }),
        { modalType: 'confirm-delete' }
      );
      expect(screen.getByText('content')).toBeInTheDocument();
    });

    it('renders null when modalType does not match', () => {
      renderWithContext(
        makeContext({ extension: { modal: { type: 'other-modal' } } }),
        { modalType: 'confirm-delete' }
      );
      expect(screen.queryByText('content')).not.toBeInTheDocument();
    });

    it('renders null when modalType is set but there is no modal in context', () => {
      renderWithContext(
        makeContext({ extension: {} }),
        { modalType: 'confirm-delete' }
      );
      expect(screen.queryByText('content')).not.toBeInTheDocument();
    });
  });

  describe('noModal filtering', () => {
    it('renders children when noModal is true and there is no modal', () => {
      renderWithContext(makeContext({ extension: {} }), { noModal: true });
      expect(screen.getByText('content')).toBeInTheDocument();
    });

    it('renders null when noModal is true but a modal is present', () => {
      renderWithContext(
        makeContext({ extension: { modal: { type: 'any-modal' } } }),
        { noModal: true }
      );
      expect(screen.queryByText('content')).not.toBeInTheDocument();
    });
  });

  describe('combined props', () => {
    it('renders children when both moduleKey and noModal match', () => {
      renderWithContext(
        makeContext({ moduleKey: 'my-module', extension: {} }),
        { moduleKey: 'my-module', noModal: true }
      );
      expect(screen.getByText('content')).toBeInTheDocument();
    });

    it('renders children when moduleKey prefix-matches and noModal passes', () => {
      renderWithContext(
        makeContext({ moduleKey: 'my-module-dev', environmentType: 'DEVELOPMENT', extension: {} }),
        { moduleKey: 'my-module', noModal: true }
      );
      expect(screen.getByText('content')).toBeInTheDocument();
    });

    it('renders null when moduleKey matches but noModal fails', () => {
      renderWithContext(
        makeContext({ moduleKey: 'my-module', extension: { modal: { type: 'some-modal' } } }),
        { moduleKey: 'my-module', noModal: true }
      );
      expect(screen.queryByText('content')).not.toBeInTheDocument();
    });

    it('renders null when noModal passes but moduleKey fails', () => {
      renderWithContext(
        makeContext({ moduleKey: 'other-module', extension: {} }),
        { moduleKey: 'my-module', noModal: true }
      );
      expect(screen.queryByText('content')).not.toBeInTheDocument();
    });

    it('renders children when moduleKey and modalType both match', () => {
      renderWithContext(
        makeContext({ moduleKey: 'my-module', extension: { modal: { type: 'add-item' } } }),
        { moduleKey: 'my-module', modalType: 'add-item' }
      );
      expect(screen.getByText('content')).toBeInTheDocument();
    });
  });

  describe('used outside provider', () => {
    it('throws ForgeContextError when used outside a ForgeContextProvider', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() =>
        render(<ContextRoute><div>content</div></ContextRoute>)
      ).toThrow(ForgeContextError);
      consoleError.mockRestore();
    });
  });
});
