# TD1 · Steering Behaviors — Master IA2

Deux applications autonomes présentent les comportements de pilotage **Seek** et **Flee** du TD1 d’IA réactive de Michel Buffa : une expérience ludique, **Swarm Attack**, et un laboratoire d’observation, **Steering Lab**. Le modèle pédagogique s’appuie sur l’article de Craig W. Reynolds, *Steering Behaviors for Autonomous Characters* (GDC 1999).

## Objectifs du TD

- Transformer une direction souhaitée en force de pilotage réactive.
- Distinguer objectif, calcul du steering et locomotion.
- Observer l’effet de la vitesse maximale et de la force maximale.
- Comparer Seek, qui se dirige vers une cible, à Flee, qui s’en éloigne.

Le principe central du cours est :

```text
desiredVelocity = direction × maxSpeed
steering = desiredVelocity − currentVelocity
steering.limit(maxForce)
```

Pour Seek, `direction = normalize(target − position)`. Pour Flee, `direction = normalize(position − target)`. Flee inverse donc la vitesse souhaitée avant de soustraire la vitesse actuelle; inverser après coup la force Seek ne donne pas la même réponse quand le véhicule est déjà en mouvement. Si la distance est nulle, la vitesse souhaitée vaut zéro et le steering freine la vitesse résiduelle. `Vehicle.update()` ajoute l’accélération, limite la vitesse à `maxSpeed`, met à jour la position puis remet l’accélération à zéro.

## Applications

### Swarm Attack

Une expérience arcade développée dans le dossier du TD. Elle conserve le jeu et ses systèmes : vagues d’ennemis, poursuite du joueur, boss, projectiles, obstacles, power-ups, progression et améliorations, score et audio. Cette version permet d’observer les comportements de poursuite dans une scène ludique.

### Steering Lab

Un outil pédagogique séparé pour inspecter Seek et Flee. Il propose une cible souris ou autonome, une population de 1 à 100 véhicules, des sliders `maxSpeed` et `maxForce`, un rayon de perception pour Flee, Pause/Reprendre/Reset, des trajectoires, des vecteurs et des scénarios prédéfinis. À l’arrivée, l’agent réapparaît; lors d’une arrivée sur la cible autonome, celle-ci se repositionne au plus une fois par image.

Les vecteurs sont échantillonnés ensemble avant l’intégration : vitesse courante, vitesse souhaitée, force steering, position d’origine et cible associée. Les flèches partagent une échelle visuelle de 12 pixels par unité. Les couleurs sont indiquées par la légende dans l’application. Le clic sur un agent le sélectionne pour l’inspection.

## Architecture

```text
1-Seek/
├── index.html              Accueil du TD1
├── home.css                Identité visuelle et navigation
├── swarm-attack.html       Page de Swarm Attack
├── steering-lab.html       Page de Steering Lab
├── vehicle.js              Vehicle partagé (version locale du projet)
├── target.js               Cibles ennemies de Swarm Attack
├── lab-vehicle.js          Agent scientifique, sous-classe de Vehicle
├── lab-target.js           LabTarget autonome, sous-classe de Vehicle
├── lab-controller.js       Population, scénarios, contrôles et affichage des vecteurs
├── lab-sketch.js           Boucle p5.js de Steering Lab
├── population.js           Gestion de population de la démonstration Seek historique
└── tests/                  Tests historiques adaptés et tests de Steering Lab
```

Les deux pages sont des documents distincts : chacune charge ses scripts applicatifs et n’exécute pas le code de l’autre. Elles réutilisent `vehicle.js`, sans le modifier dans cette livraison. Les classes du laboratoire fixent leurs paramètres après `super(x, y)` afin de ne pas dépendre de la signature étendue par options dans la version locale de `Vehicle`. `LabTarget` redéfinit son rendu et sa mise à jour autonome tout en déléguant l’intégration à `Vehicle.update()`.

## Lancement

Les deux applications chargent p5.js et, pour Swarm Attack, p5.sound depuis les bibliothèques locales fournies dans `libraries/`.

- Ouvrir `1-Seek/index.html` pour la page d’accueil.
- Choisir **Swarm Attack** ou **Steering Lab**.
- Les liens Accueil permettent de revenir à la page de sélection.

Un serveur HTTP local est également possible, depuis la racine du dépôt :

```sh
python -m http.server 8000
```

Puis ouvrir `http://localhost:8000/1-Seek/`. Aucun framework ni paquet Node n’est nécessaire pour lancer les applications.

## Contrôles de Steering Lab

- **Comportement** : Seek ou Flee.
- **Cible** : souris ou cible autonome.
- **Nombre de véhicules** : met à jour immédiatement la population via `creerVehicules(nb)`.
- **Vitesse maximale / force maximale** : valeurs appliquées à chaque pas de simulation.
- **Rayon de détection Flee** : au-delà de ce rayon, aucun steering de fuite n’est produit.
- **Trajectoires / vecteurs détaillés** : affiche ou masque les mesures. Cliquez un agent pour le sélectionner.
- **Pause / Reprendre / Reset** : contrôle de la simulation.
- Les scénarios proposent Seek collectif, Flee, cible mobile et force faible.

## Tests

Depuis le dossier `1-Seek`, avec Node.js 18 ou supérieur :

```sh
node --test tests/*.test.mjs
```

La suite inclut les tests de population et rebouclage historiques, ainsi que ceux du laboratoire : limites des forces, Seek/Flee, arrivée/réapparition, cible autonome, vecteurs cohérents, sliders, scénarios et contrôles. L’adaptateur historique fournit les fonctions p5 attendues par la version locale de `Vehicle`; les tests vérifient les fonctions de steering et de locomotion existantes sans injecter `applyBehaviors()` ou `edges()` dans la classe de base.

Dernière exécution pendant la finalisation : **21 tests réussis, 0 échec** avec `node --test tests/*.test.mjs`.

## Améliorations personnelles

Swarm Attack est l’application ludique ajoutée au projet. Steering Lab la complète avec une visualisation des valeurs calculées, des scénarios, une cible mobile et des contrôles de simulation. Cette section décrit les fonctionnalités du dépôt; elle ne prétend pas décrire l’expérience personnelle de l’étudiant.

## Limites connues

- Les interactions ont été testées avec Node et un DOM simulé; le rendu final dans un navigateur n’a pas été vérifié dans cette session.
- Il reste à vérifier manuellement la console, l’audio, le comportement tactile, le redimensionnement et le rendu des deux pages sur plusieurs tailles d’écran.
- Le mouvement est intégré par frame, comme dans le modèle de cours; il n’est pas normalisé par le temps écoulé.

## MON EXPÉRIENCE

_À compléter personnellement par l’étudiant : observations, résultats, choix de paramètres et difficultés rencontrées._
