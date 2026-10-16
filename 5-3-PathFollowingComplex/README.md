# TD5-3 — Laboratoire Complex Path Following

Ce laboratoire montre comment un agent choisit une correction locale à partir
d'un circuit fermé composé de segments. Il conserve le suivi historique de
Daniel Shiffman / The Coding Train et l'extension avec serpents déjà présente.
Aucun énoncé officiel distinct n'est fourni dans ce dossier.

## Lancer et tester

Depuis la racine du dépôt, avec un serveur HTTP statique, par exemple :

```powershell
py -m http.server 8000
```

Ouvrir http://localhost:8000/5-3-PathFollowingComplex/.
Cette commande nécessite Python 3 accessible par le lanceur Windows `py` ;
sur un système disposant de `python3`, utiliser `python3 -m http.server 8000`.
Un serveur statique d'éditeur convient aussi. Aucune installation npm n'est requise.
p5.js est local ; aucun CDN, service distant ou module réseau n'est nécessaire.
p5.sound reste conservé dans libraries/ mais n'est plus chargé, car inutilisé.

Les tests nécessitent une version récente de Node.js avec node:test :

```powershell
node --test 5-3-PathFollowingComplex/tests/*.test.mjs
```

Dernière exécution automatisée : **54 réussis, 0 échec**, Node 24.
Ce résultat ne constitue pas une validation Chrome. Les validations des autres TD
et celles d'une version antérieure ne valident pas cette nouvelle interface.

## Algorithme historique conservé

Les points sont des p5.Vector. Le segment i relie le point i au point (i+1) modulo N :
le dernier point revient au premier, y compris dans le scénario à deux points.

Pour la position X et la vitesse V :

- F = X + normalize(V) × anticipationDistance, initialement 25 pixels.
- Si V est nulle, F = X.
- Pour chaque segment AB, u = normalize(B-A) et projection = A + u × ((F-A) · u).
- Si cette projection sort de la boîte du segment, le candidat H devient B et
  la direction de la cible devient celle du segment suivant.
- Le candidat minimisant distance(F,H) est retenu ; une égalité conserve le premier.
- T = H + normalize(direction retenue) × targetAdvance, initialement 25 pixels.
- La correction est active strictement lorsque distance(F,H) > path.radius.

Ce repli sur B n'est pas un clamp classique de la projection entre A et B.
La cible peut dépasser un segment court. Aucun parcours de distance curviligne
ni indice de progression n'est ajouté. Aux croisements, la proximité et l'ordre
des segments décident, sans mémoire du tour précédent.

L'anticipation est **spatiale**, contrairement à l'anticipation en pas du TD5-2.
Les deux paramètres de 25 pixels ont des rôles distincts :
le premier situe F, le second situe T après la projection.

Seek vise T :
desiredVelocity = normalize(T-X) × maxSpeed,
steering = limit(desiredVelocity - V, maxForce).
Seek, applyForce, update et edges sont conservés sans modification.

Les segments nuls sont signalés et ignorés. Un chemin vide, ponctuel ou totalement
dégénéré retourne une force nulle avec projection indéfinie. Des coordonnées
non finies rendent le chemin invalide ; aucune géométrie inventée n'est affichée.
Une sentinelle Infinity remplace l'ancienne limite de recherche à un million.

## Composition, unités et exceptions

Les contributions individuelles sont copiées, pondérées puis additionnées :

total = limit(wFollow × follow + wSeparation × separate + wWander × wander, maxForce).

Une seule application via applyForce et une seule intégration sont effectuées
par véhicule ou anneau et par pas. Les poids n'augmentent plus le budget maximal.
Le plafond peut donc modifier les trajectoires historiques de composition.

Unités : positions, rayon, anticipation et avance en pixels ; vitesse en pixels/pas ;
force/accélération en pixels/pas² pour une masse de 1 ; poids sans unité.
La boucle p5 vise 60 images/s et exécute un pas par draw actif.
Il ne s'agit pas d'une simulation indépendante du FPS ni d'un accumulateur temporel.

Wander conserve explicitement sa formule historique de force directionnelle
directe, qui ne soustrait pas la vitesse courante. Cette exception autorisée reste
un écart à la formule directionnelle générale du dépôt. Aucun rendu n'est effectué
dans Wander. À poids nul, il n'est plus calculé : aucun tirage ni changement de theta.
Cela modifie volontairement la séquence aléatoire globale et les activations ultérieures.
Les paramètres d'un Path statique ne provoquent pas de tirage constructeur.

## Serpents et voisinage

Chaque serpent hérite de Vehicle. Sa tête suit le chemin et se sépare des voisins ;
chaque anneau utilise Arrive vers l'anneau précédent, puis la séparation.
Le corps conserve ses valeurs historiques maxSpeed=10 et maxForce=2 ;
la tête utilise initialement 3 et 0,3.
Les anneaux sont intégrés séquentiellement : le suivant voit la position actualisée
du précédent. La locomotion est toujours héritée.

Les anneaux d'un serpent ne se repoussent pas entre eux.
Ils se séparent des véhicules et des autres serpents ; les véhicules voient tous
les anneaux. Cela n'est pas une garantie d'absence de collisions.
Les objets Path sont visibles et héritent de Vehicle avec limites nulles,
mais **aucun update, steering ou applyForce n'est appelé sur Path**.

## Interface et manipulations

- Pause / Reprendre, Pas suivant (met en pause et effectue exactement un pas), Reset.
- Choisir un véhicule ou une tête de serpent dans la liste, ou cliquer à proximité.
- Les réglages agent affectent l'agent sélectionné ; Wander est désactivé dans
  l'interface pour une tête de serpent, dont le pilotage conserve suivi + séparation.
- Les réglages « tous serpents » restent disponibles et s'appliquent aussi aux
  serpents créés ensuite. Ils peuvent remplacer les poids spécifiques d'une tête.
- Rayon du corridor = demi-largeur ; largeur dessinée = 2 × rayon.
- Espacement = distance visée par Arrive. Taille visuelle = diamètre dessiné ;
  la convention historique r utilisée par la séparation est conservée.
- Éditer les sommets met en pause. Glisser un sommet l'ajuste aux limites du canvas,
  invalide les anciennes décisions puis permet un nouveau pas. Les sommets ne sont
  ni ajoutés ni supprimés par cette interface.
- T crée un serpent au pointeur ; d masque/affiche les détails ; s crée un véhicule
  rouge à maxSpeed=10 ; w crée un véhicule Wander ; glisser hors du mode édition
  ajoute des véhicules. Les commandes clavier sont ignorées dans un champ de formulaire.

Reset recrée les agents et le chemin du scénario avec la graine 2027 ; il conserve
l'état pause, le rayon et les réglages globaux des serpents. Les modifications
individuelles et celles des sommets sont réinitialisées.
Les deux premières entités sont un véhicule et un serpent.

Scénarios : ligne fermée aller-retour, virage serré, circuit complexe à trente points,
croisement et circuit contenant un segment nul. Leur géométrie et leurs conditions
initiales sont reproductibles. Le circuit complexe utilise une variation radiale
déterministe ; la fonction historique newPath aléatoire reste disponible dans le code.

## Lire les diagnostics

Les calculs enregistrent une photographie du dernier pas ; les accesseurs fournissent
des copies défensives, y compris des candidats imbriqués. Le rendu ne rappelle
aucun comportement, n'intègre aucun agent et ne consomme aucun nombre aléatoire.

Pour l'agent sélectionné : F bleu, H cyan, T violet, candidats gris, segment retenu
violet. FH est la distance au candidat retenu ; lors d'un repli sur une extrémité,
ce trait n'est pas nécessairement perpendiculaire à un segment.
Oₙ est la position **avant intégration** : les vecteurs sont tracés depuis cette origine,
même si le véhicule visible a déjà avancé d'un pas.

Le cercle et la cible W de Wander sont mémorisés et affichés uniquement pour le véhicule sélectionné actif.

Vitesse ×15 ; forces pondérées ×70 : suivi violet, séparation orange, Wander rose,
résultante plafonnée verte. Ces facteurs sont uniquement des échelles de dessin.
Le panneau indique la force de suivi individuelle et la norme de la somme avant plafond.
Masquer les détails ne désactive ni le suivi ni la séparation ni Wander.
Après modification d'une géométrie ou d'un paramètre, effectuer un pas pour obtenir
une nouvelle photographie ; les anciennes données sont invalidées.

## Trois expériences

1. **Anticipation et avance** : scénario ligne, pause, sélection du véhicule.
   Faire un pas, puis augmenter l'anticipation : F avance dans la direction de V.
   Modifier uniquement l'avance déplace T, sans déplacer F à état initial identique.
2. **Virage et budget** : virage serré, créer des voisins en glissant, augmenter
   les poids. La somme pondérée peut croître ; la résultante reste au plus maxForce.
   La séparation peut rester active même quand la correction de suivi est inactive.
3. **Croisement et géométrie nulle** : comparer les candidats au croisement,
   puis sélectionner le scénario dégénéré. Le segment nul est signalé, les autres
   restent utilisables. En édition, superposer tous les sommets : le suivi devient
   indéfini avec force nulle, sans exception.

## Architecture

- vehicle.js : comportements historiques, composition, diagnostics et locomotion.
- path.js : support géométrique statique, héritage Vehicle.
- snakeSegment.js : comportement Arrive avec espacement.
- snake.js : construction et rendu du serpent ; classe mère conservée.
- snakePathFollowing.js : composition par anneau, ordre séquentiel.
- lab-scenarios.js : géométries déterministes.
- lab-controller.js : sélection, paramètres, reset et étape physique.
- lab-renderer.js : dessin des données mémorisées.
- lab-ui.js : liaison DOM et diagnostics textuels.
- sketch.js : unique boucle p5 et interactions historiques.
- tests/ : références historiques, attentes corrigées et contrats documentés.

## Tests et non-régression

reference-trajectories.json reste intact : cinq pas, chaque anneau, six composantes,
tolérance absolue 1e-12. Véhicule suivi seul, serpent suivi seul et Wander isolé
préservent ces références. Véhicule et serpent avec séparation changent lorsque
la résultante atteint le plafond ; leurs nouvelles attentes sont séparées dans
corrected-expectations.mjs et vérifiées aussi par un oracle de composition pas à pas.
Le harness utilise un double vectoriel et un RNG injecté non constant ; il ne
prétend pas reproduire le générateur interne p5 ni valider le rendu navigateur.

Les six tests initiaux sont conservés ; seule l'attente de somme non bornée du
test de composition est adaptée au plafond, avec vérification exacte de direction.
Les anciens contrats d'exception deviennent des assertions de statut et de force nulle.
Les comptes d'application passent intentionnellement de trois/deux à une.

## Limites connues

- Pas de mémoire de progression aux croisements ni de lissage des virages.
- Projection/repli historique, et non projection bornée classique.
- Pas de rebouclage canvas automatique : edges existe mais n'est pas appelée.
- Aucune limite de population : des créations nombreuses augmentent fortement le coût
  de la séparation et peuvent ralentir le navigateur.
- Canvas logique fixe 1200 × 800, redimensionné visuellement par CSS : les distances
  physiques restent dans cet espace, même sur mobile.
- Pas d'indépendance au FPS ; un pas suit le rendu p5, sauf pause.
- Wander reste la variante historique explicitement autorisée.
- Les données finies dépassant la capacité numérique peuvent être déclarées invalides.
- Validation visuelle, pointeur tactile et lisibilité mobile à confirmer dans Chrome.

## Crédits et références

Daniel Shiffman / The Coding Train, The Nature of Code :
[vidéo Path Following](https://youtu.be/LrnR6dc2IfM),
[exemple Complex Path](https://editor.p5js.org/codingtrain/sketches/2FFzvxwVt).
[Craig Reynolds — Crowd Path Following](http://www.red3d.com/cwr/steer/CrowdPath.html).
Article fourni dans le dépôt :
[Steering Behaviors for Autonomous Characters](../ARTICLE_CRAIG_REYNOLDS/Steering%20Behaviors%20For%20Autonomous%20Characters.pdf).
L'extension Snake conserve ses crédits de provenance de 3-Arrival_correction ;
aucun fichier de cet autre TD n'est chargé ou modifié.
