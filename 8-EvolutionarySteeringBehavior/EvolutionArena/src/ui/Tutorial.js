export const TUTORIAL_STEPS = Object.freeze([
  Object.freeze({ title: 'Des créatures autonomes', symbol: '△', text: 'Les créatures se dirigent grâce à des forces de steering. Leur pointe suit leur vitesse. Cliquez sur une créature pour consulter son énergie, sa génération et son ADN.' }),
  Object.freeze({ title: 'Se nourrir pour survivre', symbol: '●', text: 'Les disques verts sont de la nourriture. Une créature qui les consomme récupère de l’énergie. Son poids génétique peut l’attirer ou la repousser : elle ne suit pas une trajectoire imposée.' }),
  Object.freeze({ title: 'Reconnaître le poison', symbol: '×', text: 'Les croix roses encadrées sont toxiques. Le poison diminue l’énergie au contact. Un poids poison négatif déclenche Flee ; un poids positif attire malheureusement la créature.' }),
  Object.freeze({ title: 'Anticiper les prédateurs', symbol: '⋈', text: 'Les grands chasseurs orangés prédisent la position de leur cible avec Pursue. Les créatures proches réagissent avec Evade. Les réticules indiquent une poursuite, les halos une capture.' }),
  Object.freeze({ title: 'Quatre gènes, une filiation', symbol: '≋', text: 'Deux poids et deux rayons composent l’ADN. Les descendants en reçoivent une copie indépendante, parfois mutée : 1 % par gène à la référence. Les couleurs et encoches indiquent un cycle de générations ; le numéro exact reste dans l’inspecteur.' }),
  Object.freeze({ title: 'Des missions, pas une preuve scientifique', symbol: '◇', text: 'En Survie, atteignez l’objectif avant sa limite. Une victoire débloque la suite. Les étoiles évaluent la population finale et les dépenses ; elles ne démontrent pas une adaptation génétique. Le Laboratoire conserve tous les réglages scientifiques.' }),
  Object.freeze({ title: 'Intervenir avec mesure', symbol: '＋', text: 'Choisissez une action puis cliquez : nourriture, nettoyage ou protection locale. L’abondance est immédiate. Coûts, récupération et durées limitent vos interventions. La zone ne protège ni de la faim ni du poison. La pause permet d’inspecter sans faire avancer le temps.' }),
]);

export class Tutorial {
  constructor() { this.index = 0; }
  get step() { return TUTORIAL_STEPS[this.index]; }
  get total() { return TUTORIAL_STEPS.length; }
  next() { if (this.index < this.total - 1) this.index++; }
  previous() { this.index = Math.max(0, this.index - 1); }
  restart() { this.index = 0; }
}
