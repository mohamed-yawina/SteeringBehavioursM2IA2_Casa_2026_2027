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

La force calculée par `Vehicle` est transmise à `applyForce()` ; `Vehicle.update()` effectue l’intégration. Dans les visualisations, les vecteurs correspondent aux valeurs du calcul courant. Leur longueur graphique est amplifiée à des fins de lecture : vitesse ×8 et force ×35.

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
├── ui.js, audio.js, ...       systèmes existants du jeu
├── libraries/                 p5.js et p5.sound locaux
└── tests/                     tests Node natifs
```

Le laboratoire charge seulement `Vehicle`, les entités requises et son propre contrôleur ; il ne charge pas l’état, le stockage ou l’interface du jeu. `Target` délègue maintenant l’intégration à `Vehicle.update()`. `BouncingBall` passe une liste de poursuivants (vide par défaut) à `Target.update()` avant d’appliquer son rebond. La variante du challenge conserve la perception en cône ; le scénario scientifique peut sélectionner la variante de perception radiale stricte.

Le `vehicle.js` de travail contenait déjà les versions actuelles de Seek, Flee, Pursuit et Evade au début de cette intervention. Il n’a pas été modifié. Le fichier de référence suivi par Git avait une ancienne implémentation de Flee qui attendait `target.pos` et un Evade basé sur l’inversion de Pursuit ; ces défauts de la version initiale sont couverts par le constat de référence, sans restaurer ni réécrire `vehicle.js`. Les agents du laboratoire ont des bords toriques, avec effacement des trajectoires au rebouclage ; `BouncingBall` rebondit sur les bords.

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

La suite couvre les comportements de référence, les limites `maxSpeed`/`maxForce`, la prédiction sans mutation de la vitesse cible, les cas nuls et les changements brusques de direction, la sélection/capture, la perception, les rebonds, les contrôles et reset du laboratoire, les comparaisons initialisées de manière identique, les paramètres du challenge et les références locales des pages. Dernière exécution pendant cette livraison : **21 tests réussis, 0 échec**.

## Limites connues

- La validation du rendu et des interactions dans un navigateur reste à faire : l’outil Browser automatisé n’est pas disponible dans cette session. Les tests d’interface exécutent le contrôleur avec des objets DOM/p5 simulés.
- La difficulté et les nombres de participants du Challenge prennent effet à la prochaine nouvelle partie.
- Le laboratoire utilise une prédiction fixe réglable ; une prédiction adaptative n’est pas incluse.
- Les mesures et l’export CSV couvrent la distance par pas, les captures et le temps en frames. Il n’y a pas encore de graphique temporel ou d’analyse statistique avancée.
- Les tests utilisent un adaptateur vectoriel minimal ; une vérification avec p5 réel dans un navigateur compléterait la validation.

## Réutilisation pour le projet final

`PursuitAgent` expose un point de composition pour d’autres comportements, tandis que `Vehicle` reste responsable de la force et de la locomotion. `target-selection.js` fournit des fonctions indépendantes pour le choix de cible et les captures. Les comportements des TD suivants ne sont pas implémentés dans ce TD2.
