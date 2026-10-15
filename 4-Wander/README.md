# TD4 — Air Traffic Lab

Cet exemple permet d'expérimenter Wander : une cible varie progressivement sur un cercle projeté devant l'avion, puis Seek produit la force qui dirige l'avion vers cette cible. La distance projette le cercle dans la direction de la vitesse ; le rayon détermine l'amplitude du déplacement de la cible ; la variation d'angle borne le changement aléatoire en radians à chaque pas. Il s'agit de règles locales et réactives.

## Architecture

`index.html` charge p5 localement, les entités, l'interface, `game.js` puis `main.js`. Le rendu utilise Canvas 2D ; une seule chaîne requestAnimationFrame anime l'application. Le `sketch.js` historique et `js/wanderer.js` ne sont pas chargés.

`Vehicle` centralise les vecteurs p5.Vector (position, vitesse, accélération), les comportements de base, applyForce et la locomotion. Airplane hérite de Vehicle et compose les forces ; Waypoint, WeatherZone et TrailParticle héritent également de Vehicle. Les waypoints et zones météo restent immobiles, avec des animations visuelles. ATC calcule les alertes ; UI gère les contrôles et statistiques. Le fichier vehicle.js est protégé.

## Temps et unités

Chaque mise à jour physique avance d'un pas fixe de 1000/60 ms (1/60 seconde), même si un argument est fourni à update. L'accumulateur convertit le temps RAF en pas complets, avec au maximum cinq pas par frame. Les fractions sont conservées ; l'excédent dépassant le plafond est abandonné : sous forte charge, la simulation ralentit plutôt que de rattraper indéfiniment.

Un timestamp non fini vide l'accumulateur et réinitialise l'horloge. Un timestamp décroissant est ignoré en conservant la dernière référence valide. Pause/reprise et changement de visibilité réinitialisent l'horloge ; aucune physique n'avance lorsque le document est masqué. Sans événement de visibilité, une longue interruption reste soumise au plafond de cinq pas.

Les positions et distances sont en pixels CSS. Les unités historiques sont conservées : vitesse en pixels par pas, accélération et force (masse implicite unitaire) en pixels par pas au carré. Les forces ne sont pas multipliées par deltaTime. Vehicle intègre vitesse puis position une seule fois par pas. Le temps de patrouille et du radar est en millisecondes simulées.

Météo, pulses des waypoints, vie et déplacement des particules avancent par pas physique. Alertes ATC : une actualisation par pas. Rendu et statistiques : une fois par frame RAF, même en pause. Le clignotement visuel d'alerte utilise performance.now et continue pendant la pause.

## Modes et composition

- Wander : cible mobile sur le cercle, pilotée par Seek.
- Waypoints : Arrive vers le waypoint courant, puis passage au suivant à moins de 40 pixels ; Wander si la liste est vide.
- Formation : le premier avion utilise Wander ; les autres utilisent Arrive vers une position décalée du leader.
- Patrouille : Seek vers une cible orbitant autour d'un centre proportionnel au canvas.

La force principale est combinée avec séparation (poids 2), évitement météo (1,5) et bordures (3), puis la somme est limitée à maxForce avant applyForce. Les formules existantes sont conservées. Les alertes ATC utilisent les seuils fixes de 40 et 80 pixels, indépendamment du curseur de séparation.

## Redimensionnement

Les positions des avions, waypoints, météo, particules et points de traînée sont multipliées séparément par les rapports de largeur et hauteur. Un changement de proportions déforme donc les trajectoires. Les coordonnées non finies sont recentrées ; les positions sont bornées au monde. Ce bornage perd irréversiblement l'information hors limites : un agrandissement ultérieur ne la restaure pas.

Vitesses, accélérations, forces, rayons météo, tailles, distances Wander, séparation, marges de bordure et espacements de formation restent inchangés. La formation recalcule ses cibles depuis le leader avec ses espacements en pixels ; la patrouille adapte son centre et ses rayons aux dimensions. Le radar projette les coordonnées sur ses dimensions courantes.

Dimensions logiques : minimum 1 pixel, valeurs non finies remplacées par 1. DPR : valeur positive finie, plafonnée à 2, sinon 1 ; chaque dimension du bitmap vaut au moins 1 pixel. Les nouveaux objets sont placés dans les limites, même sur un petit canvas. ResizeObserver observe les deux canvas lorsque disponible ; window.resize fournit le repli. Aucun second cycle d'animation n'est créé.

## Lancement et tests

Depuis la racine du dépôt, avec Python installé :

```powershell
python -m http.server 8000
```

Ouvrir `http://localhost:8000/4-Wander/` dans Chrome. Les ressources sont locales. Clic gauche : ajouter un avion ; clic droit : retirer ; espace : pause/reprise. Les boutons ajoutent aussi waypoints et turbulences.

```powershell
node --test 4-Wander/tests/*.test.mjs
```

Les tests Node utilisent node:test et un double des opérations p5.Vector. Ils comparent notamment les quatre modes à 30, 60 et 144 FPS sur cinq secondes avec 300 pas, un générateur déterministe variable et une égalité stricte des états. Ils ne remplacent pas la validation Chrome avec p5 réel.

## Limites

Sur un monde très petit, les distances physiques peuvent dépasser l'espace disponible et les avions peuvent sortir des limites pendant le mouvement : les bordures sont une force de steering, pas un mur. Les cibles de formation peuvent également dépasser le canvas. Aucun redimensionnement des rayons ou changement de locomotion ne compense cela. Le bornage intervient au redimensionnement et à la création.

La simulation n'interpole pas le rendu entre deux pas. L'aléatoire de production reste Math.random ; les tests injectent un générateur reproductible. Le système de particules existe et est mis à jour, mais aucun appel de spawn n'est présent dans l'application active. Aucun énoncé de TD absent du dépôt n'a été validé.

## Observer les calculs de Wander

Cocher « Observer Wander du premier avion ». Un seul avion est observé : le premier de la liste, identifié par son numéro de vol dans le schéma et le texte sous le canvas. S'il est retiré, le suivant devient l'avion observé. Aucun choix par clic n'est ajouté : le clic gauche conserve son rôle de création.

Le cercle et son centre sont bleus, le rayon et la cible jaunes. Les flèches représentent la vitesse avant intégration (blanc, ×12), la force Wander individuelle limitée (vert, ×240) et la force totale composée puis plafonnée (rose, ×240). Ces facteurs sont uniquement graphiques, sans normalisation : des forces égales peuvent se superposer et une force nulle n'a pas de flèche. L'origine est la position avant locomotion du dernier pas ; elle peut donc être légèrement décalée de l'avion après intégration.

Airplane observe le Seek appelé par le Wander hérité et copie sa cible ainsi que les forces retournée et appliquée. Aucun algorithme Wander ou intégrateur n'est recopié. Les données sont enregistrées indépendamment de la case d'affichage. Le rendu ne rappelle ni Wander ni Seek et ne tire aucun nombre aléatoire. En pause, le dernier calcul reste affiché. Un changement de mode efface le calcul précédent jusqu'au prochain pas pertinent.

Lors d'un redimensionnement en pause, origine, centre, cible et rayons du schéma mémorisé suivent la transformation du canvas. Un cercle peut devenir temporairement une ellipse pour préserver ce dernier calcul ; les vecteurs physiques et leurs échelles graphiques restent inchangés. Au prochain pas, le cercle reprend le rayon physique courant. Le dessin peut dépasser le canvas et être coupé près des bords.

## Formules et paramètres

Pour une position P, une vitesse v et une distance de projection d :

```text
u = v / |v| si |v| > 0,1 ; sinon u = (1, 0)
C = P + d × u
θ suivant = θ précédent + (random() − 0,5) × 2a
T = C + r × (cos θ, sin θ)
vitesse désirée = maxSpeed × (T − P) / |T − P|
force Wander = limit(vitesse désirée − v, maxForce)
force totale = limit(principale + 2 séparation + 1,5 météo + 3 bordures, maxForce)
```

Si T = P, Seek retourne une force nulle. θ est exprimé dans le repère du monde, et non comme un angle relatif au cap. Seul le centre C suit la direction de la vitesse. a est la variation maximale en radians par pas, r et d sont en pixels CSS. Avec a = 0, l'angle reste constant mais le centre continue de suivre la vitesse : cela ne garantit pas une trajectoire rectiligne. Les forces auxiliaires peuvent aussi faire tourner l'avion.

| Mode | Objectif | Effet des paramètres Wander |
|---|---|---|
| Wander | Exploration par cible fluctuante | Tous les avions |
| Waypoints | Arrive vers les balises successives | Seulement en l'absence de balises |
| Formation | Leader en Wander, suiveurs en Arrive vers des positions relatives | Leader uniquement |
| Patrouille | Seek vers une cible sur une orbite prédéfinie | Aucun |

Pour le suiveur d'indice i ≥ 1, la rangée est ceil(i/2) ; les côtés alternent. Les décalages sont de 50 pixels vers l'arrière et 40 pixels sur le côté par rangée, orientés selon la vitesse du leader. Chaque emplacement est distinct et non nul. Séparation et évitements peuvent empêcher une formation parfaite : il ne s'agit pas d'une contrainte rigide.

La cible de patrouille suit une ellipse de centre (0,4 largeur ; 0,48 hauteur), de demi-axes (0,2 largeur ; 0,192 hauteur). Son angle vaut temps simulé × 0,0003 + phase, avec une phase issue du premier chiffre du numéro de vol. Plusieurs avions peuvent donc partager une phase. C'est la cible qui suit cette orbite prédéfinie ; l'avion réagit par Seek, avec les autres forces. Ce mode n'est pas Wander.

## Trois expériences

1. **Variation angulaire.** Tout effacer, ajouter un avion, choisir Wander et activer l'observation. Comparer a = 0 à a = 0,5 loin des bordures. À zéro, l'angle mondial de la cible sur le cercle reste fixe ; à 0,5, il fluctue progressivement. Le mouvement reste influencé par les bordures.
2. **Distance et rayon.** Avec un seul avion, faire varier d de 40 à 160 en gardant r constant, puis r de 10 à 80 avec d constant. Le centre s'éloigne dans le premier cas ; la cible s'écarte davantage du centre dans le second. Observer les changements de direction plutôt que supposer une relation monotone avec la vitesse.
3. **Composition.** Ajouter une turbulence, puis plusieurs avions. Lorsque l'avion observé entre dans un voisinage pertinent, la force rose peut s'écarter de la verte. La masquer avec la case « Turbulences » ne supprime pas l'évitement. En Formation, le premier avion reste en Wander ; en Patrouille, le schéma Wander disparaît et ses paramètres n'agissent plus.

Les boutons indiquent le mode actif ; son rôle est rappelé en texte. « En pause » indique l'arrêt physique. Les cases d'affichage ne désactivent pas les forces. Les cercles de séparation ne sont dessinés qu'en alerte ; les seuils ATC et la distance de séparation sont distincts. Raccourcis supplémentaires : `+` ajoute un avion, `−` retire le dernier, `C` efface les entités. Les ajouts de balises et météo se font par boutons à des positions aléatoires.

Référence : Craig W. Reynolds, [Steering Behaviors for Autonomous Characters, GDC 1999](../ARTICLE_CRAIG_REYNOLDS/Steering%20Behaviors%20For%20Autonomous%20Characters.pdf). Aucun énoncé officiel spécifique au TD4 n'a été trouvé dans le dépôt.
