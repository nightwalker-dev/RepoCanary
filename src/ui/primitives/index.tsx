import React, { useEffect, useId, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Info,
  Loader2,
  ShieldAlert,
  Upload,
  X,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Severity } from '../../core/types';
import {
  MOTION_TOKENS,
  SEVERITY_TOKENS,
  truncateMiddlePath,
} from '../tokens';

/* -------------------------------------------------------------------------- */
/* 1. Severity Icon & SeverityTag / Badge                                     */
/* -------------------------------------------------------------------------- */

export const SeverityIcon: React.FC<{
  severity: Severity | 'none';
  size?: 16 | 20 | 24;
}> = ({ severity, size = 16 }) => {
  const sizeClass =
    size === 24 ? 'w-6 h-6' : size === 20 ? 'w-5 h-5' : 'w-4 h-4';
  const meta = SEVERITY_TOKENS[severity] ?? SEVERITY_TOKENS.none;

  switch (severity) {
    case 'critical':
      return (
        <AlertOctagon
          className={`${sizeClass} shrink-0 ${meta.textClass}`}
          aria-hidden="true"
        />
      );
    case 'high':
      return (
        <ShieldAlert
          className={`${sizeClass} shrink-0 ${meta.textClass}`}
          aria-hidden="true"
        />
      );
    case 'medium':
      return (
        <AlertTriangle
          className={`${sizeClass} shrink-0 ${meta.textClass}`}
          aria-hidden="true"
        />
      );
    case 'low':
      return (
        <AlertCircle
          className={`${sizeClass} shrink-0 ${meta.textClass}`}
          aria-hidden="true"
        />
      );
    case 'info':
      return (
        <Info
          className={`${sizeClass} shrink-0 ${meta.textClass}`}
          aria-hidden="true"
        />
      );
    default:
      return (
        <CheckCircle2
          className={`${sizeClass} shrink-0 ${meta.textClass}`}
          aria-hidden="true"
        />
      );
  }
};

export interface SeverityTagProps {
  severity: Severity | 'none';
  count?: number;
  showWeight?: boolean;
  compact?: boolean;
}

export const SeverityTag: React.FC<SeverityTagProps> = ({
  severity,
  count,
  showWeight = false,
  compact = false,
}) => {
  const meta = SEVERITY_TOKENS[severity] ?? SEVERITY_TOKENS.none;
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono font-semibold rounded-rc-sm tabular-nums whitespace-nowrap shrink-0 ${
        compact ? 'px-2 py-0.5 rc-text-12' : 'px-2.5 py-1 rc-text-12'
      } ${meta.badgeClass}`}
    >
      <SeverityIcon severity={severity} size={16} />
      <span>{meta.shortLabel}</span>
      {typeof count === 'number' && <span>({count})</span>}
      {showWeight && (
        <span className="text-rc-text-muted font-normal">
          · {meta.weightLabel}
        </span>
      )}
    </span>
  );
};

export interface BadgeProps {
  children: React.ReactNode;
  tone?: 'neutral' | 'accent' | 'clean';
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  tone = 'neutral',
  icon,
}) => {
  const toneClass =
    tone === 'accent'
      ? 'bg-rc-medium-bg text-rc-accent border border-rc-medium-border'
      : tone === 'clean'
        ? 'rc-sev-clean'
        : 'bg-rc-surface-2 text-rc-text-muted border border-rc-border';

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-rc-sm font-mono rc-text-12 tabular-nums whitespace-nowrap shrink-0 ${toneClass}`}
    >
      {icon}
      <span>{children}</span>
    </span>
  );
};

/* -------------------------------------------------------------------------- */
/* 2. Button & IconButton (min 44x44px touch target, all 6 states)            */
/* -------------------------------------------------------------------------- */

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  disabled,
  children,
  className = '',
  type = 'button',
  ...rest
}) => {
  const isDisabled = disabled || loading;

  const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
    primary:
      'bg-rc-accent text-rc-accent-ink font-semibold border border-rc-accent hover:bg-rc-accent-hover active:translate-y-[1px]',
    secondary:
      'bg-rc-surface-2 text-rc-text font-medium border border-rc-border hover:border-rc-border-strong hover:bg-rc-surface active:translate-y-[1px]',
    ghost:
      'bg-transparent text-rc-text-muted font-medium border border-transparent hover:text-rc-text hover:bg-rc-surface-2 active:translate-y-[1px]',
    danger:
      'bg-rc-critical-bg text-rc-critical font-semibold border border-rc-critical-border hover:bg-rc-surface-2 active:translate-y-[1px]',
  };

  // Every size enforces at least min-h-11 (44px) for WCAG touch target compliance
  const sizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
    sm: 'min-h-11 px-3 py-2 rc-text-12 gap-2 rounded-rc-sm',
    md: 'min-h-11 px-4 py-2.5 rc-text-14 gap-2 rounded-rc-sm',
    lg: 'min-h-12 px-6 py-3 rc-text-16 gap-2.5 rounded-rc-md',
  };

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center whitespace-nowrap shrink-0 rc-transition-fast rc-focus-ring ${
        variantClasses[variant]
      } ${sizeClasses[size]} ${
        isDisabled
          ? 'opacity-50 cursor-not-allowed pointer-events-none'
          : 'cursor-pointer'
      } ${className}`}
      {...rest}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
      ) : (
        icon && <span className="inline-flex items-center shrink-0">{icon}</span>
      )}
      <span>{children}</span>
    </button>
  );
};

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
  loading?: boolean;
  variant?: 'secondary' | 'ghost';
}

export const IconButton: React.FC<IconButtonProps> = ({
  label,
  active = false,
  loading = false,
  variant = 'ghost',
  disabled,
  children,
  className = '',
  type = 'button',
  ...rest
}) => {
  const isDisabled = disabled || loading;
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      disabled={isDisabled}
      className={`inline-flex items-center justify-center min-w-11 min-h-11 p-2.5 rounded-rc-sm rc-transition-fast rc-focus-ring shrink-0 ${
        active
          ? 'bg-rc-surface-2 text-rc-accent border border-rc-accent'
          : variant === 'secondary'
            ? 'bg-rc-surface-2 text-rc-text border border-rc-border hover:border-rc-border-strong'
            : 'bg-transparent text-rc-text-muted border border-transparent hover:text-rc-text hover:bg-rc-surface-2'
      } ${
        isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      } ${className}`}
      {...rest}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
      ) : (
        children
      )}
    </button>
  );
};

/* -------------------------------------------------------------------------- */
/* 3. Tabs & SegmentedControl (Full keyboard Left/Right navigation)           */
/* -------------------------------------------------------------------------- */

export interface TabOption<T extends string> {
  id: T;
  label: string;
  count?: number;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface TabsProps<T extends string> {
  ariaLabel: string;
  options: ReadonlyArray<TabOption<T>>;
  value: T;
  onChange: (next: T) => void;
  variant?: 'underline' | 'pill';
}

export function Tabs<T extends string>({
  ariaLabel,
  options,
  value,
  onChange,
  variant = 'underline',
}: TabsProps<T>) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleKeyDown = (e: React.KeyboardEvent, idx: number) => {
    const enabledIndices = options
      .map((opt, i) => (!opt.disabled ? i : -1))
      .filter((i) => i >= 0);
    const pos = enabledIndices.indexOf(idx);
    if (pos === -1) return;

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const nextIdx = enabledIndices[(pos + 1) % enabledIndices.length];
      tabRefs.current[nextIdx]?.focus();
      onChange(options[nextIdx].id);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prevIdx =
        enabledIndices[
          (pos - 1 + enabledIndices.length) % enabledIndices.length
        ];
      tabRefs.current[prevIdx]?.focus();
      onChange(options[prevIdx].id);
    }
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={
        variant === 'underline'
          ? 'flex items-center gap-2 border-b border-rc-border bg-rc-surface px-4 pt-2 overflow-x-auto'
          : 'flex items-center gap-1.5 p-1.5 bg-rc-surface border border-rc-border rounded-rc-md overflow-x-auto'
      }
    >
      {options.map((opt, idx) => {
        const isSelected = opt.id === value;
        return (
          <button
            key={opt.id}
            ref={(el) => {
              tabRefs.current[idx] = el;
            }}
            type="button"
            role="tab"
            aria-selected={isSelected}
            disabled={opt.disabled}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => !opt.disabled && onChange(opt.id)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={`inline-flex items-center gap-2 min-h-11 px-4 py-2 rc-text-14 font-medium whitespace-nowrap shrink-0 rc-transition-fast rc-focus-ring ${
              variant === 'underline'
                ? isSelected
                  ? 'bg-rc-bg text-rc-accent border-b-2 border-rc-accent rounded-t-rc-sm font-semibold'
                  : 'text-rc-text-muted border-b-2 border-transparent hover:text-rc-text'
                : isSelected
                  ? 'bg-rc-accent text-rc-accent-ink font-semibold rounded-rc-sm'
                  : 'text-rc-text-muted hover:text-rc-text hover:bg-rc-surface-2 rounded-rc-sm'
            } ${
              opt.disabled
                ? 'opacity-40 cursor-not-allowed'
                : 'cursor-pointer'
            }`}
          >
            {opt.icon && <span className="shrink-0">{opt.icon}</span>}
            <span>{opt.label}</span>
            {typeof opt.count === 'number' && (
              <span className="font-mono rc-text-12 tabular-nums opacity-85">
                ({opt.count})
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function SegmentedControl<T extends string>({
  ariaLabel,
  options,
  value,
  onChange,
}: Omit<TabsProps<T>, 'variant'>) {
  return (
    <Tabs
      ariaLabel={ariaLabel}
      options={options}
      value={value}
      onChange={onChange}
      variant="pill"
    />
  );
}

/* -------------------------------------------------------------------------- */
/* 4. Toggle Switch (role="switch", min 44px touch target)                    */
/* -------------------------------------------------------------------------- */

export interface ToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}

export const Toggle: React.FC<ToggleProps> = ({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}) => {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="space-y-1">
        <label
          htmlFor={id}
          className="block rc-text-14 font-semibold text-rc-text cursor-pointer"
        >
          {label}
        </label>
        {description && (
          <p className="rc-text-12 text-rc-text-muted rc-prose-col">
            {description}
          </p>
        )}
      </div>

      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative inline-flex items-center min-h-11 px-3 py-2 rounded-rc-full font-mono rc-text-12 font-semibold rc-transition-fast rc-focus-ring shrink-0 ${
          checked
            ? 'bg-rc-accent text-rc-accent-ink border border-rc-accent'
            : 'bg-rc-surface-2 text-rc-text-muted border border-rc-border hover:border-rc-border-strong'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span
          className={`w-2.5 h-2.5 rounded-rc-full mr-2 ${
            checked ? 'bg-rc-accent-ink' : 'bg-rc-text-muted'
          }`}
          aria-hidden="true"
        />
        <span>{checked ? 'ON' : 'OFF'}</span>
      </button>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 5. Input & Textarea (with label, helper, error states)                     */
/* -------------------------------------------------------------------------- */

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hideLabel?: boolean;
  helperText?: string;
  errorText?: string | null;
  leftIcon?: React.ReactNode;
  rightSlot?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      hideLabel = false,
      helperText,
      errorText,
      leftIcon,
      rightSlot,
      id,
      className = '',
      ...rest
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const hasError = Boolean(errorText);

    return (
      <div className="space-y-1.5 w-full">
        {label && (
          <label
            htmlFor={inputId}
            className={
              hideLabel
                ? 'sr-only'
                : 'block rc-text-12 font-mono font-medium text-rc-text-muted'
            }
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <span
              className="absolute left-3.5 text-rc-text-muted pointer-events-none"
              aria-hidden="true"
            >
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={hasError || undefined}
            className={`w-full min-h-11 py-2.5 bg-rc-bg text-rc-text placeholder:text-rc-text-muted rc-text-14 font-mono rounded-rc-sm border rc-transition-fast rc-focus-ring ${
              leftIcon ? 'pl-10' : 'pl-3.5'
            } ${rightSlot ? 'pr-16' : 'pr-3.5'} ${
              hasError
                ? 'border-rc-critical'
                : 'border-rc-border hover:border-rc-border-strong'
            } ${className}`}
            {...rest}
          />
          {rightSlot && (
            <div className="absolute right-2 flex items-center">
              {rightSlot}
            </div>
          )}
        </div>
        {errorText ? (
          <p role="alert" className="rc-text-12 text-rc-critical font-mono">
            {errorText}
          </p>
        ) : (
          helperText && (
            <p className="rc-text-12 text-rc-text-muted">{helperText}</p>
          )
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  errorText?: string | null;
}

export const Textarea: React.FC<TextareaProps> = ({
  label,
  helperText,
  errorText,
  id,
  className = '',
  ...rest
}) => {
  const generatedId = useId();
  const textareaId = id || generatedId;
  const hasError = Boolean(errorText);

  return (
    <div className="space-y-1.5 w-full">
      {label && (
        <label
          htmlFor={textareaId}
          className="block rc-text-12 font-mono font-medium text-rc-text-muted"
        >
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        aria-invalid={hasError || undefined}
        className={`w-full p-4 bg-rc-bg text-rc-text placeholder:text-rc-text-muted rc-text-14 font-mono rounded-rc-sm border rc-transition-fast rc-focus-ring ${
          hasError
            ? 'border-rc-critical'
            : 'border-rc-border hover:border-rc-border-strong'
        } ${className}`}
        {...rest}
      />
      {errorText ? (
        <p role="alert" className="rc-text-12 text-rc-critical font-mono">
          {errorText}
        </p>
      ) : (
        helperText && (
          <p className="rc-text-12 text-rc-text-muted">{helperText}</p>
        )
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 6. Card & Dropzone                                                         */
/* -------------------------------------------------------------------------- */

export interface CardProps {
  children: React.ReactNode;
  elevation?: 1 | 2 | 3;
  className?: string;
  as?: 'div' | 'section' | 'article' | 'aside';
  ariaLabel?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  elevation = 1,
  className = '',
  as: Component = 'div',
  ariaLabel,
}) => {
  const shadowClass =
    elevation === 3
      ? 'shadow-rc-3'
      : elevation === 2
        ? 'shadow-rc-2'
        : 'shadow-rc-1';

  return (
    <Component
      aria-label={ariaLabel}
      className={`bg-rc-surface border border-rc-border rounded-rc-md ${shadowClass} ${className}`}
    >
      {children}
    </Component>
  );
};

export interface DropzoneProps {
  isDragging: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  title: string;
  subtitle: string;
  actions: React.ReactNode;
  limitsFooter: React.ReactNode;
}

export const Dropzone: React.FC<DropzoneProps> = ({
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  title,
  subtitle,
  actions,
  limitsFooter,
}) => {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`border-2 border-dashed rounded-rc-md p-8 sm:p-12 text-center rc-transition-base ${
        isDragging
          ? 'border-rc-accent bg-rc-medium-bg'
          : 'border-rc-border bg-rc-bg hover:border-rc-border-strong'
      }`}
    >
      <div className="mx-auto w-12 h-12 rounded-rc-full bg-rc-surface-2 border border-rc-border flex items-center justify-center mb-4">
        <Upload className="w-5 h-5 text-rc-accent" aria-hidden="true" />
      </div>
      <h2 className="rc-text-20 font-semibold text-rc-text">{title}</h2>
      <p className="rc-text-14 text-rc-text-muted mt-2 max-w-xl mx-auto">
        {subtitle}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {actions}
      </div>
      <div className="mt-8 pt-4 border-t border-rc-border rc-text-12 font-mono text-rc-text-muted">
        {limitsFooter}
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 7. Chip (for hidden Unicode / Bidi / Zero-width / HTML comments in X-Ray)  */
/* -------------------------------------------------------------------------- */

export interface ChipProps {
  kind: 'tag' | 'bidi' | 'zero-width' | 'homoglyph' | 'comment';
  label: string;
  tooltip?: string;
}

export const Chip: React.FC<ChipProps> = ({ kind, label, tooltip }) => {
  const kindClass =
    kind === 'tag'
      ? 'rc-sev-critical'
      : kind === 'bidi'
        ? 'rc-sev-high'
        : kind === 'zero-width'
          ? 'rc-sev-medium'
          : kind === 'homoglyph'
            ? 'rc-sev-low'
            : 'rc-sev-high';

  return (
    <span
      title={tooltip || label}
      className={`inline-flex items-center mx-1 my-0.5 px-2 py-0.5 rounded-rc-sm font-mono rc-text-12 font-semibold align-baseline break-all ${kindClass}`}
    >
      {label}
    </span>
  );
};

/* -------------------------------------------------------------------------- */
/* 8. Tooltip & MiddleTruncatePath                                            */
/* -------------------------------------------------------------------------- */

export interface MiddleTruncatePathProps {
  path: string;
  maxLength?: number;
  className?: string;
}

export const MiddleTruncatePath: React.FC<MiddleTruncatePathProps> = ({
  path,
  maxLength = 36,
  className = '',
}) => {
  const display = truncateMiddlePath(path, maxLength);
  return (
    <span
      title={path}
      aria-label={path}
      className={`font-mono inline-block max-w-full truncate align-bottom ${className}`}
    >
      {display}
    </span>
  );
};

export interface TooltipProps {
  content: string;
  children: React.ReactNode;
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children }) => {
  return (
    <span className="relative group inline-flex items-center" title={content}>
      {children}
      <span
        role="tooltip"
        className="pointer-events-none opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 rc-transition-fast absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 bg-rc-surface-2 border border-rc-border text-rc-text font-mono rc-text-12 rounded-rc-sm shadow-rc-2 whitespace-nowrap z-40"
      >
        {content}
      </span>
    </span>
  );
};

/* -------------------------------------------------------------------------- */
/* 9. Accordion (with prefers-reduced-motion support)                         */
/* -------------------------------------------------------------------------- */

export interface AccordionProps {
  title: React.ReactNode;
  rightMeta?: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  borderClass?: string;
  children: React.ReactNode;
}

export const Accordion: React.FC<AccordionProps> = ({
  title,
  rightMeta,
  isOpen,
  onToggle,
  borderClass = 'border-rc-border',
  children,
}) => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section
      className={`bg-rc-surface border ${borderClass} rounded-rc-md overflow-hidden shadow-rc-1`}
    >
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={onToggle}
        className="w-full min-h-12 px-4 py-3 bg-rc-surface-2 flex items-center justify-between gap-4 text-left cursor-pointer hover:bg-rc-surface rc-transition-fast rc-focus-ring"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {isOpen ? (
            <ChevronDown
              className="w-4 h-4 text-rc-text-muted shrink-0"
              aria-hidden="true"
            />
          ) : (
            <ChevronRight
              className="w-4 h-4 text-rc-text-muted shrink-0"
              aria-hidden="true"
            />
          )}
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            {title}
          </div>
        </div>
        {rightMeta && (
          <div className="rc-text-12 font-mono text-rc-text-muted tabular-nums shrink-0">
            {rightMeta}
          </div>
        )}
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0 }}
            transition={{
              duration: shouldReduceMotion ? 0 : MOTION_TOKENS.baseMs / 1000,
              ease: MOTION_TOKENS.easing,
            }}
            className="divide-y divide-rc-border border-t border-rc-border"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

/* -------------------------------------------------------------------------- */
/* 10. ProgressBar, Skeleton, EmptyState, ErrorState                          */
/* -------------------------------------------------------------------------- */

export const ProgressBar: React.FC<{
  value: number;
  label?: string;
}> = ({ value, label }) => {
  const clamped = Math.min(100, Math.max(0, Math.round(value)));
  return (
    <div className="space-y-2 w-full" aria-live="polite">
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || 'Scan progress'}
        className="h-2.5 w-full bg-rc-surface-2 border border-rc-border rounded-rc-full overflow-hidden"
      >
        <div
          className="h-full bg-rc-accent rc-transition-base"
          style={{ width: `${Math.max(4, clamped)}%` }}
        />
      </div>
      {label && (
        <div className="flex justify-between rc-text-12 font-mono text-rc-text-muted tabular-nums">
          <span>{label}</span>
          <span>{clamped}%</span>
        </div>
      )}
    </div>
  );
};

export const Skeleton: React.FC<{ className?: string }> = ({
  className = 'h-6 w-full',
}) => (
  <div
    aria-hidden="true"
    className={`animate-pulse bg-rc-surface-2 rounded-rc-sm border border-rc-border ${className}`}
  />
);

export const EmptyState: React.FC<{
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}> = ({ icon, title, description, action }) => (
  <div className="p-8 sm:p-12 bg-rc-surface border border-rc-border rounded-rc-md text-center space-y-3">
    {icon && (
      <div className="mx-auto w-12 h-12 rounded-rc-full bg-rc-surface-2 border border-rc-border flex items-center justify-center text-rc-accent">
        {icon}
      </div>
    )}
    <h3 className="rc-text-18 font-semibold text-rc-text">{title}</h3>
    <p className="rc-text-14 text-rc-text-muted max-w-md mx-auto">
      {description}
    </p>
    {action && <div className="pt-2 flex justify-center">{action}</div>}
  </div>
);

export const ErrorState: React.FC<{
  title?: string;
  message: string;
  onDismiss?: () => void;
}> = ({ title = 'Scan Input Rejected', message, onDismiss }) => (
  <div
    role="alert"
    className="p-4 rounded-rc-md rc-sev-critical flex items-start justify-between gap-4"
  >
    <div className="flex items-start gap-3">
      <ShieldAlert className="w-5 h-5 text-rc-critical shrink-0 mt-0.5" aria-hidden="true" />
      <div className="space-y-1">
        <div className="rc-text-14 font-semibold text-rc-critical">{title}</div>
        <p className="rc-text-14 text-rc-text">{message}</p>
      </div>
    </div>
    {onDismiss && (
      <Button variant="ghost" size="sm" onClick={onDismiss}>
        Dismiss
      </Button>
    )}
  </div>
);

/* -------------------------------------------------------------------------- */
/* 11. CodeBlock (Plain-text safe rendering + Copy Button)                    */
/* -------------------------------------------------------------------------- */

export interface CodeBlockProps {
  code: string;
  label?: string;
  maxHeightClass?: string;
  showCopy?: boolean;
  onCopied?: () => void;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  label,
  maxHeightClass = 'max-h-72',
  showCopy = true,
  onCopied,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // Fallback if clipboard API is restricted
    }
    setCopied(true);
    onCopied?.();
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="rounded-rc-sm border border-rc-border bg-rc-bg overflow-hidden">
      {(label || showCopy) && (
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-rc-surface-2 border-b border-rc-border rc-text-12 font-mono text-rc-text-muted">
          <span className="truncate">{label || 'Plain-text excerpt'}</span>
          {showCopy && (
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-rc-sm text-rc-accent hover:bg-rc-surface rc-transition-fast rc-focus-ring cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-rc-clean" aria-hidden="true" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Copy</span>
                </>
              )}
            </button>
          )}
        </div>
      )}
      <pre
        className={`p-3 rc-text-12 font-mono text-rc-text overflow-x-auto overflow-y-auto whitespace-pre-wrap break-words ${maxHeightClass}`}
      >
        {code}
      </pre>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 12. Modal (Focus trap, Escape key close, focus return)                     */
/* -------------------------------------------------------------------------- */

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
}) => {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;

    const focusTimer = window.setTimeout(() => {
      const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      firstFocusable?.focus();
    }, 20);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-rc-bg/80 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-3xl max-h-[88vh] flex flex-col bg-rc-surface border border-rc-border rounded-rc-lg shadow-rc-3 overflow-hidden"
      >
        <div className="flex items-center justify-between gap-4 px-6 py-4 bg-rc-surface-2 border-b border-rc-border">
          <h2 id={titleId} className="rc-text-18 font-bold text-rc-text">
            {title}
          </h2>
          <IconButton label="Close dialog" onClick={onClose}>
            <X className="w-5 h-5" aria-hidden="true" />
          </IconButton>
        </div>
        <div className="p-6 overflow-y-auto space-y-6">{children}</div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 13. Toast (aria-live polite notification)                                  */
/* -------------------------------------------------------------------------- */

export interface ToastProps {
  message: string | null;
  onDismiss: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, onDismiss }) => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="fixed bottom-4 right-4 z-50 pointer-events-none"
    >
      <AnimatePresence>
        {message && (
          <motion.div
            initial={
              shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 12 }
            }
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
            transition={{
              duration: shouldReduceMotion ? 0 : MOTION_TOKENS.baseMs / 1000,
              ease: MOTION_TOKENS.easing,
            }}
            className="pointer-events-auto flex items-center gap-3 px-4 py-3 bg-rc-surface-2 border border-rc-accent rounded-rc-md shadow-rc-3 text-rc-text rc-text-14 font-mono"
          >
            <CheckCircle2
              className="w-4 h-4 text-rc-accent shrink-0"
              aria-hidden="true"
            />
            <span>{message}</span>
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss notification"
              className="p-1 text-rc-text-muted hover:text-rc-text rc-focus-ring rounded-rc-sm cursor-pointer"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
