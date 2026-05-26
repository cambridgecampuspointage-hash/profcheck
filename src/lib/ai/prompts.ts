export function buildAdminChatSystemPrompt(mode: string) {
  const modeLabel =
    mode === 'crm'
      ? 'CRM'
      : mode === 'reception'
        ? 'réception'
        : mode === 'planning'
          ? 'planning'
          : 'gestion centre'

  return [
    'Tu es l’assistant opérationnel IA de ProfCheck pour Cambridge Campus.',
    'Tu réponds en français clair, court, orienté action.',
    'Tu as accès à un snapshot transversal de la plateforme: CRM, planning, pointages, réception, paiements, recouvrement et alertes.',
    'Tu dois rester concret, métier, sans blabla.',
    `Contexte principal : ${modeLabel}.`,
    'Appuie-toi uniquement sur les données fournies dans le contexte. Si une information n’est pas visible, dis-le explicitement.',
    'Quand la question demande un état ou un total, cite les éléments ou chiffres utiles du contexte.',
    'Quand tu proposes une action, donne toujours une priorité et une prochaine étape.',
  ].join(' ')
}

export function buildReceptionBriefingPrompt(context: string) {
  return [
    'Fais un briefing réception du jour en français.',
    'Format attendu :',
    '1. Priorités immédiates',
    '2. Alertes RH',
    '3. Appels ou relances à faire',
    '4. Risques du jour',
    'Reste très opérationnel et compact.',
    '',
    context,
  ].join('\n')
}

export function buildAlertsSummaryPrompt(context: string) {
  return [
    'Tu résumes les alertes Telegram opérationnelles.',
    'Réponds en français.',
    'Donne :',
    '1. Ce qui a été envoyé récemment',
    '2. Les erreurs ou échecs',
    '3. Les signaux à surveiller',
    '4. Une recommandation admin courte',
    '',
    context,
  ].join('\n')
}

export function buildTeacherNotesPrompt(context: string) {
  return [
    'Tu résumes les notes de séance d’un professeur.',
    'Réponds en français.',
    'Donne :',
    '- un résumé global',
    '- les points récurrents',
    '- les problèmes à signaler à l’administration',
    '- une synthèse finale courte',
    '',
    context,
  ].join('\n')
}

export function buildDashboardAnomaliesPrompt(context: string) {
  return [
    'Analyse les anomalies opérationnelles du centre à partir des données fournies.',
    'Réponds en français.',
    'Structure :',
    '1. Ce qui va bien',
    '2. Anomalies critiques',
    '3. Causes probables',
    '4. Actions prioritaires aujourd’hui',
    '5. Risques business ou opérationnels',
    'Sois direct, orienté décision admin.',
    '',
    context,
  ].join('\n')
}
