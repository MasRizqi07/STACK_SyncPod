'use client';

import { useRef, type KeyboardEvent } from 'react';

export interface RadioChipOption<T extends string> {
  value: T;
  label: string;
}

export interface RadioChipGroupProps<T extends string> {
  options: readonly RadioChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  labelledBy: string;
  disabled?: boolean;
}

export function RadioChipGroup<T extends string>({
  options,
  value,
  onChange,
  labelledBy,
  disabled = false,
}: RadioChipGroupProps<T>) {
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function focusAndSelect(index: number): void {
    const option = options[index];
    if (!option || disabled) return;
    onChange(option.value);
    buttonRefs.current[index]?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
    if (disabled || options.length === 0) return;

    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (index + 1) % options.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (index - 1 + options.length) % options.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = options.length - 1;
    }

    if (nextIndex !== null) {
      event.preventDefault();
      focusAndSelect(nextIndex);
    }
  }

  const selectedIdx = options.findIndex((o) => o.value === value);
  const rovingTargetIdx = selectedIdx >= 0 ? selectedIdx : 0;

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      className="flex flex-wrap gap-2"
    >
      {options.map((option, index) => {
        const isSelected = option.value === value;
        const tabIndex = index === rovingTargetIdx ? 0 : -1;

        return (
          <button
            key={option.value}
            ref={(el) => {
              buttonRefs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={isSelected}
            tabIndex={tabIndex}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            onKeyDown={(ev) => handleKeyDown(ev, index)}
            className={`inline-flex min-h-[44px] items-center rounded-[var(--radius-control)] border px-3.5 py-2 text-sm font-medium transition-all duration-200 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40 ${
              isSelected
                ? 'border-primary bg-surface-elevated text-ink-primary ring-1 ring-primary/40 font-semibold'
                : 'border-border-subtle bg-canvas text-ink-primary hover:border-border-active hover:bg-surface-elevated'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
