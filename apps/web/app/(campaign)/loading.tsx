export default function CampaignLoading() {
  return (
    <div aria-busy="true" aria-label="Carregando memória da campanha" className="mx-auto w-[min(1180px,calc(100%-2.5rem))] py-12 sm:py-16" role="status">
      <div className="max-w-3xl">
        <div className="h-3 w-32 rounded-full bg-accent-muted" />
        <div className="mt-5 h-10 w-[min(34rem,88%)] rounded-md bg-surface" />
        <div className="mt-4 h-5 w-[min(42rem,96%)] rounded-md bg-surface" />
        <div className="mt-2 h-5 w-[min(30rem,72%)] rounded-md bg-surface" />
      </div>
      <div className="mt-10 grid gap-5 md:grid-cols-2">
        <div className="aspect-[16/8] rounded-xl border border-border-subtle bg-surface" />
        <div className="aspect-[16/8] rounded-xl border border-border-subtle bg-surface" />
      </div>
      <span className="sr-only">Carregando…</span>
    </div>
  )
}
