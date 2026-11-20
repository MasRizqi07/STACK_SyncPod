import { describe, expect, it } from 'vitest';
import { safeCallbackPath } from '../src/lib/callback-url';

describe('safeCallbackPath (D38, 3.6)', () => {
  const cases = [
    { input: '/pod', expected: '/pod', desc: 'exact /pod root' },
    { input: '/pod/session-123', expected: '/pod/session-123', desc: 'nested /pod route' },
    { input: '/pod?scenario=fallback', expected: '/pod?scenario=fallback', desc: '/pod with query string' },
    { input: '/pod/pod-42/selesai', expected: '/pod/pod-42/selesai', desc: 'deeply nested pod route' },
    { input: '  /pod/session  ', expected: '/pod/session', desc: 'trimmed valid path' },
    { input: '//evil.com', expected: null, desc: 'protocol-relative URL' },
    { input: 'https://evil.com/pod', expected: null, desc: 'absolute HTTPS URL' },
    { input: 'http://evil.com/pod', expected: null, desc: 'absolute HTTP URL' },
    { input: '/\\evil.com', expected: null, desc: 'slash backslash exploit' },
    { input: '/pod\\evil', expected: null, desc: 'internal backslash trick' },
    { input: 'javascript:alert(1)', expected: null, desc: 'javascript pseudo-protocol' },
    { input: 'JAVASCRIPT:alert(1)', expected: null, desc: 'uppercase javascript pseudo-protocol' },
    { input: 'data:text/html;base64,123', expected: null, desc: 'data pseudo-protocol' },
    { input: '%2F%2Fevil.com', expected: null, desc: 'encoded protocol-relative' },
    { input: '/pod/%5Cevil.com', expected: null, desc: 'encoded backslash' },
    { input: '/pod/\\evil.com', expected: null, desc: 'backslash immediately after /pod/' },
    { input: '/pod/%E0%A4', expected: null, desc: 'malformed URI decoding' },
    { input: '/pod/../admin', expected: null, desc: 'relative path traversal with ..' },
    { input: '/pod/%2e%2e/secret', expected: null, desc: 'encoded path traversal' },
    { input: '/masuk', expected: null, desc: 'different path (/masuk)' },
    { input: '/pod-attack', expected: null, desc: 'path starting with /pod without boundary' },
    { input: '', expected: null, desc: 'empty string' },
    { input: '   ', expected: null, desc: 'whitespace only' },
    { input: null, expected: null, desc: 'null input' },
    { input: undefined, expected: null, desc: 'undefined input' },
    { input: 12345, expected: null, desc: 'non-string input' },
  ];

  for (const { input, expected, desc } of cases) {
    it(`handles ${desc}: ${String(input)}`, () => {
      expect(safeCallbackPath(input)).toBe(expected);
    });
  }
});
