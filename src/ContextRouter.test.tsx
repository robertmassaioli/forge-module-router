import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ContextRoute } from './ContextRouter';
import { ForgeContextError } from './errors';
import { ForgeContextInternal } from './ViewContext';
import type { ForgeContext } from './types';

// We need direct access to the internal context to set up test wrappers
// without going through the async ForgeContextProvider.
// Re-export it from ViewContext for testing purposes via a test helper below.

vi.mock('@forge/bridge', () => ({
  view: { getContext: vi.fn() },
}));

// Helper: build a ForgeContext with sensible defaults, overridable per-test
function makeContext (overrides: Partial<ForgeContext> = {}): ForgeContext {
  return {
    accountId: 'account-1',
    cloudId: 'cloud-1',
    extension: {},
    localId: 'local-1',
    locale: 'en-US',
    moduleKey: 'my-module',
    siteUrl: 'https://example.atlassian.net',
    timezone: 'UTC',
    ...overrides,
  };
}

// Helper: render a ContextRoute with a specific context value injected directly
// via the internal context, bypassing the async provider.
function renderWithContext (
  context: ForgeContext,
  routeProps: Omit<React.ComponentProps<typeof ContextRoute>, 'children'>,
  child = <div>content</div>
) {
  // Access the internal context via the named export we add below
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

  describe('moduleKey filtering', () => {
    it('renders children when moduleKey matches', () => {
      renderWithContext(makeContext({ moduleKey: 'my-module' }), { moduleKey: 'my-module' });
      expect(screen.getByText('content')).toBeInTheDocument();
    });

    it('renders null when moduleKey does not match', () => {
      renderWithContext(makeContext({ moduleKey: 'other-module' }), { moduleKey: 'my-module' });
      expect(screen.queryByText('content')).not.toBeInTheDocument();
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
