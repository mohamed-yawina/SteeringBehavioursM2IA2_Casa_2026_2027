# Étape 2 — Moteur de simulation NeuroDrive AI

## Périmètre et référence au TP

Cette étape réalise uniquement la locomotion, la perception, une piste de test,
les checkpoints stricts, les collisions continues, la conduite clavier et une
interface pédagogique. Aucun réseau neuronal, algorithme génétique, fitness,
mission ou mécanisme de reproduction n’est inclus.

L’analyse `ANALYSE-TP9.md`, les consignes racine `AGENTS.md` et `ARCHITECTURE.md`
et les implémentations originales ont été relues avant le développement :

- TP 9 : `vehicle.js`, `ray.js`, `sketch.js` et les fichiers analysés à l’étape 1 ;
- TP 9b : `Car.js`, `Ray.js`, `Track.js` et la boucle de simulation analysée à l’étape 1.

Les TPs représentent les murs par des segments `a,b`, utilisent des `p5.Vector`
et construisent une vitesse désirée avant de soustraire la vitesse actuelle.
Leur raycasting résout les intersections par déterminants. NeuroDrive conserve
ces principes, mais traite les extrémités, les segments nuls et les cas
colinéaires. Les checkpoints utilisent un franchissement et non une proximité.

Le projet indépendant et sa physique en secondes demandés pour cette étape
remplacent le choix de réutilisation directe envisagé dans l’analyse : importer
le Vehicle original imposerait ses globals, son réseau, sa mortalité et sa mise
à jour sans `dt`. Un **nouveau socle `src/core/Vehicle.js`** assure la locomotion
du projet ; `Car` en hérite. Ce n’est ni une modification ni une copie du
`vehicle.js` fourni. La sélection d’une commande, le calcul de la force et
l’intégration restent séparés. Seule l’entité Car est un agent visible ; piste,
murs, checkpoints et rayons sont des données géométriques dessinées par la vue,
pas des classes autonomes d’entités animées.

## Architecture ES6

```text
index.html + styles.css       interface, copie locale de p5, entrée ES6
src/main.js                  liaison des commandes et boucle d’affichage
src/core/Vehicle.js          état, applyForce, intégration et arrêt sur contact
src/entities/Car.js          dimensions, braquage, capteurs ; étend Vehicle
src/controls/manualSteering.js  commande → vitesse désirée → force bornée
src/controls/KeyboardController.js  touches → commande normalisée
src/math/vector.js           accès p5.Vector, validation des entrées
src/math/geometry.js         rayons, distances, balayage et franchissements
src/sensors/SensorSystem.js  orientations, portée, distance minimale
src/track/Track.js           données de piste et fabrique de l’ovale
src/track/CheckpointManager.js  ordre des portes et tours
src/simulation/Simulation.js contrôle → intégration/contact → portes → capteurs
src/simulation/FixedStepClock.js pas fixe indépendant du rendu
src/view/Renderer.js         Canvas 2D, sans changement d’état de simulation
tools/serve.mjs              serveur HTTP local Node, sans dépendance
tests/*.test.js             tests Node natifs
tests/support/p5.mjs         chargement du vrai module p5.Vector sous Node
vendor/                     p5 existant copié, provenance et licence
```

Le moteur ne lit aucun fichier des autres TPs à l’exécution. Il ne dépend ni
de TensorFlow, ni d’un CDN. La seule bibliothèque réutilisée est la distribution
p5.js 1.7.0 déjà présente dans `1-Seek/libraries`, copiée sans modification.
Le module Vector réel est utilisé aussi par les tests ; un adaptateur charge
son module Browserify sans lancer le runtime DOM de p5.

## Physique de la voiture

Unités : pixels du monde, secondes, radians, masse unitaire. Le monde conserve
une taille logique de 1000 × 700, indépendamment de la taille du canvas.

État : `position`, `previousPosition`, `velocity`, `acceleration`, `orientation`,
`maxSpeed`, `maxAcceleration`, `maxForce`, `steeringAngle`, `active`, `crashed`
et `distanceTravelled`. Tous les vecteurs de mouvement sont des `p5.Vector`.

Valeurs initiales : vitesse maximale 220 px/s, accélération maximale 160 px/s²,
dimensions 26 × 14 px, empattement 24 px et braquage maximal 0,55 radian.

Le clavier produit accélérateur `u` et frein `b` dans [0,1], direction `s` dans
[-1,1]. Le frein est prioritaire sur l’accélérateur. À chaque pas `dt` :

```text
δ = s × angleMax
vitesseCible = clamp(vitesse + (u × accélérationMax − 0,3 × vitesse) × dt, 0, vitesseMax)
si frein : vitesseCible = max(0, vitesse − b × accélérationMax × dt)
capCible = orientation + vitesse / empattement × tan(δ) × dt
vitesseDésirée = direction(capCible) × vitesseCible
force = limit((vitesseDésirée − vitesseActuelle) / dt, maxForce)
applyForce(force)
vitesseSuivante = limit(vitesseActuelle + accélération × dt, vitesseMax)
positionCandidate = positionActuelle + vitesseSuivante × dt
```

La division par `dt` convertit l’écart de vitesse en accélération. L’intégrateur
est Euler semi-implicite. La force résultante cumulée est bornée, puis consommée
et remise à zéro. Le cap suit la vitesse lorsqu’elle est non nulle ; il reste
défini à l’arrêt. Il n’existe ni rotation gratuite sur place, ni vitesse négative.
La distance cumule uniquement le déplacement effectivement accepté.

La loi de braquage s’inspire du modèle bicyclette, mais l’accélération latérale
partage la même limite que l’accélération longitudinale : ce n’est pas une
simulation complète de pneus, d’adhérence ou de transmission. À vitesse élevée,
la voiture ne peut pas suivre un virage très serré : il faut freiner.

Le pas de simulation est fixe : **1/120 seconde**. L’affichage utilise
`requestAnimationFrame` avec un accumulateur. Le rattrapage est limité à 12 pas
par image (0,1 s) pour éviter une spirale de retard. Après un long blocage,
du temps réel peut donc être abandonné ; aucune téléportation de rattrapage.
Une perte de focus/visibilité met en pause et efface les commandes. Le `dt`
public doit rester dans ]0;0,1] ; une mise à jour de locomotion de durée nulle
est simplement inerte. Les nombres non finis sont rejetés explicitement.

## Raycasting

Sept capteurs couvrent −90°, −60°, −30°, 0°, 30°, 60°, 90° autour du cap, avec
une portée de 190 px. Une liste différente d’angles peut inclure d’autres
directions. Chaque lecture contient `distance`, `proximity`, `hit` et `end`.

Pour le rayon `O + tD` (D normalisé) et le segment `A + u(B−A)` :

```text
S = B − A ; Q = A − O ; den = cross(D,S)
t = cross(Q,S) / den
u = cross(Q,D) / den
intersection si t ≥ 0, 0 ≤ u ≤ 1 et t ≤ portée
```

Une tolérance numérique traite les directions presque parallèles avant toute
division. Si les primitives sont colinéaires, la projection des extrémités
détermine le premier contact devant l’origine ; un recouvrement de l’origine
donne zéro. Les segments nuls sont traités comme des points. Les extrémités et
la limite exacte de portée sont incluses. La distance minimale des murs est
renvoyée ; sans intersection, la distance vaut la portée et `hit=false`.
`proximity = 1 − distance/portée` reste dans [0,1]. Aucune entrée de futur réseau
n’est ajoutée dans cette étape. La case Capteurs contrôle uniquement le rendu.

## Circuit et checkpoints stricts

La piste de référence est un anneau elliptique fermé : limites intérieure et
extérieure de 96 sommets, 192 segments de mur et 12 checkpoints. La porte 0 est
la ligne d’arrivée. Chaque porte possède deux extrémités et une normale unitaire
orientée dans le bon sens. Les flèches indiquent ce sens. La zone de départ est
placée juste après la porte 0, côté droit du circuit, orientée vers le bas.

`Track` permet de fournir d’autres polygones, portes et départs ;
`trackFactories` constitue le registre d’extension. Ajouter une piste doit
respecter le contrat : départ immédiatement après la porte zéro et portes
ordonnées 1..N−1 puis 0. Les segments et normales dégénérés sont rejetés.
Le redimensionnement du canvas transforme seulement l’affichage, sans reconstruire
la géométrie ni altérer la progression.

Le manager débute avec `nextIndex=1` et zéro tour. Sur un déplacement P→Q :

1. Calculer les distances signées à chaque porte avec sa normale.
2. Exiger un passage du côté strictement négatif vers le côté positif ou la
   ligne, avec une tolérance arithmétique de 1e-9 et sans zone de proximité.
3. Calculer le point d’intersection et vérifier qu’il appartient au segment fini.
4. Trier les événements par leur fraction de déplacement et exiger l’ordre
   attendu. Un événement hors ordre bloque les validations suivantes de ce pas.
5. Avancer l’indice seulement après validation ; la porte zéro n’ajoute un tour
   qu’après les portes 1..N−1. Repartir à la porte 1 pour le tour suivant.

Arriver exactement sur la ligne valide ; partir de cette ligne ne revalide pas.
Un mouvement inverse ou une oscillation autour d’une porte déjà validée n’apporte
aucun crédit. Plusieurs portes peuvent être validées dans un même pas uniquement
si elles sont réellement traversées dans l’ordre et à des instants distincts.
La proximité et les extensions infinies des portes ne comptent pas.

## Collisions continues

La carrosserie rectangulaire est englobée par un disque de rayon
`hypot(longueur, largeur)/2` (environ 14,8 px). Pour chaque segment, le déplacement
du centre est testé contre la capsule du mur : bande à distance rayon autour du
segment et cercles aux deux extrémités. Les intersections avec la bande se
calculent par projection ; celles avec les cercles par une équation quadratique.
La plus petite fraction de contact entre tous les murs est retenue.

Le véhicule est arrêté légèrement avant ce premier contact, marqué accidenté et
désactivé ; vitesse et accélération deviennent nulles. Le disque englobant reste
valable quelle que soit l’orientation : pas de traversée entre deux positions,
même à grande vitesse, et pas de dépendance aux angles des capteurs.

Le manager ne reçoit que le déplacement accepté avant contact. Une porte située
avant l’impact peut compter ; une porte à l’impact ou au-delà ne compte pas.
Le système ne crédite jamais le déplacement candidat situé derrière un mur.
Un chevauchement au départ provoque une collision immédiate. Aucun rebond ou
glissement n’est simulé.

## Tests et vérification

Depuis le dossier NeuroDriveAI, sans installation :

```powershell
npm test
# équivalent exact :
node --import ./tests/support/p5.mjs --test
```

Les tests utilisent `node:test` et `node:assert/strict`. Les scénarios sont
déterministes ; le test exploratoire des rayons utilise un générateur à seed fixe.

Couverture : mouvement, cap et rotation à l’arrêt, freinage, vitesse et forces
bornées, composition de forces, invalidité des entrées, pas fixe à 30/60/144 FPS,
limite de rattrapage, intersections, portée, parallélisme, colinéarité, extrémités,
segments nuls, collisions balayées et tangentes, premier contact, bon/mauvais
sens, portes hors ordre, répétitions, multiples franchissements réels, deux tours
complets, pause, reset, clavier et intégration de l’entrée de l’application.

Deux tests de durée exécutent chacun **20 000 pas** : conduite libre restant
active, puis simulation complète avec murs/capteurs/collisions et réinitialisation
après chaque accident. Ils ne se contentent pas de laisser une voiture inactive
pendant la boucle. Les composantes, angles, distances et mesures restent finis.

Le test de l’interface utilise un contrat DOM/Canvas simulé pour exercer les
vrais événements et la boucle d’entrée ; il ne vérifie pas les pixels ou la mise
en page. L’outil Browser de cette session ne dispose d’aucun navigateur connecté.
Une vérification visuelle automatisée ne doit donc pas être considérée acquise.
Les résultats finaux et le contrôle HTTP sont consignés en fin de document.

## Lancement et validation navigateur

```powershell
cd 'C:\Users\Simo\Desktop\SteeringBehavioursM2IA2_Casa_2026_2027\NeuroDriveAI'
npm start
```

Ouvrir `http://127.0.0.1:8000`. Le serveur écoute uniquement sur la boucle locale.
Ctrl+C l’arrête. Pour changer le port : `$env:PORT = '8001'` puis `npm start`.
Ne pas ouvrir l’HTML en `file://` : l’application utilise des modules ES6.

Après réussite des tests automatisés, validation visuelle complémentaire :

1. Vérifier le circuit, la zone de départ à droite, la voiture verte, les rayons
   jaunes et le HUD. La prochaine porte doit être 1, le compteur de tours zéro.
2. Accélérer avec ↑/Z/W, freiner avec ↓/S et tourner avec ←→/Q-D/A-D. À l’arrêt,
   braquer seul ne doit pas déplacer la voiture. Freiner avant les virages.
3. Cliquer Pause : le véhicule et sa progression doivent rester figés, tandis
   que le rendu et les FPS continuent. Reprendre puis réaccélérer : les touches
   ont été effacées au changement d’état pour éviter une commande bloquée.
4. Masquer puis afficher les capteurs : seule leur visualisation change.
5. Traverser les portes dans le sens des flèches : seul l’indice attendu avance.
   Passer à proximité, en sens inverse ou sur une porte hors ordre ne doit pas
   valider. Le tour augmente après 1..11 puis l’arrivée 0, jamais au départ.
6. Percuter un bord : état accidenté, immobilisation. Réinitialiser : départ,
   vitesse, distance, progression et tours remis à zéro.
7. Redimensionner la fenêtre : le monde et sa progression restent identiques.
   Changer d’onglet ou perdre le focus : pause automatique, reprise explicite.
8. Vérifier dans la console l’absence d’erreur de chargement ou d’exécution ;
   l’application ne doit demander aucune ressource réseau externe.

## Limites connues

- Une seule piste de référence et une seule voiture. Ajouter une piste demande
  encore une définition en code ; pas d’éditeur ou de sélection UI.
- Le disque englobant peut déclarer un accident avant le contact visuel du
  rectangle. Cette marge est volontairement conservatrice.
- Modèle de steering cinématique simplifié, sans marche arrière, pneus, moteur,
  dérapage ou réponse réaliste de pédales. Il reste exploitable pour des commandes
  autonomes ultérieures sans intégrer ces commandes à cette étape.
- Le validateur de piste contrôle les données de base, pas la simplicité des
  polygones, leur inclusion, les auto-intersections ou tous les départs possibles.
  Les futures pistes doivent être géométriquement vérifiées et respecter le
  contrat du départ. Le moteur ne corrige pas des téléportations externes.
- Tolérances adaptées à des coordonnées de l’ordre de milliers de pixels ; pas
  de garantie pour des valeurs finies extrêmes proches du débordement IEEE-754.
- Coût linéaire en nombre de murs pour chaque rayon et chaque balayage. Aucun
  index spatial ni profilage multi-voitures dans cette étape.
- Rattrapage limité ; sous forte charge la simulation peut avancer moins vite
  que le temps réel. Les FPS sont ceux de l’affichage, pas ceux de la physique.
- Le bundle p5 complet est conservé pour réutiliser une dépendance disponible,
  bien que seul Vector soit nécessaire. Le chargeur Node des tests est lié à
  cette version. Les tests de contrat UI ne remplacent pas un contrôle visuel.

## Arrêt de l’étape

Les fichiers des TPs 9, 9b, EvolutionArena et des autres projets restent intacts.
L’analyse de l’étape 1 est conservée. Aucun commit, push, déploiement ou ajout de
dépendance installée. Le développement s’arrête ici jusqu’à validation utilisateur.

## Résultats de cette livraison

- `npm test` exécuté avec Node.js 24.18.0 : **35 tests, 35 réussis, 0 échec**.
- Les deux scénarios de 20 000 pas et le test d’intégration DOM/Canvas sont inclus
  dans ce total ; aucune comparaison visuelle en navigateur n’est revendiquée.
- Serveur lancé par `node tools/serve.mjs` : **16 ressources HTTP locales**
  vérifiées, contenu identique aux fichiers et MIME JavaScript correct ;
  erreurs 404 et méthode non autorisée 405 également vérifiées.
- 28 fichiers nouveaux : fichiers racine (`index.html`, `styles.css`,
  `package.json`, `README.md`), 13 modules `src/`, 5 suites `tests/*.test.js`,
  le support `tests/support/p5.mjs`, `tools/serve.mjs`, les 3 fichiers `vendor/`
  et le présent document. `docs/ANALYSE-TP9.md` reste inchangé.
- Aucun fichier préexistant modifié. La bibliothèque copiée est identique à sa
  source locale ; la licence LGPL 2.1 est fournie sans modification depuis la
  copie standard présente avec Git (`xz/COPYING.LGPLv2.1`).
