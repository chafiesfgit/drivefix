import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText)

/** Custom ease-outs (Emil): fast start, long soft landing. */
gsap.registerEase?.('df.out', (p: number) => 1 - Math.pow(1 - p, 3.2))

export const MOTION = {
  reduce: '(prefers-reduced-motion: reduce)',
  ok: '(prefers-reduced-motion: no-preference)',
}

export { gsap, ScrollTrigger, SplitText, useGSAP }
