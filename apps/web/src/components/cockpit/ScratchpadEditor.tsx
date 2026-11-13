'use client';

import { useEffect, useRef, useState } from 'react';
import { markdown } from '@codemirror/lang-markdown';
import { Annotation, EditorState } from '@codemirror/state';
import { EditorView, placeholder } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { Check, Eye, PenLine } from 'lucide-react';
import { COPY } from '@/copy';
import { MarkdownPreview } from './MarkdownPreview';

const externalSyncAnnotation = Annotation.define<boolean>();

export interface ScratchpadEditorProps {
  value: string;
  onChange: (nextValue: string) => void;
  onTypingActivity?: () => void;
  readOnly?: boolean;
}

const syncPodEditorTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: 'var(--bg-canvas)',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-mono)',
      fontSize: '0.875rem',
      lineHeight: '1.6',
      height: '100%',
      minHeight: '320px',
      borderRadius: 'var(--radius-control)',
      border: '1px solid var(--border-subtle)',
    },
    '&.cm-focused': {
      outline: '2px solid var(--color-primary)',
      outlineOffset: '2px',
    },
    '.cm-scroller': {
      overflow: 'auto',
      height: '100%',
      fontFamily: 'var(--font-mono)',
      padding: '0.5rem 0',
    },
    '.cm-content': {
      caretColor: 'var(--color-primary)',
      color: 'var(--text-primary)',
      padding: '0.25rem 0.5rem',
    },
    '.cm-line span': {
      color: 'var(--text-primary)',
      textDecoration: 'none',
    },
    '.cm-gutters': {
      backgroundColor: 'var(--bg-surface)',
      color: 'var(--text-muted)',
      borderRight: '1px solid var(--border-subtle)',
    },
    '.cm-activeLine': {
      backgroundColor: 'rgba(56, 189, 248, 0.06)',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'var(--bg-surface-elevated)',
      color: 'var(--text-secondary)',
    },
    '.cm-selectionBackground, ::selection': {
      backgroundColor: 'rgba(56, 189, 248, 0.22)',
    },
    '.cm-cursor': {
      borderLeftColor: 'var(--color-primary)',
    },
    '.cm-placeholder': {
      color: 'var(--text-muted)',
    },
  },
  { dark: true },
);

export function ScratchpadEditor({
  value,
  onChange,
  onTypingActivity,
  readOnly = false,
}: ScratchpadEditorProps) {
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write');
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onTypingRef = useRef(onTypingActivity);

  useEffect(() => {
    onChangeRef.current = onChange;
    onTypingRef.current = onTypingActivity;
  });

  useEffect(() => {
    const container = hostRef.current;
    if (!container || activeTab !== 'write') {
      return;
    }

    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        markdown(),
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({ 'aria-label': COPY.cockpit.panelNotes }),
        EditorState.readOnly.of(readOnly),
        placeholder(COPY.cockpit.notesEmpty),
        syncPodEditorTheme,
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) {
            return;
          }
          const isExternalOnly = update.transactions.every((tr) =>
            Boolean(tr.annotation(externalSyncAnnotation)),
          );
          if (isExternalOnly) {
            return;
          }
          onChangeRef.current(update.state.doc.toString());
          onTypingRef.current?.();
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: container,
    });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Initial doc and readOnly recreate editor cleanly when toggling between write and preview.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, readOnly]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || activeTab !== 'write') {
      return;
    }
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
        annotations: externalSyncAnnotation.of(true),
      });
    }
  }, [value, activeTab]);

  return (
    <section
      aria-label={COPY.cockpit.panelNotes}
      className="flex h-full min-h-0 min-w-0 flex-1 flex-col rounded-[var(--radius-panel)] border border-border-subtle bg-surface p-[var(--space-card)]"
    >
      <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border-subtle pb-3">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-base font-semibold text-ink-primary">
            {COPY.cockpit.panelNotes}
          </h2>
          <span className="inline-flex items-center gap-1 text-xs text-emerald">
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{COPY.cockpit.autoSaved}</span>
          </span>
        </div>

        <div
          role="tablist"
          aria-label={COPY.cockpit.panelNotes}
          className="inline-flex rounded-[var(--radius-control)] border border-border-subtle bg-canvas p-0.5"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'write'}
            onClick={() => setActiveTab('write')}
            className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-[calc(var(--radius-control)-2px)] px-3 py-1 text-xs font-medium transition-colors duration-200 ${
              activeTab === 'write'
                ? 'bg-surface-elevated text-ink-primary'
                : 'text-ink-secondary hover:text-ink-primary'
            }`}
          >
            <PenLine className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{COPY.cockpit.tabWrite}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'preview'}
            onClick={() => setActiveTab('preview')}
            className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-[calc(var(--radius-control)-2px)] px-3 py-1 text-xs font-medium transition-colors duration-200 ${
              activeTab === 'preview'
                ? 'bg-surface-elevated text-ink-primary'
                : 'text-ink-secondary hover:text-ink-primary'
            }`}
          >
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{COPY.cockpit.tabPreview}</span>
          </button>
        </div>
      </div>

      {activeTab === 'write' ? (
        <div
          ref={hostRef}
          data-scratchpad-mode="write"
          className="flex h-full min-h-[320px] min-w-0 flex-1 flex-col overflow-hidden [&_.cm-editor]:h-full [&_.cm-editor]:flex-1"
        />
      ) : (
        <div
          data-scratchpad-mode="preview"
          className="h-full min-h-[320px] min-w-0 flex-1 overflow-y-auto rounded-[var(--radius-control)] border border-border-subtle bg-canvas/60 p-4"
        >
          <MarkdownPreview content={value} />
        </div>
      )}
    </section>
  );
}

