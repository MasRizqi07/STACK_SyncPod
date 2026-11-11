import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MarkdownPreview } from '../src/components/cockpit/MarkdownPreview';

describe('MarkdownPreview XSS sanitization (PRD FR-3.2 / DESIGN B8)', () => {
  it('strips script tags, inline event handlers, and javascript: links', () => {
    const hostileMarkdown = [
      '# Catatanaman',
      '',
      '<script>window.xssInjected = true;</script>',
      '',
      '<img src="x" onerror="alert(1)" />',
      '',
      '[Klik berbahaya](javascript:alert(1))',
      '',
      '[Tautan aman](https://example.com)',
    ].join('\n');

    const html = renderToStaticMarkup(<MarkdownPreview content={hostileMarkdown} />);

    expect(html).toContain('Catatanaman');
    expect(html).toContain('Tautan aman');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('javascript:');
  });
});

