# Architecture d'Evolution Arena

## Frontières

Application autonome HTML/CSS/ES modules, sans bundler ni dépendance à installer. `index.html` charge p5 local, le Vehicle fourni puis `src/main.js`. Le code du cours dans `vendor/vehicle.js` reste intact. `core/courseVehicle.js` expose sa classe aux modules ES ; toutes les entités visibles en héritent. Le moteur ne dépend pas du DOM.

```text
main.mountApp
  ├─ Simulation du Laboratoire
  ├─ GameMode → MissionManager → Simulation de Survie
  │                            → PlayerActions + EcosystemPoints
  │                            → MissionProgress + GameResults
  ├─ Interface / GameInterface / ScienceInterface / AppShell
  ├─ ArenaRenderer / GameRenderer / TimeSeriesCharts
  └─ LocalPreferences → localStorage (progression et affichage seulement)
```

## Interfaces publiques et responsabilités

| Module | Contrat |
| --- | --- |
| `main.mountApp(sketch, root, options)` | Assemble, raccorde p5, charge les préférences ; retourne les composants et `dispose()` |
| `Simulation` | `step()` : un pas de 1/60 s ; `advance(seconds)` : accumulateur plafonné ; `reset()`, `togglePause()`, `setSeed()` ; `stats` en lecture |
| `DNA` | Quatre valeurs immuables, `copy()`, `mutated()`, validation et bornes |
| `Creature` | Perception et combinaison des forces, énergie, âge/filiation ; locomotion déléguée à Vehicle |
| `Predator` | Planification de cible/Wander, énergie, repos et locomotion héritée |
| `Food`, `Poison`, `ProtectionZone` | Entités séparées héritant de Vehicle |
| `behaviors/` | Fonctions pures ou état local explicite pour perception, Flee, composition, anticipation et Wander |
| `evolution/reproduction.js` | Configuration validée et admissibilité parentale ; orchestration dans `Simulation.tryReproduce()` |
| `EvolutionMetrics` | Compteurs de consommation/vies terminées, résumé génétique et historique borné |
| `predation/` | Validation des paramètres, sélection de cible et admissibilité de capture ; conséquences atomiques dans Simulation |
| `GameMode` | Choix du monde actif ; le monde inactif n'avance pas |
| `MissionManager` | `start`, `step`, `advance`, `replay`, `next`, `showSelection`, actions et résultat |
| `MissionProgress` | Déblocages et meilleures étoiles ; `record`, `reset`, callback `onChange` |
| `PlayerActions` | Coûts/cooldowns/effets temporaires ; aucune manipulation de l'ADN |
| `Experiments` | Configurations, huit profils, instantanés immuables, quatre traces UI, redémarrage validé avant remplacement |
| `ExperimentBatch` | Essais à horizon fixe, extinction/censure et agrégats entre graines |
| `CSVExport` | CSV rectangulaire, métadonnées, valeurs indisponibles et libération des URL Blob |
| `AppShell`, `DisplaySettings` | Écrans, tutoriel, focus et préférences visuelles ; aucune logique physique |
| `Interface`, `GameInterface`, `ScienceInterface` | Liaisons DOM, commandes et présentation des mesures |
| `ArenaRenderer`, `GameRenderer` | Lecture du monde et dessin p5 ; ne déplacent jamais les entités |
| `TimeSeriesCharts` | Neuf tracés Canvas 2D, cache et axes fondés sur le temps simulé |
| `LocalPreferences` | Schéma v1, liste blanche, validation et accès au stockage tolérant les erreurs |

## Mouvement et cycle vital

Chaque steering construit une vitesse désirée, soustrait la vitesse actuelle puis limite à maxForce. La composition pondérée est de nouveau bornée avant `applyForce()`. La locomotion reste celle du Vehicle fourni. Pursue prévoit une position puis utilise Seek ; Evade prévoit la menace puis construit une vitesse opposée avant la soustraction. Wander conserve une dérive continue de son angle.

Ordre d'un pas : planification des prédateurs ; consommation/forces/mouvement et morts des créatures ; mouvement/énergie des prédateurs ; captures avec retrait immédiat ; reproduction des survivants ; renouvellement des ressources et échantillonnage. Une victime retirée ne peut pas être capturée une seconde fois. Les nouveaux-nés n'agissent pas au pas de leur naissance.

Les quatre gènes restent poids nourriture, poids poison, perception nourriture, perception poison. Reproduction asexuée, copie indépendante et mutation bornée. La sélection naturelle émerge des différences de survie/reproduction ; aucun score de fitness ne choisit artificiellement les gagnants. Le détail historique et les formules figurent aux étapes 2–4.

## Temps, reproductibilité et mesures

Le pas fixe est 1/60 seconde ; une vitesse est exprimée en pixels par pas. Le rendu peut viser 30 ou 60 Hz. Les menus suspendent l'avancée ; une longue interruption n'est pas intégralement rattrapée. Les flux aléatoires de l'environnement, de la génétique et des prédateurs sont dérivés de la graine.

Le HUD est actualisé à environ 10 Hz, le panneau scientifique à 1 Hz. Au plus 600 mesures par monde ; chaque configuration est copiée, jamais référencée vers un objet mutable. Les compteurs cumulés continuent malgré la troncature de l'historique. Les quatre traces sont des instantanés indépendants. Les notifications et effets temporaires sont bornés ; les morts ne sont pas gardés comme objets historiques.

La diversité D est la moyenne des variances des quatre gènes normalisées par leurs étendues au carré. Population vide : D indisponible. Un export porte paramètres, graine, version et limites. Les comparaisons exigent même horizon et plusieurs graines ; les interventions ne sont pas rejouées automatiquement.

## Persistance et cycle de vie

Clé unique `evolution-arena.preferences.v1`. Schéma : `{version:1, stars:[[missionId,stars],...], display:{reducedMotion,highContrast,effects,quality}, preferences:{perception,predatorDebug}}`.

Les étoiles forment un préfixe de missions gagnées (1 à 5), avec entiers 1–3, sans trou ni doublon. Les types des préférences sont stricts ; seuls les champs connus sont recopiés. Une lecture de plus de 8192 caractères, un JSON invalide ou un schéma inconnu déclenche les valeurs par défaut. Le getter localStorage, les lectures et écritures peuvent échouer sans bloquer le jeu.

`mountApp` hydrate les composants avant leur présentation. `MissionProgress.onChange`, `AppShell.onSettings` et les deux cases diagnostiques déclenchent une écriture ; aucune écriture dans draw/step. Le reset de progression efface les étoiles et quitte la tentative en cours vers la sélection, sans toucher au Laboratoire. Les préférences ne restaurent ni ADN, ni RNG, ni graine, ni population, ni trace.

Les écouteurs sont libérés via AbortController ; `dispose()` coupe aussi le callback de progression. La fermeture du navigateur termine le monde courant. Aucun service distant ni télémétrie.

## Validation et maintenance

Tests Node : vrai Vehicle avec doublure de p5.Vector/DOM ; Chrome headless : vrai p5, ressources HTTP et Canvas. `tools/performance.mjs` mesure uniquement le moteur Node sur populations stables ; `tools/browser-smoke.mjs` produit captures, téléchargement et profilage CPU court. Les documents historiques ne sont pas réécrits pour masquer leurs limites initiales.

Conserver les algorithmes scientifiques lors d'une optimisation. Profiler avant de changer le code. Ne pas modifier vehicle.js sans accord explicite, ni importer les projets voisins. Les rapports finaux ne remplacent pas une évaluation humaine complète de la démonstration.
