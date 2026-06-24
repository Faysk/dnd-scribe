# 11 — UX e Telas do Sistema

## Objetivo

Definir as principais telas do Yuhara Scribe.

## 1. Dashboard

Mostra visão geral da campanha.

Cards:

- próxima sessão;
- última sessão;
- sessões em revisão;
- candidatos pendentes;
- canon recente;
- ganchos abertos;
- arquivos aguardando processamento.

## 2. Criar sessão

Campos:

- título provisório;
- data;
- arco;
- participantes;
- personagens;
- links Roll20/Discord;
- status de consentimento;
- notas iniciais;
- glossário adicional.

## 3. Upload da sessão

Área para subir:

- faixas Craig;
- Craig info.txt;
- OBS backup;
- Roll20 chat;
- notas manuais;
- outros arquivos.

A tela deve validar:

- arquivo sem participante associado;
- arquivo grande;
- formato inválido;
- sessão sem metadata;
- falta de consentimento.

## 4. Processamento

Mostra jobs:

```txt
Normalizando áudio... ok
Dividindo chunks... ok
Transcrevendo Dandelion... rodando
Transcrevendo Astel... aguardando
Parseando Roll20... ok
Classificando segmentos... aguardando
```

## 5. Transcript Viewer

Tela de leitura da transcrição.

Filtros:

- speaker;
- personagem;
- tipo de segmento;
- candidato a canon;
- fala marcante;
- bastidor;
- mecânica;
- busca por texto;
- entidade citada.

Cada segmento mostra:

- timestamp;
- speaker;
- personagem;
- texto;
- tipo;
- confiança;
- botões de ação.

## 6. Review Board

A tela mais importante.

Colunas:

```txt
Timeline | Transcrição | Candidatos | Fonte/Áudio
```

### Candidatos

Abas:

- Canon;
- Falas;
- Bastidores;
- Ganchos;
- Entidades;
- Dúvidas;
- Privados.

### Ações

- aprovar;
- rejeitar;
- editar;
- marcar como interpretação;
- marcar como gancho;
- exigir revisão do mestre;
- publicar;
- ocultar.

## 7. Player de áudio

Requisitos:

- tocar trecho por timestamp;
- avançar/retroceder 5s;
- destacar segmento atual;
- volume por faixa, se possível;
- botão “copiar timestamp”.

## 8. Publicações

Tela para gerar e revisar:

- recap curto;
- recap completo;
- mudanças de canon;
- timeline;
- falas marcantes;
- bastidores aprovados;
- versão pública;
- versão Mestre.

## 9. Entidades

Tela para NPCs, lugares, itens etc.

Cada entidade deve mostrar:

- resumo;
- status;
- primeira aparição;
- última aparição;
- sessões relacionadas;
- eventos canon;
- falas relacionadas;
- relações;
- notas privadas.

## 10. Permissões

Visões:

### Mestre

Acesso a tudo.

### Jogador

Acesso a material público da mesa e revisão permitida.

### Convidado

Acesso apenas a publicações públicas.

## 11. Estilo visual

Sugestão:

- dark fantasy;
- cards limpos;
- timeline elegante;
- tags coloridas por tipo;
- tom de “arquivo mágico”;
- ícones para canon, bastidor, fala, dúvida, privado.

Mas cuidado: primeiro funcional, depois perfumaria. Senão vira aquele clássico projeto lindo que não processa um áudio nem sob ameaça de goblin.
