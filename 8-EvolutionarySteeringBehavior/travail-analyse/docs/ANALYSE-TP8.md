# TP 8 — Analyse préalable à EVOLUTION ARENA

Date : 25 octobre 2026. Périmètre : analyse uniquement, sans développement du jeu.

## Sources et méthode

Le TP est disponible localement dans `8-EvolutionarySteeringBehavior`, au sein du dépôt du cours. Aucun clonage n'est nécessaire. Le remote `origin` désigne le [dépôt de Michel Buffa](https://github.com/micbuffa/SteeringBehavioursM2IA2_Casa_2026_2027).

**Attention : les fichiers actuellement ouverts sur disque ne sont plus le TP original.** `index.html`, `sketch.js`, `style.css` et `vehicle.js` sont déjà modifiés ; plusieurs fichiers non suivis constituent une extension appelée EvoSwarm. Ces modifications préexistent à cette analyse et ont été conservées.

La référence de cette analyse est donc la version enregistrée dans Git au commit `b7790773543acf9fb73160428f24d376acee57ab`, daté du 17 octobre 2026, consultée avec `git show HEAD:8-EvolutionarySteeringBehavior/<fichier>`. Il s'agit de la référence locale disponible, sans prétendre qu'elle représente la dernière version distante : la consultation de la page GitHub a échoué. Les noms de fichiers et fonctions ci-dessous désignent cette version Git, sauf mention « copie actuelle ».

Pour consulter la bonne source sans restaurer ni écraser un fichier :

```powershell
git show b7790773543acf9fb73160428f24d376acee57ab:8-EvolutionarySteeringBehavior/vehicle.js
git show b7790773543acf9fb73160428f24d376acee57ab:8-EvolutionarySteeringBehavior/sketch.js
```

Les consignes `AGENTS.md` et `ARCHITECTURE.md` à la racine du dépôt ont été lues. Référence conceptuelle prescrite : Craig W. Reynolds, « Steering Behaviors for Autonomous Characters », GDC 1999, PDF local dans `ARTICLE_CRAIG_REYNOLDS`. Son extraction n'a pas été possible avec la commande disponible (`python` absent du PATH) ; aucune citation de page ni lecture intégrale du PDF n'est revendiquée. Les formules présentées ici sont vérifiées directement dans le code.

Ce document est isolé dans `travail-analyse/docs/`, dossier de travail documentaire à l'intérieur du seul espace autorisé en écriture. Aucun fichier source existant n'est modifié. Les liens vers la version de référence utilisent le commit pour éviter de pointer vers le code local déjà transformé.

## A. Architecture du TP 8 original

```text
8-EvolutionarySteeringBehavior/
├── index.html
├── style.css
├── sketch.js
├── vehicle.js
├── jsconfig.json
└── libraries/
    ├── p5.min.js
    └── p5.sound.min.js
```

| Fichier original | Responsabilité |
| --- | --- |
| `index.html` | Charge le CSS, p5.js, p5.sound, puis `vehicle.js` et `sketch.js`. Le corps est vide : p5 crée le canvas et l'interface. |
| `style.css` | Retire marges et padding de la page ; affiche le canvas en bloc. |
| `sketch.js` | État global, interface, initialisation, boucle, apparition et dessin des ressources, gestion des naissances et morts, interactions. |
| `vehicle.js` | Classe `Vehicle` : état physique, santé, ADN, steering, consommation, reproduction, mort et dessin. Variable globale `mr` pour la mutation. |
| `jsconfig.json` | Configuration JavaScript ES6 pour l'éditeur ; chemin de types p5 spécifique à la machine de l'auteur. Ce n'est ni un lanceur de tests ni une configuration de compilation nécessaire au navigateur. |
| `libraries/*.js` | Bibliothèques fournies. Le code applicatif original examiné n'utilise pas les fonctions audio de p5.sound. |

Sources : [index.html original](https://github.com/micbuffa/SteeringBehavioursM2IA2_Casa_2026_2027/blob/b7790773543acf9fb73160428f24d376acee57ab/8-EvolutionarySteeringBehavior/index.html), [sketch.js original](https://github.com/micbuffa/SteeringBehavioursM2IA2_Casa_2026_2027/blob/b7790773543acf9fb73160428f24d376acee57ab/8-EvolutionarySteeringBehavior/sketch.js), [vehicle.js original](https://github.com/micbuffa/SteeringBehavioursM2IA2_Casa_2026_2027/blob/b7790773543acf9fb73160428f24d376acee57ab/8-EvolutionarySteeringBehavior/vehicle.js). Ces liens identifient les sources ; l'analyse repose sur leurs objets Git locaux.

### Classes et responsabilités

L'application originale ne définit qu'une classe : `Vehicle`. Son constructeur initialise `pos`, `vel`, `acc`, `health`, les paramètres physiques et les quatre gènes. `eat()` assure à la fois perception et consommation ; `seek()` calcule une force ; `behaviors()` combine les forces ; `boundaries()` applique un confinement ; `applyForce()` et `update()` réalisent la locomotion ; `clone()` crée éventuellement un descendant ; `dead()` teste la santé ; `display()` dessine l'individu et ses informations de debug. Source : `vehicle.js`, méthodes citées.

La nourriture et le poison sont des `p5.Vector` rangés dans deux tableaux, pas des classes d'entités. `vehicles` contient des `Vehicle`. Source : `sketch.js`, déclarations globales, `initSimulation()` et `draw()`.

Cette représentation originale des ressources ne satisfait pas la nouvelle consigne « toute entité visible étend Vehicle ». Il s'agit d'un constat sur le TP fourni ; une future architecture devra traiter ce point sans réécrire silencieusement le fichier protégé.

### Différence avec la copie actuelle

Sur disque, `README.md`, `behavior_manager.js`, `behaviors.js`, `predator.js`, `powerup.js`, `vehicle_variants.js` et `game.js` sont des ajouts locaux, absents de l'arbre Git de référence. Le `vehicle.js` actuel contient notamment six gènes, des mutations gaussiennes bornées et `reproduce()` avec seuils de santé et d'âge. Ce ne sont **pas** les mécanismes originaux décrits dans les sections suivantes.

Le `index.html` actuel charge `game.js` et ne charge pas `sketch.js`. Il ne faut donc pas déduire le comportement exécuté actuellement de la seule lecture du `sketch.js` présent sur disque. L'extension locale n'a pas fait l'objet d'un audit fonctionnel complet dans cette étape.

## B. Fonctionnement de la simulation originale

`setup()` crée un canvas de la taille de la fenêtre, appelle `afficheGUI()`, puis `initSimulation()`. Cette dernière crée 50 individus, 40 points de nourriture et 20 points de poison à positions aléatoires, et remet les probabilités d'apparition à 0,2 et 0,01. Source : `sketch.js`, fonctions citées.

À chaque appel de `draw()` :

1. Effacement du fond et affichage des compteurs.
2. Ajout éventuel d'un point de nourriture et d'un point de poison, suivant deux tirages indépendants et les curseurs.
3. Dessin des ressources : vert pour la nourriture, rouge pour le poison.
4. Parcours inverse des véhicules : `boundaries()`, `behaviors(food, poison)`, `update()`, `display()`, `clone()`, puis `dead()`.
5. Ajout du descendant si le clonage réussit ; retrait du mort et création d'un point de nourriture à sa position.

Source : `sketch.js`, `draw()`. Le parcours inverse permet les suppressions sans sauter un individu. Un descendant ajouté en fin de tableau n'est pas traité pendant ce même passage.

`mouseDragged()` ajoute un individu à ADN entièrement aléatoire ; `keyPressed()` bascule le debug avec D ; le bouton de `afficheGUI()` réinitialise la simulation. Le debug représente les poids par des segments et les perceptions par des cercles ; la couleur du véhicule dépend de sa santé. Sources : `sketch.js`, fonctions citées ; `vehicle.js`, `display()`.

### Détection et consommation

`Vehicle.eat(list, nutrition, perception)` examine toute la liste en sens inverse et calcule la distance euclidienne à chaque élément :

- Si `d < 5` pixels, l'élément est supprimé et sa valeur nutritive est ajoutée à la santé.
- Sinon, parmi les éléments vérifiant `d < perception`, le plus proche est retenu.
- S'il existe une cible, la méthode retourne `seek(closest)` ; sinon, un vecteur nul.

Le rayon de consommation est une constante littérale 5 : malgré le commentaire, il n'est pas calculé depuis `maxSpeed`. Les comparaisons sont strictes : à exactement 5 pixels, pas de consommation ; à exactement la perception, pas de détection. La consommation ne dépend pas du rayon de perception : un individu peut absorber un élément proche même avec une perception nulle ou négative. Plusieurs ressources peuvent être consommées pendant un seul appel. Source : `vehicle.js`, `eat()`.

La perception est omnidirectionnelle, sans angle de vue, obstacle ni mémoire. Le poison est détecté selon la même recherche que la nourriture. Il n'est pas automatiquement évité : le signe de son poids génétique décide de l'attraction ou de la répulsion. Source : `vehicle.js`, `eat()` et `behaviors()`.

## C. Algorithmes génétiques : ADN, hérédité et sélection

### Quatre gènes réels

| Indice | Signification | Initialisation sans parent | Mutation possible |
| --- | --- | --- | --- |
| `dna[0]` | Poids du Seek nourriture | `random(-2, 2)` | Ajout uniforme entre -0,1 et 0,1 |
| `dna[1]` | Poids du Seek poison | `random(-2, 2)` | Ajout uniforme entre -0,1 et 0,1 |
| `dna[2]` | Rayon de perception nourriture, en pixels | `random(0, 100)` | Ajout uniforme entre -10 et 10 |
| `dna[3]` | Rayon de perception poison, en pixels | `random(0, 100)` | Ajout uniforme entre -10 et 10 |

Source : `vehicle.js`, `constructor()` et `mr = 0.01`. Les bornes supérieures de `random(min, max)` sont exclues selon l'API p5 ; aucune valeur n'est arrondie à un entier.

Un poids positif attire, un poids négatif inverse la force calculée, et un poids nul annule ce comportement. Le génotype est ce tableau de nombres ; le phénotype observable est la manière de rechercher les ressources et de se déplacer, résultant aussi de l'environnement. Sources : `Vehicle.constructor()`, `behaviors()` et `eat()`.

### Mutations

Quand un ADN parental est fourni au constructeur, ses quatre valeurs sont copiées dans un nouveau tableau. Chaque gène subit un tirage indépendant avec une probabilité de 1 %. Une naissance ne signifie donc pas nécessairement mutation. Sous cette indépendance, la probabilité théorique d'au moins une mutation est `1 - 0,99^4 ≈ 3,94 %`. Les perturbations sont **uniformes**, pas gaussiennes. Aucun bornage après mutation n'empêche les poids de dépasser les intervalles initiaux ni les perceptions de devenir négatives. Source : `vehicle.js`, `constructor()`.

### Sélection naturelle implicite

Il n'y a ni fonction explicite de fitness, ni classement, ni tournoi, ni croisement, ni remplacement par générations synchronisées. Les individus coexistent et se reproduisent pendant leur vie. Ceux qui vivent plus longtemps bénéficient de davantage d'essais de clonage ; leurs gènes peuvent donc devenir plus fréquents. La disponibilité des ressources et la compétition pour leur consommation constituent la pression de sélection. Sources : `sketch.js`, `draw()` ; `vehicle.js`, `clone()`, `eat()`, `update()` et `dead()`.

Ce mécanisme ne garantit pas que chaque génération soit meilleure. Le hasard des positions, les mutations et les ressources rencontrées influencent aussi la descendance. « Smartest » sera un titre de jeu : le TP ne contient ni réseau neuronal ni apprentissage individuel. Source : état et règles de `Vehicle`, sans mécanisme d'apprentissage dans les deux fichiers applicatifs originaux.

## D. Forces de direction et locomotion

### Seek

`Vehicle.seek(target)` effectue les opérations suivantes avec `p5.Vector` :

```text
direction = target - pos
desiredVelocity = direction mise à la norme maxSpeed
steering = desiredVelocity - vel
steering limitée à maxForce
```

Les paramètres originaux sont `maxSpeed = 5` et `maxForce = 0.5`. Par exemple, avec une vitesse actuelle `(0, -2)` et une cible située à droite, la vitesse désirée est `(5, 0)`. La correction brute `(5, 2)` est limitée à une norme de 0,5. Elle modifie progressivement la vitesse, sans téléporter le véhicule. Source : `vehicle.js`, `constructor()` et `seek()`.

Seek n'est pas Arrive : il demande la vitesse maximale quelle que soit la distance. La consommation à proximité retire la cible ; aucun ralentissement anticipé n'est prévu. Sources : `seek()` et `eat()`.

### Composition et répulsion

`behaviors()` appelle `eat(food, 0.2, dna[2])` et `eat(poison, -1, dna[3])`, multiplie leurs résultats par les poids associés, puis les transmet à `applyForce()`. `boundaries()` a déjà ajouté sa propre force. Ainsi :

```text
acc = forceBords + dna[0] × seekNourriture + dna[1] × seekPoison
```

Les termes de Seek sont limités **avant pondération**. Il n'existe pas de limitation finale de cette somme : un poids de 2 peut porter un terme à une norme de 1, supérieure à `maxForce`. C'est une limite importante pour les futures règles de composition. Sources : `vehicle.js`, `behaviors()`, `boundaries()` et `applyForce()`.

Inverser Seek n'est pas exactement Flee. Avant limitation, Seek donne `desired - vel` ; son opposé donne `-desired + vel`, alors qu'une fuite construite en inversant la vitesse désirée donne `-desired - vel`. L'inversion génétique produit bien une répulsion, mais peut réagir différemment selon la vitesse actuelle. Le TP ne définit aucune méthode `flee()`. Sources : `seek()` et `behaviors()`.

### Application du mouvement

`applyForce(force)` additionne la force à l'accélération, sans masse explicite. `update()` retire 0,005 de santé, additionne l'accélération à la vitesse, limite celle-ci à 5, avance la position puis remet l'accélération à zéro. La santé ne réduit pas directement la vitesse maximale. Sources : `Vehicle.applyForce()` et `update()`.

`boundaries()` construit une vitesse désirée vers l'intérieur quand la position dépasse une marge de 25 pixels, calcule la différence avec la vitesse actuelle, limite cette force et l'applique. C'est une correction réactive, pas une barrière physique : des sorties temporaires restent possibles. Aux coins, la correction verticale remplace la vitesse désirée calculée pour le bord horizontal. Source : `Vehicle.boundaries()`.

## E. Reproduction, naissances et morts

`clone()` retourne `new Vehicle(pos.x, pos.y, dna)` si `random(1) < 0.002`, sinon `null`. La probabilité est **0,2 % par individu et par image**, et non 0,002 % comme l'indique un commentaire de `sketch.js`. La reproduction est asexuée : un seul parent et aucune recombinaison. Source : `Vehicle.clone()`.

Le descendant reçoit une copie éventuellement mutée des quatre gènes, la position actuelle du parent, une santé neuve de 1 et la vitesse initiale `(0, -2)`. Il n'hérite pas de la santé, de la vitesse ou de l'accélération du parent. Le parent ne paie aucun coût ; aucun âge, délai ou seuil de santé n'est vérifié. Sources : `Vehicle.clone()` et `constructor()`.

À cadence constante de 60 images/s, le taux moyen est 0,12 naissance par seconde et par individu continuellement présent. Sur 200 essais, la probabilité d'au moins un clonage est `1 - 0,998^200 ≈ 33 %`. Ce calcul décrit le tirage, sans prédire la survie effective d'un individu. Sources des constantes : `clone()` et `update()`.

La santé obéit à ces règles :

| Événement | Effet | Source |
| --- | --- | --- |
| Construction | `health = 1` | `Vehicle.constructor()` |
| Chaque mise à jour | `health -= 0.005` | `Vehicle.update()` |
| Nourriture consommée | `health += 0.2` par élément | `behaviors()` et `eat()` |
| Poison consommé | `health -= 1` par élément | `behaviors()` et `eat()` |
| Mort | `health <= 0` | `Vehicle.dead()` |

Sans alimentation, la durée théorique est d'environ 200 mises à jour, soit 3,33 secondes à 60 images/s. La cadence réelle peut varier. Un poison n'est pas toujours fatal : la santé peut dépasser 1 et permettre d'en absorber un. Sources : `update()`, `eat()` et absence de plafond dans ces méthodes.

L'ordre de `draw()` autorise un clonage après que la santé est devenue nulle ou négative, puisque `clone()` précède le retrait par `dead()`. Un mort devient un point de nourriture, pas une transmission explicite de son énergie résiduelle. Il n'y a pas de redémarrage automatique après extinction : l'utilisateur peut ajouter des individus par glissement ou réinitialiser. Source : `sketch.js`, `draw()`, `mouseDragged()` et `initSimulation()`.

## F. Limites et problèmes éventuels

| Constat original | Conséquence ou point de vigilance | Référence |
| --- | --- | --- |
| Énergie, apparition des ressources et clonage mesurés par image | Une cadence différente change la vitesse de simulation en temps réel. | `sketch.js:draw()`, `Vehicle.update()`, `clone()` |
| Aucun coût ou seuil de reproduction ; enfant à santé pleine | La reproduction crée une réserve de santé supplémentaire ; le modèle ne conserve pas l'énergie. | `Vehicle.clone()`, `constructor()` |
| Clonage avant retrait des morts | Un individu en état de mort peut encore donner un descendant. | `sketch.js:draw()` |
| ADN non borné | Perceptions négatives, valeurs extrêmes et forces pondérées excessives possibles. | `Vehicle.constructor()`, `behaviors()` |
| Pas de limite sur les tableaux | Accumulation possible de ressources et croissance de population ; risque de ralentissement. | `sketch.js:draw()`, `mouseDragged()` |
| Recherche complète pour chaque individu | Coût de perception d'ordre `N × (F + P)` par image, hors suppressions de tableaux ; pas d'index spatial. | `Vehicle.eat()`, `sketch.js:draw()` |
| Ressources consommées immédiatement pendant le parcours | L'ordre des véhicules avantage ceux traités en premier lors d'une concurrence locale. | `Vehicle.eat()`, boucle inverse de `draw()` |
| Confinement par force et sans priorité | Les autres forces peuvent contrer le retour ; pas de garantie stricte de maintien dans le canvas. | `Vehicle.boundaries()`, `behaviors()` |
| Pas de séparation entre individus | Superpositions possibles, notamment à la naissance. | `Vehicle.clone()`, `behaviors()` |
| Pas d'historique, de lignées ou de statistiques génétiques | L'évolution est visible mais difficile à mesurer rigoureusement. | État de `sketch.js`, `Vehicle.constructor()` |
| Aléatoire non fixé et aucun lanceur de tests dans l'exemple original | Expériences non reproductibles par défaut ; règles non couvertes automatiquement. | Arbre Git, appels `random()` dans les deux fichiers JS |
| Logique, interface et affichage imbriqués | Extension et tests plus difficiles. | `sketch.js:draw()`, `Vehicle.eat()` et `display()` |

Le texte de l'interface « se clone quand il a vécu assez longtemps » décrit un effet statistique, pas un seuil d'âge codé. De même, « repoussés par le poison » n'est vrai que pour un poids poison négatif. Sources : `sketch.js:afficheGUI()` et `draw()` ; `Vehicle.clone()` et `behaviors()`.

## G. Propositions pour EVOLUTION ARENA — à ajouter après validation

Les éléments de cette section sont des **propositions**, pas des fonctionnalités du TP original. Certains ont des équivalents dans l'extension locale EvoSwarm ; leur présence sur disque ne vaut ni validation ni décision de les reprendre.

| Proposition | But pédagogique ou ludique | Point de départ original |
| --- | --- | --- |
| Inspecteur d'individu : quatre gènes, forces, santé et cible | Comprendre le lien ADN → perception → action → survie. | `Vehicle.display()`, `eat()`, `behaviors()` |
| Compteurs de naissances/morts et courbes de distributions des gènes | Mesurer la sélection ; conserver aussi la diversité, pas seulement les moyennes. | `sketch.js:draw()`, `Vehicle.clone()` |
| Graine aléatoire et pas de simulation fixe | Comparer deux expériences dans des conditions maîtrisées. | `initSimulation()`, `draw()`, `update()` |
| Politique de reproduction explicite | Examiner séparément les effets d'un coût, d'un âge minimal et d'un seuil d'énergie. | `clone()` et son emplacement dans `draw()` |
| Politique de mutation bornée et configurable | Éviter les rayons négatifs ; comparer taux et amplitudes de mutation. | `Vehicle.constructor()` |
| Composition des forces contrôlée, puis séparation si utile | Rendre les limites physiques lisibles et réduire les superpositions. | `behaviors()`, `applyForce()`, `boundaries()` |
| Scénarios de rareté et objectifs de survie | Donner au joueur des décisions sur l'environnement tout en gardant le mouvement autonome. | Curseurs de `afficheGUI()` et génération dans `draw()` |
| Prédateurs et nouveaux gènes, dans une étape ultérieure | Ajouter une pression de sélection seulement après compréhension du modèle à quatre gènes. | Extension conceptuelle de `eat()` et `behaviors()` |

La simulation doit continuer à produire les déplacements par forces locales. Aucun déplacement scénarisé à la main ne doit remplacer Seek et la locomotion. Les nouvelles entités visibles devront chacune avoir leur propre fichier et étendre `Vehicle`, conformément aux consignes locales. Un contrôleur ou des modules de comportement indépendants pourront organiser la composition.

Le fichier `vehicle.js` est protégé. Une future sous-classe doit réutiliser ses méthodes et déléguer les forces à `applyForce()` ainsi que la locomotion à l'implémentation existante. Tout besoin de modifier cette base exigera un accord explicite préalable ; aucune modification de ce type n'est réalisée ni autorisée par cette analyse.

## H. Plan de développement progressif — non exécuté

1. **Valider cette analyse et choisir la base.** Décider d'une copie isolée du TP original ou d'une reprise explicitement auditée d'EvoSwarm. Préserver l'état local actuel et SmartCity Traffic AI 2.0. Livrable : périmètre et emplacement convenus.
2. **Établir une référence reproductible.** Dans la future copie, ajouter une commande de tests légère sans dépendance inutile et un contrôle de l'aléatoire. Vérifier Seek, limites, perceptions, consommation, santé, hérédité, mutations et ordre naissance/mort. Livrable : règles de référence documentées et tests réussis.
3. **Rendre le TP observable.** Ajouter pause, pas à pas, inspecteur et statistiques minimales. Vérifier automatiquement leurs calculs et la correspondance entre gènes affichés et gènes effectifs.
4. **Clarifier l'architecture par extensions.** Séparer entités, comportements et contrôle du monde, sans recopier `vehicle.js`. Tester les forces pondérées, leurs limites finales et les conflits avec les bords. Tout changement nécessaire de la base doit être soumis séparément à autorisation.
5. **Faire évoluer le modèle génétique.** Ajouter une seule règle à la fois : bornes, coût de reproduction, seuils ou paramètres. Comparer plusieurs graines et mesurer survie, descendance et diversité. Ne pas attribuer une amélioration au seul aspect visuel d'un essai.
6. **Introduire EVOLUTION ARENA.** Ajouter identité visuelle, scénarios et objectifs de survie. Le joueur agit sur l'écosystème ; les agents continuent de choisir leurs actions localement. Couvrir les conditions de victoire, défaite et redémarrage par des tests.
7. **Étendre et optimiser sur mesure.** Envisager prédateurs, nouveaux gènes et grille spatiale après mesure des besoins. Tester les cas limites, la composition avec les comportements existants et la reproductibilité ; comparer les résultats à la référence.

Chaque étape devra être validée avant d'élargir le périmètre. Aucune étape de développement n'a été commencée ici.

## Résumé pédagogique

Imagine une population de petits véhicules. Chacun possède quatre réglages héritables : son intérêt pour la nourriture, son intérêt pour le poison et les distances auxquelles il les repère. Ces réglages sont son ADN ; ils ne décrivent pas une trajectoire.

À chaque image, chaque véhicule recherche les ressources proches. Seek calcule une correction de vitesse vers une cible ; le poids génétique renforce, annule ou inverse cette correction. Les forces modifient l'accélération, puis la vitesse et enfin la position. C'est ainsi qu'un déplacement autonome apparaît à partir de règles simples (`Vehicle.eat()`, `seek()`, `behaviors()`, `applyForce()`, `update()`).

La vie baisse continuellement. Manger aide à survivre ; absorber du poison nuit à la santé. Un véhicule peut se cloner avec une faible probabilité et transmettre des gènes presque identiques. Parfois, une mutation change légèrement un réglage (`update()`, `eat()`, `clone()`, `constructor()`).

Un individu qui survit longtemps a davantage d'occasions de se reproduire. Ses réglages peuvent devenir plus fréquents : c'est la sélection naturelle. Le véhicule ne comprend pas qu'il doit éviter le poison et ne réécrit pas ses gènes pendant sa vie. C'est la composition de la population qui évolue au fil des naissances et des morts (`sketch.js:draw()`, `Vehicle.clone()` et `dead()`).

Le TP montre donc trois mécanismes essentiels : **variation**, **hérédité**, **succès reproductif différentiel**. Evolution Arena pourra rendre ces mécanismes mesurables et jouables, après validation de cette première analyse.

## Vérifications et limites de cette livraison

- Analyse statique des fichiers originaux lus depuis Git, puis distinction avec les modifications locales préexistantes.
- Aucun code de simulation, fichier `vehicle.js`, fichier SmartCity, dépendance ou configuration existante modifié.
- Aucun commit, push, clonage ou publication.
- Aucun test fonctionnel exécuté : cette livraison ajoute seulement ce document, sans fonctionnalité. Aucun lanceur de tests n'est présent dans l'arbre original de cet exemple ; il n'en a pas été ajouté à cette étape documentaire.
- La simulation n'a pas été exécutée dans le navigateur ; les observations de comportement sont des déductions du code, pas des mesures expérimentales.
- Arrêt après l'analyse ; développement soumis à la validation de l'utilisateur.
