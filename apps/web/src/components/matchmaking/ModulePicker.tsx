'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronRight, FolderTree, Search } from 'lucide-react';
import { COPY } from '@/copy';
import { filterModuleCatalog, type ModuleTreeNode } from '@/features/matchmaking';

export interface ModulePickerProps {
  nodes: readonly ModuleTreeNode[];
  selectedNode: ModuleTreeNode | null;
  onSelectNode: (node: ModuleTreeNode) => void;
  disabled?: boolean;
}

export function ModulePicker({
  nodes,
  selectedNode,
  onSelectNode,
  disabled = false,
}: ModulePickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(['course-if201', 'topic-sd-graf']),
  );

  const visibleNodes = useMemo(
    () => filterModuleCatalog(searchQuery, nodes),
    [searchQuery, nodes],
  );
  const isFiltering = searchQuery.trim().length > 0;

  function toggleExpanded(node: ModuleTreeNode): void {
    onSelectNode(node);
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(node.id)) {
        next.delete(node.id);
      } else {
        next.add(node.id);
      }
      return next;
    });
  }

  return (
    <div className="space-y-2.5">
      <div className="relative">
        <label htmlFor="module-search-input" className="sr-only">
          {COPY.matchmaking.moduleSearchPlaceholder}
        </label>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
          aria-hidden="true"
        />
        <input
          id="module-search-input"
          type="search"
          disabled={disabled}
          value={searchQuery}
          onChange={(ev) => setSearchQuery(ev.target.value)}
          placeholder={COPY.matchmaking.moduleSearchPlaceholder}
          className="min-h-[44px] w-full rounded-[var(--radius-control)] border border-border-subtle bg-canvas py-2 pl-9 pr-3 text-sm text-ink-primary placeholder:text-ink-muted focus:border-primary disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      <div
        role="region"
        aria-label={COPY.matchmaking.modulePrompt}
        className="max-h-[290px] overflow-y-auto rounded-[var(--radius-control)] border border-border-subtle bg-canvas p-2"
      >
        {visibleNodes.length === 0 ? (
          <p className="p-3 text-sm text-ink-secondary">{COPY.matchmaking.emptySearch}</p>
        ) : (
          <ul className="m-0 list-none space-y-1 p-0">
            {visibleNodes.map((course) => {
              const courseExpanded = isFiltering || expandedIds.has(course.id);
              const isCourseSelected = selectedNode?.id === course.id;

              return (
                <li key={course.id}>
                  <button
                    type="button"
                    disabled={disabled}
                    aria-expanded={courseExpanded}
                    onClick={() => toggleExpanded(course)}
                    className={`flex min-h-[44px] w-full items-center justify-between gap-2 rounded-[var(--radius-control)] px-2.5 py-2 text-left text-sm font-semibold transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${
                      isCourseSelected
                        ? 'bg-surface-elevated text-amber'
                        : 'text-ink-primary hover:bg-surface'
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {courseExpanded ? (
                        <ChevronDown className="h-4 w-4 shrink-0 text-ink-secondary" aria-hidden="true" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0 text-ink-secondary" aria-hidden="true" />
                      )}
                      <span className="truncate">{course.title}</span>
                    </span>
                    <span className="tabular-nums shrink-0 text-xs font-normal text-ink-muted">
                      {course.courseCode}
                    </span>
                  </button>

                  {courseExpanded && course.children && (
                    <ul className="m-0 mt-1 list-none space-y-1 border-l border-border-subtle pl-3">
                      {course.children.map((topic) => {
                        const topicExpanded = isFiltering || expandedIds.has(topic.id);
                        const isTopicSelected = selectedNode?.id === topic.id;

                        return (
                          <li key={topic.id}>
                            <button
                              type="button"
                              disabled={disabled}
                              aria-expanded={topicExpanded}
                              onClick={() => toggleExpanded(topic)}
                              className={`flex min-h-[44px] w-full items-center gap-2 rounded-[var(--radius-control)] px-2.5 py-1.5 text-left text-sm font-medium transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${
                                isTopicSelected
                                  ? 'bg-surface-elevated text-amber'
                                  : 'text-ink-secondary hover:bg-surface hover:text-ink-primary'
                              }`}
                            >
                              {topicExpanded ? (
                                <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                              )}
                              <span className="truncate">{topic.title}</span>
                            </button>

                            {topicExpanded && topic.children && (
                              <ul className="m-0 mt-1 list-none space-y-1 border-l border-border-subtle pl-3">
                                {topic.children.map((leaf) => {
                                  const isLeafSelected = selectedNode?.id === leaf.id;
                                  return (
                                    <li key={leaf.id}>
                                      <button
                                        type="button"
                                        disabled={disabled}
                                        data-module-id={leaf.id}
                                        data-module-leaf="true"
                                        aria-pressed={isLeafSelected}
                                        onClick={() => onSelectNode(leaf)}
                                        className={`flex min-h-[44px] w-full items-center justify-between gap-2 rounded-[var(--radius-control)] border px-2.5 py-1.5 text-left text-sm transition-all duration-200 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-1 disabled:cursor-not-allowed disabled:opacity-40 ${
                                          isLeafSelected
                                            ? 'border-primary bg-surface-elevated font-medium text-ink-primary ring-1 ring-primary/40'
                                            : 'border-transparent text-ink-primary hover:border-border-subtle hover:bg-surface'
                                        }`}
                                      >
                                        <span className="min-w-0 break-words">{leaf.title}</span>
                                        {isLeafSelected && (
                                          <Check
                                            className="h-4 w-4 shrink-0 text-primary"
                                            aria-hidden="true"
                                          />
                                        )}
                                      </button>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {selectedNode && !selectedNode.isLeaf && (
        <p
          role="status"
          data-nonleaf-hint="true"
          className="flex items-center gap-2 rounded-[var(--radius-control)] border border-amber/40 bg-canvas px-3 py-2 text-xs font-medium text-amber"
        >
          <FolderTree className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{COPY.matchmaking.moduleHintNonLeaf}</span>
        </p>
      )}

      {selectedNode && selectedNode.isLeaf && (
        <p className="text-xs text-ink-secondary">
          <span className="text-ink-muted">{COPY.matchmaking.selectedModuleLabel}: </span>
          <span className="font-medium text-ink-primary">{selectedNode.path.join(' › ')}</span>
        </p>
      )}
    </div>
  );
}
