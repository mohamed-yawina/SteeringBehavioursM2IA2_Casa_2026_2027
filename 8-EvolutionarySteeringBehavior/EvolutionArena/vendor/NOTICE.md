# Sources conservées

- `vehicle.js` : copie exacte du TP 8 au commit `b7790773543acf9fb73160428f24d376acee57ab` du dépôt de Michel Buffa. Les crédits Daniel Shiffman / The Coding Train figurent dans le fichier. Ne pas le modifier sans accord préalable.
- `p5.min.js` : copie de la bibliothèque p5.js 1.7.0 déjà fournie localement. Son en-tête de licence est conservé. Aucune installation ni connexion CDN requise.

La base Vehicle contient des méthodes du TP comme `clone()`, `eat()` et `display()` qui ne sont pas utilisées par ce moteur. Le constructeur de base est toujours appelé sans ADN parental ; ses branches de mutation ne sont jamais utilisées. Depuis l'étape 3, la reproduction et les mutations sont implémentées séparément dans `src/evolution/` et `src/core/DNA.js`, sans modifier cette base.
