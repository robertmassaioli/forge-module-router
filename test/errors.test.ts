import { describe, it, expect } from 'vitest';
import { ForgeContextError } from '../src/errors';

describe('ForgeContextError', () => {
  it('is an instance of Error', () => {
    const err = new ForgeContextError('test message');
    expect(err).toBeInstanceOf(Error);
  });

  it('is an instance of ForgeContextError', () => {
    const err = new ForgeContextError('test message');
    expect(err).toBeInstanceOf(ForgeContextError);
  });

  it('has the correct name', () => {
    const err = new ForgeContextError('test message');
    expect(err.name).toBe('ForgeContextError');
  });

  it('has the correct message', () => {
    const err = new ForgeContextError('something went wrong');
    expect(err.message).toBe('something went wrong');
  });
});
