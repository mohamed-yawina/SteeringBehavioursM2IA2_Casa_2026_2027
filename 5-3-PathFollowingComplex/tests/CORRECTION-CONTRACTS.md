# Mise en œuvre autorisée — état actuel

Le tableau ci-dessous est conservé comme plan historique de phase 1, pas comme
description de contrats encore tous en attente. Les corrections de composition,
géométrie invalide, diagnostics, Path statique et ordre HTML sont implémentées.

Décision utilisateur explicite : Wander reste la formule historique, mais son calcul
est désormais omis à poids nul (la recommandation initiale de conserver ces tirages
est donc remplacée). Le test vérifie zéro tirage puis un tirage après activation.

Les six tests initiaux restent présents. L'attente de somme non plafonnée est adaptée
à la résultante limitée ; les contributions et la direction restent vérifiées.
Les compteurs historiques de 3/2 applications passent à 1 ; l'intégration reste unique.
Les exceptions deviennent des statuts sans force. Les sondes géométriques utilisent
les nouveaux diagnostics au lieu d'observer le dessin retiré de follow.

reference-trajectories.json n'a pas été réécrit. Trois références sont préservées
à 1e-12 ; les deux scénarios avec séparation changent volontairement. Leurs nouvelles
valeurs sont séparées dans corrected-expectations.mjs, avec oracle vectoriel de
composition et d'intégration pour tous les pas et tous les anneaux.

Le harness est limité à Node (double vectoriel et DOM simulé) ; Chrome reste à valider.

---

﻿# Références historiques et contrats à corriger

Commande : node --test 5-3-PathFollowingComplex/tests/*.test.mjs

## Statut et méthode
Cette phase ne modifie que tests/. Le code applicatif reste la source de vérité.
Les tests "historique a corriger" enregistrent des défauts observés, et ne constituent
pas des exigences permanentes. Lors de la correction autorisée, remplacer ces
assertions par le contrat indiqué ci-dessous, avec justification dans la revue.
Les six tests préexistants restent intacts, notamment les interactions et le voisinage.

Le harness charge les vrais scripts dans vm, sans recopier Vehicle ni follow.
Le double vectoriel reprend les opérations du harness préexistant ; il ne remplace
pas une validation avec p5.js réel dans Chrome. inspectFollow observe les appels
de dessin debug historiques pour récupérer F, H et la cible sans recalcul du suivi.
Il faudra remplacer cet observateur par les diagnostics exacts lors de la séparation
calcul/rendu, sans changer les résultats géométriques attendus.

## Références numériques figées
reference-trajectories.json a été capturé une fois avant toute correction applicative.
Les tests lisent ce fichier : ils ne régénèrent jamais les attentes.
Cinq étapes, chaque agent, six composantes [x,y,vx,vy,ax,ay], tolérance absolue 1e-12.
Conditions : circuit [(0,0),(160,0),(160,140),(0,140)], rayon 20,
départ (40,40), vitesse initiale historique, voisin immobile (46,42).
Serpent : trois anneaux, poids follow 1, séparation 0 ou 1.2 ; paramètres hérités
du corps conservés. Véhicule : poids follow 1, séparation 0 ou 1.2.
Wander : seul poids Wander 1. Les comportements de poids nul sont encore évalués.
Graine 246813579, LCG uint32 (1664525,1013904223), tirages non constants.
Ce générateur définit une injection de test, sans prétendre reproduire le RNG interne p5.
Scénarios : vehicle-follow, vehicle-separation, snake-follow, snake-separation, wander.

## Plan exact des corrections à autoriser
| Fichier / méthode | Actuel | Futur contrat recommandé | Invariants / tests | Trajectoire |
|---|---|---|---|---|
| vehicle.js constructeur | ms/mf explicites, anticipation et avance codées en dur dans follow | ajouter anticipationDistance=25 et targetAdvance=25, diagnostics vides ; valider les entrées sans refonte de l'intégrateur | valeurs initiales, zéro accepté, paramètres non finis rejetés ; constructeur Path avec super(0,0,0,0) | identique pour entrées valides et paramètres initiaux |
| vehicle.js findProjection | projection sur droite, direction nulle traitée comme origine | retourner un statut indéfini/null pour direction nulle ou entrées invalides | projection inclinée, non-mutation ; tests invalides | seuls cas invalides/dégénérés changent |
| vehicle.js follow | boucle fermée, anticipation spatiale, repli sur B, départage premier ; dessin inclus | préserver algorithme valide et ordre mathématique ; séparer dessin ; copies défensives de tous candidats et décision ; Infinity pour le minimum ; aucun candidat valide => force nulle/statut explicite | anticipation25, avance25, extrémités, sélection, égalité, seuil strict, vitesse nulle, absence de mutation | valide inchangé ; grandes distances cessent de lever une exception |
| vehicle.js follow, géométrie dégénérée | vide => exception ; un point et doublons traités comme points | ignorer segments nuls ; moins de deux points distincts ou aucun segment valide => projection indéfinie et force nulle ; invalidité explicite | vide, un point, doublons seuls ou mêlés à des segments valides, NaN/Infinity | changement intentionnel des cas dégénérés uniquement |
| vehicle.js applyBehaviors | 3 applications, somme pondérée non plafonnée | contributions calculées sur copies, somme limitée à maxForce, une application ; diagnostics individuels et total | convergentes/opposées/nulles, limite globale, une intégration ; ne pas muter les contributions | changement attendu quand la somme dépasse maxForce |
| vehicle.js wander (décision séparée) | force de direction directe ; theta et RNG évoluent même poids nul | séparer rendu ; conserver d'abord la formule historique ; arbitrer explicitement l'écart avec desiredVelocity-currentVelocity | référence Wander avec graine, absence de dessin dans calcul | reformuler la force changerait volontairement la trajectoire et exige une décision distincte |
| vehicle.js applyBehaviors, poids nul | Wander est évalué sans contribution physique | recommander d'abord de conserver les tirages pour isoler le plafonnement ; suppression ultérieure seulement sous contrat RNG explicite | test du nombre de tirages, références Wander ; comparaison entre agents | supprimer les tirages modifie la suite globale et les activations ultérieures |
| snakePathFollowing.js move | 2 forces par anneau non plafonnées ; mise à jour séquentielle | composer sur copies et limiter selon maxForce propre à chaque anneau ; une application, une intégration | tous anneaux, héritage, exclusion voisinage, limites et espacement ; ne pas synchroniser artificiellement les anneaux | attendu lorsque total dépasse la limite ; conserver Arrive et l'ordre tête puis corps |
| path.js constructeur | entité visible indépendante de Vehicle | Path extends Vehicle, super avec arguments finis et limites nulles ; aucune intégration, force ni steering ; points inchangés | instanceof, pos/vel/acc finis, immobilité après étapes ; édition des sommets seulement sur interaction | agents inchangés |
| index.html scripts | Path chargé avant Vehicle | Vehicle avant Path, puis segments, Snake, SnakePathFollowing, sketch | ordre et résolution des scripts, chargement sans erreur | aucune |

## Cas qui ne doivent pas être silencieusement réécrits
- Le repli historique est B puis direction suivante, pas un clamp(t,0,1).
- Les égalités et les croisements gardent le premier candidat.
- La cible peut dépasser un segment court ; aucune progression curviligne n'est ajoutée.
- La vitesse nulle donne F = position.
- Ne pas activer edges automatiquement : le parcours actuel ne l'appelle pas.
- Les références de composition fautive restent des témoins avant/après, pas des seuils
  auxquels adapter maxForce pour rendre artificiellement la correction transparente.

## Validation ultérieure
Ajouter les nouveaux tests de contrat lors des corrections, pas des tests ignorés
présentés comme une validation acquise : données défensives, absence de rendu/RNG
supplémentaire dans le renderer, entrées invalides, segments mêlés nuls/valides,
Path statique, ordre HTML et plafond des résultantes. Préserver les scénarios
numériques inchangés ; documenter et mesurer ceux affectés intentionnellement.
Les tests historiques comptant 3/2 appels applyForce et celui préexistant de somme
non bornée devront évoluer vers un appel total, tout en conservant les assertions
sur chaque contribution et l'unique intégration. Aucun changement Seek/update/edges
n'est nécessaire au premier lot. Validation Chrome encore à réaliser après implémentation.
