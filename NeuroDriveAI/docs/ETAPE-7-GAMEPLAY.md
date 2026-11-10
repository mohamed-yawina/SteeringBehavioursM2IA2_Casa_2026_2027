# Étape 7 — Gameplay, carrière et compétitions

## Protocole d’équilibrage déclaré avant les essais

Les documents des étapes 2 à 6 et les interfaces de Simulation, Car,
CheckpointManager, NeuralController, ChampionSerialization et des outils
expérimentaux ont été examinés. Les 158 tests et les moteurs scientifique,
physique et neuronal sont préservés. Les nouveaux modules composent les
simulations existantes ; aucun véhicule ne reçoit de position imposée.

Les résultats de l’étape 6 montrent que les missions techniques ne peuvent pas
être présentées comme déjà réussies par les champions livrés. Les objectifs
demandés sont conservés : trois portes Oval, un tour Oval, un tour Desert,
neuf portes Mountain (50 % des 18 portes strictes), un tour Championship.
Les durées prévues sont respectivement 45, 90, 90, 120 et 120 secondes simulées,
hors compte à rebours. Elles permettent une conduite manuelle prudente ; elles
ne garantissent pas que les réseaux survivront aux virages.

Essai pré-déclaré : les 30 champions de l’étape 6 et les 20 de l’étape 5,
avec les graines d’entraînement 2026…2030, sur chacune des cinq missions.
Cinq réseaux aléatoires 8→12→2, graines 2026…2030, constituent un témoin séparé.
Soit 275 évaluations neuronales, sans réentraînement, au pas 1/120 s.
Chaque essai s’arrête sur victoire, collision ou timeout ; les poids sont
comparés avant/après. Les résultats de réseaux provenant d’une même graine
ne sont pas traités comme 50 réplications indépendantes.

Cinq essais de faisabilité physique utilisent séparément le pilote de diagnostic
de l’étape 6 à 55 px/s, via les commandes manuelles normales. Ils ne sont ni
des champions neuronaux, ni une preuve d’apprentissage ou de validation humaine.
Le pilote n’est jamais disponible dans le jeu ou comme adversaire IA.

Aucun checkpoint, mur, force ou braquage ne sera modifié pour équilibrer les
missions. Les objectifs ne seront pas abaissés après observation des résultats.
Les missions 4 et 5 resteront signalées comme défis manuels si aucun champion
ne les démontre. La validation humaine et le rendu Chrome seront signalés
séparément des tests automatisés.

## 1. Architecture et séparation du laboratoire

| Module | Responsabilité |
|---|---|
| `src/game/GameManager.js` | Accueil, carrière, compétitions, suspension et enregistrement d’un résultat une seule fois. |
| `MissionDefinitions.js` | Définitions immuables, objectifs, délais, récompenses et étoiles. |
| `MissionManager.js` | Mission à un concurrent, composée avec RaceManager. |
| `MissionProgress.js` | Déblocages, profils humain/IA, validation et sauvegarde locale. |
| `RaceManager.js` | Simulations indépendantes, départ commun, horloge, arrivées, collisions et abandons. |
| `RaceResults.js` | Classement déterministe, égalités et résultat final immuable. |
| `ChampionRegistry.js` | Huit exemples, imports validés, copies indépendantes et capacité bornée. |
| `GameplayBalance.js` | Évaluation neuronale headless sans entraînement. |
| `src/view/GamePanel.js` | Navigation et commandes de gameplay, HUD, écrans de fin et progression. |
| `src/view/RaceView.js` | Dessin des Car existantes, piste et identification des concurrentes. |
| `tools/balance-gameplay.mjs` + worker | Campagne d’équilibrage, JSON et CSV. |

Les entités visibles restent les Car héritant du Vehicle du projet. Aucun code
de locomotion n’est dupliqué. Chaque course compose une ou deux `Simulation`,
avec leurs `CheckpointManager` et `NeuralController` existants. Les données de
piste sont clonées et gelées. La perception et les commandes passent toujours
par le même moteur physique. Le gameplay n’importe ni EvolutionEngine, ni
sélection, mutation, reproduction ou pilote de diagnostic.

L’onglet Laboratoire conserve tous les modes précédents et ses propres données.
Le changement d’espace suspend la partie et l’entraînement, efface les touches
et le reliquat du pas fixe. La boucle principale exécute uniquement l’espace
actif : aucun entraînement ne continue caché derrière une course. Revenir à
une partie ou au laboratoire nécessite une reprise explicite. Le chargement
des champions ne touche jamais au réseau du laboratoire.

## 2. Missions et règles de victoire / défaite

| Ordre | Mission | Circuit | Victoire stricte | Limite hors départ | Récompense unique |
|---:|---|---|---|---:|---:|
| 1 | FIRST STEPS | Oval | 3 checkpoints ordonnés | 45 s | 100 |
| 2 | FIRST LAP | Oval | 1 tour complet, 12 portes | 90 s | 200 |
| 3 | DESERT CHALLENGE | Desert | 1 tour complet, 14 portes | 90 s | 300 |
| 4 | MOUNTAIN EXPLORER | Mountain | 9 portes ordonnées sur 18 | 120 s | 400 |
| 5 | EVOLUTION CHAMPION | Championship | 1 tour complet, 20 portes | 120 s | 500 |

Une collision, un timeout ou un abandon produit une défaite. Au même pas, une
collision est prioritaire sur la victoire, même si une porte a été validée avant
l’impact ; c’est une règle de jeu conservatrice, sans modification physique.
Sans collision, une arrivée au dernier pas admissible compte avant le timeout.
La réussite désactive la voiture et fige le résultat. Un accident ne peut plus
accumuler portes, score, distance ou tours.

La progression de gameplay utilise seulement les portes réellement validées.
Mountain exige bien neuf franchissements, pas une projection fractionnaire à
proximité d’une porte. La progression affichée en mission est le pourcentage
de l’objectif : 9/9 vaut 100 % de mission et 50 % du tour Mountain. Les règles
historiques d’ordre, sens, segments finis et arrivée restent inchangées. Aucun
checkpoint manquant ne peut produire un tour.

## 3. Points, étoiles et déblocage

Pour une durée T, un temps de réussite t et un progrès d’objectif p dans [0,1] :

```
victoire : score = récompense + floor(1000 * clamp(1 - t/T, 0, 1))
défaite  : score = floor(99 * p), zéro étoile
étoiles de victoire : 3 si t <= T/2 ; 2 si t <= 3T/4 ; sinon 1
```

Les scores sont calculés au résultat terminal, sans somme de récompenses par
frame. L’immobilité vaut zéro et une défaite ne rapporte pas d’étoile. Le meilleur
temps, le meilleur score, les étoiles et les tentatives sont séparés pour
humain et IA. Une victoire dans l’un des deux profils débloque la mission
suivante ; un succès IA n’est jamais présenté comme un record humain.

Les récompenses uniques sont dérivées des missions terminées, maximum 1500 :
rejouer n’accumule pas de monnaie. Le total d’étoiles prend le meilleur profil
de chaque mission, maximum 15. Un meilleur temps améliore le record ; une
tentative plus lente ne le remplace pas. Recommencer une mission active
enregistre son abandon, puis démarre une nouvelle tentative. Quitter un onglet
met en pause ; une fermeture du navigateur n’archive pas une partie inachevée.

## 4. Résultats d’équilibrage réellement exécutés

Node v24.18.0, cinq graines, pas fixe 1/120 s, aucun apprentissage, aucune
modification d’objectif après observation. 50 champions existants plus cinq
réseaux témoins sur cinq missions : **275 évaluations neuronales**.

| Mission | Champions étape 6 | Champions étape 5 | Ensemble des champions | Réseaux aléatoires |
|---|---:|---:|---:|---:|
| FIRST STEPS | 24/30 | 20/20 | 44/50 | 2/5 |
| FIRST LAP | 15/30 | 20/20 | 35/50 | 1/5 |
| DESERT CHALLENGE | 6/30 | 0/20 | 6/50 | 0/5 |
| MOUNTAIN EXPLORER | 0/30 | 0/20 | 0/50 | 0/5 |
| EVOLUTION CHAMPION | 0/30 | 0/20 | 0/50 | 0/5 |

Les meilleurs réseaux ne sont pas indépendants entre stratégies et graines ;
ces proportions décrivent ce catalogue, pas une probabilité générale de succès.
Un témoin aléatoire peut réussir sans apprentissage, ce que le tableau conserve.
L’allongement de durée ne guérit pas les collisions précoces. Les meilleurs
essais neuronaux ne franchissent que quatre portes sur Mountain et Championship,
insuffisant pour les objectifs conservés. Certains réseaux freinent dès le
départ et attendent le timeout, sans gain.

Exemples disponibles dans le jeu et temps de mission hors départ :

| Champion | FIRST STEPS | FIRST LAP | DESERT CHALLENGE |
|---|---:|---:|---:|
| Oval C · 2028 (étape 5) | 3,50 s | 10,91 s | Échec, collision |
| Oval · 2026 | 8,86 s | 24,00 s | Échec, collision |
| Desert · 2028 | 5,68 s | 15,44 s | 17,97 s |
| Desert · 2029 | 7,54 s | 26,21 s | 28,47 s |

La mission 3 possède donc deux exemples adaptés dans le catalogue. Aucun
champion n’est présenté comme solution garantie de la mission 4 ou 5.

Les cinq contrôles de faisabilité physique utilisent uniquement les commandes
normales du moteur, à vitesse cible 55 px/s :

| Mission | Portes obtenues | Tours | Temps | Résultat |
|---|---:|---:|---:|---|
| FIRST STEPS | 3 | 0 | 8,29 s | Victoire, sans collision |
| FIRST LAP | 12 | 1 | 33,87 s | Victoire, sans collision |
| DESERT CHALLENGE | 14 | 1 | 33,61 s | Victoire, sans collision |
| MOUNTAIN EXPLORER | 9 | 0 | 18,88 s | Victoire, sans collision |
| EVOLUTION CHAMPION | 20 | 1 | 37,28 s | Victoire, sans collision |

Ces cinq parcours prouvent une faisabilité avec le moteur et les commandes
autorisées, sans téléportation. Ils ne prouvent ni une réussite au clavier par
un humain, ni une réussite neuronale. Les durées étendues sont une marge pour
la conduite prudente ; la difficulté humaine et les seuils d’étoiles restent
à mesurer. La carrière demeure exigeante après Desert et doit être présentée
ainsi, plutôt que d’abaisser silencieusement ses objectifs.

Les données brutes sont dans [resultats.json](experiments/etape-7/resultats.json),
[evaluations.csv](experiments/etape-7/evaluations.csv) et
[summary.csv](experiments/etape-7/summary.csv). Les statistiques incluent effectif,
réussites, temps conditionnels aux succès, médiane, dispersion, progression et
collisions. Les temps de réussite sont `null` si aucun succès, pas zéro.

```powershell
npm.cmd run balance -- --seeds 2026,2027,2028,2029,2030 --workers 4 --output output/gameplay-nouvel-essai
```

Utiliser un dossier neuf. Les workers ne partagent aucun état aléatoire ; les
réseaux chargés sont immuables et chaque résultat vérifie les mêmes poids
avant/après. La faisabilité par pilote de diagnostic est enregistrée séparément,
avec `humanValidated:false`.

## 5. Human vs AI

Le joueur et le champion A partent du même point, au même cap, à vitesse nulle,
avec les mêmes limites de vitesse, force, braquage et capteurs. Il n’y a pas de
décalage physique de grille : les deux voitures sont des fantômes qui peuvent
se superposer. Les contours et étiquettes les distinguent. Seuls les murs
causent des collisions ; le réseau ne reçoit aucune information sur l’adversaire.

Le compte à rebours commun de trois secondes ne simule aucun mouvement. Le
chronomètre partagé ne commence qu’après le départ. Pause et perte de focus
figent les deux concurrentes et effacent les touches. Le pas est 1/120 s ; les
temps d’arrivée sont enregistrés à la fin du pas, résolution environ 8,33 ms.
La course continue pour une voiture active après l’arrivée ou l’accident de
l’autre, jusqu’à son résultat ou à l’horizon commun. Les arrivées sont figées.

« Abandon du joueur » arrête seulement le joueur ; l’IA peut finir. « Abandonner
la partie » clôt tous les concurrents encore actifs. Aucun abandon n’est une
collision fictive. Recommencer recrée les mêmes conditions et les mêmes poids.

## 6. AI vs AI, classement et égalités

Deux imports ou exemples peuvent être choisis indépendamment. Chaque concurrent
possède une identité, une Simulation, une Car, des checkpoints et une copie
indépendante du réseau. Choisir deux fois le même champion est autorisé et
produit une égalité déterministe dans les mêmes conditions, sans bruit ajouté.

Le classement final applique :

1. Les objectifs terminés précèdent tous les abandons et échecs.
2. Les arrivées sont classées par temps croissant. Un même pas d’arrivée donne
   le même rang ; l’identifiant ordonne seulement l’affichage des ex æquo.
3. Pour les non-finissants : plus de checkpoints stricts d’abord, puis timeout,
   collision, abandon à progression identique. Cette préférence terminale est
   explicite ; la distance parcourue ou une proximité ne départagent pas les portes.
4. Deux résultats sportifs identiques gardent le même rang (1,1,3). Si aucun
   objectif n’est terminé, il n’y a **aucun vainqueur**, même si le classement
   des non-finissants contient un premier.

Le tableau expose portes, progression d’objectif, tours, temps d’arrivée ou
d’arrêt, état, collisions et vitesse moyenne. La vitesse moyenne est la distance
réellement acceptée divisée par le temps de conduite jusqu’à l’arrêt, pas par
le temps d’attente de l’autre voiture. Le résultat final est immuable et n’est
jamais recalculé par un pas supplémentaire.

## 7. Champions et imports

Huit exemples sont référencés par chemins locaux sans duplication de fichiers :
Oval 2026/2028, Desert 2028/2029, Mountain 2029 expérimental, Championship 2026
expérimental, le classique de l’étape 4 et Oval C 2028 de l’étape 5.
Le jeu peut charger leur JSON ou importer un fichier / texte collé. Une erreur
ne remplace pas les sélections ou réseaux déjà chargés. Les chargements
concurrents d’un même exemple ne créent pas de doublon.

Le format neuronal et les métadonnées versionnées existants sont réutilisés.
Les anciens champions sans provenance restent acceptés, sans inventer de circuit
source. La validation reprend le contrat de NeuralController : huit entrées,
deux sorties et tanh en sortie ; les exemples livrés restent 8→12→2. Le jeu
n’utilise pas Genome pour tronquer ou muter un import. Le catalogue est limité
à 24 entrées, les textes/fichiers à la borne du sérialiseur, les noms à 80
caractères. Les noms sont affichés comme texte, jamais interprétés comme HTML.

Les champions importés ne sont pas persistés automatiquement. Ils restent en
mémoire jusqu’au rechargement de page, et doivent être conservés dans leur JSON.
Le contrôle du circuit source et le transfert scientifique restent dans le
laboratoire ; une victoire de mission sur un circuit connu n’est pas une preuve
de généralisation.

## 8. Sauvegarde locale

Clé `NeuroDriveAI.career.v1`, format `NeuroDriveAI.career`, version 1. Le profil
contient cinq lignes de mission avec deux petits records (humain et IA), sans
trajectoire, poids, champion JSON ou historique volumineux. Une sauvegarde
courante reste inférieure à 2 Ko ; l’import est borné à 16 000 caractères.

La validation vérifie version, ordre et identifiants des cinq missions, types,
bornes des tentatives, score, temps, étoiles, cohérence entre meilleure réussite
et score, ainsi que la chaîne de déblocage. Des données corrompues ou futures
sont ignorées avec un message. Le stockage indisponible ou saturé ne bloque pas
le jeu : progression en mémoire et avertissement explicite. Les requêtes HTTP
ne transmettent jamais ce profil à un serveur.

Il s’agit d’une sauvegarde locale de confort, pas d’un système anti-triche :
une personne pouvant éditer le code ou forger des données cohérentes peut
modifier ses records. Aucun compte, classement en ligne ou service externe.
Changer d’origine/port du serveur peut donner un stockage local différent.

## 9. Tests et contrôles

Les 158 tests antérieurs sont conservés sans modification. Les nouveaux tests
couvrent définitions, cinq victoires physiques, récompenses et étoiles, défaites,
verrouillage, profils humain/IA, sauvegardes invalides ou bloquées, import ancien
et nouveau, indépendance des réseaux, compte à rebours, pause, chronomètre commun,
Human vs AI, AI vs AI, arrivée légale, mauvais sens, portes sautées, collision
continue, priorité collision/victoire, abandons individuels et de partie, égalités,
classement DNF, reset reproductible et absence de modification des poids.

Une validation prolongée exécute 20 000 vrais pas de courses avec deux IA et des
réinitialisations après résultats. Les anciens tests prolongés neuronaux,
évolutifs et multi-circuits restent présents. Les artefacts d’équilibrage sont
validés et des champions rejoués exactement. Le contrat DOM/Canvas exerce
l’entrée réelle de l’application, le changement d’espace, les écrans terminaux,
les sélections, imports texte/fichier et commandes de partie.

Commande : `npm.cmd test`. Résultat exécuté : **200 tests réussis, zéro échec**,
dont 42 nouveaux. Les tests de contrat ne certifient pas les pixels. Chrome
n’est pas connecté à l’automatisation de cette session : aucune validation
visuelle ni réussite humaine au clavier n’est revendiquée.

## 10. Démonstration dans Chrome

```powershell
cd "C:\Users\Simo\Desktop\SteeringBehavioursM2IA2_Casa_2026_2027\NeuroDriveAI"
npm.cmd start
```

Ouvrir `http://localhost:8000`, pas `file://`. Les ressources sont locales.

1. **Accueil** : vérifier Championship, Carrière, Human vs AI, AI vs AI et
   Laboratoire. Attendre le chargement des huit exemples. En cas d’échec de
   chargement, la conduite manuelle et l’import JSON restent disponibles.
2. **Carrière** : commencer FIRST STEPS au clavier. ↑/Z/W accélère, ↓/S freine,
   ←→/Q/D/A tourne. Cliquer la piste si le focus est dans un formulaire. Vérifier
   le départ 3–2–1, les portes ordonnées et le résultat au troisième checkpoint.
3. **Démonstration IA reproductible** : choisir le pilotage IA et « Oval C · 2028 »
   comme champion A. FIRST STEPS réussit en environ 3,50 s de conduite ; FIRST LAP
   en environ 10,91 s. Le compte à rebours ajoute trois secondes avant le chrono.
   Les succès débloquent les missions suivantes et sont marqués dans le profil IA.
4. **Desert** : choisir Desert · 2028, lancer DESERT CHALLENGE. Un tour est attendu
   en environ 17,97 s. Mountain et Championship restent des défis manuels : ne pas
   présenter les exemples expérimentaux comme leurs solutions.
5. **Human vs AI** : sélectionner le circuit, un tour, 90 s et le champion A.
   Vérifier départ identique, progression des deux voitures, collisions
   indépendantes et chronomètre commun. Tester Pause/Reprendre, abandon du joueur
   (l’IA continue) puis abandon de partie. Une voiture accidentée reste figée.
6. **AI vs AI** : choisir deux exemples distincts puis le même champion des deux
   côtés. Vérifier les identités A/B, les tours, temps, vitesses moyennes et le
   résultat ; deux réseaux identiques doivent arriver ex æquo. Aucun apprentissage.
7. **Import et sauvegarde** : importer un ancien champion JSON puis un fichier
   invalide ; le dernier import valide reste disponible. Recharger la page :
   les records de carrière et déblocages sont restaurés, les imports mémoire
   ne le sont pas. Les records humains et IA restent séparés.
8. **Laboratoire** : vérifier manuel, autonome, entraînement mono/multi, transfert
   et comparaisons scientifiques. Une reprise explicite relance cet espace.
   Revenir au jeu doit suspendre le laboratoire. Perdre le focus doit mettre la
   partie en pause. Vérifier la console Chrome sans erreur.

## 11. Limites et arrêt

- Les missions 4 et 5 sont physiquement réalisables mais sans réussite neuronale
  ni validation humaine démontrée. Le déblocage progressif rend ces défis
  obligatoires pour finir la carrière ; il n’existe pas de contournement caché.
- Les seuils d’étoiles ne sont pas calibrés sur une cohorte humaine. Les profils
  IA et humain sont séparés, mais chacun peut débloquer la mission suivante.
- Les courses sont des contre-la-montre simultanés fantômes : pas de contact
  voiture-voiture, dépassement bloqué, trafic ou adversaire visible par les rayons.
- Les temps sont simulés, quantifiés au pas. Sous charge, le jeu peut avancer
  plus lentement que le temps réel, comme le laboratoire existant.
- Pas de reprise d’une course après rechargement, ni sauvegarde de champions,
  ni récompenses en ligne. L’arrêt d’une partie au timeout est distinct d’une
  collision ; les voitures arrêtées ne continuent pas à marquer.
- L’équilibrage concerne des modèles déjà sélectionnés, cinq graines et des
  conditions connues ; il ne démontre ni généralisation, ni supériorité d’un
  algorithme génétique. Aucun réseau n’a été réentraîné durant cette étape.
- Interface fonctionnelle sobre ; aucune refonte futuriste, son, animation
  avancée, nouvel obstacle ou changement de physique de l’étape 8.

Les fichiers des TPs 9/9b, Vehicle/vehicle.js, les autres TPs et EvolutionArena
restent inchangés. Aucun commit, push, déploiement ou installation de dépendance.
Le développement s’arrête à l’étape 7, en attente de validation utilisateur.

## 12. Inventaire de livraison

**21 fichiers créés :**

- `src/game/ChampionRegistry.js`, `GameManager.js`, `GameplayBalance.js`,
  `MissionDefinitions.js`, `MissionManager.js`, `MissionProgress.js`,
  `RaceManager.js`, `RaceResults.js`.
- `src/view/GamePanel.js`, `src/view/RaceView.js`.
- `tools/balance-gameplay.mjs`, `tools/gameplay-balance-worker.mjs`.
- `tests/game-champions.test.js`, `game-interface.test.js`, `game-missions.test.js`,
  `game-race.test.js` et `tests/support/game-dom.mjs`.
- `docs/ETAPE-7-GAMEPLAY.md`.
- `docs/experiments/etape-7/resultats.json`, `evaluations.csv`, `summary.csv`.

**5 fichiers modifiés :** `README.md`, `index.html`, `package.json` (0.7.0 et
commande balance), `src/main.js` (sélection de la boucle active), `styles.css`.
Aucun fichier supprimé. Aucun ancien test, document ou résultat modifié.
Les modules scientifiques, Simulation, checkpoints, géométrie, capteurs, Car,
Vehicle et les formats neuronaux restent inchangés. Les modifications sont
préparées et testées dans un dossier temporaire puis copiées par manifeste
avec contrôle des empreintes, uniquement vers NeuroDriveAI.
