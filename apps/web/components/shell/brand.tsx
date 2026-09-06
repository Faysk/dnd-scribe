import Link from 'next/link'

export function Brand() {
  return (
    <Link className="inline-flex shrink-0 items-center gap-3 no-underline" href="/" aria-label="TDA — Tem Dado Aqui — início">
      <span className="grid size-11 shrink-0 place-items-center" aria-hidden="true">
        {/* biome-ignore lint/performance/noImgElement: Small local SVG needs no image optimization. */}
        <img
          alt=""
          className="size-11 object-contain [filter:var(--ds-brand-filter)]"
          height="44"
          src="/brand/tda-mark-black.svg"
          width="44"
        />
      </span>
      <span className="hidden sm:block">
        <strong className="block font-display text-lg font-semibold tracking-[0.02em] text-foreground">TDA</strong>
        <small className="mt-0.5 block font-ui text-[10px] uppercase tracking-[0.14em] text-foreground-muted">Tem Dado Aqui</small>
      </span>
    </Link>
  )
}
