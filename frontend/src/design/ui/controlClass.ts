import { cn } from '../cn'

/** Shared input styling (38px field from Figma). */
export const controlClass = (invalid: boolean, tone: 'light' | 'dark' = 'light') =>
  cn(
    'h-[38px] w-full min-w-0 rounded-md border px-3 text-sm outline-none transition-[border-color,box-shadow] duration-150',
    tone === 'dark'
      ? 'border-white/[0.28] bg-white/10 text-white placeholder:text-white/50 focus:border-white/60 focus:shadow-[0_0_0_3px_rgb(255_255_255/0.15)]'
      : 'border-grey-200 bg-white text-navy-900 placeholder:text-grey-400 focus:border-brand focus:shadow-[0_0_0_3px_rgb(31_78_158/0.15)]',
    'disabled:cursor-not-allowed disabled:bg-sand disabled:text-grey-400',
    invalid && (tone === 'dark' ? 'border-[#ffb4a8]' : 'border-danger focus:border-danger focus:shadow-[0_0_0_3px_rgb(192_57_43/0.15)]'),
  )
