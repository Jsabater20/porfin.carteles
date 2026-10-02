import { useId } from 'react';

/** Original wordmark from page 1 of the supplied catalog, styled in the brand colors. */
export function BrandLogo({ hero = false }: { hero?: boolean }) {
  const filterId = useId();
  return <svg className={hero ? 'brand-logo brand-logo-hero' : 'brand-logo'} viewBox="322 1254 170 78" role="img" aria-label="Por fin, carteles y más">
    <defs><filter id={filterId} colorInterpolationFilters="sRGB">
      <feComponentTransfer>
        <feFuncR type="linear" slope="-1.034826" intercept="1.047102" />
        <feFuncG type="linear" slope="-0.778378" intercept="0.878537" />
        <feFuncB type="linear" slope="-0.814815" intercept="1.001597" />
      </feComponentTransfer>
    </filter></defs>
    <image href="/catalogo/referencia/logo-original.png" width="813" height="1444" filter={'url(#' + filterId + ')'} />
  </svg>;
}
