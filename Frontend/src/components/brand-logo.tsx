/** Brand wordmark rendered as text so it stays sharp on every background. */
export function BrandLogo({ hero = false }: { hero?: boolean }) {
  return <span className={hero ? 'brand-logo brand-logo-hero' : 'brand-logo'} role="img" aria-label="Por fin, carteles y más">
    <span className="brand-logo-name">Por fin</span>
    <span className="brand-logo-caption">CARTELES &amp; MÁS</span>
  </span>;
}
