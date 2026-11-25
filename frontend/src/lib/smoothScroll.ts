import Lenis from 'lenis'
import 'lenis/dist/lenis.css'
import { useEffect, useRef } from 'react'
import { gsap, MOTION, ScrollTrigger } from './gsap'

/**
 * Smooth (inertial) wheel scrolling for marketing pages, driven by GSAP's ticker so ScrollTrigger
 * scrubs stay perfectly in sync. Off for reduced motion; touch keeps native scrolling (Lenis default).
 * Returns a ref to the instance so callers can scroll to anchors through it.
 */
export function useSmoothScroll() {
  const lenis = useRef<Lenis | null>(null)
  useEffect(() => {
    if (window.matchMedia(MOTION.reduce).matches) return
    const instance = new Lenis({ duration: 1.1, easing: (t) => 1 - Math.pow(1 - t, 4), wheelMultiplier: 1, smoothWheel: true })
    lenis.current = instance
    instance.on('scroll', ScrollTrigger.update)
    const tick = (time: number) => instance.raf(time * 1000)
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)
    return () => {
      gsap.ticker.remove(tick)
      gsap.ticker.lagSmoothing(500, 33)
      instance.destroy()
      lenis.current = null
    }
  }, [])
  return lenis
}
