import Image from 'next/image';

/** Original Por fin Carteles wordmark, shared by the storefront and administration. */
export function BrandLogo() {
  return <span className="brand-logo">
    <Image className="brand-logo-image" src="/brand/por-fin-carteles-logo.png" width={2172} height={724} sizes="(max-width: 520px) 116px, 154px" alt="Por fin Carteles" priority />
  </span>;
}
