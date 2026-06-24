window.DND_SCRIBE_DATA = {
  viewers: [
    {
      id: "dm",
      name: "DM",
      character: "Mestre",
      role: "dm",
      hint: "Vê canon público, segredos de DM e segredos compartilhados com o DM. Não vê diários privados de jogador."
    },
    {
      id: "renan",
      name: "Renan",
      character: "Dandelion",
      role: "player",
      hint: "Vê o que Dandelion sabe, segredos próprios, segredos compartilhados com ele e o canon público."
    },
    {
      id: "arthur",
      name: "Arthur",
      character: "Astel",
      role: "player",
      hint: "Vê o que Astel sabe, segredos próprios, segredos compartilhados com ele e o canon público."
    },
    {
      id: "bia",
      name: "Player da Screaky",
      character: "Screaky",
      role: "player",
      hint: "Vê o que Screaky sabe, segredos próprios, segredos compartilhados com ela e o canon público."
    }
  ],

  session: {
    id: "sessao-027",
    title: "Preparação para o Duelo de Euclix",
    arc: "Euclix / Porta do Kenku",
    status: "Em revisão",
    date: "Sábado, 29/06/2026",
    duration: "06h 12m",
    currentScene: "Praça congelada de Euclix",
    nextGoal: "Preparar Screaky para o duelo público contra Ivory sem deixar a narrativa ser sequestrada.",
    rule: "Áudio bruto é evidência. Transcrição é rascunho. IA sugere. Humano valida. Só o validado vira canon."
  },

  captureSources: [
    { id: "craig", name: "Craig Multitrack", status: "Pronto", detail: "4 faixas detectadas: DM, Renan/Dandelion, Arthur/Astel, Screaky", progress: 100, color: "green" },
    { id: "obs", name: "OBS Backup", status: "Importado", detail: "Tela Roll20 + áudio geral + Discord", progress: 100, color: "blue" },
    { id: "roll20", name: "Roll20 Pro Logger", status: "Eventos parseados", detail: "Rols, cenas, turnos, whispers e !dnd commands", progress: 88, color: "gold" },
    { id: "discord", name: "Discord/Craig Notes", status: "Marcadores lidos", detail: "CANON, FALA, BASTIDOR, DUVIDA, CORTAR", progress: 78, color: "purple" },
    { id: "ai", name: "OpenAI Transcrição", status: "Em revisão", detail: "Transcrição segmentada por jogador e timestamp", progress: 64, color: "orange" }
  ],

  markers: [
    { t: "00:08:12", type: "Cena", text: "Retorno à praça de Euclix" },
    { t: "00:44:09", type: "Canon?", text: "Ivory pode tentar manipular as regras do duelo" },
    { t: "01:16:33", type: "Segredo", text: "Astel recebe sinal fraco de Hugin" },
    { t: "02:03:10", type: "Bastidor", text: "Piada da mesa sobre 'paladino abrindo chamado na Raven Queen'" },
    { t: "03:22:47", type: "Fala", text: "Dandelion improvisa discurso sobre música e memória" }
  ],

  transcript: [
    {
      id: "seg-001",
      time: "00:08:12",
      speaker: "DM",
      character: "Narrador",
      text: "A praça de Euclix parece mais cheia do que antes. As pessoas não cantam alto, mas algumas bocas se movem como se lembrassem uma melodia proibida.",
      type: "dm_narration",
      access: "party",
      visibleTo: ["dm", "renan", "arthur", "bia"],
      fictionKnows: ["Dandelion", "Astel", "Screaky", "Povo de Euclix"],
      tags: ["euclix", "publico", "musica"]
    },
    {
      id: "seg-002",
      time: "00:09:44",
      speaker: "Renan",
      character: "Dandelion",
      text: "Eu não preciso que eles cantem alto. Ainda. Uma revolução começa igual panela de pressão: primeiro faz barulhinho, depois suja a cozinha toda.",
      type: "in_character",
      access: "party",
      visibleTo: ["dm", "renan", "arthur", "bia"],
      fictionKnows: ["Dandelion", "Astel", "Screaky"],
      tags: ["fala", "dandelion", "revolucao"]
    },
    {
      id: "seg-003",
      time: "01:16:33",
      speaker: "Arthur",
      character: "Astel",
      text: "Astel toca a marca na mão e tenta sentir Hugin. A resposta vem fraca, como um corvo batendo contra vidro.",
      type: "player_action",
      access: "shared_secret",
      visibleTo: ["dm", "arthur"],
      fictionKnows: ["Astel", "Hugin"],
      tags: ["astel", "hugin", "familia", "segredo"]
    },
    {
      id: "seg-004",
      time: "02:03:10",
      speaker: "Mesa",
      character: "Fora de personagem",
      text: "Discussão fora de jogo sobre o Astel abrir chamado técnico para a Raven Queen: prioridade crítica, SLA eterno, resposta em corvo.",
      type: "ooc_chatter",
      access: "party_private",
      visibleTo: ["dm", "renan", "arthur", "bia"],
      fictionKnows: [],
      tags: ["bastidor", "piada"]
    },
    {
      id: "seg-005",
      time: "03:22:47",
      speaker: "Renan",
      character: "Dandelion",
      text: "Vocês fizeram o reino esquecer a música. Mas esquecer não é o mesmo que matar.",
      type: "quote_candidate",
      access: "party",
      visibleTo: ["dm", "renan", "arthur", "bia"],
      fictionKnows: ["Dandelion", "Astel", "Screaky", "Povo de Euclix"],
      tags: ["fala", "canon", "musica"]
    },
    {
      id: "seg-006",
      time: "04:01:01",
      speaker: "Renan",
      character: "Diário privado de Dandelion",
      text: "Talvez Dandelion esteja com medo de que, se o povo cantar sem ele, ninguém precise mais dele no palco.",
      type: "private_journal",
      access: "player_only_no_dm",
      visibleTo: ["renan"],
      fictionKnows: ["Dandelion"],
      tags: ["diario", "nao-canon", "privado"]
    }
  ],

  candidates: [
    {
      id: "cand-001",
      title: "O povo começou a repetir a canção proibida",
      claim: "Alguns habitantes de Euclix já lembram e murmuram a melodia de Dandelion, sugerindo que a música começou a se espalhar.",
      status: "candidate",
      confidence: 0.86,
      visibilitySuggestion: "Canon público do grupo",
      source: "seg-001",
      sourceTime: "00:08:12",
      tags: ["canon", "euclix", "dandelion"],
      visibleTo: ["dm", "renan", "arthur", "bia"]
    },
    {
      id: "cand-002",
      title: "A conexão de Astel com Hugin enfraqueceu",
      claim: "Astel percebeu uma resposta fraca de Hugin, indicando possível risco envolvendo sua família ou o vínculo espiritual.",
      status: "private_canon_candidate",
      confidence: 0.74,
      visibilitySuggestion: "Arthur + DM",
      source: "seg-003",
      sourceTime: "01:16:33",
      tags: ["segredo", "astel", "dm"],
      visibleTo: ["dm", "arthur"]
    },
    {
      id: "cand-003",
      title: "Fala marcante de Dandelion sobre memória",
      claim: "A frase 'esquecer não é o mesmo que matar' deve ser marcada como fala destacada e possível frase de abertura do recap.",
      status: "quote_candidate",
      confidence: 0.93,
      visibilitySuggestion: "Pública após revisão",
      source: "seg-005",
      sourceTime: "03:22:47",
      tags: ["fala", "dandelion", "recap"],
      visibleTo: ["dm", "renan", "arthur", "bia"]
    }
  ],

  secrets: [
    {
      id: "sec-001",
      title: "Hugin responde fraco a Astel",
      type: "Segredo de Personagem",
      owner: "arthur",
      ownerCharacter: "Astel",
      visibleTo: ["arthur", "dm"],
      fictionKnows: ["Astel", "Hugin"],
      status: "Canon privado candidato",
      dmCanView: true,
      canAffectCanon: true,
      source: "Sessão 027 • 01:16:33",
      description: "A conexão de Astel com Hugin parece instável. Pode indicar perigo para sua família ou interferência de Euclix.",
      revealHistory: ["Criado a partir de transcrição", "Sugerido como segredo Arthur + DM"]
    },
    {
      id: "sec-002",
      title: "Dandelion teme perder o palco para a própria canção",
      type: "Diário privado",
      owner: "renan",
      ownerCharacter: "Dandelion",
      visibleTo: ["renan"],
      fictionKnows: ["Dandelion"],
      status: "Não canon / privado",
      dmCanView: false,
      canAffectCanon: false,
      source: "Nota privada do jogador",
      description: "Reflexão interna. Não entra em recap, não alimenta canon e não aparece para o DM até Renan decidir compartilhar.",
      revealHistory: ["Criado como diário privado", "Não compartilhado com DM"]
    },
    {
      id: "sec-003",
      title: "Dandelion e Screaky planejam encenação contra Ivory",
      type: "Segredo compartilhado",
      owner: "renan",
      ownerCharacter: "Dandelion",
      visibleTo: ["renan", "bia", "dm"],
      fictionKnows: ["Dandelion", "Screaky"],
      status: "Plano privado com DM",
      dmCanView: true,
      canAffectCanon: true,
      source: "Marcador manual /momento",
      description: "Plano de cena pública para forçar Ivory a reagir diante do povo. Astel ainda não sabe dentro da ficção.",
      revealHistory: ["Criado manualmente", "Compartilhado com Screaky e DM"]
    },
    {
      id: "sec-004",
      title: "Ivory conhece uma versão distorcida da Porta do Kenku",
      type: "Segredo do DM",
      owner: "dm",
      ownerCharacter: "DM",
      visibleTo: ["dm"],
      fictionKnows: ["Ivory"],
      status: "DM only",
      dmCanView: true,
      canAffectCanon: true,
      source: "Preparação do mestre",
      description: "Gancho do mestre. Pode explicar por que Ivory consegue atacar a narrativa antes do duelo.",
      revealHistory: ["Criado pelo DM", "Ainda não revelado aos jogadores"]
    }
  ],

  knowledge: [
    {
      id: "know-001",
      fact: "Screaky é a legítima herdeira de Euclix.",
      truthStatus: "Canon consolidado",
      systemAudience: ["dm", "renan", "arthur", "bia"],
      fictionKnows: ["Dandelion", "Astel", "Screaky", "Flander", "parte do povo"],
      notKnownBy: ["facção de Ivory", "povo manipulado"],
      source: "Sessões anteriores / Arco Euclix"
    },
    {
      id: "know-002",
      fact: "A conexão de Astel com Hugin parece instável.",
      truthStatus: "Canon privado candidato",
      systemAudience: ["dm", "arthur"],
      fictionKnows: ["Astel", "Hugin"],
      notKnownBy: ["Dandelion", "Screaky"],
      source: "Sessão 027 • 01:16:33"
    },
    {
      id: "know-003",
      fact: "Dandelion se pergunta se a canção continuar sem ele significa que ele perdeu importância.",
      truthStatus: "Diário privado / não canon",
      systemAudience: ["renan"],
      fictionKnows: ["Dandelion"],
      notKnownBy: ["DM", "Astel", "Screaky"],
      source: "Diário privado"
    },
    {
      id: "know-004",
      fact: "Ivory pode tentar vencer o duelo atacando a imagem de Screaky, não apenas sua força.",
      truthStatus: "Interpretação / gancho possível",
      systemAudience: ["dm", "renan", "arthur", "bia"],
      fictionKnows: ["Jogadores fora de personagem"],
      notKnownBy: ["Personagens, até prova em sessão"],
      source: "Discussão de planejamento"
    }
  ],

  canonBoard: [
    {
      id: "can-001",
      title: "Canon público",
      count: 18,
      items: [
        { text: "Screaky é herdeira legítima", visibleTo: ["dm", "renan", "arthur", "bia"] },
        { text: "Ivory proibiu artes", visibleTo: ["dm", "renan", "arthur", "bia"] },
        { text: "Duelo público foi marcado", visibleTo: ["dm", "renan", "arthur", "bia"] }
      ]
    },
    {
      id: "can-002",
      title: "Canon privado",
      count: 3,
      items: [
        { text: "Astel/Hugin instável", visibleTo: ["dm", "arthur"] },
        { text: "Plano Dandelion+Screaky", visibleTo: ["dm", "renan", "bia"] },
        { text: "Segredo de Leonard pendente", visibleTo: ["dm"] }
      ]
    },
    {
      id: "can-003",
      title: "Interpretação",
      count: 9,
      items: [
        { text: "Porta do Kenku como voz roubada", visibleTo: ["dm", "renan", "arthur", "bia"] },
        { text: "Dandelion teme ser substituído pela própria lenda", visibleTo: ["renan"] }
      ]
    },
    {
      id: "can-004",
      title: "Rejeitado / Bastidor",
      count: 14,
      items: [
        { text: "Piada do Jira da Raven Queen", visibleTo: ["dm", "renan", "arthur", "bia"] },
        { text: "Discussão de pizza", visibleTo: ["dm", "renan", "arthur", "bia"] },
        { text: "Problema de microfone", visibleTo: ["dm", "renan", "arthur", "bia"] }
      ]
    }
  ],

  entities: [
    { name: "Dandelion", type: "PC", visibleTo: ["dm", "renan", "arthur", "bia"], detail: "Bardo fada/pato, voz revolucionária de Euclix, caos com trilha sonora." },
    { name: "Astel", type: "PC", visibleTo: ["dm", "renan", "arthur", "bia"], detail: "Paladino da Raven Queen, ligado a Hugin, família e segredos sombrios." },
    { name: "Screaky", type: "PC", visibleTo: ["dm", "renan", "arthur", "bia"], detail: "Kenku/arara escarlate, legítima herdeira de Euclix, símbolo da Fênix Vermelha." },
    { name: "Ivory", type: "NPC", visibleTo: ["dm", "renan", "arthur", "bia"], detail: "Rainha usurpadora. Controla Euclix pelo silêncio, medo e narrativa." },
    { name: "Segredo da Porta", type: "DM", visibleTo: ["dm"], detail: "Informação oculta do mestre sobre a Porta do Kenku e Ivory." }
  ],

  outtakes: [
    { id: "out-001", title: "Chamado técnico para Raven Queen", visibility: "Mesa privada", approved: true, text: "Astel abre chamado: 'conexão com corvo intermitente, impacto em produção, favor priorizar'." },
    { id: "out-002", title: "Dandelion e a panela de pressão revolucionária", visibility: "Publicável após aprovação", approved: false, text: "Comparação fora de controle entre revolução popular e cozinha destruída." },
    { id: "out-003", title: "Discussão pessoal cortada", visibility: "Privado / não publicar", approved: false, text: "Trecho marcado como conversa pessoal. Mantido fora de recap e bastidores." }
  ]
};
