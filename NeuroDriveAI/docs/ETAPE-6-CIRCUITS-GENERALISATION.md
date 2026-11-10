# Étape 6 — Circuits et généralisation

## Protocole déclaré avant l’entraînement

Les cinq documents des étapes précédentes et les interfaces demandées ont été
examinés. Track.js, le circuit Training Oval, Simulation, CheckpointManager et
les fichiers Vehicle restent inchangés. Les règles strictes de tours sont conservées.

Les quatre nouvelles pistes sont définies par des polygones de contrôle différents,
lissés par Chaikin et rééchantillonnés, puis bordés par décalage normal. Elles ne
sont pas des transformations affines de l’ovale. Leurs définitions sont figées
après validation géométrique et physique, avant toute mesure des champions.

Graines pré-définies : 2026, 2027, 2028, 2029, 2030. Réseau 8→12→2 tanh.
Population : 20 ; sélection roulette sans élitisme (stratégie A de l’étape 5),
mutation 0,10, amplitude 0,20, adaptation et immigration désactivées. Ces paramètres
ne seront pas retouchés après observation des tests inconnus.

Conditions mono : six générations sur chaque piste, horizon 30 s et stagnation
4 s. Cinq graines pour chacune des cinq pistes, donc 25 exécutions. Les modèles
oval constituent A sur leur piste, B sur les quatre pistes inconnues ; les
modèles spécialisés constituent C sur leur propre piste. Tous sont également
relus sur les cinq pistes pour fournir une matrice de transfert complète.

Condition multi D : deux générations, mêmes 20 génomes et horizon 30 s PAR piste,
évalués sur [oval, desert, mountain]. Neon City et Evolution Championship restent
explicitement hors entraînement. Cinq graines, indépendantes des modèles mono.
Les champions sont relus sur les cinq pistes, sans modification des poids.

Budget réservé par exécution : mono 20×6×1×30×120 = 432000 emplacements
individu-circuit-pas ; multi 20×2×3×30×120 = 432000. L’égalité de budget impose
ici moins de générations multi : ce n’est pas une ablation pure à même nombre
de reproductions. Les pas actifs réels sont enregistrés séparément ; le budget
inutilisé après élimination n’est pas réinvesti. Les 30 exécutions réservent au
total 12960000 emplacements. Chaque champion possède cinq relectures de 30 s,
sans stagnation anticipée ; une immobilité survivant 30 s ne vaut pas réussite.

Une réussite de transfert est au moins un tour légal pendant la relecture. Le
jeu de test n’est jamais utilisé pour sélectionner ou modifier les poids. Les
scores d’entraînement sont normalisés par piste, puis agrégés à poids égaux,
avec une composante de pire cas, afin de ne pas favoriser les pistes longues
ou dotées de davantage de checkpoints.

Les environnements dynamiques sont reportés : aucune adhérence, vitesse ou
obstacle supplémentaire ne modifie les expériences de référence de cette étape.
La validation humaine des cinq pistes n’est pas acquise. Les tests de faisabilité
utilisent un pilote de référence réservé aux diagnostics ; ils ne démontrent
pas qu’un réseau a appris à conduire.

## 1. Architecture et compatibilité

`TrackRegistry` expose cinq identifiants stables et leurs nom, description,
difficulté indicative et dimensions 1000 × 700. `createRegisteredTrack(id)`
retourne une instance indépendante avec géométrie, départ, orientation, arrivée,
checkpoints, métadonnées et rapport de validation. Un identifiant inconnu échoue.
Le registre historique de `Track.js` reste compatible ; les nouveaux outils
utilisent le nouveau registre. `TrackVariants.js` reste inchangé : son ancienne
variante affine demeure un diagnostic de l’étape 5, distinct des nouvelles pistes.

`TrackFactory` lisse trois fois une boucle de contrôle par Chaikin, la
rééchantillonne à distance régulière, puis construit deux bords par décalage
normal. Chaque intervalle de huit échantillons définit un checkpoint. Les
géométries obtenues passent ensuite `TrackValidator` ; une simple construction
par décalage ne serait pas à elle seule une garantie contre les intersections.
Le point de départ est après le checkpoint zéro, avant le checkpoint un, orienté
selon la tangente. Les entités visibles et leur locomotion existantes sont
réutilisées ; aucun déplacement direct ne pilote les réseaux.

`MultiCircuitPopulation` compose une population physique indépendante par piste.
Un même génome possède donc K simulations, chacune avec ses capteurs, collisions,
checkpoint manager, temps et stagnation. Le wrapper expose l’interface attendue
par `EvolutionEngine`. L’ancien chemin mono conserve toutes ses fitness et les
quatre stratégies ; le mode multi impose un score normalisé. `TransferSession`
n’utilise aucun moteur évolutif. Les panneaux Track, Transfer et Generalization
complètent l’interface, sans refonte graphique.

## 2. Cinq circuits et validation géométrique

| Circuit / identifiant | Caractéristiques | Longueur (px) | Largeur min. (px) | Checkpoints |
|---|---|---:|---:|---:|
| Training Oval / oval | Ovale original, strictement inchangé | 1875,77 | 116,75 | 12 |
| Desert Circuit / desert | Boucle asymétrique, rentrants, courbes variées | 1872,94 | 87,37 | 14 |
| Mountain Pass / mountain | Épingles, alternances serrées | 2129,61 | 62,62 | 18 |
| Neon City / neon | Angles arrondis, chicane intérieure | 2209,59 | 75,03 | 16 |
| Evolution Championship / championship | Enchaînements mixtes et resserrés | 2081,05 | 65,22 | 20 |

Les quatre nouvelles boucles ont des portions concaves ; une transformation
affine non dégénérée de l’ovale convexe ne pourrait pas produire ces concavités.
Leurs polygones de contrôle, nombres de portes et longueurs diffèrent. Les niveaux
de difficulté sont indicatifs, sans classement humain établi. Championship est
plus long que l’ovale ; Neon est encore plus long, donc le nom ne signifie pas
« circuit le plus long ».

Les cinq validations passent : bords finis fermés par les murs, absence de
segments dégénérés et d’auto-intersections, inclusion du bord intérieur,
distance minimale exacte entre segments intérieurs et extérieurs ≥ 40 px.
Le départ doit être sur la chaussée, avec dégagement supérieur au rayon de
collision de la voiture. Sa direction doit avoir un produit scalaire normalisé
≥ 0,85 avec la tangente. Les portes ont des normales unitaires perpendiculaires,
orientées dans le sens de la boucle ; elles sont ordonnées sur la ligne centrale,
centrées sur la route, attachées aux deux bords et ne traversent aucun autre mur.
L’arrivée doit être exactement la porte zéro. Les données géométriques sont
déterministes et ne dépendent d’aucune graine d’apprentissage.

Limite du validateur : il vise ces pistes à deux polygones simples et échantillons
appariés, sans intersection routière, pont, obstacle ou import arbitraire de carte.
La fermeture est représentée implicitement dernier→premier, pas par duplication
du premier sommet.

## 3. Checkpoints, collisions et faisabilité physique

`CheckpointManager` et `Simulation` restent inchangés. Une trajectoire entre deux
positions doit couper le segment fini du prochain checkpoint, dans son bon sens.
La proximité, la marche arrière, une porte sautée ou une arrivée prématurée ne
valident rien. Les portes 1…N−1 puis zéro sont nécessaires à chaque tour. Le
balayage continu de collision interrompt la trajectoire avant le premier contact ;
une porte située derrière le mur ne rapporte aucun progrès.

Le pilote de faisabilité, isolé dans `src/diagnostics`, suit la ligne centrale
avec une commande de courbure locale à vitesse cible 55 px/s. Il n’est importé
ni par le réseau, ni par le contrôleur autonome, ni par l’entraînement. Il ne
modifie jamais les positions : il émet les commandes physiques habituelles.
Son rôle est uniquement de vérifier qu’un véhicule réel du moteur peut parcourir
ces géométries avec le braquage et les collisions existants.

| Circuit | Tour légal de diagnostic | Durée (s) | Collision | Validation humaine |
|---|---:|---:|---:|---|
| Training Oval | 1 | 33,87 | 0 | À effectuer |
| Desert Circuit | 1 | 33,61 | 0 | À effectuer |
| Mountain Pass | 1 | 38,11 | 0 | À effectuer |
| Neon City | 1 | 39,64 | 0 | À effectuer |
| Evolution Championship | 1 | 37,28 | 0 | À effectuer |

Rapport exact : [validation-circuits.json](experiments/etape-6/validation-circuits.json).
Ces durées dépassent 30 s à la vitesse prudente choisie ; le budget neuronal de
30 s impose une conduite plus rapide et n’est pas une preuve de faisabilité à
cet horizon pour toutes les pistes. Il reste possible de régler l’horizon jusqu’à
120 s pour de futurs essais pré-déclarés. Aucune géométrie n’a été élargie après
observation des échecs neuronaux.

## 4. Entraînement mono et multi-circuits

En mono, sélectionner une piste puis démarrer un nouvel essai utilise cette
piste dans toutes les évaluations. Les paramètres existants restent disponibles :
population, roulette, tournoi, élites, mutation fixe/adaptative et immigration.
Changer de piste suspend l’ancien essai et remet la conduite au départ ; les
paramètres d’un entraînement actif ne changent pas implicitement.

En multi, sélectionner au moins deux pistes. Chaque génome reçoit le même
horizon maximal et la même condition initiale sur chaque piste. Tous les épisodes
doivent se terminer avant reproduction. Une collision ou stagnation sur une piste
ne supprime pas les résultats des autres. L’écran montre la première piste du
registre sélectionnée ; les scores et tours de chaque épisode sont listés dans
le panneau dédié. L’historique génétique résume les génomes : sa colonne collisions
compte les génomes ayant au moins un épisode accidenté, pas la somme des collisions
de tous leurs épisodes. Les résultats par piste donnent les collisions individuelles.

Soit C le nombre de checkpoints légalement validés, N leur nombre par tour,
f la fraction sectorielle maximale bornée dans [0 ; 0,999], L les tours légaux :

```
p = min(1, (max(0,C) + clamp(f,0,0.999)) / N)
l = 1 si L >= 1, sinon 0
q = 0.5 si collision, sinon 0.75 si stagnation, sinon 1
s = (0.6*p + 0.4*l) * q
S = 0.5*moyenne(s par circuit) + 0.5*minimum(s par circuit)
```

Chaque score est dans [0,1]. Une valeur non finie d’une métrique de résultat est
traitée comme zéro. L’agrégation rejette tout score invalide, tableau vide ou creux.
Les poids sont égaux par piste ; un circuit avec vingt portes ne pèse pas plus
qu’un circuit à douze. Le minimum pénalise une spécialisation à une seule piste.
Les progrès sont les maxima de franchissements ordonnés et de fraction sectorielle
existants, sans accumulation de récompense à chaque frame. La durée et la distance
seules ne récompensent pas une voiture immobile. Le score sature au premier tour :
l’objectif expérimental est un tour réussi, pas une course d’endurance ni un temps
record. La fitness optimisée de l’étape 5 et celle du professeur restent disponibles
pour les modes mono historiques, sans changement de formule.

## 5. Champions et transfert direct

Le JSON conserve le format `NeuroDriveAI.feedforward`, version 1, poids et biais
8→12→2. Un champ optionnel `training` version 1 contient `trackIds`, `seed`,
`generation` et le nom de fitness. L’import neuronal historique accepte ce champ
supplémentaire ; `ChampionSerialization` en vérifie les identifiants uniques et
la provenance numérique. Un ancien JSON est accepté avec origine inconnue. Une
graine de réseau ne permet pas de déduire un circuit d’entraînement. Les
métadonnées importées sont déclaratives, sans certification externe.

Le transfert recharge le champion au départ de la piste cible, applique les mêmes
huit entrées (sept distances et vitesse) et deux sorties que précédemment, et ne
modifie aucun poids. `TransferSession` compare la sérialisation avant/après.
Résultats : circuit source déclaré, cible, checkpoints, tours, premier temps de
tour, survie, collision, progression normalisée, fitness brute optimisée et score
normalisé. La relecture n’applique pas la terminaison de stagnation d’entraînement :
une survie immobile jusqu’au timeout reste un échec. Réinitialiser recommence
le transfert ; changer de piste invalide la session affichée.

## 6. Exécution reproductible et fichiers de mesures

Node utilisé : v24.18.0. Aucune dépendance installée ; p5.Vector local est réutilisé
dans le navigateur et chargé sans DOM dans les outils/tests.

```powershell
cd "C:\Users\Simo\Desktop\SteeringBehavioursM2IA2_Casa_2026_2027\NeuroDriveAI"
npm.cmd test
node tools/validate-tracks.mjs
npm.cmd run generalization -- --seeds 2026,2027,2028,2029,2030 --population 20 --mono-generations 6 --horizon 30 --workers 4 --output output/generalization-nouvel-essai
```

Choisir un dossier neuf pour éviter d’écraser les mesures livrées. Le nombre de
générations mono doit être un multiple de trois ; le multi en utilise le tiers.
Le nombre de workers change l’ordonnancement, pas les graines par essai.
Les résultats contiennent le budget réservé et le nombre de pas réellement actifs.

Dans [experiments/etape-6](experiments/etape-6) :

- `resultats.json` : protocole, 30 exécutions, historiques, résultats par piste,
  moyennes, médianes, écarts-types d’échantillon, minima et maxima.
- `evaluations.csv` : 150 évaluations gelées ; `directTransfer` indique si la cible
  était absente de l’ensemble d’entraînement.
- `summary.csv` : 30 lignes condition×circuit de test et leurs statistiques.
- 30 fichiers d’exécution et 30 champions JSON rejouables.
- `validation-circuits.json` : géométrie et tours physiques de diagnostic.

Le panneau de comparaison de généralisation recalcule les statistiques depuis
les épisodes et rejette poids modifiés, matrices incomplètes ou budgets divergents.
La comparaison scientifique A–D de l’étape 5 reste disponible séparément.

## 7. Résultats observés

30 entraînements, cinq graines appariées par condition. Budget total réservé :
12 960 000 pas individu-circuit ; réellement actifs : 1 690 211. Les épisodes
d’entraînement totalisent **103 tours**, avec réévaluations de génomes ; ce ne
sont pas 103 réseaux indépendants. Les 150 relectures totalisent **30 tours**,
répartis sur **21 évaluations ayant au moins un tour**. Ces chiffres ne doivent
pas être additionnés aux résultats historiques de l’étape 5.

Matrice de réussite « au moins un tour légal en 30 s » ; chaque cellule est
le nombre de champions réussissant sur cinq graines, sans ajustement sur la cible :

| Entraînement | Test Oval | Test Desert | Test Mountain | Test Neon | Test Championship |
|---|---:|---:|---:|---:|---:|
| Oval (A sur diagonale, B ailleurs) | 4/5 | 1/5 | 0/5 | 0/5 | 0/5 |
| Desert (C sur diagonale) | 4/5 | 3/5 | 0/5 | 0/5 | 0/5 |
| Mountain (C sur diagonale) | 0/5 | 0/5 | 0/5 | 0/5 | 0/5 |
| Neon (C sur diagonale) | 1/5 | 0/5 | 0/5 | 0/5 | 0/5 |
| Championship (C sur diagonale) | 3/5 | 1/5 | 0/5 | 0/5 | 0/5 |
| Oval + Desert + Mountain (D, Neon et Championship exclus) | 3/5 | 1/5 | 0/5 | 0/5 | 0/5 |

Le succès et la collision sont deux métriques distinctes : un champion peut
terminer un tour puis heurter un mur avant le timeout. Le taux de réussite compte
les graines, pas les tours cumulés. Les réseaux testés sur leur circuit d’origine
sont aussi relus sans mise à jour des poids ; il ne s’agit alors pas d’un transfert
vers une piste inconnue.

| Condition pertinente | Test | Progression moyenne ± écart-type | Réussite | Collisions | Survie moyenne |
|---|---|---:|---:|---:|---:|
| A : Oval→Oval | Oval | 91,50 ± 19,01 % | 80 % | 20 % | 25,22 s |
| B : Oval→inconnu | Desert | 50,35 ± 43,38 % | 20 % | 60 % | 16,50 s |
| B : Oval→inconnu | Mountain | 12,46 ± 2,75 % | 0 % | 80 % | 9,61 s |
| B : Oval→inconnu | Neon | 19,43 ± 4,52 % | 0 % | 80 % | 10,48 s |
| B : Oval→inconnu | Championship | 15,10 ± 2,58 % | 0 % | 80 % | 9,90 s |
| C : Desert→Desert | Desert | 85,86 ± 24,75 % | 60 % | 40 % | 21,92 s |
| C : Mountain→Mountain | Mountain | 15,45 ± 2,79 % | 0 % | 80 % | 10,19 s |
| C : Neon→Neon | Neon | 22,78 ± 3,65 % | 0 % | 100 % | 4,94 s |
| C : Championship→Championship | Championship | 18,65 ± 2,74 % | 0 % | 80 % | 9,31 s |
| D : multi→tenu à l’écart | Neon | 15,33 ± 7,82 % | 0 % | 100 % | 3,73 s |
| D : multi→tenu à l’écart | Championship | 12,17 ± 6,12 % | 0 % | 100 % | 3,73 s |

La meilleure réussite spécialisée observée est Oval (4/5), puis Desert (3/5).
Le transfert Oval→Desert réussit pour un champion sur cinq ; les trois pistes
techniques ne sont terminées par aucun champion, même spécialisé. Le multi
n’apporte pas de réussite sur les deux pistes tenues à l’écart. Ces observations
ne démontrent donc pas une généralisation robuste. Elles n’établissent pas non
plus une impossibilité intrinsèque du réseau ou des pistes.

## 8. Tests et validation

Les 114 tests précédents sont conservés sans modification. Les ajouts couvrent
chargement/indépendance des pistes, invariance exacte de l’ovale, concavités,
erreurs géométriques, départs, normales et ordre, checkpoints stricts sur cinq
pistes, collisions balayées à grande vitesse, tours physiques de faisabilité,
sélection/réinitialisation, mono/multi, graines appariées, normalisation et pire
cas, anciens champions, provenance, transfert gelé, import de rapport et exports.
Un champion sauvegardé est rejoué exactement sur une piste inconnue et comparé
à l’épisode JSON. La stabilité multi-circuits exécute 20 000 pas synchronisés
avec plusieurs centaines de générations, en plus des validations prolongées
précédentes. Résultat exécuté : `npm.cmd test`, **158 tests réussis, zéro échec**,
dont les 114 précédents et 44 ajouts. La suite complète dure environ une minute
sur cet environnement ; ce n’est pas une garantie de durée sur un autre poste.

Chrome n’a pas été accessible à l’automatisation de cette session. Les contrats
DOM, événements, branchements Canvas et HTTP sont vérifiés séparément ; cela ne
remplace pas une inspection visuelle ni une validation au clavier humaine. Les
cinq circuits restent explicitement marqués « validation humaine à effectuer ».

## 9. Procédure de validation dans Chrome

1. Exécuter `npm.cmd start`, ouvrir `http://localhost:8000` dans Chrome. Éviter
   l’ouverture `file://`. Conserver le serveur local ouvert pendant les essais.
2. Choisir chacun des cinq circuits. Vérifier aperçu, nom, difficulté, voiture
   au départ, capteurs et checkpoint un actif. Accélérer avec ↑/Z/W, freiner avec
   ↓/S, tourner avec ←→/Q/D/A. Commencer lentement sur les circuits techniques.
3. Franchir 1…N−1 puis zéro pour un tour. Tester une arrivée précoce et une porte
   en sens inverse : aucun tour ne doit être validé. Heurter un mur : accident,
   arrêt, puis Réinitialiser. Vérifier pause, reprise et masquage des rayons.
4. Mono : choisir une piste, mode Entraînement IA mono-circuit, ajuster les
   paramètres, Démarrer. Exporter le meilleur avant de changer d’essai. Le JSON
   doit déclarer l’identifiant de la piste d’entraînement.
5. Transfert reproductible : ouvrir
   `http://localhost:8000/docs/experiments/etape-6/champions/oval-2026.json`,
   copier son JSON dans le champ neuronal. Choisir Neon City puis cliquer
   « Charger le JSON et tester sans réentraînement ». Vérifier source oval,
   cible neon, poids gelés et résultat sans tour, conformément au rapport.
   Refaire sur Training Oval : ce champion termine un tour au budget de 30 s.
6. Multi : choisir le mode dédié, cocher Oval, Desert et Mountain puis Démarrer.
   Contrôler les trois lignes de résultats et la provenance de l’export. Le
   rendu principal représente seulement la première piste, pas trois routes
   superposées. Tester Pause IA, Reprendre IA et Réinitialiser IA.
7. Déplier « Généralisation », charger les mesures livrées, sélectionner les
   six conditions et comparer les cinq cibles. Le panneau A–D historique reste
   indépendant. Un JSON invalide doit produire une erreur sans effacer le dernier
   tableau valide. Vérifier la console Chrome sans erreur.

## 10. Limites scientifiques et suite proposée

- Cinq graines seulement et petits budgets : pas de test de significativité,
  d’intervalle de confiance pré-déclaré ni de supériorité générale démontrée.
- Budget réservé égal, nombre de pas actifs différent. Le multi dispose de deux
  générations contre six générations mono : ce facteur confond diversité des
  pistes et nombre d’itérations évolutives (une reproduction multi contre cinq
  mono). Il faudra comparer des
  courbes au budget actif et une ablation à générations égales, en explicitant
  alors son surcoût.
- L’horizon 30 s peut être contraignant sur les pistes techniques ; la faisabilité
  lente à 55 px/s ne démontre pas un tour en 30 s. Les collisions précoces montrent
  toutefois qu’un simple allongement du timeout ne résoudra pas tous les échecs.
- Les entrées restent sept rayons et vitesse, sans mémoire, carte ni prochain
  checkpoint. L’anticipation dans les épingles et la commande couplée de vitesse
  peuvent limiter les politiques réactives. Aucune trajectoire de diagnostic
  n’est fournie au réseau pour masquer cette difficulté.
- Le score sature après un tour, donc ne distingue pas deux tours de dix tours,
  ni les temps de course. La fitness brute affichée en transfert dépend du nombre
  de portes : comparer prioritairement succès et progression normalisée, pas cette
  valeur brute entre pistes.
- Les cinq cartes sont maintenant observées expérimentalement : une future
  optimisation utilisant leurs résultats les transforme en validation. Prévoir
  des pistes de test finales supplémentaires avant toute affirmation générale.
- Environnements dynamiques, obstacles, nouvelle architecture neuronale et
  validation humaine sont reportés. Aucun obstacle mobile ni modification
  d’adhérence n’a été introduit. Aucun changement de l’étape 7 n’est commencé.

Pour l’étape 7, après validation : pré-déclarer un budget plus long et davantage
de graines, étudier vitesse et collisions dans les épingles, séparer validation
et test final, puis tester robustesse aux conditions physiques avec des expériences
de référence conservées. Une nouvelle entrée ou mémoire éventuelle nécessitera
une justification et une conversion explicite des champions ; le réseau livré
ici reste 8→12→2.

## 11. Inventaire de livraison

Huit fichiers existants modifiés :

- `README.md`, `index.html`, `package.json`, `styles.css`.
- `src/main.js`.
- `src/evolution/EvolutionEngine.js` : composition multi, fitness normalisée,
  métadonnées et sérialisation du champion.
- `src/view/NeuralPanel.js`, `src/view/TrainingPanel.js` : modes supplémentaires,
  configuration multi et diagnostics par piste.

Vingt nouveaux fichiers de code, tests et documentation :

- `src/track/TrackFactory.js`, `TrackRegistry.js`, `TrackValidator.js`.
- `src/evolution/MultiCircuitPopulation.js`, `NormalizedScore.js`.
- `src/ai/ChampionSerialization.js`.
- `src/experiments/Generalization.js`, `GeneralizationReport.js`, `TransferSession.js`.
- `src/diagnostics/FeasibilityDriver.js`.
- `src/view/TrackPanel.js`, `TransferPanel.js`, `GeneralizationPanel.js`.
- `tools/generalization.mjs`, `generalization-worker.mjs`, `validate-tracks.mjs`.
- `tests/multitrack.test.js`, `multitrack-interface.test.js`, `generalization.test.js`.
- `docs/ETAPE-6-CIRCUITS-GENERALISATION.md`.

Soixante-quatre nouveaux fichiers de mesures dans `docs/experiments/etape-6/` :
`resultats.json`, `evaluations.csv`, `summary.csv`, `validation-circuits.json`,
30 rapports individuels (`oval`, `desert`, `mountain`, `neon`, `championship`,
`multi`, chacun aux graines 2026…2030), et leurs 30 JSON dans `champions/`.
Total : **84 fichiers créés, 8 modifiés, aucun supprimé**.

Les anciens tests, documents et expériences restent inchangés. `Vehicle.js`,
`Car.js`, `Track.js`, `TrackVariants.js`, `CheckpointManager.js`, `Simulation.js`,
les capteurs, le contrôleur neuronal et la sérialisation neuronale historique
ne sont pas modifiés. Les TPs originaux, leurs Vehicle/vehicle.js, EvolutionArena
et les autres projets restent hors du périmètre d’écriture. Aucun commit,
push, installation de dépendance ou déploiement. Arrêt à l’étape 6.
