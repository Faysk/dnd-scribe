import { bootstrapContent } from '@/lib/bootstrap'

export default function HomePage() {
  return (
    <main className="bootstrap-shell">
      <section className="bootstrap-card" aria-labelledby="bootstrap-title">
        <p className="bootstrap-eyebrow">{bootstrapContent.eyebrow}</p>
        <h1 className="bootstrap-title" id="bootstrap-title">
          {bootstrapContent.title}
        </h1>
        <p className="bootstrap-copy">{bootstrapContent.description}</p>
        <p className="bootstrap-status">{bootstrapContent.status}</p>
      </section>
    </main>
  )
}
