window.DND_SCRIBE = {
  meta: {
    version: "v3",
    projectName: "DnD Scribe",
    tagline: "Nem toda verdade pertence a todos.",
    operationalRule: "Segredo sem DM é diário. Segredo com DM é munição narrativa.",
    domainSuggestion: "dnd.faysk.dev"
  },

  users: [
    {
      id: "yuhara",
      name: "Yuhara",
      displayName: "Yuhara • DM",
      email: "yuhara.dm@demo.local",
      role: "dm",
      character: "Mestre",
      avatar: "YH",
      color: "gold",
      permissions: ["approve_canon", "view_dm_secrets", "manage_sessions", "manage_players", "publish_recaps"],
      loginNote: "O DM vê canon público, segredos de DM e segredos compartilhados com o DM. Não vê diário privado owner-only."
    },
    {
      id: "renan",
      name: "Renan",
      displayName: "Renan • Dandelion",
      email: "renan.dandelion@demo.local",
      role: "player",
      character: "Dandelion",
      avatar: "RD",
      color: "orange",
      permissions: ["create_private_journal", "propose_canon", "share_secret", "approve_own_outtake"],
      loginNote: "Vê diário do Dandelion, segredos compartilhados com ele, canon público e o que Dandelion sabe na ficção."
    },
    {
      id: "arthur",
      name: "Arthur",
      displayName: "Arthur • Astel",
      email: "arthur.astel@demo.local",
      role: "player",
      character: "Astel",
      avatar: "AA",
      color: "purple",
      permissions: ["create_private_journal", "propose_canon", "share_secret", "approve_own_outtake", "roll20_pro_owner"],
      loginNote: "Vê segredos de Astel, incluindo conteúdo Arthur + DM. Também é o dono do Roll20 Pro na mesa."
    },
    {
      id: "fernanda",
      name: "Fernanda",
      displayName: "Fernanda • Screacky",
      email: "fernanda.screacky@demo.local",
      role: "player",
      character: "Screacky",
      avatar: "FS",
      color: "red",
      permissions: ["create_private_journal", "propose_canon", "share_secret", "approve_own_outtake"],
      loginNote: "Vê segredos da Screacky, notas da personagem, canon público e segredos compartilhados com ela."
    }
  ],

  session: {
    id: "sessao-027",
    title: "Preparação para o Duelo de Euclix",
    arc: "Euclix / Porta do Kenku",
    date: "Sábado • Sessão longa",
    duration: "06h 12m",
    status: "Em revisão",
    scene: "Praça congelada de Euclix",
    goal: "Preparar Screacky para o duelo contra Ivory e impedir que a narrativa pública seja sequestrada.",
    mantra: "Áudio bruto é evidência. Transcrição é rascunho. IA sugere. Humano valida. Só o validado vira canon."
  },

  captureSources: [
    { id: "craig", name: "Craig Multitrack", status: "Pronto", progress: 100, color: "green", detail: "Faixas separadas por pessoa: Yuhara, Renan, Arthur e Fernanda." },
    { id: "obs", name: "OBS Backup", status: "Importado", progress: 100, color: "blue", detail: "Tela Roll20 + áudio geral + Discord para auditoria e fallback." },
    { id: "roll20", name: "Roll20 Pro Logger", status: "Eventos parseados", progress: 88, color: "gold", detail: "Arthur tem Roll20 Pro. Logs de rolagens, cenas, whispers e comandos !dnd." },
    { id: "discord", name: "Discord / Craig Notes", status: "Marcadores lidos", progress: 78, color: "purple", detail: "CANON, FALA, SEGREDO, BASTIDOR, CORTAR e DÚVIDA." },
    { id: "openai", name: "OpenAI Transcrição", status: "Em revisão", progress: 66, color: "orange", detail: "Transcrição por faixa + classificação de segmentos por IA." }
  ],

  pipelineSteps: [
    { step: 1, title: "Criar sessão", detail: "Define título, arco, participantes, consentimento e fontes esperadas." },
    { step: 2, title: "Capturar", detail: "Craig multitrack, OBS backup, Roll20 Logger e notas rápidas." },
    { step: 3, title: "Processar áudio", detail: "ffmpeg normaliza, quebra em chunks e prepara arquivos para transcrição." },
    { step: 4, title: "Transcrever", detail: "OpenAI transcreve por faixa e preserva speaker/character mapping." },
    { step: 5, title: "Classificar", detail: "IA separa narração, fala in-character, regra, bastidor, piada, segredo e canon candidato." },
    { step: 6, title: "Auditar", detail: "Mesa/DM revisa com fonte, timestamp, áudio e permissões." },
    { step: 7, title: "Canonizar", detail: "DM aprova canon público ou privado. Jogadores controlam diários e revelações próprias." },
    { step: 8, title: "Publicar", detail: "Gera recap limpo, bastidores aprovados, atualizações de entidades e timeline." }
  ],

  transcriptSegments: [
    {
      id: "seg-001",
      time: "00:08:12",
      speakerUser: "yuhara",
      speaker: "Yuhara",
      character: "Narrador",
      type: "dm_narration",
      access: "party",
      visibleTo: ["yuhara", "renan", "arthur", "fernanda"],
      fictionKnows: ["Dandelion", "Astel", "Screacky", "Povo de Euclix"],
      text: "A praça de Euclix está mais cheia do que antes. As pessoas ainda não cantam alto, mas algumas bocas se movem como se lembrassem uma melodia proibida.",
      tags: ["euclix", "publico", "musica", "canon-candidato"]
    },
    {
      id: "seg-002",
      time: "00:09:44",
      speakerUser: "renan",
      speaker: "Renan",
      character: "Dandelion",
      type: "in_character",
      access: "party",
      visibleTo: ["yuhara", "renan", "arthur", "fernanda"],
      fictionKnows: ["Dandelion", "Astel", "Screacky"],
      text: "Eu não preciso que eles cantem alto. Ainda. Uma revolução começa igual panela de pressão: primeiro faz barulhinho, depois suja a cozinha toda.",
      tags: ["dandelion", "fala", "revolucao"]
    },
    {
      id: "seg-003",
      time: "01:16:33",
      speakerUser: "arthur",
      speaker: "Arthur",
      character: "Astel",
      type: "player_action",
      access: "owner_dm",
      visibleTo: ["yuhara", "arthur"],
      fictionKnows: ["Astel", "Hugin"],
      text: "Astel toca a marca na mão e tenta sentir Hugin. A resposta vem fraca, como um corvo batendo contra vidro.",
      tags: ["astel", "hugin", "segredo", "familia"]
    },
    {
      id: "seg-004",
      time: "01:41:05",
      speakerUser: "fernanda",
      speaker: "Fernanda",
      character: "Screacky",
      type: "private_decision",
      access: "shared",
      visibleTo: ["yuhara", "fernanda", "renan"],
      fictionKnows: ["Screacky", "Dandelion"],
      text: "Screacky combina com Dandelion um sinal discreto para iniciar a performance se Ivory tentar encerrar o duelo antes da hora.",
      tags: ["screacky", "dandelion", "plano", "segredo-compartilhado"]
    },
    {
      id: "seg-005",
      time: "02:03:10",
      speakerUser: null,
      speaker: "Mesa",
      character: "Fora de personagem",
      type: "ooc_chatter",
      access: "party_private",
      visibleTo: ["yuhara", "renan", "arthur", "fernanda"],
      fictionKnows: [],
      text: "Discussão fora de jogo sobre o Astel abrir chamado técnico para a Raven Queen: prioridade crítica, SLA eterno, resposta em corvo.",
      tags: ["bastidor", "piada", "nao-canon"]
    },
    {
      id: "seg-006",
      time: "03:22:47",
      speakerUser: "renan",
      speaker: "Renan",
      character: "Dandelion",
      type: "quote_candidate",
      access: "party",
      visibleTo: ["yuhara", "renan", "arthur", "fernanda"],
      fictionKnows: ["Dandelion", "Astel", "Screacky", "Povo de Euclix"],
      text: "Vocês fizeram o reino esquecer a música. Mas esquecer não é o mesmo que matar.",
      tags: ["fala-marcante", "dandelion", "euclix", "canon-candidato"]
    },
    {
      id: "seg-007",
      time: "04:01:01",
      speakerUser: "renan",
      speaker: "Renan",
      character: "Diário privado de Dandelion",
      type: "private_journal",
      access: "owner_only",
      visibleTo: ["renan"],
      fictionKnows: ["Dandelion"],
      text: "Talvez Dandelion esteja com medo de que, se o povo cantar sem ele, ninguém precise mais dele no palco.",
      tags: ["diario", "privado", "nao-canon", "sem-dm"]
    },
    {
      id: "seg-008",
      time: "04:42:19",
      speakerUser: "yuhara",
      speaker: "Yuhara",
      character: "DM secreto",
      type: "dm_secret_note",
      access: "dm_only",
      visibleTo: ["yuhara"],
      fictionKnows: ["Ivory"],
      text: "Ivory sabe que a Porta do Kenku está acordando e pretende usar o medo da plateia para acelerar isso.",
      tags: ["dm-only", "ivory", "porta-do-kenku"]
    }
  ],

  secrets: [
    {
      id: "sec-001",
      title: "Hugin responde fraco a Astel",
      type: "Segredo de Personagem",
      audience: "Arthur + DM",
      access: "owner_dm",
      owner: "arthur",
      visibleTo: ["arthur", "yuhara"],
      fictionKnows: ["Astel", "Hugin"],
      status: "Canon privado candidato",
      dmCanView: true,
      canAffectCanon: true,
      source: "Sessão 027 • 01:16:33",
      description: "A conexão de Astel com Hugin parece instável. Pode indicar perigo para a família Nightshade ou interferência de Euclix.",
      revealState: "Não revelado ao grupo",
      notes: ["Criado a partir da transcrição", "Precisa validação de Arthur e Yuhara"]
    },
    {
      id: "sec-002",
      title: "Dandelion teme perder o palco para a própria canção",
      type: "Diário privado",
      audience: "Somente Renan",
      access: "owner_only",
      owner: "renan",
      visibleTo: ["renan"],
      fictionKnows: ["Dandelion"],
      status: "Não canon / introspecção",
      dmCanView: false,
      canAffectCanon: false,
      source: "Diário do jogador • 04:01:01",
      description: "Reflexão pessoal do jogador sobre um medo interno de Dandelion. Não vira canon nem consequência até Renan compartilhar com Yuhara ou revelar em sessão.",
      revealState: "Privado do jogador",
      notes: ["Não usado pela IA para lore", "Não aparece em recap"]
    },
    {
      id: "sec-003",
      title: "Sinal secreto entre Dandelion e Screacky",
      type: "Segredo compartilhado",
      audience: "Renan + Fernanda + DM",
      access: "shared",
      owner: "fernanda",
      visibleTo: ["renan", "fernanda", "yuhara"],
      fictionKnows: ["Dandelion", "Screacky"],
      status: "Plano privado da cena",
      dmCanView: true,
      canAffectCanon: true,
      source: "Sessão 027 • 01:41:05",
      description: "Dandelion e Screacky combinaram um sinal para iniciar a performance caso Ivory tente manipular a plateia ou encerrar o duelo.",
      revealState: "Oculto de Astel/Arthur",
      notes: ["Pode virar cena", "Deve aparecer para Yuhara como munição narrativa"]
    },
    {
      id: "sec-004",
      title: "Ivory conhece o risco da Porta do Kenku",
      type: "Segredo do DM",
      audience: "Somente Yuhara",
      access: "dm_only",
      owner: "yuhara",
      visibleTo: ["yuhara"],
      fictionKnows: ["Ivory"],
      status: "Canon oculto do DM",
      dmCanView: true,
      canAffectCanon: true,
      source: "Nota privada do mestre • 04:42:19",
      description: "Ivory entende que a porta está acordando e pode usar medo coletivo para fortalecer o fenômeno.",
      revealState: "Não revelado",
      notes: ["Não entra em recap público", "Pode alimentar cenas futuras"]
    },
    {
      id: "sec-005",
      title: "O povo começou a cantar baixo",
      type: "Canon público do grupo",
      audience: "Mesa inteira",
      access: "party",
      owner: "yuhara",
      visibleTo: ["yuhara", "renan", "arthur", "fernanda"],
      fictionKnows: ["Dandelion", "Astel", "Screacky", "Povo de Euclix"],
      status: "Canon público candidato",
      dmCanView: true,
      canAffectCanon: true,
      source: "Sessão 027 • 00:08:12",
      description: "A melodia de Dandelion já começou a circular entre o povo de Euclix, ainda em voz baixa.",
      revealState: "Visível para todos",
      notes: ["Aguardando aprovação final do DM"]
    }
  ],

  candidates: [
    {
      id: "cand-001",
      title: "O povo começou a repetir a canção proibida",
      claim: "Alguns habitantes de Euclix lembram e murmuram a melodia de Dandelion.",
      status: "Canon público candidato",
      confidence: 0.86,
      sourceSegment: "seg-001",
      sourceTime: "00:08:12",
      visibleTo: ["yuhara", "renan", "arthur", "fernanda"],
      suggestedAction: "Aprovar como canon público"
    },
    {
      id: "cand-002",
      title: "A conexão de Astel com Hugin enfraqueceu",
      claim: "Astel percebe resposta fraca de Hugin, sugerindo risco espiritual ou familiar.",
      status: "Canon privado candidato",
      confidence: 0.74,
      sourceSegment: "seg-003",
      sourceTime: "01:16:33",
      visibleTo: ["yuhara", "arthur"],
      suggestedAction: "Manter como segredo Arthur + DM"
    },
    {
      id: "cand-003",
      title: "Sinal secreto entre Dandelion e Screacky",
      claim: "Dandelion e Screacky combinaram uma ação condicional privada.",
      status: "Segredo compartilhado candidato",
      confidence: 0.81,
      sourceSegment: "seg-004",
      sourceTime: "01:41:05",
      visibleTo: ["yuhara", "renan", "fernanda"],
      suggestedAction: "Vincular a Renan + Fernanda + DM"
    },
    {
      id: "cand-004",
      title: "Fala marcante de Dandelion sobre memória",
      claim: "A frase 'esquecer não é o mesmo que matar' deve ser destacada no recap.",
      status: "Fala marcante candidata",
      confidence: 0.93,
      sourceSegment: "seg-006",
      sourceTime: "03:22:47",
      visibleTo: ["yuhara", "renan", "arthur", "fernanda"],
      suggestedAction: "Aprovar como quote pública"
    }
  ],

  canonEntries: [
    {
      id: "canon-001",
      title: "Euclix começou a lembrar da música",
      visibility: "party",
      status: "Canon público aprovado",
      text: "Após a apresentação proibida, parte do povo de Euclix começou a murmurar a melodia de Dandelion em segredo.",
      source: "Sessão 027 • 00:08:12",
      visibleTo: ["yuhara", "renan", "arthur", "fernanda"],
      related: ["Euclix", "Dandelion", "Ivory"]
    },
    {
      id: "canon-002",
      title: "A conexão de Astel com Hugin está instável",
      visibility: "owner_dm",
      status: "Canon privado em revisão",
      text: "Astel sentiu Hugin responder de forma fraca, como se algo interferisse no vínculo.",
      source: "Sessão 027 • 01:16:33",
      visibleTo: ["yuhara", "arthur"],
      related: ["Astel", "Hugin", "Família Nightshade"]
    },
    {
      id: "canon-003",
      title: "Ivory conhece parte do fenômeno da Porta do Kenku",
      visibility: "dm_only",
      status: "Canon oculto do DM",
      text: "Ivory sabe mais sobre a Porta do Kenku do que demonstrou publicamente.",
      source: "Nota do DM • 04:42:19",
      visibleTo: ["yuhara"],
      related: ["Ivory", "Porta do Kenku", "Euclix"]
    }
  ],

  outtakes: [
    {
      id: "out-001",
      title: "SLA da Raven Queen",
      text: "A mesa comparou o pedido de Astel para Raven Queen com chamado técnico de prioridade crítica.",
      access: "party",
      visibleTo: ["yuhara", "renan", "arthur", "fernanda"],
      status: "Bastidor aprovado pela mesa",
      source: "02:03:10"
    },
    {
      id: "out-002",
      title: "Piada privada do Dandelion sobre o próprio medo",
      text: "Um comentário de diário pessoal que não deve virar corte público sem aprovação de Renan.",
      access: "owner_only",
      visibleTo: ["renan"],
      status: "Privado / não publicar",
      source: "04:01:01"
    }
  ],

  entities: [
    {
      id: "ent-001",
      name: "Dandelion",
      type: "Personagem jogador",
      owner: "renan",
      access: "party",
      visibleTo: ["yuhara", "renan", "arthur", "fernanda"],
      summary: "Bardo feérico em forma de pato, teatral e caótico. Transforma memória em música e revolução em espetáculo.",
      privateNote: "Tem diário privado sobre medo de ser esquecido e de perder o palco para a própria canção.",
      tags: ["bardo", "música", "memória", "Euclix"]
    },
    {
      id: "ent-002",
      name: "Astel",
      type: "Personagem jogador",
      owner: "arthur",
      access: "party",
      visibleTo: ["yuhara", "renan", "arthur", "fernanda"],
      summary: "Paladino sombrio da Raven Queen, ligado a corvos, morte, proteção e família Nightshade.",
      privateNote: "A conexão com Hugin está instável, visível apenas para Arthur + Yuhara.",
      tags: ["paladino", "raven queen", "hugin", "família"]
    },
    {
      id: "ent-003",
      name: "Screacky",
      type: "Personagem jogador",
      owner: "fernanda",
      access: "party",
      visibleTo: ["yuhara", "renan", "arthur", "fernanda"],
      summary: "Kenku/arara escarlate, monge das sombras, herdeira ligada a Euclix e à profecia da Fênix Vermelha.",
      privateNote: "Compartilha com Dandelion um sinal secreto para agir contra manipulações de Ivory.",
      tags: ["monge", "sombras", "fênix", "Euclix"]
    },
    {
      id: "ent-004",
      name: "Ivory",
      type: "NPC / antagonista",
      owner: "yuhara",
      access: "party",
      visibleTo: ["yuhara", "renan", "arthur", "fernanda"],
      summary: "Rainha usurpadora associada a gelo, espinhos, controle narrativo e silenciamento cultural.",
      privateNote: "DM-only: conhece parte do risco da Porta do Kenku.",
      tags: ["npc", "vilã", "Euclix", "segredo-dm"]
    }
  ],

  songs: [
    {
      title: "O Reino Vai Cantar",
      status: "Canção pública / hino de resistência",
      owner: "renan",
      description: "Hino revolucionário de Dandelion sobre Euclix, a música proibida e o retorno da fênix.",
      visibility: "party"
    },
    {
      title: "A Rainha de Penas Vermelhas",
      status: "Canção pública / revelação de Screacky",
      owner: "renan",
      description: "Música que reposiciona Screacky como símbolo de renascimento, não como vilã da narrativa de Ivory.",
      visibility: "party"
    },
    {
      title: "Reprise privada para o duelo",
      status: "Rascunho privado / surpresa estética",
      owner: "renan",
      description: "Ideia de música futura. Não canon e invisível para DM até Renan decidir compartilhar.",
      visibility: "owner_only"
    }
  ],

  visibilityRules: [
    { rule: "Diário privado", system: "Somente dono", fiction: "Só o personagem/dono sabe", canon: "Não canon até compartilhar", dm: "DM não vê" },
    { rule: "Segredo de personagem", system: "Dono + DM", fiction: "Personagem sabe", canon: "Pode virar canon privado", dm: "DM vê" },
    { rule: "Segredo compartilhado", system: "Players escolhidos + DM", fiction: "Personagens escolhidos sabem", canon: "Pode virar cena", dm: "DM vê" },
    { rule: "Segredo do DM", system: "Somente DM", fiction: "NPCs/mundo podem saber", canon: "Canon oculto", dm: "DM controla" },
    { rule: "Canon público", system: "Mesa inteira", fiction: "Grupo/mundo sabe", canon: "Canon aprovado", dm: "DM aprova" }
  ]
};
