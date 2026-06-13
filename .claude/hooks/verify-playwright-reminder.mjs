// .claude/hooks/verify-playwright-reminder.mjs
// UserPromptSubmit hook : injecte un rappel quand l'utilisateur signale un bug front-end,
// pour forcer la vérification au Playwright AVANT de répondre.
let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { raw += c; });
process.stdin.on('end', () => {
  let prompt = '';
  try { prompt = (JSON.parse(raw || '{}').prompt || '').toLowerCase(); } catch {}

  // Mots déclencheurs : bug d'affichage / interaction front-end
  const triggers = [
    'bug', 'clignote', 'clignotement', 'marche pas', 'marche plus',
    "s'affiche pas", 'affiche pas', 'ne fonctionne', 'fonctionne pas',
    'cassé', 'casse', 'plante', 'beug', "n'apparait", 'apparait pas',
  ];
  const hit = triggers.some((t) => prompt.includes(t));

  if (hit) {
    const reminder =
      'RAPPEL UTILISATEUR (récurrent) : ce message signale un bug front-end. ' +
      'AVANT de répondre, REPRODUIRE et VÉRIFIER au Playwright en conditions réelles ' +
      '(contexte mobile hasTouch:true, touchscreen.tap, état réel ex. localStorage rempli/corrompu, prod). ' +
      'Surveiller : réponses 404 (un flot = clignotement), erreurs console, mutations DOM (re-render en boucle), ' +
      'hit-test elementFromPoint. Penser à page.unrouteAll() pour purger les mocks persistants. ' +
      'Ne JAMAIS dire "corrigé/ça marche" sans preuve chiffrée (count404=0, mutations=0) + screenshot. ' +
      'Voir la mémoire feedback-verify-playwright.';
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: reminder },
    }));
  }
  process.exit(0);
});
