import { useEffect, useRef } from 'react';
import Header from '../components/Header';
import Hero from '../sections/Hero';
import Benefits from '../sections/Benefits';
import Features from '../sections/Features';
import HowItWorks from '../sections/HowItWorks';
import Testimonials from '../sections/Testimonials';
import Pricing from '../sections/Pricing';
import Footer from '../components/Footer';

export default function HomePage() {
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;

    const sections = [...main.children].filter(
      (element): element is HTMLElement => element instanceof HTMLElement && element.tagName === 'SECTION' && element.id !== 'features'
    );
    const featureSlides = [...main.querySelectorAll<HTMLElement>('[data-site-reveal]')];
    const targets = [...sections, ...featureSlides];
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');

    targets.forEach((target) => target.classList.add('site-reveal-item'));

    if (motionPreference.matches) {
      targets.forEach((target) => target.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => entry.target.classList.toggle('is-visible', entry.intersectionRatio >= 0.1)),
      { threshold: [0, 0.1], rootMargin: '0px' }
    );

    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, []);

  return <><Header /><main ref={mainRef}><Hero /><Benefits /><Features /><HowItWorks /><Testimonials /><Pricing /></main><Footer /></>;
}
