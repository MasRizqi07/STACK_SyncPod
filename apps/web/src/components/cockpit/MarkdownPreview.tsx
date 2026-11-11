import Markdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { COPY } from '@/copy';

export interface MarkdownPreviewProps {
  content: string;
  emptyText?: string;
}

export function MarkdownPreview({
  content,
  emptyText = COPY.cockpit.notesEmpty,
}: MarkdownPreviewProps) {
  if (content.trim().length === 0) {
    return (
      <div className="rounded-[var(--radius-control)] border border-dashed border-border-subtle bg-canvas/40 p-4 text-sm text-ink-muted">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="max-w-none space-y-3 break-words text-[0.9375rem] leading-relaxed text-ink-primary">
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          h1: ({ children }) => (
            <h1 className="font-display text-xl font-bold text-ink-primary">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="font-display text-lg font-semibold text-ink-primary">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="font-display text-base font-semibold text-ink-primary">{children}</h3>
          ),
          p: ({ children }) => <p className="text-ink-primary">{children}</p>,
          ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5">{children}</ol>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-primary pl-3 text-ink-secondary">
              {children}
            </blockquote>
          ),
          code: ({ className, children }) => {
            const isBlock = Boolean(className?.startsWith('language-'));
            if (isBlock) {
              return (
                <code className="block overflow-x-auto rounded-[var(--radius-control)] border border-border-subtle bg-canvas p-3 font-mono text-xs text-ink-primary">
                  {children}
                </code>
              );
            }
            return (
              <code className="rounded bg-surface-elevated px-1.5 py-0.5 font-mono text-xs text-primary">
                {children}
              </code>
            );
          },
          pre: ({ children }) => <pre className="m-0 overflow-x-auto">{children}</pre>,
          a: ({ href, children }) => (
            <a
              href={href}
              rel="noopener noreferrer nofollow"
              className="text-primary underline underline-offset-2 hover:text-primary-hover"
            >
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-border-subtle text-sm">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-border-subtle bg-surface-elevated px-2.5 py-1.5 text-left font-medium text-ink-primary">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-border-subtle px-2.5 py-1.5 text-ink-secondary">
              {children}
            </td>
          ),
        }}
      >
        {content}
      </Markdown>
    </div>
  );
}

