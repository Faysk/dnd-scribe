import { ActionLink } from '@/components/ui/action'
import { Surface } from '@/components/ui/surface'
import { BodyCopy, DisplayTitle, Eyebrow } from '@/components/ui/typography'

type AuthErrorProps = Readonly<{
  message?: string
}>

export function AuthError({ message }: AuthErrorProps) {
  return (
    <div className="mx-auto grid min-h-[calc(100vh-77px)] w-[min(1180px,calc(100%-2.5rem))] place-items-center py-12">
      <Surface className="w-full max-w-2xl p-7 sm:p-10 lg:p-14" tone="elevated">
        <Eyebrow>Autenticação interrompida</Eyebrow>
        <DisplayTitle className="mt-4">Não conseguimos abrir o arquivo.</DisplayTitle>
        <BodyCopy className="mt-6">
          {message || 'A sessão existe, mas uma dependência de acesso não respondeu como esperado.'}
        </BodyCopy>
        <div className="mt-8 flex flex-wrap gap-3">
          <ActionLink href="/" variant="secondary">Tentar novamente</ActionLink>
          <ActionLink href="/login" variant="tertiary">Voltar ao login</ActionLink>
        </div>
      </Surface>
    </div>
  )
}
