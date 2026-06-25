# 12 — Publicação, Privacidade e Permissões

## Objetivo

Definir o que pode ser publicado, o que deve ser privado e como proteger a mesa.

## Regra principal

```txt
Áudio bruto e transcrição completa são privados por padrão.
Publicação só acontece após revisão.
Bastidores exigem aprovação.
```

## Tipos de conteúdo

### Privado sempre

- áudio bruto;
- transcrição completa;
- conversas pessoais;
- dados sensíveis;
- conflitos reais;
- informações de conta/acesso;
- bastidores não aprovados;
- notas privadas do mestre;
- spoilers de mestre.

### Revisável

- falas marcantes;
- bastidores engraçados;
- recaps;
- ganchos;
- interpretações;
- cortes de vídeo/áudio.

### Publicável após aprovação

- recap curto;
- recap completo;
- mudanças de canon;
- timeline pública;
- músicas;
- lore consolidada;
- bastidores aprovados;
- quotes aprovadas.

## Níveis de visibilidade

```txt
private_master
private_players
review_only
public_campaign
public_web
```

## Consentimento

Mensagem sugerida para fixar no Discord:

```md
As sessões podem ser gravadas para registro, transcrição, recap e memória da campanha.

O áudio bruto e a transcrição completa são privados.
Trechos de bastidores só serão publicados após aprovação.
Conversas pessoais, técnicas ou sensíveis serão ocultadas.
Qualquer pessoa pode pedir remoção de trecho fora de personagem.
```

## Aprovação de bastidores

Bastidores devem ter status:

```txt
candidate
approved_by_speaker
approved_by_all
rejected
private
published
```

Regra prática:

- se o trecho envolve uma pessoa, ela aprova;
- se envolve várias, todas aprovam;
- se tiver dúvida, não publica.

## Publicação pública

Domínio sugerido:

```txt
dnd.faysk.dev
```

Áreas públicas:

- recaps aprovados;
- músicas;
- lore consolidada;
- personagens públicos;
- timeline pública;
- bastidores aprovados.

Áreas privadas:

- revisão;
- fontes;
- áudio;
- transcrição bruta;
- notas do mestre;
- ganchos secretos.

## Export

Mesmo que o banco seja a fonte principal, o sistema pode exportar:

- Markdown;
- JSON;
- PDF futuramente;
- ZIP da sessão;
- pacote para GPT/LLM.

## Implementacao atual

O pipeline atual gera primeiro um pacote `review_only`.

```txt
publication_type=master_notes
visibility=review_only
status=draft
```

Recap curto, recap completo, mudanças de canon, falas aprovadas e bastidores públicos só devem ser gerados quando existirem itens aprovados.

Comando:

```bash
python3 tools/build_session_publications.py --update-db
```

Saida local:

```txt
tmp/sessions/{session_id}/publications/{source_run_id}/
```

## Decisoes humanas

O Review Board exporta um JSON local com decisoes de segmentos e candidatos. Esse arquivo e aplicado por script local:

```bash
python3 tools/apply_review_decisions.py review_decisions.json --update-db
```

O script:

- registra cada decisao em `review_decisions`;
- atualiza status de segmentos e candidatos;
- resolve o ator pelo track/persona da mesa;
- pode ser executado de novo sem duplicar a decisao logica.

Travas atuais:

- `approved` em fala nao publica automaticamente;
- bastidor so deve alimentar publicacao final com `approved_by_all`;
- canon aprovado precisa de decisao final do DM;
- o navegador nao recebe `service_role`.

## Política de remoção

Qualquer participante pode pedir:

- ocultar trecho;
- remover bastidor;
- marcar como privado;
- corrigir transcrição;
- retirar áudio de revisão pública.

## Segurança básica

- Supabase RLS ligado.
- Buckets privados.
- URLs assinadas com expiração.
- Nunca expor service role key no frontend.
- Separar API pública e worker.
- Logs sem secrets.
- `.env` fora do Git.

## Ideia boa

Criar botão:

```txt
Solicitar remoção deste trecho
```

Isso dá confiança para a mesa participar sem medo de virar meme eterno sem consentimento. Meme eterno só com assinatura em cartório, né.
