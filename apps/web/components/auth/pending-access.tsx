import { Button } from '@/components/ui/action'
import { Surface } from '@/components/ui/surface'
import { BodyCopy, DisplayTitle, Eyebrow, MetaText } from '@/components/ui/typography'
import type { AuthIdentity } from '@/lib/auth/state'

type PendingAccessProps = Readonly<{
  identity: AuthIdentity
}>

export function PendingAccess({ identity }: PendingAccessProps) {
  return (
    <div className="mx-auto grid min-h-[calc(100vh-77px)] w-[min(1180px,calc(100%-2.5rem))] place-items-center py-12">
      <Surface className="w-full max-w-2xl p-7 sm:p-10 lg:p-14" tone="elevated">
        <Eyebrow>Acesso pendente</Eyebrow>
        <DisplayTitle className="mt-4">Você chegou ao arquivo.</DisplayTitle>
        <BodyCopy className="mt-6 max-w-xl">
          Seu login está conectado, mas o perfil ainda precisa ser aprovado como membro da campanha.
        </BodyCopy>
        <MetaText className="mt-5">Conectado como {identity.displayName}</MetaText>
        <div className="mt-8 flex flex-wrap gap-3">
          <form action="/" method="get">
            <Button type="submit" variant="secondary">Verificar novamente</Button>
          </form>
          <form action="/auth/logout" method="post">
            <Button type="submit" variant="tertiary">Sair</Button>
          </form>
        </div>
      </Surface>
    </div>
  )
}
