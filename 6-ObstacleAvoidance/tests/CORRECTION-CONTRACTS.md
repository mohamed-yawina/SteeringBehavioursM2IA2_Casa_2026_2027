# Phase 3 — Laboratoire et poids configurables

Le laboratoire ajoute contrôleur, renderer, UI et huit scénarios. Les références
immuables restent intactes (SHA-256 testés). Les méthodes physiques protégées de
phase 2 restent identiques ; les champs d'horizons, de poids et d'état Avoid sont
initialisés dans Vehicle. applyBehaviors est le seul calcul physique modifié dans
cette correction ciblée ; les méthodes protégées sont toujours comparées aux snapshots.

Suite avant cette correction ciblée : 50 historiques + 29 corrections + 18 laboratoire
= 97 réussis. La suite actuelle ajoute 8 tests de poids/UI, soit 105 réussis.

Les paramètres validés du contrôleur sont copiés dans chaque véhicule. Les quatre
poids configurés par défaut sont 0,2 / 3 / 0,2 / 3. applyBehaviors lit des copies
validées, calcule les forces brutes et pondérées, conserve l'ordre de composition,
plafonne toujours la somme à maxForce et appelle applyForce une seule fois.
Quand Avoid est coupé, son poids effectif est zéro ; son poids configuré et la
décision géométrique restent consultables. Les diagnostics distinguent ces deux
valeurs et l'état du commutateur. Les paramètres négatifs ou non finis sont refusés.

Les méthodes Seek, Arrive, Avoid, Separate, Boundaries, applyForce, update et edges
restent protégées et inchangées. Seuls applyBehaviors et les champs minimaux du
constructeur ont été étendus pour le raccordement demandé.

Aucun navigateur n'a été exécuté pour cette interface. Les validations Chrome
antérieures sont celles de phase 2 uniquement.

---

# Phase 2 — Corrections ciblées réalisées

Cette section décrit le code actuel. Le document de phase 1 conservé plus bas
reste une référence historique ; son tableau de propositions n'est pas une liste
de corrections toutes encore en attente.

## Suites séparées

- reference.test.mjs : **50 tests historiques**, chargement par défaut des sources
  figées de historical-sources.json ; leurs empreintes SHA-256 sont contrôlées.
- corrections.test.mjs : **29 tests du code actuel**, chargement explicite avec
  load(2027, {historical:false}).
- Total : **79 réussis, 0 échec, 0 ignoré**.
- reference-trajectories.json reste intact ; corrected-trajectories.json conserve
  séparément les attentes du code corrigé. Aucune suite ne régénère ses attentes.
- Le snapshot historique est uniquement une donnée de test, jamais un autre moteur
  Vehicle ni un script chargé par index.html. Son rôle est de conserver les preuves
  des défauts corrigés sans imposer ceux-ci à l'application actuelle.

## Contrats actuels

Separate utilise maxSpeed, vel et maxForce ; les voisins invalides, superposés ou
hors perception sont ignorés. Les paramètres invalides donnent une force nulle.
Boundaries garde sa géométrie et sa priorité verticale aux coins, mais retourne
désormais le steering calculé, limité à maxForce.

applyBehaviors conserve les poids 0,2 / 3 / 0,2 / 3, copie les contributions, plafonne
le total et effectue une seule application avant l'unique intégration. Les diagnostics
séparent raw, weighted, unclamped et total ; leurs accesseurs copient récursivement.
Un état physique non fini n'est ni intégré ni dessiné par sketch ; update reste intacte.

Avoid garde X/Q15/Q30, proximité du centre, départages et seuil strict. Sa direction
reste Q-C et sa norme maxForce/2. **L'écart à desiredVelocity-currentVelocity est
volontairement NON corrigé**, conformément à l'autorisation de cette phase.
Les détections avec force nulle et les trous entre échantillons restent possibles.

La recherche utilise Infinity ; les obstacles sans position finie ou rayon fini
non négatif sont ignorés. Une liste vide n'entraîne plus d'exception.
Les anciennes sentinelles et la branche distance4, qui ne produisait pas de séparation
effective aux paramètres historiques, ne servent plus dans Avoid.
Un calcul numérique débordant peut être déclaré invalide ou inexploitable ;
il ne faut pas confondre ces protections avec une réparation générale de l'intégrateur.

Le calcul actif Avoid/Boundaries ne dessine plus. Le debug existant est consommé
dans show à partir des décisions mémorisées. La flèche jaune d'évitement représente
la force brute réellement retournée, avec une échelle visuelle ×100, depuis la
position du pas avant intégration. Le trait épais reste un repère historique,
pas une preuve de détection continue. Aucun panneau pédagogique n'est ajouté ici.
Les méthodes auxiliaires non actives, notamment avoidCorrige, sont conservées.

## Correction ciblée Flee / Pursue / Evade

Flee, Pursue et Evade ne sont pas appelés par les huit scénarios actifs. Leur
correction n'altère donc pas les trajectoires de référence actives.

- Flee construit la direction `position - cible`, la vitesse désirée à `maxSpeed`,
  puis calcule `limit(desiredVelocity - velocity, maxForce)`. Il n'inverse plus
  la force Seek, car cette inversion inversait aussi la compensation de vitesse.
- Evade conserve la prédiction `cible.position + cible.velocity × 10`, puis calcule
  le steering opposé à cette position future. Il n'inverse plus le résultat de
  Pursue.
- Direction opposée nulle : vitesse désirée nulle, donc freinage `-velocity`
  plafonné à `maxForce`. Ce choix suit le calcul existant de Seek pour un vecteur
  cible nul ; il est couvert comme contrat explicite de ces méthodes.
- maxSpeed/maxForce nuls conservent leurs effets physiques ; état, cible ou
  prédiction non finis produisent une force finie nulle. Les vecteurs d'entrée ne
  sont pas mutés.
- Pursue conserve son anticipation à dix pas et son calcul Seek, mais n'appelle
  plus `fill()` ni `circle()`. Le calcul ne produit aucun rendu. Le marqueur vert
  historique n'est pas redessiné ailleurs.

Les tests directs de ces auxiliaires sont distincts des tests historiques figés.
Un test des huit scénarios remplace Flee/Pursue/Evade par des sentinelles qui
échouent si un scénario actif les appelle. Les références historiques et corrigées
de l'évitement ne sont pas modifiées.

Obstacle hérite de Vehicle, garde son rayon et son rendu, sans force ni intégration.
Target est extrait dans target.js et représente réellement le curseur rouge de
diamètre 32. La classe auparavant dormante à vitesse aléatoire de norme 5 devient
une cible statique contrôlée par souris : cette adaptation est intentionnelle.
Les coordonnées souris non finies sont ignorées, sans déplacer la cible.

Le constructeur générique de Vehicle, Seek, applyForce, update et edges restent
strictement identiques à la référence figée. L'ordre HTML est maintenant :
p5, p5.sound, Vehicle, Obstacle, Target, sketch.

## Trajectoires

À tolérance absolue 1e-12 :
- Arrive seul, Avoid seul et leur combinaison isolée restent identiques.
  Le scénario isolé Arrive+Avoid additionne explicitement les forces de l'expérience ;
  il n'est pas présenté comme la nouvelle composition plafonnée applyBehaviors.
- La référence Boundaries axiale reste aussi identique sur cinq pas : ancienne
  et nouvelle formule saturent dans la même direction. Une trajectoire oblique
  distincte démontre le changement attendu de la correction.
- Separate et la composition complète changent volontairement.
- Les nouvelles références sont vérifiées avec un oracle d'addition, de plafonnement
  et d'intégration, en plus des formules de force testées indépendamment.

## Limites et validation manuelle restante

Pas de pause, reset, slider, scénario ou interface de laboratoire dans cette phase.
Pas de garantie d'absence de collisions, ni de choix explicite gauche/droite.
Le rebouclage edges n'est toujours pas activé. Les commentaires historiques
inexacts sur la touche f et certains TODO restent à traiter lors de la documentation.
style.css, jsconfig.json et les bibliothèques sont inchangés ; la référence absolue
d'éditeur de jsconfig reste donc présente.

Chrome n'a pas été exécuté dans cette phase. Vérifier manuellement : cible souris
rouge, clic et rayons d'obstacles, touches v/d/f, debug après intégration, traînées,
évitement et séparation multivéhicule, passage près des quatre bords.
Attendre cette validation avant toute phase de laboratoire ou commit.

---

﻿# TD6 — Références historiques et futurs contrats de correction

## Périmètre et exécution

Phase 1 uniquement : aucun code applicatif n'est modifié.
Depuis la racine :

```powershell
node --test 6-ObstacleAvoidance/tests/*.test.mjs
```

Résultat de cette phase : **50 tests réussis, 0 échec, 0 ignoré** (Node 24).
Aucune validation Chrome. Les fonctions graphiques sont simulées ; le véritable
module p5.Vector de libraries/p5.min.js (p5 1.7.0) est exécuté en mémoire.

Le harness n'est pas une copie de Vehicle ni du détecteur. Il charge obstacle.js,
vehicle.js et sketch.js. Il extrait le module Vector du bundle Browserify local ;
les dépendances polyfill core-js sont satisfaites par les primitives natives de Node,
et le noyau graphique p5 est remplacé par le minimum nécessaire à Vector.
Un changement de format du bundle devra faire réexaminer cette extraction.
Aucune bibliothèque ni dépendance externe n'est ajoutée.

RNG injecté : LCG uint32, état initial 2027, multiplicateur 1664525,
incrément 1013904223, division par 2^32. Le contexte random() et Math.random()
du VM sont contrôlés, sans changer Math.random du processus hôte.
Ce générateur n'est pas présenté comme celui de p5 dans le navigateur.

## Références JSON figées

reference-trajectories.json est capturé une fois sur l'application historique.
Les tests lisent ce JSON ; aucun générateur automatique ou mode mise à jour
n'est inclus dans la suite. Ne jamais le réécrire pour faire passer une correction.

Tolérance absolue : **1e-12**, pour chaque nombre, chaque pas et chaque agent.
Les structures, nombres d'applications, indices et booléens sont comparés exactement.

Six scénarios, cinq pas :
- A arrive : véhicule (100,100), vitesse (1,0), cible (300,100), force non pondérée.
- B avoid : même véhicule, obstacles (130,105,r=10) et (350,250,r=30), poids 1.
- C arrive-avoid : mêmes conditions, poids historiques 0,2 et 3.
- D separate : trois véhicules mis à jour séquentiellement à chaque pas :
  (100,100)/(1,0), (110,104)/(0,5;0), (95,110)/(0;0,5).
  Chaque véhicule voit les trois, poids 1 ; aucune correction des noms erronés.
- E boundaries : départ (10,100), vitesse (1,0), rectangle (0,0,1200,800), marge 25, poids 1.
- F full : départ (100,100)/(1,0), voisin FIXE (110,104)/(1,0), cible (300,100),
  obstacles de B, véritable applyBehaviors avec poids 0,2 / 3 / 0,2 / 3.

Tous gardent maxSpeed=4, maxForce=0,2, r=48, marge de détection 24.
Le voisin fixe du scénario F est un choix d'expérience contrôlée, pas une
affirmation sur la boucle multivéhicule de l'application, qui est testée séparément.

Chaque agent/pas contient :
- position, vitesse et accélération avant calcul ;
- forces individuelles et forces pondérées ;
- résultante, égale à l'accélération juste avant update (accélération initiale nulle) ;
- nombre d'applications ;
- position, vitesse et accélération après update ;
- pour Avoid : X, Q15, Q30, indice et centre de l'obstacle sélectionné,
  entrée dans la branche de détection et point échantillonné retenu si observable.

L'observation enveloppe les vraies méthodes et utilise leur dessin debug :
elle ne recalcule ni le classement ni le détecteur. Sans entrée dans la branche
de détection, selectedSample est null : cela signifie « non observé », pas que
le code n'a calculé aucun minimum interne. detection est null pour les scénarios
qui ne calculent pas Avoid. Le debug est vérifié sans effet physique ni aléatoire.
La cohérence des trajectoires est aussi contrôlée avec un oracle d'addition et
d'intégration vectorielle, sans recopier les comportements.

## Caractéristiques historiques à préserver

- Q30 = X + 30 V ; Q15 = X + 15 V, sans normalisation préalable.
- Trois échantillons : Q30, Q15 et X.
- Obstacle choisi par distance du CENTRE à X, indépendamment de son rayon.
- Égalités : premier obstacle dans le tableau ; Q30 avant Q15 avant X.
- Détection stricte distance < rayon obstacle + largeurZoneEvitementDevantVaisseau.
- La marge actuelle est r/2 = 24 ; elle n'est pas une seconde addition de r.
- Les rayons nuls sont possibles ; une détection subsiste grâce à la marge.
- Un obstacle proche derrière peut déclencher une répulsion.
- Un petit obstacle entre les points peut être manqué.
- Un centre proche non menaçant peut masquer une menace plus éloignée.
- Les choix symétriques dépendent de l'ordre du tableau.
- La boucle intègre une fois par véhicule, dans l'ordre existant.
- edges() n'est pas appelée ; ne pas activer implicitement un rebouclage.

Une détection continue ou une sélection de la menace la plus dangereuse serait
une autre expérience pédagogique, jamais une substitution implicite.

## Contrats corrigés recommandés — NON implémentés et NON autorisés ici

| Méthode / fichier | Historique | Contrat recommandé | Tests futurs / trajectoires |
|---|---|---|---|
| vehicle.js separate() | maxspeed, velocity et maxforce inexistants ; avertissement p5, norme 1 possible, même maxForce=0 | utiliser maxSpeed, vel, maxForce ; vitesse désirée moins vitesse, plafond individuel ; conserver voisinage et moyenne | voisins proches/lointains/superposés, limites nulles, aucune mutation ; D et F changeront intentionnellement |
| vehicle.js boundaries() | force calculée puis ignorée ; desired limitée et retournée | limiter et retourner force ; préserver le rectangle, marge et priorité historique verticale au coin | direction déjà désirée => force nulle, freinage/opposition, seuil et coins ; E et F peuvent changer |
| vehicle.js applyBehaviors() | 4 applications, somme non bornée ; dépendance globale vehicules | copier les contributions, pondérer 0,2/3/0,2/3, limiter le total à maxForce puis appliquer une fois ; envisager voisins explicites sans casser appels | contributions convergentes/opposées/nulles, zéro budget, diagnostic avant/après plafond, une intégration ; C/F si plafonnés changent |
| vehicle.js avoid() | liste vide ou sélection absente => exception | aucun obstacle exploitable => force nulle et diagnostic explicite, sans exception | listes vides, objets incomplets, absence de menace, aucune force non finie |
| vehicle.js getObstacleLePlusProche() | sentinelle 100000000 ; égalités conservées | Infinity, candidats de géométrie valide et distances finies ; ordre stable conservé | centres éloignés, égalités, liste vide ; seuls cas auparavant exclus doivent changer |
| avoid()/sélection, contrôles | pas de validation ; NaN parfois masqué par p5, Infinity peut conduire à exception ou état physique infini | vérifier coordonnées brutes, rayon fini >=0, vitesse/limites finies et >=0 ; diagnostic des rejets ; politique explicite d'ignorance des obstacles invalides | NaN, ±Infinity, rayon invalide, paramètres zéro, état agent invalide ; ne pas prétendre qu'une force nulle répare une vitesse infinie : le contrôleur doit interdire l'intégration d'un état invalide |
| vehicle.js avoid(), formule | direction Q-C mise à maxForce/2 ; pas de soustraction de vitesse | décision utilisateur nécessaire : construction desiredVelocity=normalize(Q-C)*maxSpeed puis soustraction vel, avec budget explicite (par exemple maxForce/2 conservé) ; géométrie historique inchangée | force et direction, vitesse nulle, axe, coordonnées identiques, bornes ; B/C/F changeraient intentionnellement |
| avoid(), Q=C | détection vraie mais vecteur nul | décider explicitement du freinage si vitesse non nulle ; à vitesse nulle et centre identique, aucune direction unique n'existe ; ne pas inventer un côté aléatoire | préserver la distinction « détecté » / « force nulle » ; une politique d'échappement requiert un contrat distinct |
| obstacle.js / index.html | Obstacle visible indépendant de Vehicle | extends Vehicle, super(x,y), vitesse/accélération nulles, limites nulles ; jamais update/applyForce/steering sur obstacle ; Vehicle chargé avant Obstacle | instanceof, géométrie/rendu préservés, immobilité sur plusieurs pas ; agents valides inchangés |
| vehicle.js Target / futur target.js | Target dormant dans vehicle.js, vitesse aléatoire de norme 5 ; curseur dessiné directement par sketch | extraire la classe dans un fichier dédié ; décider séparément de sa réutilisation en cible de souris statique contrôlée par interaction, en préservant la fonctionnalité | héritage, scripts, position souris, pas de mouvement autonome du curseur ; ne pas transformer silencieusement le constructeur historique |
| avoid(), boundaries(), autres dessins de comportements | dessin pendant le calcul, force debug brute avant normalisation ; zone dessinée continue | mémoriser les données réellement employées ; renderer séparé, aucun recalcul, RNG ni intégration | rendu activé/désactivé => mêmes états ; origine avant intégration ; trois points visibles plutôt qu'une garantie de collision continue |
| diagnostics Vehicle | aucun snapshot réutilisable | copies défensives imbriquées : X/Q15/Q30, obstacle retenu, distances, échantillon, seuil, détection, forces individuelle/pondérée/totale | mutation d'une copie sans effet, pause/reset/scénario, aucun appel de steering au rendu ; géométrie et ordre inchangés |

## Défauts et assertions de caractérisation

Les tests « défaut à corriger » sont des témoins avant correction, PAS des exigences
permanentes. Lorsqu'une correction est autorisée, remplacer explicitement leurs
attentes et conserver leur couverture, avec justification :
- exceptions => statut sans force ;
- Separate non borné => formule et plafond corrects ;
- Boundaries desired => force de steering ;
- somme non bornée => résultante limitée ;
- compte de quatre applications => une application du total, toujours une intégration.
Ne pas élargir 1e-12 ni supprimer les comparaisons numériques pour cacher ces écarts.

Pour les scénarios dont le contrat change, conserver l'ancien JSON comme référence
historique et placer les nouvelles attentes dans un fichier distinct, avec contrôle
indépendant des contributions et des limites.
Les scénarios isolés non concernés doivent rester identiques à 1e-12.

## Risques et limites du harness

- Vecteurs réels mais contexte graphique simulé : aucune validation du rendu Chrome.
- RNG injecté reproductible mais différent de celui du navigateur.
- NaN peut être masqué par certaines opérations de p5 : les tests assignent les
  coordonnées invalides après construction pour ne pas confondre avec l'assainissement
  implicite du constructeur Vector.
- La collecte debug doit être remplacée par de vrais diagnostics après séparation
  calcul/rendu. Elle repose sur les appels du code actuel et sera volontairement
  à adapter ; elle ne doit pas inciter à conserver les dessins dans les comportements.
- Corriger Separate et Boundaries change des directions et des accélérations,
  même avant le plafonnement global ; isoler ces changements par lots.
- La branche distance4 conserve une sentinelle de 1000000 et une logique de voisin
  partiellement commentée. Elle n'est pas un mécanisme effectif de séparation aux
  paramètres historiques ; sa suppression ou réactivation doit être explicitée.
- L'absence d'oscillation ou de collision sur cinq pas n'est pas une garantie générale.
- Les noms de touches, les rayons, les états des obstacles et l'ordre de mise à jour
  doivent rester couverts ; aucune physique temporelle nouvelle n'est proposée ici.

Toute modification de vehicle.js nécessite une autorisation explicite ultérieure.
Cette phase ne modifie ni ce fichier, ni les scripts, ni les bibliothèques.

## Contrat final de Avoid

La correction ultérieure conserve strictement la détection ci-dessus : `X`,
`Q15 = X + 15V`, `Q30 = X + 30V`, classement par distance du centre à X, ordre
des obstacles et départages, choix Q30/Q15/X, puis seuil strict rayon + marge.
Elle remplace uniquement la force calculée après une détection :

```text
direction = selectedSample - obstacleCenter
desiredVelocity = normalize(direction) * maxSpeed
steering = limit(desiredVelocity - velocity, maxForce / 2)
```

`maxForce / 2` est le budget individuel explicite ; la somme pondérée reste
plafonnée par `applyBehaviors()` à `maxForce`. Si la direction est nulle,
`desiredVelocity` vaut zéro : le véhicule freine dans le budget individuel, ou
retourne zéro s'il est déjà immobile. La détection reste vraie et le diagnostic
géométrique conserve `reason: coincident-sample`.

`reference-trajectories.json`, `historical-sources.json` et
`corrected-trajectories.json` restent des références immuables : elles documentent
respectivement l'application historique et la correction de phase 2. Les attentes
post-steering sont distinctes dans `corrected-avoid-trajectories.json` pour Avoid
seul, Arrive + Avoid avec le plafond global, et la composition complète à deux agents.
Les tests historiques continuent d'exécuter les sources figées ; les tests du code
courant comparent la géométrie à l'historique, mais vérifient séparément la nouvelle
force et les trajectoires corrigées. Aucun test ne régénère les références.
