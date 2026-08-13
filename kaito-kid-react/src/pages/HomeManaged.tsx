import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Home from './Home';
import HomepageProductSectionStack from '../components/home/HomepageProductSectionStack';

const LEGACY_SECTION_IDS = [
  'section-newarrivals',
  'section-saleproducts',
  'section-bestsellers',
] as const;

export default function HomeManaged() {
  const [mountNode, setMountNode] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let retryTimer = 0;
    let mount: HTMLDivElement | null = null;
    const previousDisplay = new Map<HTMLElement, string>();

    const attach = () => {
      if (cancelled) return;
      const legacySections = LEGACY_SECTION_IDS
        .map((id) => document.getElementById(id))
        .filter((node): node is HTMLElement => Boolean(node));

      if (legacySections.length !== LEGACY_SECTION_IDS.length) {
        retryTimer = window.setTimeout(attach, 30);
        return;
      }

      const parent = legacySections[0].parentElement;
      if (!parent) return;

      legacySections.forEach((section) => {
        previousDisplay.set(section, section.style.display);
        section.style.display = 'none';
        section.setAttribute('aria-hidden', 'true');
      });

      mount = document.createElement('div');
      mount.id = 'homepage-managed-product-sections';
      mount.className = 'homepage-managed-product-sections';
      parent.insertBefore(mount, legacySections[0]);
      setMountNode(mount);
    };

    attach();

    return () => {
      cancelled = true;
      window.clearTimeout(retryTimer);
      setMountNode(null);
      LEGACY_SECTION_IDS.forEach((id) => {
        const section = document.getElementById(id);
        if (!section) return;
        section.style.display = previousDisplay.get(section) ?? '';
        section.removeAttribute('aria-hidden');
      });
      mount?.remove();
    };
  }, []);

  return (
    <>
      <Home />
      {mountNode && createPortal(<HomepageProductSectionStack />, mountNode)}
    </>
  );
}
