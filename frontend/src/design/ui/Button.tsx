import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import arrowDisabled from '@/assets/figma/arrow-disabled.svg'
import arrowInk from '@/assets/figma/arrow-ink.svg'
import arrowNavy from '@/assets/figma/arrow-navy.svg'
import arrowOrange from '@/assets/figma/arrow-orange.svg'
import arrowPlainMuted from '@/assets/figma/arrow-plain-muted.svg'
import arrowSand from '@/assets/figma/arrow-sand.svg'
import arrowWhite from '@/assets/figma/arrow-white.svg'
import { cn } from '../cn'
import { Spinner } from './Spinner'

export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger' | 'white' | 'glass'
export type ButtonSize = 'sm' | 'md' | 'lg'

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-brand-700 text-white shadow-sm hover:bg-night',
  accent: 'bg-orange text-white hover:bg-orange-hover',
  secondary: 'bg-white text-navy-900 border border-grey-200 hover:border-grey-400',
  ghost: 'bg-transparent text-brand-700 hover:bg-white',
  danger: 'bg-danger text-white hover:bg-[#a5301f]',
  white: 'bg-white text-navy-900 shadow-sm hover:bg-cream-50',
  glass: 'glass-pill text-white hover:bg-white/15',
}

/** Round arrow badge per variant, taken from the Figma Button component. */
const ARROW: Record<ButtonVariant, string> = {
  primary: arrowOrange,
  accent: arrowNavy,
  secondary: arrowInk,
  ghost: arrowSand,
  danger: arrowWhite,
  white: arrowOrange,
  glass: arrowOrange,
}

const DISABLED = 'disabled:bg-sand disabled:text-grey-400 disabled:border disabled:border-grey-200 disabled:shadow-none'

interface CommonProps {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Show the round arrow icon at the end (Figma default for pill buttons). */
  arrow?: boolean
  icon?: ReactNode
  loading?: boolean
  fullWidth?: boolean
  children?: ReactNode
  className?: string
}

function classes(variant: ButtonVariant, size: ButtonSize, arrow: boolean, fullWidth?: boolean, className?: string) {
  const pad = arrow
    ? size === 'sm'
      ? 'ps-4 pe-1 py-1 gap-2'
      : size === 'lg'
        ? 'ps-6 pe-2 py-2 gap-3 text-body'
        : 'ps-5 pe-1.5 py-1.5 gap-2.5'
    : size === 'sm'
      ? 'px-3.5 h-8 gap-1.5'
      : size === 'lg'
        ? 'px-7 h-12 gap-2 text-body'
        : 'px-5 h-11 gap-2'
  return cn(
    'pressable relative inline-flex select-none items-center justify-center whitespace-nowrap rounded-full text-sm font-medium',
    'transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out',
    'disabled:cursor-not-allowed aria-disabled:cursor-not-allowed',
    pad,
    VARIANT[variant],
    DISABLED,
    fullWidth && 'w-full',
    className,
  )
}

function Arrow({ variant, disabled }: { variant: ButtonVariant; disabled?: boolean }) {
  const src = disabled ? (variant === 'ghost' ? arrowPlainMuted : arrowDisabled) : ARROW[variant]
  return (
    <img
      src={src}
      alt=""
      aria-hidden
      width={32}
      height={32}
      className="flip-rtl size-8 shrink-0 transition-transform duration-200 ease-out group-hover/btn:translate-x-0.5"
    />
  )
}

export interface ButtonProps extends CommonProps, Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    arrow = false,
    icon,
    loading,
    fullWidth,
    className,
    children,
    disabled,
    type = 'button',
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || loading
  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cn('group/btn', classes(variant, size, arrow, fullWidth, className))}
      {...rest}
    >
      {loading ? <Spinner className="size-4" /> : icon}
      {children}
      {arrow && <Arrow variant={variant} disabled={isDisabled} />}
    </button>
  )
})

export interface ButtonLinkProps extends CommonProps, Omit<LinkProps, 'children' | 'className'> {}

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  arrow = false,
  icon,
  fullWidth,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link className={cn('group/btn', classes(variant, size, arrow, fullWidth, className))} {...rest}>
      {icon}
      {children}
      {arrow && <Arrow variant={variant} />}
    </Link>
  )
}

/** Square icon-only button with an accessible label. */
export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { label: string; tone?: 'light' | 'dark' }
>(function IconButton({ label, tone = 'light', className, children, type = 'button', ...rest }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'pressable inline-flex size-10 items-center justify-center rounded-full transition-colors duration-150',
        tone === 'light'
          ? 'text-navy-900 hover:bg-sand'
          : 'text-white/80 hover:bg-white/10 hover:text-white',
        'disabled:opacity-40',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
})
