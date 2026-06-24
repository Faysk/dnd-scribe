# DnD Scribe — Demo Visual

Demo navegável em **HTML, CSS e JavaScript puro** para apresentar a proposta visual do projeto **DnD Scribe**, um sistema para registrar, transcrever, auditar, canonizar e publicar sessões longas de D&D.

## Como abrir

Abra o arquivo:

```txt
index.html
```

Também existe uma página de apresentação rápida:

```txt
pitch.html
```

## O que esta demo mostra

- Dashboard da sessão atual.
- Captura de fontes: Craig, OBS, Roll20 Pro Logger e Discord.
- Tela de revisão com timeline, transcrição e candidatos da IA.
- Transcrição pesquisável.
- Quadro de canonização.
- Bastidores aprováveis e privados.
- Entidades detectadas e grafo narrativo mockado.
- Palco do Dandelion para músicas e momentos performáticos.
- Pipeline técnico com Supabase, worker Docker, OpenAI e publicação.
- Tela de permissões, consentimento e papéis.

## Observações

Esta demo é 100% estática e não usa backend. Todos os dados são mockados em `assets/js/app.js`.

O objetivo é validar visual, fluxo e prioridade de telas com a mesa antes de investir no sistema real. Em bom português: primeiro vê se o dragão é bonito antes de gastar spell slot.

## Estrutura

```txt
index.html
pitch.html
assets/
  css/styles.css
  js/app.js
docs/
  guia_da_demo.md
  mapa_de_telas.md
  sugestoes_de_melhorias.md
```

## Próximos passos sugeridos

1. Mostrar `pitch.html` para a mesa.
2. Navegar pelo `index.html` em conjunto.
3. Marcar quais telas realmente importam agora.
4. Cortar o que estiver bonito, mas inútil.
5. Transformar o MVP real em: Captura → Upload → Transcrição → Revisão → Canon.
