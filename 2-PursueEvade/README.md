# TD2 — Pursuit & Evade Intelligence Lab

Projet du TD2 de Steering Behaviors (Master 2 MIAGE IA2, cours de Michel Buffa). Le dossier réunit un challenge Predator & Prey et un laboratoire scientifique indépendant. Les deux pages utilisent les bibliothèques p5 locales et peuvent être lancées séparément.

## Objectifs pédagogiques

- Distinguer une cible actuelle d’une cible prédite.
- Comparer Seek à Pursuit et Flee à Evade avec les mêmes conditions initiales.
- Observer la perception d’une proie et le choix du poursuivant le plus proche.
- Relier l’action choisie, la force de steering et la locomotion fournie par `Vehicle`.
- Mesurer les distances, les captures et le temps en pas de simulation.

## Formules

Seek et Flee construisent une vitesse souhaitée de longueur au plus `maxSpeed`, puis calculent la force :

```text
desiredVelocity = direction × maxSpeed
steering = desiredVelocity − currentVelocity
|steering| ≤ maxForce
```

Pursuit prédit une position future de la cible et applique Seek à cette position :

```text
futurePosition = target.position + target.velocity × predictionFrames
Pursuit = Seek(futurePosition)
```

Evade prédit de la même façon la position future du poursuivant, puis construit une vitesse souhaitée opposée à cette position. Il ne retourne pas simplement la force de Pursuit inversée :

```text
futurePursuer = pursuer.position + pursuer.velocity × predictionFrames
desiredVelocity = direction opposée vers futurePursuer × maxSpeed
Evade = desiredVelocity − currentVelocity
```

La force calculée par `Vehicle` est transmise à `applyForce()` ; `Vehicle.update()` effectue l’intégration. Dans les visualisations, les vecteurs correspondent aux valeurs du calcul courant. Leur longueur graphique est amplifiée à des fins de lecture : vitesse ×8 et force totale ×35. Dans le scénario chat et souris, la vitesse désirée reste celle de Pursuit tandis que la force rose représente la résultante avec les bordures, plafonnée à `maxForce`. Les diagnostics conservent séparément `lastSteering.force` (comportement individuel) et `lastSteering.totalForce` (force appliquée). Dans les autres scénarios ces deux forces sont égales.

## Applications

### Predator & Prey Challenge

Ouvrir `predator-prey.html`. Cette page conserve le jeu local et ses types de proies, poursuite, obstacles, power-ups, score, combos, succès, audio et effets de capture. Les paramètres permettent de choisir une difficulté et jusqu’à quatre chasseurs et dix proies initiales ; **Nouvelle partie** applique les réglages. Le panneau de statistiques affiche FPS, captures, temps écoulé, distance minimale mesurée et temps de la dernière capture. Le nombre de proies peut ensuite augmenter selon la règle de réapparition du jeu.

Contrôles clavier du jeu :

- `P` : Pursuit ; `S` : Seek/Arrive vers la souris ; `W` : Wander.
- `V` : afficher/masquer le champ de vision ; `M` : couper/rétablir le son.
- `R` : réinitialiser la partie.
- Clic droit : placer un obstacle.

### Pursuit & Evade Scientific Lab

Ouvrir `pursuit-lab.html`. Les scénarios comprennent un agent configurable, le chat et la souris, des balles rebondissantes, une comparaison Seek/Pursuit et une comparaison Flee/Evade. Les deux comparaisons repartent de positions et vitesses relatives identiques. Chaque pas relève la distance ; les captures et le temps de capture affichés proviennent de la simulation. Le bouton CSV exporte l’historique effectivement collecté.

Le panneau règle le comportement, `predictionFrames` (2 à 30), la vitesse et la force de l’agent, la vitesse de la cible, le rayon de perception et la vitesse de simulation. Pause, Reprendre, Pas suivant, Reset, sélection par clic, vecteurs, point futur, trajectoires et champ de vision sont disponibles.

## Architecture

```text
2-PursueEvade/
├── index.html                 accueil des deux applications
├── home.css
├── predator-prey.html         jeu préservé, page autonome
├── challenge.css
├── pursuit-lab.html           laboratoire autonome
├── lab.css
├── vehicle.js                 classe locale fournie/modifiée, non modifiée ici
├── target.js                  proie, perception et mise à jour via Vehicle
├── bouncingBall.js            BouncingBall extends Target
├── target-selection.js        sélection du plus proche et détection de capture
├── pursuit-agent.js           sous-classe Vehicle instrumentée pour le laboratoire
├── pursuit-lab.js             simulation, scénarios, mesures et contrôles
├── lab-renderer.js             rendu des agents, vecteurs et prédictions
├── lab-sketch.js              cycle p5 du laboratoire
├── sketch.js                  boucle du challenge
├── particle.js                particules balistiques et création des explosions
├── shockwave.js               onde de choc immobile, classe séparée
├── ui.js, audio.js, ...       systèmes existants du jeu
├── libraries/                 p5.js et p5.sound locaux
└── tests/                     tests Node natifs
```

Le laboratoire charge seulement `Vehicle`, les entités requises et son propre contrôleur ; il ne charge pas l’état, le stockage ou l’interface du jeu. `Target` délègue maintenant l’intégration à `Vehicle.update()`. `BouncingBall` passe une liste de poursuivants (vide par défaut) à `Target.update()` avant d’appliquer son rebond. La variante du challenge conserve la perception en cône ; le scénario scientifique peut sélectionner la variante de perception radiale stricte.

Le `vehicle.js` conserve les versions existantes de Seek, Flee, Pursuit et Evade et son intégrateur. Il n'a pas été modifié pendant cette correction architecturale. Les agents du laboratoire ont des bords toriques, avec effacement des trajectoires au rebouclage ; `BouncingBall` rebondit sur les bords.

Dans le challenge, chaque chasseur compose comportement principal, évitement et bordures, puis applique une seule force plafonnée à `maxForce`. `Vehicle.avoid()` limite aussi sa force individuelle à `maxForce`, et le contrôleur conserve un plafonnement local de sécurité. Dans le laboratoire, le scénario `chase` additionne Pursuit et bordures puis plafonne leur somme avant une application unique. Les proies avaient déjà leur propre plafonnement global, conservé.

### Effets balistiques et exceptions

Les particules héritent de Vehicle et délèguent chaque déplacement à une seule intégration centrale. Leurs forces de frottement et gravité sont balistiques : elles ne représentent pas Seek/Flee et ne sont pas arbitrairement limitées par les paramètres d'un chasseur. La vitesse maximale des particules reste infinie pour préserver les explosions.

Le comportement historique déplace d'abord la particule puis amortit sa vitesse : `P suivant = P + v`, `v suivant = 0,94 v + (0, gravité)`. Après l'intégration héritée, Particle prépare maintenant la force `−0,06 v + (0, gravité)` avec `applyForce()` pour le pas suivant, sans écrire directement dans sa vitesse. Ainsi `vel + acc` en fin de pas représente la vitesse historique du prochain déplacement ; `vel` seule représente le déplacement qui vient d'être intégré. L'accélération en attente n'est donc volontairement pas nulle en sortie de Particle.update(). Au pas suivant, Vehicle ajoute cette force, déplace la particule puis efface l'accélération avant la préparation suivante.

Cette récurrence conserve les positions historiques à l'arrondi flottant près, y compris avec gravité non nulle. Le rendu n'utilise que position, vie, couleur et taille : il conserve son comportement. La vie décroît toujours de 6 par pas, et les traînées héritées sont vidées. Shockwave conserve exactement son origine fixe, son rayon augmenté de 8 et sa vie diminuée de 10 par pas ; elle est maintenant définie dans son propre fichier. `explode()` conserve son nombre de particules et son onde.

Les rebonds, rebouclages et réapparitions de capture restent des règles de scène, distinctes des comportements de steering. Les systèmes d'audio et leurs temporisations sont conservés.

## Lancer le TD2

Depuis la racine du dépôt, démarrer un serveur HTTP statique :

```sh
python -m http.server 8000
```

Ouvrir ensuite :

- `http://localhost:8000/2-PursueEvade/` pour l’accueil ;
- `http://localhost:8000/2-PursueEvade/predator-prey.html` pour le jeu ;
- `http://localhost:8000/2-PursueEvade/pursuit-lab.html` pour le laboratoire.

Node.js est requis pour les tests, mais pas pour lancer les applications. Aucun framework supplémentaire n’est utilisé.

## Tests

Depuis `2-PursueEvade` :

```sh
node --test tests/*.test.mjs
```

La suite couvre les comportements de référence, les limites `maxSpeed`/`maxForce`, la prédiction sans mutation de la vitesse cible, les cas nuls et les changements brusques de direction, la sélection/capture, la perception, les rebonds, les contrôles et reset du laboratoire, les comparaisons initialisées de manière identique, les paramètres du challenge et les références locales des pages. Après correction architecturale : **30 tests réussis, 0 échec**.

Les nouveaux tests vérifient la composition plafonnée, l'application et l'intégration uniques du scénario chase, les diagnostics individuels/totaux et le vecteur réellement dessiné, le chargement de Shockwave et la création des explosions. Les positions des particules sont comparées à la récurrence historique sur 100 pas avec gravité nulle, positive, négative et changement de signe, avec une tolérance absolue de 1e-11 pixel. L'ancien test de vitesse vérifie désormais `vel + acc`, conformément au contrat de force différée.

## Limites connues

- Aucune nouvelle validation Chrome n'a été effectuée pour cette correction. Les tests d'interface exécutent le contrôleur avec des objets DOM/p5 simulés ; une validation ciblée des deux applications reste nécessaire.
- Le plafonnement global réduit certaines accélérations près des obstacles et des bordures. Les règles de capture, réglages de difficulté et bonus sont conservés, mais les trajectoires et temps de capture peuvent évoluer ; l'équilibre doit être apprécié dans Chrome.
- La difficulté et les nombres de participants du Challenge prennent effet à la prochaine nouvelle partie.
- Le laboratoire utilise une prédiction fixe réglable ; une prédiction adaptative n’est pas incluse.
- Les mesures et l’export CSV couvrent la distance par pas, les captures et le temps en frames. Il n’y a pas encore de graphique temporel ou d’analyse statistique avancée.
- Les tests utilisent un adaptateur vectoriel minimal ; une vérification avec p5 réel dans un navigateur compléterait la validation.

## Réutilisation pour le projet final

`PursuitAgent` expose un point de composition pour d’autres comportements, tandis que `Vehicle` reste responsable de la force et de la locomotion. `target-selection.js` fournit des fonctions indépendantes pour le choix de cible et les captures. Les comportements des TD suivants ne sont pas implémentés dans ce TD2.
