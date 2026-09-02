import { type ButtonHTMLAttributes, type InputHTMLAttributes, type LabelHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import clsx from 'clsx'

/* ---------- Button ---------- */
type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
type ButtonSize = 'md' | 'lg' | 'sm'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  fullWidth?: boolean
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 shadow-sm shadow-brand-600/20',
  secondary: 'bg-ink-900 text-white hover:bg-ink-700',
  outline: 'bg-white text-ink-900 border border-ink-300 hover:bg-cream-100',
  ghost: 'bg-transparent text-ink-700 hover:bg-brand-50',
  danger: 'bg-danger-500 text-white hover:bg-red-700',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'text-sm px-3 py-2 rounded-lg',
  md: 'text-base px-4 py-3 rounded-xl',
  lg: 'text-lg px-6 py-4 rounded-2xl',
}

export function Button({ variant = 'primary', size = 'md', loading, fullWidth, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      className={clsx(
        'tap-target inline-flex items-center justify-center gap-2 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && 'w-full',
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Spinner size={16} className="border-current" />}
      {children}
    </button>
  )
}

/* ---------- Card ---------- */
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx('bg-white rounded-2xl border border-black/5 shadow-sm', className)}>{children}</div>
}

/* ---------- Form fields ---------- */
export function Label({ className, ...rest }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={clsx('block text-sm font-medium text-ink-700 mb-1.5', className)} {...rest} />
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx(
        'w-full tap-target rounded-xl border border-ink-300 bg-white px-4 py-3 text-base text-ink-900 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400',
        className,
      )}
      {...rest}
    />
  )
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={clsx(
        'w-full rounded-xl border border-ink-300 bg-white px-4 py-3 text-base text-ink-900 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400',
        className,
      )}
      {...rest}
    />
  )
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={clsx(
        'w-full tap-target rounded-xl border border-ink-300 bg-white px-4 py-3 text-base text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400',
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  )
}

export function FieldError({ children }: { children?: string | null }) {
  if (!children) return null
  return <p className="mt-1.5 text-sm text-danger-500">{children}</p>
}

/* ---------- Badge ---------- */
type BadgeTone = 'green' | 'amber' | 'red' | 'gray' | 'brand' | 'blue'
const badgeTones: Record<BadgeTone, string> = {
  green: 'bg-green-100 text-green-700',
  amber: 'bg-amber-100 text-amber-700',
  red: 'bg-red-100 text-red-700',
  gray: 'bg-ink-100 text-ink-700',
  brand: 'bg-brand-100 text-brand-700',
  blue: 'bg-blue-100 text-blue-700',
}

export function Badge({ tone = 'gray', children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold', badgeTones[tone], className)}>
      {children}
    </span>
  )
}

/* ---------- Spinner ---------- */
export function Spinner({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <span
      className={clsx('inline-block animate-spin rounded-full border-2 border-transparent border-t-current border-r-current', className)}
      style={{ width: size, height: size }}
    />
  )
}

export function FullScreenSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream-50">
      <Spinner size={36} className="text-brand-600" />
    </div>
  )
}

/* ---------- Empty state ---------- */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-300 bg-white/60 px-6 py-14 text-center">
      {icon && <div className="mb-4 text-5xl">{icon}</div>}
      <h3 className="text-lg font-semibold text-ink-900">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-ink-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/* ---------- Stat card ---------- */
export function StatCard({ label, value, hint, tone = 'brand' }: { label: string; value: ReactNode; hint?: string; tone?: BadgeTone }) {
  return (
    <Card className="p-4">
      <p className="text-sm text-ink-500">{label}</p>
      <p className={clsx('mt-1 text-2xl font-bold', tone === 'brand' ? 'text-brand-700' : 'text-ink-900')}>{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
    </Card>
  )
}

/* ---------- Modal / bottom sheet ---------- */
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className={clsx(
          'relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl sm:m-4',
          wide ? 'sm:max-w-2xl' : 'sm:max-w-md',
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink-900">{title}</h2>
          <button onClick={onClose} className="tap-target rounded-full p-2 text-ink-500 hover:bg-cream-100" aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/* ---------- Toast ---------- */
export function Banner({ tone = 'brand', children }: { tone?: 'brand' | 'danger' | 'success'; children: ReactNode }) {
  const toneClasses = {
    brand: 'bg-brand-50 text-brand-700 border-brand-200',
    danger: 'bg-red-50 text-red-700 border-red-200',
    success: 'bg-green-50 text-green-700 border-green-200',
  }[tone]
  return <div className={clsx('rounded-xl border px-4 py-3 text-sm', toneClasses)}>{children}</div>
}
