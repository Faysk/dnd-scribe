import Link from 'next/link'

export function Brand() {
  return (
    <Link className="inline-flex items-center gap-3 no-underline" href="/" aria-label="DnD Scribe — início">
      <span
        aria-hidden="true"
        className="grid size-10 place-items-center rounded-full border border-accent/50 bg-accent-muted font-display text-xl text-accent-strong shadow-[inset_0_0_0_4px_var(--ds-canvas)]"
      >
        20
      </span>
      <span>
        <strong className="block font-display text-lg font-medium tracking-[0.01em] text-foreground">DnD Scribe</strong>
        <small className="mt-0.5 block font-ui text-[10px] uppercase tracking-[0.12em] text-foreground-muted">Arquivo da campanha</small>
      </span>
    </Link>
  )
}
