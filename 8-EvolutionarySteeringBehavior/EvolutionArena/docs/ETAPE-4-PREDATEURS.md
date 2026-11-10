# Étape 4 — Prédateurs autonomes et survie

Projet : **EVOLUTION ARENA — Survival of the Smartest**. Date : 25 octobre 2026.

## Périmètre et références

Les documents des étapes 2 et 3, l'architecture du dépôt et les modules de simulation, de génétique, de steering et d'interface ont été examinés avant développement. Les 62 tests existants ont été exécutés avec succès avant modification.

Le moteur conserve exactement les quatre gènes initiaux : poids nourriture, poids poison, perception nourriture et perception poison. La détection des prédateurs et l'intensité de fuite sont des **paramètres globaux non héritables** ; aucun gène supplémentaire n'est ajouté.

La base fournie `vendor/vehicle.js` n'est pas modifiée. Les nouvelles entités réutilisent `seek()`, `applyForce()` et `update()`. Les fichiers voisins du TP, d'EvoSwarm et de SmartCity ne sont pas modifiés. Aucune dépendance installée, aucun commit, push ou déploiement. Les documents des étapes 2 et 3 restent historiques. Les empreintes SHA-256 des fichiers voisins et des bibliothèques fournies relevées avant intervention sont identiques après développement.

## Fichiers créés et modifiés

| Statut | Fichier | Rôle |
| --- | --- | --- |
| Créé | `src/entities/Predator.js` | Entité héritant de Vehicle ; cible, états, énergie, Wander, Pursue et effet de capture. |
| Créé | `src/behaviors/prediction.js` | Prédiction bornée, Pursue et Evade indépendants. |
| Créé | `src/behaviors/wander.js` | Exploration continue avec angle persistant. |
| Créé | `src/predation/settings.js` | Paramètres, domaines et validation atomique. |
| Créé | `src/predation/targeting.js` | Choix des proies, protection des descendants et perception des menaces. |
| Créé | `src/predation/capture.js` | Recherche d'une victime admissible au contact, sans effet de bord. |
| Créé | `tests/predation.test.js` | 29 nouveaux tests, dont deux endurances avec prédation active. |
| Créé | `docs/ETAPE-4-PREDATEURS.md` | Ce document. |
| Modifié | `src/entities/Creature.js` | Perception de la menace et contribution Evade progressive ; ADN inchangé. |
| Modifié | `src/behaviors/steering.js` | Poids globaux et composition avec Evade, force finale limitée. |
| Modifié | `src/simulation/Simulation.js` | Cycle des prédateurs, capture atomique, compteurs, activation et troisième flux aléatoire. |
| Modifié | `src/evolution/EvolutionMetrics.js` | Copie des paramètres de prédation dans les échantillons d'expérience. |
| Modifié | `src/ui/Interface.js` | Contrôles, statistiques et case de diagnostic. |
| Modifié | `src/ui/ArenaRenderer.js` | Prédateurs distincts, rayons, prédictions, vecteurs et halo de capture. |
| Modifié | `src/main.js` | Raccordement du diagnostic au rendu et description accessible du canvas. |
| Modifié | `index.html`, `styles.css` | Panneau de prédation et statistiques de survie. |
| Modifié | `tests/helpers/runtime.js` | Éléments DOM simulés pour les nouveaux contrôles ; scénarios historiques conservés. |
| Modifié | `README.md`, `package.json` | Instructions et version 0.4. |

## Entité Predator et états

`Predator extends Vehicle` possède position, vitesse et accélération en `p5.Vector`, vitesse et force maximales, rayons de perception et de capture. Son énergie est un accesseur vers `health`, comme celle des créatures, pour éviter deux états divergents. Il ne se reproduit pas.

Les états sont explicites :

- `inactive` : prédateurs désactivés, sans mouvement, drain d'énergie, cible ou capture.
- `wander` : aucun objectif accessible ; exploration locale continue.
- `pursue` : poursuite d'une créature vivante et admissible.
- `rest` : phase initiale, délai après capture ou effectif de proies trop faible. Le prédateur continue un Wander atténué et consomme de l'énergie.
- `dead` : énergie nulle, puis retrait du tableau.

`Predator.plan()` choisit l'action et calcule la force ; `tick()` délègue la locomotion à `super.update()`. Le drain de 0,005 contenu dans la base est compensé, puis le drain explicite par seconde est appliqué, comme dans Creature. Aucune position n'est déplacée directement par un comportement.

## Détection et choix de cible

`selectPrey()` cherche la créature vivante la plus proche strictement dans le rayon de perception. Les descendants dont l'âge est inférieur à la protection des nouveau-nés sont exclus. Les fondateurs ne sont pas des nouveau-nés, même à l'initialisation.

Une cible déjà poursuivie est conservée tant qu'elle est admissible et à moins de `1,15 × rayon`. Cette hystérésis empêche les changements incessants de cible pour une petite différence de distance ou un franchissement du cercle de perception. Les candidats à l'acquisition restent limités au rayon nominal. Une cible morte, protégée ou trop éloignée est abandonnée.

`nearestThreat()` sélectionne le prédateur vivant le plus proche à l'intérieur du rayon de détection commun des créatures. Les prédateurs en repos restent des menaces physiques. Lorsque la prédation est désactivée, aucune menace n'est traitée.

## Pursue : poursuite prédictive

Le modèle fourni exprime la vitesse en **pixels par pas**, avec 60 pas fixes par seconde. Pour garder des unités cohérentes, `predictPosition()` utilise :

```text
vitesseActeurParSeconde = maxSpeed × 60
horizonSecondes = min(horizonMaximal, distanceActuelle / vitesseActeurParSeconde)
positionFuture = positionCible + vitesseCibleParPas × 60 × horizonSecondes
```

Si la vitesse maximale est nulle, l'horizon devient zéro. La cible et ses vecteurs ne sont pas modifiés. L'horizon par défaut est limité à 0,75 seconde pour éviter les anticipations excessives sur une cible lointaine.

`pursue()` appelle ensuite le **Seek fourni** sur cette position future :

```text
vitesseDésirée = normalize(positionFuture - positionPrédateur) × maxSpeed
steering = vitesseDésirée - vitesseActuelle
force = limiter(steering, maxForce)
```

Le résultat du module contient la force et la prédiction, réutilisée pour le diagnostic. La prédiction suppose une vitesse constante de la cible ; ce n'est pas une connaissance de ses décisions futures.

## Evade : fuite prédictive correcte

`evade()` prédit la position future du prédateur avec la même règle d'horizon. Il appelle ensuite `flee()` sur cette position :

```text
vitesseDésirée = normalize(positionCréature - positionFutureMenace) × maxSpeed
steering = vitesseDésirée - vitesseActuelle
force = limiter(steering, maxForce)
```

On inverse la direction de la **vitesse désirée**, jamais toute la force Pursue. En effet, `-(desired - velocity)` contient `+velocity`, alors qu'Evade doit toujours contenir `-velocity`. Un test avec une vitesse transverse vérifie précisément cette différence.

À position confondue et vitesse nulle, le résultat reste fini ; il ne crée pas une direction aléatoire instantanée. Les règles de contact, les pas suivants et le mouvement des autres agents résolvent cette situation.

## Combinaison des forces et stabilité

La recherche de nourriture et l'évitement du poison conservent les poids signés de l'ADN : un poids positif attire avec Seek, un poids négatif repousse avec Flee. Les multiplicateurs globaux nourriture/poison ne remplacent pas ces gènes ; ils modulent leur contribution, avec ou sans prédateurs.

La contribution Evade augmente progressivement lorsque la menace approche :

```text
p = 1 - distanceMenace / rayonDétection
proximité = p² × (3 - 2p)
fuiteCible = forceEvade × intensitéGlobale × proximité
alpha = 1 - exp(-pasSecondes / tempsDeLissage)
fuiteLissée = (1 - alpha) × fuiteLisséePrécédente + alpha × fuiteCible
```

Si aucune menace n'est détectée, la contribution lissée décroît vers zéro. Seule cette contribution est filtrée : hors menace, la dynamique de recherche de nourriture reste celle de l'étape 3. Les vitesses ne sont jamais réinitialisées pour simuler une fuite.

Dans `combinedForce()` :

```text
forceTotale = poidsGlobalNourriture × forceNourritureGénétique
            + poidsGlobalPoison × forcePoisonGénétique
            + fuiteLissée
forceAppliquée = limiter(forceTotale, maxForce)
```

Chaque comportement de base retourne une force limitée. La pondération peut produire des contributions intermédiaires plus fortes ; la somme finale est de nouveau limitée avant `applyForce()`. Aux bords, la force de confinement garde la priorité. Il s'agit d'un confinement par steering : une courte sortie visuelle pendant un demi-tour reste possible, comme auparavant.

Le poids zéro met progressivement fin à une fuite déjà filtrée. Désactiver les prédateurs efface immédiatement la mémoire de menace. Les réglages ne changent aucun des quatre gènes.

## Wander

`wander()` conserve `wanderAngle` et le fait dériver par une petite variation uniforme de ±0,08 radian par pas. Il construit une cible sur un cercle de rayon 22 pixels, centré 35 pixels devant le véhicule, puis réutilise Seek. Ce n'est pas une nouvelle direction complètement aléatoire à chaque image.

Un prédateur immobile utilise une direction avant de référence pour construire ce cercle, sans division par zéro. Les tirages de Wander viennent du flux aléatoire dédié aux prédateurs.

## Capture et conséquences

`captureCandidate()` exige : prédation active, simulation non suspendue, prédateur vivant en état `pursue`, grâce initiale terminée, délai de capture écoulé, effectif strictement supérieur au seuil de protection, cible vivante et non protégée. La distance au centre de la cible doit être **strictement inférieure** au rayon de capture.

`Simulation.tryCapture()` applique ensuite toutes les conséquences dans une opération séquentielle :

1. Retrouver la victime encore présente dans le tableau.
2. Mettre son énergie à zéro et sa cause de mort à `predator`.
3. Enregistrer une seule vie terminée dans les métriques et retirer immédiatement la créature.
4. Incrémenter morts totales, captures et morts par prédation, une fois chacune.
5. Restaurer l'énergie du prédateur, plafonnée à son maximum ; lancer son délai de repos et un halo de 0,6 seconde à la position copiée de la victime.

Un second prédateur visant la même créature ne la retrouve plus et ne peut ni la recompter ni gagner de l'énergie. Chaque prédateur capture au plus une créature avant son délai. Le seuil de proies est revérifié pour chaque capture, y compris lorsque plusieurs prédateurs sont au contact au même pas.

La capture est létale, sans système de points de dégâts intermédiaires ni création de nourriture. La créature capturée ne se reproduit pas ensuite. La collision est discrète aux positions du pas fixe ; ce n'est pas un moteur de collisions continues.

## Ordre du pas de simulation

`Simulation.step()` conserve le pas fixe de 1/60 s :

1. Prédateurs : perception, sélection et calcul des forces à partir de l'état disponible.
2. Créatures : consommation, steering composé, locomotion, âge et retrait des morts naturels.
3. Prédateurs : locomotion, drain d'énergie, mise à jour des délais/effets et retrait des morts de faim.
4. Captures sur les positions après déplacement, avec retrait immédiat des victimes.
5. Reproduction des créatures survivantes uniquement.
6. Renouvellement des ressources et échantillonnage des statistiques.

Les décisions restent locales et réactives. Les créatures lisent les positions de prédateurs avant leur déplacement de ce pas. Le parcours est séquentiel : des biais d'ordre restent possibles lorsque plusieurs prédateurs partagent une cible. Aucun nouveau-né n'agit durant son pas de naissance.

## Paramètres

Les valeurs sont centralisées et validées dans `predation/settings.js`.

| Paramètre | Défaut | Domaine moteur / remarque |
| --- | --- | --- |
| `enabled` | false | Booléen ; témoin sans prédation au lancement |
| `count` | 2 | Entier de 0 à 8 ; effectif demandé |
| `speed` | 2,4 px/pas | 0,2 à 4 ; créatures à 2,8 par défaut |
| `maxForce` | 0,14 | 0,01 à 0,3 |
| `perceptionRadius` | 160 px | 40 à 350 |
| `captureRadius` | 9 px | 3 à 24 ; distance entre centres |
| `evadeWeight` | 2 | 0 à 5 |
| `foodWeight`, `poisonWeight` | 1 | 0 à 3 ; actifs aussi dans le témoin |
| `preyPerception` | 140 px | 40 à 350 ; commun à toutes les créatures, pas un gène |
| `smoothingSeconds` | 0,12 s | 0,05 à 1 |
| `maxPredictionSeconds` | 0,75 s | 0 à 2 |
| Énergie initiale / maximale | 1 / 1,5 | Propriétés de Predator |
| `energyDrain` | 0,015/s | 0 à 1/s |
| `captureEnergy` | +0,45 | 0 à 1,5, gain plafonné |
| `captureCooldown` | 4 s | 0,2 à 30 s |
| `spawnGrace` | 3 s | 0 à 20 s ; chaque nouveau prédateur |
| `newbornProtection` | 1,5 s | 0 à 20 s ; descendants seulement |
| `minimumPrey` | 6 | Entier de 0 à 1000 ; arrête la chasse à cet effectif |

L'interface expose les cinq sliders demandés et les deux poids globaux nourriture/poison. Les autres réglages sont accessibles par la configuration du moteur. Les domaines sont vérifiés avant application ; une configuration invalide n'est pas partiellement appliquée.

Ces garde-fous limitent l'extermination rapide par capture. Ils n'empêchent pas une extinction naturelle par énergie ou poison, et ne garantissent pas un équilibre écologique. Les réglages extrêmes restent des expériences plus sévères.

## Activation, effectif, énergie et mémoire

Le pool initial contient les deux prédateurs demandés, mais ils restent inactifs et invisibles tant que la case n'est pas cochée. Désactiver les prédateurs fige leurs positions, énergie, âge, délais et effets, efface leurs cibles et désactive Evade. Réactiver les reprend sans rendre gratuitement de l'énergie aux survivants.

Un prédateur dont l'énergie atteint zéro disparaît et incrémente `predatorsStarved`, sans être compté parmi les morts de créatures. Il n'est **pas remplacé automatiquement** pendant les pas suivants. L'effectif présent peut donc devenir inférieur à l'effectif demandé. Modifier sa vitesse ne le recrée pas.

Un changement explicite du nombre, un reset ou une réactivation resynchronise le pool avec le nombre demandé ; cela peut créer de nouveaux prédateurs. Les boutons Ajouter/Retirer visent l'effectif effectivement présent ±1 et respectent la limite de 8. Ces actions sont comptées comme interventions expérimentales.

Les effets sont de simples champs temporaires, pas des listes qui s'accumulent. Les cibles sont des IDs, les projections sont des vecteurs copiés. L'historique scientifique reste limité à 600 échantillons et copie les paramètres de prédation sans conserver de créatures mortes.

## Statistiques et visualisation

- **Prédateurs actifs** : prédateurs vivants présents lorsque la prédation est activée.
- **Attaques** : nouvelles poursuites engagées, à l'acquisition ou au changement de cible. Une poursuite sur 60 images ne fait pas 60 attaques. Ce compteur ne représente pas des contacts physiques ou des dégâts.
- **Captures** et **morts par prédation** : identiques ici, puisque chaque capture est létale.
- **Morts totales** : toutes les créatures mortes, y compris celles capturées, sans double compte.
- **Survie moyenne** : âge moyen des vies de créatures terminées, toutes causes confondues. Les vivants ne sont pas inclus ; ce n'est pas une estimation corrigée de la censure.
- Population, naissances, ADN, diversité et consommation de l'étape 3 restent disponibles.

Les prédateurs ont une grande silhouette rouge orangé à deux triangles et une barre d'énergie. Leur repos apparaît plus terne. Le halo de capture se développe à l'emplacement de la victime puis disparaît. Les couleurs de génération des créatures sont conservées.

Le diagnostic affiche les cercles de perception et de capture du prédateur, la cible actuelle, sa projection linéaire et la force Pursue. Pour les créatures menacées, il montre le rayon commun de détection, la position prédite de la menace et le vecteur Evade brut. Les vecteurs sont amplifiés graphiquement ×240 ; ce ne sont pas des déplacements appliqués. L'interface garde ces éléments facultatifs pour éviter de surcharger le rendu.

## Mode scientifique

Le moteur ajoute un troisième flux déterministe dérivé de la graine pour les positions et le Wander des prédateurs. Il n'avance pas les flux de l'environnement ou de la génétique. Avec la même graine, les fondateurs et les ressources initiales sont identiques avec ou sans prédateurs. Avec paramètres et interactions identiques, les événements sont reproductibles, hors IDs d'expérience volontairement renouvelés après reset.

Les paramètres de prédation sont copiés dans `EvolutionMetrics.history` à chaque échantillon et changement de configuration. Sélection et diagnostics n'influencent pas les forces. Les interventions manuelles et les réglages sont comptés ; pour comparer, choisir les paramètres puis réinitialiser et ne plus intervenir.

Les quatre gènes n'encodent pas Evade : ils peuvent subir une pression de sélection indirecte via l'alimentation, les positions fréquentées et la survie. Des captures, davantage de générations ou une modification des moyennes génétiques ne démontrent pas une adaptation. Une comparaison multi-graines, à environnement et durée contrôlés, puis une évaluation commune d'ADN fondateurs et descendants seraient nécessaires. Ces étapes d'inférence ne sont pas réalisées ici.

## Tests réalisés

Commande :

```powershell
node --test tests/*.test.js
```

**Résultat final sous Node.js v24.18.0 : 91 tests exécutés, 91 réussites, 0 échec et 0 test ignoré.**

La suite conserve les **62 tests précédents** et ajoute **29 tests** de prédation. Ils couvrent héritage de Vehicle, détection et sélection, hystérésis, prédictions et unités, Pursue/Evade, cas confondus, composition et lissage, Wander continu, états, capture et doublons, seuil collectif, capture avant reproduction, énergie/faim, activation, pause, limites d'effectif, paramètres invalides, graines, reset, UI et arguments numériques du rendu.

Deux endurances supplémentaires exécutent **20 000 pas chacune avec prédateurs et reproduction actifs**, dans les modes Arena et TP. Elles vérifient vecteurs/énergies/âges finis, vitesses bornées, quatre gènes, plafonds d'effectif, compteurs de capture, conservation `fondateurs + naissances - morts = population`, et historique borné. Les anciens tests d'endurance sans prédateurs restent présents.

Les exemples suivants ont été exécutés sous Node avec la graine 2026 :

| Scénario | Population finale | Naissances | Morts totales | Captures | Attaques | Prédateurs actifs |
| --- | --- | --- | --- | --- | --- | --- |
| Défauts, 120 s, sans prédateurs | 18 | 38 | 56 | 0 | 0 | 0 |
| Défauts, 120 s, avec prédateurs | 9 | 32 | 59 | 21 | 26 | 2 |
| Stress Arena, 20 000 pas | 100 | 259 | 199 | 181 | 186 | 3 |
| Stress TP, 20 000 pas | 100 | 228 | 168 | 168 | 171 | 3 |

Stress : 40 fondateurs, 100 nourritures initiales, flux alimentaire 5/s, aucun poison, drain créature 0,002/s ; reproduction 0,03/pas, seuil 0,4, coût 0,2, âge 0,2 s, délai 1 s, population maximale 100 ; 3 prédateurs à vitesse 3, perception 220 px, capture 12 px et drain 0,002/s. Les autres valeurs sont celles par défaut. Ces réglages accélérés servent aux tests de stabilité.

Ce tableau est une vérification du fonctionnement, pas une preuve d'adaptation. Par exemple, la survie moyenne des morts peut augmenter malgré les captures à cause de la composition des populations : il ne faut pas lire une moyenne isolée comme un gain de performance.

### Limite de validation réelle

Les outils ont répondu « No browser is available » puis une liste vide lors de la connexion au navigateur. Aucun rendu visuel réel, aucune fluidité ni console navigateur n'ont donc été vérifiés. Les tests utilisent le Vehicle fourni, avec une doublure minimale de p5.Vector et du DOM ; ils ne remplacent pas une exécution avec le vrai p5. Les tests HTTP, de syntaxe et de présence des éléments dans le HTML restent exécutés.

## Lancement et validation dans le navigateur

```powershell
cd "C:\Users\Simo\Desktop\SteeringBehavioursM2IA2_Casa_2026_2027\8-EvolutionarySteeringBehavior\EvolutionArena"
node tools/serve.mjs
```

Ouvrir **http://127.0.0.1:8088**. Ctrl+C arrête le serveur ; aucune installation n'est nécessaire.

1. Laisser les prédateurs désactivés, choisir graine 2026 et mode Arena, puis appliquer la graine et réinitialiser. Vérifier zéro prédateur actif, zéro attaque et zéro capture. Les fonctionnalités des étapes 2 et 3 restent utilisables.
2. Cocher « Activer les prédateurs », garder les valeurs par défaut et réinitialiser avec la même graine. Observer les silhouettes rouge orangé ; elles ne chassent pas pendant leurs trois premières secondes.
3. Activer le diagnostic. Vérifier rayon nominal, cible, projection et vecteur Pursue ; observer les vecteurs Evade des créatures proches. Les trajectoires doivent rester issues de corrections de vitesse continues.
4. Laisser tourner 30 à 60 secondes. Les captures doivent retirer une seule victime, afficher un halo, augmenter les morts par prédation et l'énergie du chasseur. Les captures ne doivent pas se répéter immédiatement pour le même prédateur.
5. Tester les cinq sliders, puis Ajouter/Retirer. Une vitesse proche de 3 et une perception de 220 facilitent l'observation, mais constituent une autre expérience que les valeurs par défaut. Les poids nourriture/poison doivent continuer d'agir sur la composition.
6. Mettre en pause : positions, énergie, délais et halos doivent rester figés. La sélection d'une créature et son panneau génétique doivent fonctionner. Reprendre sans rattraper la durée de pause.
7. Décocher l'activation : aucun prédateur actif, aucune capture supplémentaire ; les prédateurs restent conservés mais invisibles et ne dépensent plus d'énergie. Réactiver reprend les survivants ; un reset recrée l'état initial et remet les compteurs à zéro.
8. Comparer avec/sans prédateurs à temps simulé égal, mêmes réglages et plusieurs graines, sans clics d'ajout de ressources. Consigner aussi naissances, morts, diversité, durée de vie et consommation ; ne conclure à aucune adaptation à partir des seules captures.
9. Vérifier dans la console du navigateur l'absence d'erreurs et examiner l'affichage sur une fenêtre étroite : ces vérifications visuelles n'ont pas été possibles dans cette session.

Le développement s'arrête à l'étape 4, dans l'attente de validation.
