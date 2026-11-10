# Analyse du TP 9 — NeuroDriveAI

Date : 25 octobre 2026. Périmètre : lecture intégrale des deux exemples locaux, sans modification de leur code.

## 1. Objet et méthode

Comprendre le TP avant de concevoir une amélioration indépendante. Cette analyse décrit le comportement réellement implémenté : certains commentaires annoncent autre chose que les instructions exécutées.

Sources principales : tous les fichiers des dossiers `9-VoitureSuitCircuit genetic algo` et `9b - Voiture suit circuit version 2`, ainsi que `AGENTS.md` et `ARCHITECTURE.md` à la racine du dépôt. Les liens ci-dessous sont relatifs au présent document.

Référence du cours : [Craig W. Reynolds, Steering Behaviors for Autonomous Characters, GDC 1999](../../ARTICLE_CRAIG_REYNOLDS/Steering%20Behaviors%20For%20Autonomous%20Characters.pdf). Le PDF n’a pas été extrait dans cette session ; les rapprochements conceptuels reprennent les consignes locales, sans attribution de citation ni de page au PDF.

Les constats sont issus d’une analyse statique et d’une vérification de syntaxe. Aucune mesure de convergence, de fluidité ou de réussite en navigateur n’est revendiquée.

## 2. Entrées et lancement

Chaque exemple est une application Web statique autonome. Son point d’entrée est `index.html`. p5.js appelle ensuite automatiquement `setup()` puis `draw()` ; aucun serveur applicatif, compilation, `package.json` ou lanceur de tests n’est présent dans ces deux dossiers.

| Version | Bibliothèques chargées par CDN | Initialisation et boucle |
| --- | --- | --- |
| 9 | p5.js 0.8.0, addon p5.dom 0.8.0, TensorFlow.js 1.1.0 | `sketch.js` |
| 9b | p5.js 1.9.0, TensorFlow.js 4.20.0 | `js/main.js` |

Depuis PowerShell, à la racine du dépôt, ouverture directe possible :

```powershell
Start-Process '.\9-VoitureSuitCircuit genetic algo\index.html'
Start-Process '.\9b - Voiture suit circuit version 2\index.html'
```

Les scripts ne chargent pas de ressources locales par `fetch` ou modules ES ; l’ouverture directe est donc une option cohérente avec le code, à confirmer dans le navigateur utilisé. Les CDN exigent une connexion réseau et peuvent être bloqués par ses politiques.

Alternative, uniquement si Python est déjà installé, sans installation supplémentaire :

```powershell
python -m http.server 8000
```

Puis ouvrir `http://localhost:8000/9-VoitureSuitCircuit%20genetic%20algo/` ou `http://localhost:8000/9b%20-%20Voiture%20suit%20circuit%20version%202/`. Python n’a pas été trouvé par `Get-Command` dans cette session ; cette commande est une possibilité conditionnelle, pas une commande exécutée avec succès. Aucun serveur ni navigateur n’a été lancé pendant l’analyse.

## 3. Architecture et inventaire

### Version 9 : sept fichiers

| Fichier | Rôle |
| --- | --- |
| [index.html](../../9-VoitureSuitCircuit%20genetic%20algo/index.html) | Charge les bibliothèques, puis `nn`, `ga`, `ray`, `boundary`, `vehicle`, `sketch` dans cet ordre. |
| [sketch.js](../../9-VoitureSuitCircuit%20genetic%20algo/sketch.js) | Configuration, génération du circuit, populations, boucle, affichage et passage de génération. |
| [vehicle.js](../../9-VoitureSuitCircuit%20genetic%20algo/vehicle.js) | Classe `Vehicle` : capteurs, décision neuronale, steering, locomotion, checkpoints, dessin et fitness brute. |
| [ray.js](../../9-VoitureSuitCircuit%20genetic%20algo/ray.js) | Classe `Ray`, intersection rayon/segment, orientation et dessin. |
| [boundary.js](../../9-VoitureSuitCircuit%20genetic%20algo/boundary.js) | Classe `Boundary`, segment servant de mur ou checkpoint, milieu et dessin. |
| [nn.js](../../9-VoitureSuitCircuit%20genetic%20algo/nn.js) | Réseau dense TensorFlow, prédiction, copie, mutation et libération. |
| [ga.js](../../9-VoitureSuitCircuit%20genetic%20algo/ga.js) | Fitness normalisée, roulette et reproduction. |

`setup()` crée un canvas 1200 × 800, choisit le backend CPU, construit le circuit et initialise 100 voitures. `draw()` répète entre 1 et 10 cycles selon le curseur : comportement → checkpoint → locomotion → retrait des morts → nouvelle génération si nécessaire. Le rendu des voitures existe à la fois dans les cycles et après eux.

Le circuit utilise 60 angles autour du centre et du bruit de Perlin pour faire varier ses rayons. À chaque angle, deux points sont décalés radialement de ±60 pixels : leur séparation est de 120 pixels, malgré le nom `pathWidth = 60`. Deux boucles forment 120 murs ; les 60 traverses constituent les checkpoints. Le départ est le milieu du checkpoint zéro. Le circuit est reconstruit à chaque génération.

### Version 9b : dix fichiers

| Fichier | Rôle |
| --- | --- |
| [index.html](../../9b%20-%20Voiture%20suit%20circuit%20version%202/index.html) | Bibliothèques, scripts et trois curseurs HTML. |
| `css/style.css` | Présentation, plein écran, panneau presque transparent révélé au survol. |
| `js/globals.js` | Configuration et état global partagé. |
| `js/utils.js` | Distance point/segment par projection bornée. |
| `js/NeuralNetwork.js` | Équivalent fonctionnel de `nn.js`. |
| `js/Ray.js` | Équivalent de `ray.js`, avec position et direction réglables. |
| `js/Track.js` | Classe `Boundary`, construction et affichage du circuit, géométrie auxiliaire. |
| [js/Car.js](../../9b%20-%20Voiture%20suit%20circuit%20version%202/js/Car.js) | Capteurs, réseau, steering, locomotion, progression et élimination. |
| [js/Genetic.js](../../9b%20-%20Voiture%20suit%20circuit%20version%202/js/Genetic.js) | Fitness, tournoi, reproduction et critère de réussite. |
| [js/main.js](../../9b%20-%20Voiture%20suit%20circuit%20version%202/js/main.js) | Cycle p5, interface, collisions et HUD. |

La version 9b ne contient ni `ga.js`, ni `nn.js`, ni `ray.js` en minuscules, ni `vehicle.js`. Leurs responsabilités se retrouvent respectivement dans `Genetic.js`, `NeuralNetwork.js`, `Ray.js` et `Car.js`. `Car` est une classe autonome : elle n’étend pas `Vehicle`.

`setup()` construit le canvas plein écran, le circuit et 50 voitures. À chaque image : `look()` → `think()` (qui rappelle `look()`) → `update()` → checkpoints → collisions → retrait des morts → génération suivante si la population est vide → rendu et HUD. Les données circulent par variables globales, avec aussi `window.startAngle` et `window.startCheckpointIndex`.

Le générateur de circuit recherche une boucle sur grille par parcours récursif avec retour arrière, limité à 50 000 appels. La taille des cellules dépend de la largeur ; la longueur recherchée dépend de la difficulté et de la capacité de la grille. En cas d’échec, quatre points constituent un tracé de repli. Les points passent par interpolation Catmull-Rom, lissage laplacien avec perturbations aléatoires, puis rééchantillonnage à environ 8 pixels. Les normales créent les bords à ±`TRACK_WIDTH/2`. Une mise à l’échelle recentre le résultat dans le canvas ; la largeur effective peut donc être inférieure à la valeur du curseur. Un checkpoint est créé tous les quatre points. Le départ se situe à environ 5 % du tracé, orienté vers son aval. Le circuit reste identique entre générations ordinaires.

Les fonctions `getConvexHull` et `checkPathIntersection` ne participent pas au générateur actif ; leur présence ne garantit pas l’absence de croisements après lissage ou décalage des bords.

## 4. Perception par raycasting

Un capteur part de la position de la voiture dans une direction relative à son cap. `Ray.cast(wall)` résout l’intersection entre une demi-droite et un segment : un dénominateur nul signifie des directions parallèles ; `0 < t < 1` place l’intersection à l’intérieur du mur ; `u > 0` la place devant le capteur. Les extrémités exactes des murs sont exclues et les cas colinéaires ne sont pas traités.

Pour chaque rayon, la voiture teste tous les murs et conserve l’intersection la plus proche dans sa portée. Sans obstacle détecté, la distance reste égale à cette portée. Le réseau reçoit une proximité :

```text
proximité = 1 - distance / portée
```

Un obstacle proche donne une entrée proche de 1 ; aucun obstacle à portée donne 0. `cast()` est géométriquement illimité ; c’est la recherche du minimum dans `look()` qui borne la perception.

| Paramètre | Version 9 | Version 9b |
| --- | --- | --- |
| Rayons | 6 | 5 |
| Angles relatifs | −45°, −30°, −15°, 0°, +15°, +30° | −60°, −30°, 0°, +30°, +60° |
| Portée | 50 px | 150 px |
| Autre entrée | Aucune | Norme de la vitesse / limite de vitesse |
| Collision | Distance détectée < 5 px sur un rayon | Distance du centre aux segments < 10/1,8 px, plus limites écran |

Le commentaire de la version 9 annonce un champ de 90°, mais la boucle exclut +45° : les capteurs couvrent effectivement 75° et sont asymétriques. En 9b, le champ vaut 120° et est symétrique. Aucune des versions ne donne directement les checkpoints, les coordonnées du circuit ou une trajectoire idéale au réseau. Les checkpoints servent à l’évaluation ; la détection de sens inverse de 9b utilise toutefois la direction du circuit pour éliminer des candidats.

## 5. Réseau neuronal et steering

Les deux réseaux sont entièrement connectés, avec une couche cachée et deux sorties. Chaque neurone applique une somme pondérée avec biais, puis une sigmoïde : `σ(z) = 1 / (1 + exp(-z))`.

| Version | Topologie | Paramètres entraînables |
| --- | --- | --- |
| 9 | 6 → 12 → 2 | `(6×12+12) + (12×2+2) = 110` |
| 9b | 6 → 20 → 2 | `(6×20+20) + (20×2+2) = 182` |

Les calculs de paramètres dans les commentaires de `vehicle.js` ne correspondent pas au réseau exécuté.

En version 9, la première sortie est convertie en angle relatif entre −π et +π ; la seconde en vitesse désirée entre 0 et 5. En 9b, la première donne un angle relatif entre −0,5 et +0,5 radian, malgré son nom `turnForce`, et la seconde une vitesse désirée entre 0 et `GAME_SPEED_LIMIT` (6 par défaut, réglable de 2 à 20). Il ne s’agit pas d’une accélération brute.

Dans les deux versions :

```text
cap désiré = cap actuel + angle relatif
vitesse désirée = direction(cap désiré) × vitesse demandée
steering = vitesse désirée - vitesse actuelle
steering = force limitée à maxforce/maxForce
applyForce(steering)
```

La force maximale vaut 0,2 en 9 et 0,5 en 9b. La locomotion utilise des `p5.Vector`. La version 9 déplace d’abord la position avec l’ancienne vitesse, puis actualise la vitesse ; 9b actualise la vitesse avant la position. Toutes deux remettent l’accélération à zéro après intégration.

Le réseau est une politique réactive, sans mémoire ni rétropropagation : aucun `fit()`, jeu d’exemples étiquetés ou optimiseur n’intervient. L’apprentissage résulte de la sélection des paramètres à l’échelle des générations. `tf.tidy()` encadre les calculs temporaires, les poids sont clonés avant reproduction et les modèles des morts sont explicitement libérés. La prédiction lit les sorties synchroniquement avec `dataSync()`. La version 9 journalise en plus chaque prédiction dans la console.

La séparation de Reynolds apparaît dans l’objectif de progression, la force de steering et son application par la locomotion. Cependant perception, décision et steering restent réunis dans `Vehicle.look()` en 9 ; 9b sépare davantage `look()` et `think()`. Aucune composition explicite de plusieurs comportements indépendants n’est implémentée.

## 6. Fitness, sélection, reproduction et mutations

### Version 9

`check()` mesure la distance du centre à la droite infinie portant le prochain checkpoint, par la fonction locale `pldistance` (ce n’est pas une fonction p5). Si cette distance est < 5 pixels, le compteur de checkpoints augmente et le délai sans progression revient à zéro. Sans validation pendant plus de 25 mises à jour, la voiture meurt. L’indice boucle modulo 60 ; `finished` n’est jamais activé dans le code actif.

La variable `fitness` représente d’abord le nombre `k` de validations, puis `calculateFitness()` la remplace par `2^k`. Il s’agit d’une exponentielle, malgré le commentaire « au carré ». `ga.js` normalise ensuite :

```text
p(i) = 2^k(i) / somme_j(2^k(j))
```

Exemple : pour 0, 1 et 2 validations, les poids valent 1, 2 et 4, donc les probabilités 1/7, 2/7 et 4/7. Même sans progrès, un individu conserve un poids positif.

La roulette tire un nombre uniforme et soustrait les probabilités jusqu’à atteindre zéro. Chaque enfant copie un seul réseau parent puis mute ses paramètres. Chaque poids ou biais a 10 % de probabilité de recevoir un ajout gaussien d’écart-type 1. Il n’y a ni croisement à deux parents, ni élitisme explicite. Après création des 100 enfants, les anciens modèles sont libérés.

### Version 9b

Chaque validation du prochain segment à distance < 40 pixels apporte 50 points. Lorsque l’indice suivant devient zéro, 200 points supplémentaires sont accordés, `finished` et `dead` passent à vrai. Le score n’est donc pas du temps, malgré le commentaire du constructeur. Le bonus de survie est commenté et inactif.

La fitness finale est :

```text
fitness = score + max(0, 50 × (1 - distanceAuCentreDuProchainCheckpoint / 400))
```

Le bonus varie de 0 à 50, soit autant qu’un checkpoint, et non un demi-checkpoint comme l’annonce un commentaire. Il apporte un signal de progression entre validations. Aucune normalisation n’est nécessaire pour le tournoi.

Pour chaque enfant, cinq candidats sont tirés avec remise ; celui ayant la fitness maximale devient l’unique parent. Son réseau est copié. Chaque paramètre a 15 % de probabilité de recevoir un ajout gaussien de moyenne 0 et d’écart-type 0,1. Les mutations sont donc plus fréquentes mais beaucoup moins amples qu’en 9. Il n’existe toujours ni crossover ni conservation garantie du champion.

Lorsque 60 % des 50 voitures sont marquées `finished`, `trainingFinished` devient vrai. Le système affiche une alerte et désactive les mutations suivantes. Il continue néanmoins la simulation, la sélection et la création de générations : ce n’est pas un arrêt effectif.

La version 9b ajoute une impulsion initiale dans le sens du tracé, une vitesse désirée minimale durant 30 images, un contrôle de déplacement au cycle 60, des contrôles de stagnation par périodes de 61 mises à jour environ, un délai maximal de 1200 mises à jour sans checkpoint, ainsi qu’une élimination du sens inverse prolongé après 100 cycles. Les seuils sont exprimés en mises à jour ; les équivalences en secondes supposent une fréquence proche de 60 Hz.

## 7. Comparaison et acquis

| Aspect | Version 9 | Version 9b |
| --- | --- | --- |
| Population | 100 | 50 |
| Circuit | Bruit radial, nouveau à chaque génération | Grille et lissage, stable entre générations |
| Perception | 6 proximités | 5 proximités + vitesse |
| Steering | Grand angle relatif, force 0,2 | Angle relatif réduit, force 0,5 |
| Évaluation | Checkpoints, puis exponentielle | Score linéaire + proximité |
| Sélection | Roulette | Tournoi de taille 5 |
| Mutation | 10 %, bruit σ=1 | 15 %, bruit σ=0,1 |
| Fin de parcours | Non implémentée | Indice zéro, avec biais de départ |
| Interface | Génération, leader, cycles/image | HUD, leader, vitesse, difficulté, largeur |
| Robustesse | Collision par capteurs, délai court | Collision géométrique, anti-stagnation, sens inverse |

Les acquis communs sont le pilotage local appris, les capteurs orientés, la normalisation des perceptions, les forces bornées, une population de politiques, la reproduction avec mutation et la visualisation du leader. La version 9b ajoute une organisation par responsabilités et des garde-fous, mais ne constitue pas encore une base entièrement découplée ou validée.

## 8. Problèmes et limites identifiés

### Justesse de l’évaluation

1. **9 : checkpoint sur une droite infinie.** Une voiture peut valider hors du segment de piste. Une proximité ne prouve ni franchissement ni bon sens. Le checkpoint initial peut être crédité immédiatement au départ.
2. **9 : aucune arrivée effective.** Le compteur peut parcourir plusieurs tours et la génération attend la mort de tous. Une politique qui progresse indéfiniment peut empêcher son renouvellement. `maxFitness`, `changeMap` et `end` ne pilotent pas de condition d’arrêt active.
3. **9b : tour incomplet.** Le départ est vers 5 % du tracé, mais la réussite est déclenchée à l’indice zéro ; la portion du zéro au départ n’est pas exigée.
4. **9b : validation trop permissive.** La distance < 40 pixels est comparable ou supérieure à l’espacement nominal d’environ 32 pixels entre checkpoints. Un véhicule peut valider plusieurs checkpoints voisins sur plusieurs images sans les traverser. Le reset du compteur de sens inverse à chaque validation peut aussi affaiblir ce garde-fou.
5. **9b : score avant collision.** Les checkpoints sont évalués avant les murs : une voiture peut obtenir un crédit sur l’image où elle entre en collision.
6. **9b : pas de récompense directe du temps au tour.** L’anti-stagnation favorise la progression minimale, mais deux arrivées de durées différentes ne sont pas départagées explicitement par leur temps.

### Robustesse et reproductibilité

- Les collisions de 9 ignorent les murs entre rayons et derrière la voiture. Celles de 9b approchent la voiture par un centre et une petite marge, sans rectangle orienté ni balayage entre positions : des contacts de carrosserie ou traversées rapides peuvent échapper au test.
- Le helper de distance point/segment de 9b divise par la longueur au carré sans traiter le segment nul. Le constructeur `Boundary` peut justement transformer des coordonnées NaN en segment nul, masquant une erreur plutôt que la signalant.
- Les curseurs de difficulté/largeur et le redimensionnement changent le circuit de 9b sans réinitialiser les voitures, indices, scores ou morts sauvegardés. Cela mélange les conditions d’évaluation ; des indices peuvent dépasser le nouveau nombre de checkpoints. Le redimensionnement ne réarme pas non plus explicitement `trainingFinished`.
- Une très petite fenêtre peut conduire à une grille de zéro ligne ou colonne et à un accès invalide lors de la génération. Le lissage et les décalages de bords ne bénéficient pas d’une validation géométrique finale.
- La difficulté initiale affichée vaut 10 dans le HTML mais 5 dans `globals.js` ; les éléments ne sont synchronisés qu’après interaction.
- Aucun seed global : p5, initialisation TensorFlow et, en 9b, `Math.random()` rendent les essais difficiles à reproduire. Fixer seulement le seed p5 ne suffit pas.
- La fitness exponentielle de 9 concentre fortement la sélection et peut déborder numériquement pour de très grands compteurs. La roulette ne gère pas explicitement le tirage exact zéro (indice −1), les arrondis de somme ou les valeurs non finies.
- Ni élitisme, ni archive du meilleur modèle, ni sauvegarde/import du réseau, ni évaluation séparée sur plusieurs circuits. Une amélioration observée peut être perdue ou spécifique à une piste.

### Architecture, performance et pédagogie

- Les deux exemples dépendent fortement de l’état global. La classe `Car` de 9b n’hérite pas de `Vehicle` et `Boundary` n’en hérite dans aucune version : le code fourni ne respecte donc pas intégralement les conventions actuelles du dépôt. Ce constat ne justifie aucune modification des originaux.
- `main.js` de 9b appelle deux fois la perception par voiture et par image. Le coût est proportionnel à voitures × rayons × murs, auquel s’ajoutent les collisions. La densité du circuit augmente ce coût.
- Les prédictions synchrones, le backend CPU, les dessins répétés de 9 et les logs par prédiction peuvent ralentir l’exécution. Aucun profilage n’a été réalisé ; ces coûts sont identifiés dans le code.
- Le mouvement dépend du nombre d’images et n’utilise pas de pas de temps explicite. Le curseur de 9 accélère la simulation ; celui de 9b change la limite de vitesse physique, donc aussi le problème d’apprentissage.
- Les sorties sigmoïdes et les mutations peuvent saturer les décisions ; aucune mesure de diversité ou adaptation du bruit n’est disponible.
- L’interface ne montre ni fitness moyenne, ni historique, ni temps au tour, ni diversité. Le panneau presque invisible de 9b réduit la découvrabilité des réglages.
- Les bibliothèques proviennent de CDN ; aucune copie locale n’est fournie. Aucun test automatisé ni protocole de comparaison n’est présent dans ces deux exemples.

## 9. Améliorations proposées, sans implémentation

Priorité à une évaluation fiable avant toute augmentation de la complexité visuelle ou du réseau.

- Définir un tour par franchissements orientés de segments ordonnés, avec retour au départ après un tour complet. Gérer le franchissement entre ancienne et nouvelle position, les validations multiples légitimes et la collision dans le même pas.
- Séparer perception, politique neuronale, calcul du steering, locomotion, évaluation et sélection. Les comportements retournent des forces composables ; l’entité appelle `applyForce` et conserve la locomotion fournie.
- Concevoir l’extension par sous-classes de `Vehicle`, sans modifier ni recopier son code. L’adaptation aux états d’évaluation déjà présents et aux conventions `maxspeed/maxforce` doit être explicitée avant implémentation. Les éléments visibles doivent suivre les consignes d’héritage et de fichier distinct ; les données géométriques et calculs restent dans des modules dédiés.
- Utiliser une configuration immuable par épisode et une réinitialisation cohérente de tous les candidats lors d’un changement de piste. Valider les dimensions, segments et indices.
- Définir une fitness explicable : progression orientée d’abord, réussite complète ensuite, temps et conduite en critères secondaires calibrés. Éviter que survie ou proximité seules dominent l’objectif.
- Ajouter un élitisme limité et une archive du champion. Le crossover est une option expérimentale, pas une étape indispensable ; son intérêt doit être comparé au clonage muté existant.
- Injecter l’aléatoire, fixer les seeds des différentes sources et conserver configuration, piste et paramètres du réseau. Comparer sur plusieurs seeds et pistes de validation distinctes.
- Calculer les perceptions une seule fois par pas ; séparer simulation et rendu. Envisager un index spatial uniquement si le profilage le justifie.
- Prévoir commandes pause/reprise, pas à pas, visualisation des entrées/sorties et courbes de fitness ; sauvegarde/import de champions avec format versionné et validation des dimensions.

## 10. Plan de développement progressif soumis à validation

| Étape | Résultat attendu | Critère de validation |
| --- | --- | --- |
| 0 — Cadrage | Valider cette analyse, les règles d’un tour, la réutilisation de `Vehicle` et le périmètre indépendant. | Accord utilisateur avant tout code. |
| 1 — Fondations | Structure NeuroDriveAI isolée, configuration, sources d’aléatoire injectables et petit lanceur de tests sans dépendance inutile. | Aucun changement aux TPs ; initialisation reproductible. |
| 2 — Géométrie | Raycasting, distances, collisions et franchissements directionnels robustes. | Tests parallèles/colinéaires, extrémités, segment nul, haute vitesse, mauvais sens et tour depuis un départ décalé. |
| 3 — Pilotage | Entité spécialisée et politique séparée, forces composables via la locomotion existante. | Tests entrées proches/lointaines, vitesse nulle, sorties extrêmes, direction du steering, limite maxForce et composition. |
| 4 — Neuroévolution | Fitness fiable, tournoi, copie indépendante, mutations et élitisme limité. | Tests scores, égalités, absence de progrès, taux 0/1, bruit fixé, parent inchangé, population et libération des modèles. |
| 5 — Évaluation | Épisodes figés, vraie réussite, limites de durée et pistes de validation. | Tests reset complet, arrivée/collision simultanée, fin d’entraînement et comparaisons multi-seeds. |
| 6 — Outils pédagogiques | HUD, historique, pause et inspection des décisions. | Mesures cohérentes avec la simulation ; vérification en navigateur. |
| 7 — Optimisation et extension | Profilage puis optimisations utiles, nouvelles pistes et persistance. | Résultats reproductibles et absence de régression mesurée. |

Aucune étape de développement n’a commencé. Les commandes de tests et critères détaillés seront fixés avec la structure validée ; aucun résultat futur n’est présumé.

## 11. Vérifications et bilan de cette livraison

Commande de syntaxe exécutée avec le Node.js déjà installé, depuis la racine du dépôt :

```powershell
$files = Get-ChildItem -LiteralPath '9-VoitureSuitCircuit genetic algo','9b - Voiture suit circuit version 2' -Recurse -File
foreach ($file in $files | Where-Object Extension -eq '.js') {
    node --check $file.FullName
    if ($LASTEXITCODE -ne 0) { throw "Syntaxe invalide : $($file.FullName)" }
}
```

Résultat : les 14 fichiers JavaScript sont acceptés par le vérificateur de syntaxe. Cela ne valide ni les API p5/TensorFlow en navigateur ni le comportement des algorithmes. Aucune suite unitaire existante n’a été trouvée dans ces deux dossiers. Aucun test comportemental n’a été ajouté ou exécuté : cette livraison contient uniquement un document d’analyse et aucune nouvelle fonctionnalité.

Fichier créé : `NeuroDriveAI/docs/ANALYSE-TP9.md`. Aucun fichier existant modifié ; `vehicle.js` reste intact. Aucun changement à EvolutionArena ou aux autres TPs, aucune dépendance installée, aucun commit ou push. Les changements préexistants du TP 8 visibles dans `git status` sont hors périmètre et ont été laissés en place.

**Décision attendue : validation de l’analyse et du plan avant de coder NeuroDriveAI.**