# Arrival Intelligence Studio — TD3 Arrive

Projet du TD3 de Steering Behaviors (Master 2 MIAGE IA2). Le dossier propose trois usages de l’arrivée : laboratoire scientifique, challenge de formations et composition de texte. Les anciens modes Arrive, Snake et Texte sont conservés et lancés depuis des pages dédiées.

## Correction de composition et diagnostics

Validation actuelle : **41 tests Node réussis, 0 échec**, contre 33 avant correction. Les huit contrôles Chrome cités plus bas sont historiques ; aucune nouvelle validation Chrome n'a été effectuée pendant cette intervention.

Dans les modes ordinaires Seek et Arrive, le contrôleur calcule séparément la force principale et les bordures, additionne sur une copie et plafonne la somme à maxForce avant un unique applyForce() et une seule intégration. Les comparateurs, formations et agents de texte conservent leurs règles : aucune force de bordure ne leur est ajoutée. Les trajectoires près des bords peuvent changer avec ce plafonnement.

lastSteering et les diagnostics hérités conservent la force principale. appliedSteering mémorise des copies de l'origine, des vitesses et de la force totale appliquée. Tous les vecteurs partent de la position du calcul avant intégration : vitesse blanche (×6), vitesse désirée jaune pour l'agent inspecté (×6), force principale verte pour cet agent (×45), force totale rose (×45). Deux forces égales peuvent se superposer. Le rendu ne recalcule aucune force ; le léger décalage avec le corps après déplacement est intentionnel.

Le panneau distingue les deux forces. Les unités sont les pixels CSS, les pixels par pas pour les vitesses et les pixels par pas au carré pour les forces, avec masse implicite unitaire et pas de 1/60 seconde. À distance exactement nulle, Seek et Arrive retournent une force nulle, même avec une vitesse résiduelle : ce cas ne garantit pas un arrêt instantané.

La sélection lit le dernier calcul de l'agent choisi. En comparaison, les indices parcourent le groupe Seek puis le groupe Arrive. La pause conserve le dernier calcul ; reset, changement de mode et réaffectation des cibles texte invalident les anciens instantanés. Avant le premier calcul, les champs affichent des tirets.

Les nouveaux tests couvrent forces convergentes/opposées/nulles, plafonnement, application et intégration uniques, copies défensives, origines de rendu, pause/reprise, sélection, reset, changements de mode, comparateurs et texte. Les tests existants restent présents.

### Anomalies protégées restant ouvertes

Aucun vehicle.js n'a été modifié. Le constructeur conserve `options.maxSpeed || 6` et `options.maxForce || 0.4` : zéro et null utilisent les défauts ; les valeurs négatives ou infinies ne sont pas validées. Certaines sous-classes ont aussi des replis par `||`. L'interface conserve ses bornes positives.

Le diagnostic de flee() conserve le libellé erroné 'arrive' dans les deux branches. Ces anomalies restent non corrigées faute d'autorisation spécifique. La cible souris reste une entrée cinématique, distincte du steering des agents.

## Objectifs pédagogiques

- Comprendre comment Arrive adapte la vitesse désirée à la distance de la cible.
- Distinguer Seek, qui conserve une vitesse désirée maximale, d’Arrive, qui ralentit dans un rayon.
- Observer la différence entre vitesse souhaitée, vitesse actuelle et force de pilotage.
- Réutiliser Arrive pour suivre une cible, un leader, un emplacement de formation ou un point de caractère.
- Mesurer la distance, la vitesse et l’erreur de formation à partir de la simulation.

## Formules

Soit `d` la distance agent-cible, `r` le rayon de ralentissement, `s` la distance d’arrêt et `vmax` la vitesse maximale :

```text
si d >= r : desiredSpeed = vmax
sinon     : desiredSpeed = vmax × clamp((d - s) / (r - s), 0, 1)
desiredVelocity = normalize(target - position) × desiredSpeed
steering = desiredVelocity - currentVelocity
|steering| <= maxForce
```

Seek emploie `desiredSpeed = maxSpeed`. Arrive conserve la même loi de steering, mais fait décroître la vitesse désirée dans `slowRadius`. `stopDistance` définit un rayon intérieur où la vitesse désirée devient nulle; l’interface borne ce rayon sous `slowRadius` pour éviter des seuils incohérents. La locomotion reste déléguée à `Vehicle.applyForce()` puis `Vehicle.update()`.

## Les applications

### Scientific Arrive Lab — `arrive-lab.html`

La cible suit la souris. Le laboratoire propose Arrive et Seek, un comparateur côte à côte initialisé avec les mêmes positions, les paramètres `maxSpeed`, `maxForce`, `slowRadius`, `stopDistance` et le nombre d’agents. Pause, reprise, pas suivant, reset, vitesse de simulation, trajectoires, rayons et vecteurs vitesse/force sont contrôlables. Les distances, vitesses et mesures de comparaison sont échantillonnées dans la simulation et exportables en CSV.

Les scénarios sélectionnent une seed déterministe. Une même seed reconstruit les mêmes positions initiales. Le temps de simulation utilise un pas fixe de 1/60 seconde; le curseur de vitesse ajuste le nombre de pas effectués par temps réel.

### Snake & Formation Challenge — `arrive-challenge.html`

Le leader suit la souris et les agents utilisent Arrive pour suivre le leader ou rejoindre leur emplacement relatif. Les formations disponibles sont chaîne (mode historique), ligne, chevron et arc. Nombre d’agents, espacement, vitesse, force et rayons sont configurables. La stabilité affichée est l’erreur moyenne mesurée entre les agents et leurs emplacements de formation.

### Text Formation Studio — `text-studio.html`

Le texte est rasterisé sur un canvas natif puis échantillonné en points. Les agents rejoignent ces points par Arrive. Le texte, la densité d’échantillonnage, le nombre d’agents, la palette, la vitesse et la force peuvent être réglés. Lors d’un changement de mot, les agents existants gardent leur état et pilotent vers de nouveaux points, ce qui produit une transition.

## Architecture

```text
3-Arrival/
├── index.html                  accueil
├── arrive-lab.html             laboratoire et comparaison
├── arrive-challenge.html       Snake et formations
├── text-studio.html            formations de texte
├── css/                        styles partagés et accueil
├── js/
│   ├── vehicle.js              locomotion et comportements avec état p5.Vector
│   ├── target.js               cible souris
│   ├── trailer.js              suiveur de formation
│   ├── textVehicle.js          agent de caractères
│   ├── particle.js             effets visuels
│   ├── game.js                 simulation, scénarios et mesures
│   ├── ui.js                   contrôles HTML
│   └── main.js                 événements de page
└── tests/                      tests Node.js (dont un double p5.Vector dédié)
```

Les comportements de pilotage produisent des forces p5.Vector et la locomotion partagée les applique via Vehicle.applyForce() puis Vehicle.update(). Les trois pages de simulation chargent la bibliothèque locale libraries/p5.min.js avant les entités; main.js vérifie que p5.Vector existe. Le projet conserve son canvas HTML Canvas 2D et sa boucle fixe, sans démarrer de boucle de rendu p5. Les diagnostics restent des copies numériques défensives. Les tests Node utilisent un double vectoriel limité : ils ne valident pas le runtime réel p5.

## Lancement

Depuis ce dossier, lancer un serveur statique local :

```powershell
python -m http.server 8000
```

Puis ouvrir `http://localhost:8000/3-Arrival/` depuis la racine du dépôt, ou `http://localhost:8000/` si le serveur a été lancé directement dans `3-Arrival`.

Les applications n’ajoutent aucune dépendance npm ou framework. Les tests demandent Node.js :

```powershell
node --test tests/*.test.mjs
```

## Contrôles

- Souris dans le canvas : déplacer la cible ou le leader.
- `Espace` : pause/reprise; `R` : reset.
- `+` et `-` : ajouter ou retirer un véhicule; `C` : vider la simulation.
- Les boutons et curseurs de chaque panneau contrôlent leur simulation.
- Le laboratoire exporte les échantillons collectés via **Exporter les mesures CSV**.

## Scénarios de démonstration

1. Dans le laboratoire, comparer Seek et Arrive avec le même scénario, puis observer le ralentissement lorsque les agents entrent dans `slowRadius`.
2. Augmenter `stopDistance` tout en le maintenant sous `slowRadius`, puis comparer la distance d’arrêt.
3. Dans le challenge, essayer chaîne, ligne, chevron et arc; observer l’erreur moyenne pendant les changements de direction.
4. Dans Text Studio, saisir un autre mot et comparer densité et palette sans remplacer instantanément les agents.

## Tests et validation

La locomotion a été migrée vers `p5.Vector` pour les positions, vitesses, accélérations et forces. Le rendu reste assuré par Canvas 2D et par la boucle applicative existante; p5 fournit localement les opérations vectorielles sans ajouter de canvas ni de boucle de rendu p5.

Les tests automatisés Node sont exécutés avec `node --test tests/*.test.mjs`. Ils utilisent un double limité de `p5.Vector`; ils valident les comportements et les règles testées, mais ne remplacent pas l’exécution de la bibliothèque p5 réelle dans un navigateur. Résultat de référence : **33 tests Node réussis**.

La validation manuelle dans Chrome a couvert **8 contrôles**. Les trois applications chargent `libraries/p5.min.js` depuis le dépôt. Lors de ces contrôles, aucun canvas supplémentaire ni aucune boucle p5 concurrente n’a été observé. Ces contrôles navigateur sont manuels et ne sont pas comptés parmi les tests automatisés.

Les tests couvrent notamment les méthodes de référence, les seuils d’Arrive, la limitation de force, la position souris `x = 0`, l’application des réglages, les emplacements de formation, les transitions entre textes, les scénarios reproductibles, les contrôles de pause et les chemins des pages.

## Réutilisation pour le projet final

Arrive peut servir de comportement de ralentissement à l’approche d’une cible, d’un point de chemin ou d’un emplacement de formation. Pour le projet final, garder les comportements comme producteurs de forces composables et confier leur application ainsi que le déplacement à une locomotion partagée. La migration vers p5.Vector est réalisée dans Vehicle et les entités du TD3. Les tests avant/après vérifient les mêmes valeurs de référence et les types vectoriels avec un double de test; la validation manuelle Chrome de la bibliothèque réelle est documentée dans « Tests et validation ».
