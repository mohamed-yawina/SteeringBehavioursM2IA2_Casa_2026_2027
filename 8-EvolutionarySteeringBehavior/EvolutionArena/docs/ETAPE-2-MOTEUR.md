# Étape 2 — Moteur de simulation

Projet : **EVOLUTION ARENA — Survival of the Smartest**. Date : 25 octobre 2026.

## Périmètre et protection des sources

L'analyse `../../travail-analyse/docs/ANALYSE-TP8.md` et les consignes `../../../ARCHITECTURE.md` à la racine du dépôt du cours ont été consultées avant développement. Ces chemins sont relatifs à ce document.

La référence est le TP 8 original du commit `b7790773543acf9fb73160428f24d376acee57ab`, lu depuis Git. Le `vehicle.js` présent à la racine du TP est une version EvoSwarm déjà modifiée : il n'a pas servi de base au moteur.

Le dossier `EvolutionArena` est un projet autonome : ses ressources, ses modules et son serveur sont locaux. Il ne dépend pas des fichiers voisins au lancement. Pour respecter le périmètre d'écriture du workspace, il est physiquement placé sous le dossier du TP 8 ; il ne constitue pas un dépôt Git distinct. Aucun fichier préexistant du TP, d'EvoSwarm ou de SmartCity n'a été édité. Aucune installation, aucun commit, push ou déploiement.

`vendor/vehicle.js` est une copie **inchangée** du fichier original enregistré dans Git. `vendor/p5.min.js` est une copie de la bibliothèque 1.7.0 fournie dans le TP. Les crédits restent dans les fichiers et dans `vendor/NOTICE.md`. Les comportements existants ne sont pas recopiés dans une nouvelle classe.

## Architecture et fichiers créés

```text
EvolutionArena/
├── index.html
├── styles.css
├── package.json
├── README.md
├── docs/
│   └── ETAPE-2-MOTEUR.md
├── vendor/
│   ├── NOTICE.md
│   ├── p5.min.js
│   └── vehicle.js
├── src/
│   ├── main.js
│   ├── core/
│   │   ├── courseVehicle.js
│   │   └── DNA.js
│   ├── behaviors/
│   │   ├── perception.js
│   │   └── steering.js
│   ├── entities/
│   │   ├── Creature.js
│   │   ├── Food.js
│   │   └── Poison.js
│   ├── simulation/
│   │   └── Simulation.js
│   └── ui/
│       ├── ArenaRenderer.js
│       └── Interface.js
├── tools/
│   └── serve.mjs
└── tests/
    ├── engine.test.js
    ├── interface.test.js
    ├── server.test.js
    └── helpers/
        └── runtime.js
```

Tous ces fichiers sont nouveaux. Aucun fichier existant n'est modifié.

Les empreintes SHA-256 des onze fichiers applicatifs préexistants du TP/EvoSwarm ont été comparées au relevé de début de tâche : elles sont identiques. La copie `vendor/vehicle.js` a également été comparée octet par octet à l'objet Git original : identité confirmée. Les autres projets, dont SmartCity, n'ont pas été ouverts ni modifiés.

| Classe / module | Rôle |
| --- | --- |
| `Vehicle`, `vendor/vehicle.js` | Base fournie : vecteurs, Seek, application des forces, intégration de la vitesse et de la position, test de mort. Chargement classique, sans modification. |
| `core/courseVehicle.js` | Adaptateur qui permet aux modules ES d'importer la classe globale du cours. |
| `DNA`, `core/DNA.js` | Quatre valeurs validées et immuables, accesseurs explicites, initialisation aléatoire. Aucun opérateur de mutation ou de croisement. |
| `Creature`, `entities/Creature.js` | Hérite de Vehicle, porte l'ADN et l'énergie, perçoit les cibles et applique les forces ; délègue la locomotion à `super.update()`. |
| `Food`, `entities/Food.js` | Entité alimentaire statique, héritant elle aussi de Vehicle. |
| `Poison`, `entities/Poison.js` | Entité toxique statique, héritant de Vehicle, dans un fichier distinct. |
| `behaviors/perception.js` | Fonctions indépendantes de sélection du plus proche et de consommation au contact. |
| `behaviors/steering.js` | Flee, attraction/répulsion signée, confinement et composition bornée des forces. |
| `Simulation`, `simulation/Simulation.js` | Possède les tableaux d'entités, avance le temps, retire les morts, renouvelle les ressources et gère pause/reset. Aucune dépendance au DOM. |
| `ArenaRenderer`, `ui/ArenaRenderer.js` | Dessine le monde avec p5 ; lit les positions et l'ADN sans déplacer les entités. |
| `Interface`, `ui/Interface.js` | Connecte les boutons, les compteurs et la case de perception ; libère ses écouteurs via `dispose()`. |
| `main.js` | Assemble le moteur et l'interface dans `mountApp()`, raccorde les callbacks p5 et convertit les clics en coordonnées du monde. |
| `tools/serve.mjs` | Serveur HTTP Node local, sans dépendance, avec MIME pour les modules et refus des chemins hors projet. |

Le choix du mode global p5 permet d'utiliser les fonctions globales attendues par la base du cours. Les nouveaux modules ne publient pas leur état globalement ; seuls les callbacks p5 sont raccordés à `window`.

## ADN : les quatre gènes vérifiés

Les indices et les intervalles initiaux viennent de `Vehicle.constructor()` dans le TP original :

| Indice | Accesseur DNA | Sens | Intervalle |
| --- | --- | --- | --- |
| 0 | `foodWeight` | Poids signé pour la nourriture | [-2, 2] accepté ; tirage dans [-2, 2[ |
| 1 | `poisonWeight` | Poids signé pour le poison | [-2, 2] accepté ; tirage dans [-2, 2[ |
| 2 | `foodPerception` | Rayon nourriture en pixels | [0, 100] accepté ; tirage dans [0, 100[ |
| 3 | `poisonPerception` | Rayon poison en pixels | [0, 100] accepté ; tirage dans [0, 100[ |

Un poids positif utilise Seek ; un poids négatif utilise Flee avec l'amplitude absolue du poids. Zéro annule la force. Les rayons déterminent indépendamment quelles cibles sont accessibles à la perception. Il est donc possible d'avoir une créature attirée par le poison ou repoussée par la nourriture. C'est une propriété du modèle à ADN aléatoire.

Les gènes ne changent jamais durant cette étape. La population n'évolue pas génétiquement : seules ses interactions et ses morts sont simulées.

## Algorithmes de steering

### Seek réutilisé depuis le cours

`Vehicle.seek(target)` fournit :

```text
desiredVelocity = normalize(target - position) × maxSpeed
steering = desiredVelocity - currentVelocity
force = limit(steering, maxForce)
```

Le comportement retourne une force, sans changer directement la position. À distance nulle, le vecteur désiré est nul et la correction freine la vitesse existante. La normalisation du vecteur nul ne produit pas de division manuelle par zéro.

### Flee corrigé

`steering.flee(vehicle, target)` utilise :

```text
desiredVelocity = normalize(position - target) × maxSpeed
steering = desiredVelocity - currentVelocity
force = limit(steering, maxForce)
```

Ce calcul inverse la direction désirée avant la soustraction. Il évite l'erreur qui consisterait à multiplier toute la force Seek par -1 : cela inverserait aussi, à tort, la contribution de la vitesse actuelle.

### Composition et confinement

`resourceForce()` choisit Seek/Flee selon le signe du poids, pondère la force et la limite. `combinedForce()` additionne nourriture et poison puis limite à nouveau la somme. La norme de la force appliquée ne dépasse donc jamais `Creature.maxForce`.

Si un individu se trouve dans la marge de 48 pixels près des limites, `boundaryForce()` reçoit la priorité. Les deux axes sont corrigés simultanément dans les coins. Cette approche évite que l'attraction d'une ressource extérieure annule le retour. Ce sont toujours des forces locales : le confinement n'est pas une collision dure, et une petite excursion au-delà du bord reste possible lors d'un demi-tour.

Les réglages sont `maxSpeed = 2.8` pixels par pas et `maxForce = 0.16`. Les déplacements ne sont jamais codés sous forme de trajectoires. `Creature.steer()` appelle `applyForce()`, puis `Creature.tick()` délègue l'intégration à `Vehicle.update()`.

## Perception, énergie et ressources

`nearestResource()` compare les distances au carré pour choisir le point le plus proche strictement dans le rayon génétique. Pas de racine carrée par candidat ; aucun angle de vision ni mémoire.

`consumeResources()` teste le contact indépendamment de la perception, avec une distance strictement inférieure à 8 pixels. Le tableau est parcouru à l'envers pour supprimer proprement les éléments consommés. Une créature morte ne peut plus consommer. Les gains et pertes sont plafonnés entre zéro et l'énergie maximale.

| Paramètre initial | Valeur | Source |
| --- | --- | --- |
| Taille du monde | 1100 × 650 pixels logiques | `Simulation` |
| Créatures | 36 | `Simulation` |
| Nourriture / poison | 90 / 28 | `Simulation` |
| Énergie initiale / maximale | 1 / 1,5 | `Vehicle` / `Creature` |
| Perte passive | 0,035 unité par seconde simulée | `Simulation`, `Creature.tick()` |
| Nourriture consommée | +0,25 | `Simulation` |
| Poison consommé | -0,65 | `Simulation` |
| Flux de nourriture / poison | 3 / 0,3 ressource par seconde | `Simulation.step()` |
| Plafonds nourriture / poison | 140 / 45 | `Simulation.addResource()` |

La perte de santé de 0,005 présente dans la base fournie est compensée juste avant `super.update()` dans `Creature.tick()`. On applique ensuite la perte propre à Arena par seconde. Cette adaptation conserve intégralement la locomotion et le fichier fourni ; elle est couverte par un test de perte exacte sur 60 pas. La propriété `energy` est un accesseur vers `health`, sans second état divergent.

Les ressources sont immobiles : elles héritent bien de Vehicle, mais on n'appelle pas leur `update()`. Elles n'ont donc ni drain d'énergie ni déplacement inutile. Le constructeur original crée certains champs qui ne sont pas exploités par ces ressources : c'est le coût accepté de la réutilisation du modèle fourni.

Les nouveaux points apparaissent progressivement à des positions aléatoires, après les consommations ; ils remplacent à terme les ressources mangées tant que le plafond n'est pas atteint. Il n'y a pas de remplacement instantané à la même position ni de chaîne de consommation dans une même boucle. Les clics sont également soumis aux plafonds.

## Temps, arrêt et réinitialisation

`Simulation.advance(elapsedSeconds)` utilise un accumulateur et un pas fixe de 1/60 s. Deux rendus à 30 Hz et 60 Hz produisent les mêmes pas et, avec la même graine, les mêmes états. Les mouvements de la base restent exprimés par pas. Le rendu s'adapte à la largeur du conteneur tout en gardant les dimensions logiques du monde.

Pour éviter une longue boucle au retour d'un onglet suspendu, un appel rattrape au maximum 0,25 seconde. À cadence très basse, la simulation peut donc progresser moins vite que le temps mural. Le compteur affiche le temps **simulé**, pas une promesse de temps réel.

Pause fige les positions, les énergies, les ressources et le compteur ; le dessin reste visible. Reprendre ne rattrape pas le temps passé en pause. Réinitialiser remplace les tableaux, remet temps, budgets et morts à zéro, recrée une population aléatoire et quitte la pause. Aucun historique croissant n'est conservé et les écouteurs d'interface ne sont pas recréés à chaque reset.

Une créature meurt à `energy <= 0`. Elle est retirée du tableau sans reproduction, sans cadavre transformé en nourriture et sans remplacement. Quand il n'y en a plus, l'interface affiche l'extinction ; seul Réinitialiser crée une nouvelle population.

## Vérifications effectuées

Commande exécutée depuis `EvolutionArena` avec Node.js v24.18.0 :

```powershell
node --test tests/*.test.js
```

**Résultat final : 35 tests, 35 réussites, 0 échec, 0 test ignoré.** Une première exécution a révélé une conversion d'URL de fichier incorrecte dans le test de syntaxe sous Windows ; le test a été corrigé avec `fileURLToPath()` puis la suite complète a réussi.

| Besoin | Vérification automatisée réalisée |
| --- | --- |
| Lancement | Démarrage de `mountApp()` avec DOM/p5 simulés ; création du canvas et 120 appels de rendu sans exception. Serveur HTTP réel et téléchargement de la page, des bibliothèques, des modules et du CSS. |
| Déplacements | Formule numérique du Seek fourni ; intégration réelle de `Vehicle.update()` ; plafonds de vitesse et remise à zéro de l'accélération. |
| Recherche de nourriture | Test d'approche et de consommation ; plus proche, perception nulle, hors rayon et seuil exact. |
| Réaction au poison | Test de fuite augmentant la distance ; perte d'énergie et suppression au contact. |
| Quatre gènes | Signes et amplitudes des poids ; effet indépendant des deux rayons ; validation et immutabilité. |
| Forces | Formules Seek/Flee, différence entre Flee et -Seek, pondération, composition et limites, cas de cible confondue. |
| Énergie et mort | Drain exact sur une seconde ; plafond après nourriture ; poison létal ; suppression de morts adjacents ; aucune naissance ni résurrection. |
| Pause / Reprendre | Gel complet de l'état ; boutons connectés à la vraie classe Interface ; libellés et état ARIA. |
| Réinitialisation | Effectifs, temps, budgets, pause et compteurs remis à zéro ; anciennes instances remplacées. |
| Perception et interactions | Case de perception, clic nourriture, Maj + clic poison, rejet des clics hors canvas ou pendant la pause ; redimensionnement du canvas. |
| Absence de NaN | Cas nuls et 12 000 pas déterministes ; tous les vecteurs et énergies restent finis. Paramètres de dessin numériques vérifiés sur le pipeline simulé. |
| Ressources / mémoire | Flux de réapparition, plafonds, rejet des coordonnées invalides, libération des écouteurs d'interface. |
| JavaScript et serveur | Vérification `node --check` des modules ; imports servis avec le bon MIME ; erreurs 404 et refus d'accès hors projet. |

Le serveur a également été lancé directement avec `node tools/serve.mjs` et a annoncé `http://127.0.0.1:8088`.

### Limite de validation à conserver explicitement

Aucun navigateur n'est connecté aux outils de cette session : la découverte a renvoyé « No browser is available », puis une liste vide après vérification. **La page n'a donc pas été exécutée ni inspectée visuellement dans un vrai navigateur.** La fluidité, le rendu responsive et l'absence d'erreurs dans la console navigateur restent non vérifiés.

Les tests Node utilisent la vraie classe Vehicle du cours mais une doublure minimale de `p5.Vector` et du DOM. Ils vérifient nos règles, la liaison des commandes et les appels de dessin ; ils ne démontrent pas à eux seuls le bon fonctionnement du runtime p5 réel. La bibliothèque p5 fournie est chargée localement dans l'application, sans doublure. Ce document ne présente pas les tests simulés comme des tests navigateur.

## Différences volontaires avec le TP original

- Quatre gènes conservés, avec validation explicite et ADN immuable.
- Vrai Flee pour les poids négatifs ; aucune inversion de la force Seek entière.
- Forces limitées après pondération et composition ; priorité au retour dans l'arène.
- Énergie exprimée en unités par seconde avec une durée d'observation plus longue.
- Ressources sous forme d'entités héritant de Vehicle, budgets d'apparition et plafonds.
- Moteur séparé du DOM et du dessin, boutons HTML et tests reproductibles.
- Aucun clonage ou mécanisme évolutif activé à cette étape.

Les méthodes historiques `clone()` et les branches de mutation existent dans le fichier fourni inchangé. Elles ne sont jamais appelées par Arena : tous les appels à `super()` se font sans ADN parental. Les conserver dans une dépendance fournie n'ajoute aucun cycle de reproduction à notre simulation.

## Lancement local exact

```powershell
cd "C:\Users\Simo\Desktop\SteeringBehavioursM2IA2_Casa_2026_2027\8-EvolutionarySteeringBehavior\EvolutionArena"
node tools/serve.mjs
```

Adresse : **http://127.0.0.1:8088**. Arrêt : Ctrl+C. Pas de `npm install`, pas de CDN, pas de publication. Les modules ES nécessitent HTTP ; ouvrir directement le fichier HTML n'est pas le mode de lancement prévu.

## Fonctionnalités restantes — après validation uniquement

Reproduction, mutations, choix des parents, mesure de la sélection, généalogie, prédateurs, missions, score avancé, sauvegarde et musique sont hors périmètre. La classe DNA et le moteur préparent leur ajout, sans les anticiper.

La prochaine étape devra définir précisément les conditions et le coût de reproduction, puis les règles de mutation et leurs tests. Elle ne doit pas être commencée avant validation de cette livraison.
