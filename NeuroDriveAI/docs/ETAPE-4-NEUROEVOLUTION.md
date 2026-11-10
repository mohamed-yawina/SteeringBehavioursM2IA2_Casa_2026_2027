# Étape 4 — Neuro-évolution

## Périmètre et fichiers protégés

Cette étape relie le moteur de conduite et les réseaux de l’étape 3 à une
population évaluée par algorithme génétique. Les modes Manuel et Autonome sont
conservés. Aucun travail de l’étape 5, mission ou déploiement n’est inclus.

Les trois documents précédents, les interfaces Car/Simulation/CheckpointManager,
NeuralNetwork/NeuralController/NetworkSerialization et les mécanismes génétiques
des deux TPs ont été examinés avant développement. Le TP 9 utilise `2^k`, une
roulette et une copie mutée à un seul parent. Le TP 9b utilise un score linéaire
avec proximité, un tournoi de cinq candidats et une copie mutée. Aucun des deux
ne réalise de crossover ou d’élitisme garanti. NeuroDrive ajoute ces opérateurs
sans modifier leurs implémentations.

Les 60 tests existants, tous les Vehicle/vehicle.js, Car.js, SensorSystem.js,
Simulation.js, CheckpointManager.js et les modules neuronaux de calcul/sérialisation
restent inchangés. Les adaptations existantes concernent uniquement l’application,
son affichage et ses commandes de mode. Aucun paquet installé.

## Modules

| Fichier | Rôle |
| --- | --- |
| `src/evolution/Random.js` | PRNG local déterministe et bruit gaussien. |
| `Genome.js` | Paramètres aplatis, validation, copie et reconstruction. |
| `Fitness.js` | Référence TP 9, formule améliorée et progression partielle. |
| `Selection.js` | Roulette stable et tournoi configurable. |
| `Crossover.js` | Croisement uniforme coefficient par coefficient. |
| `Mutation.js` | Probabilité, amplitude et bornes de sécurité. |
| `Population.js` | Simulations individuelles, progression, stagnation et résultats. |
| `EvolutionEngine.js` | Cycle, configuration figée, élitisme et archive du champion. |
| `EvolutionStatistics.js` | Statistiques de génération et diversité. |
| `src/view/TrainingPanel.js` | Paramètres et commandes d’entraînement. |
| `tools/experiment.mjs` | Essai headless reproductible, rapport et export du champion. |

Une population contient des objets d’évaluation, chacun avec sa propre Simulation,
sa Car héritant de Vehicle, son réseau, son manager de checkpoints et ses mesures.
Ces objets d’évaluation ne sont pas de nouvelles entités dessinées : le Renderer
affiche les Car existantes, avec les capteurs du leader seulement.

## Génome et architecture

L’évolution conserve strictement **8 → 12 → 2, tanh cachée et tanh de sortie**.
Un génome contient 134 nombres :

1. Poids cachés, 12 lignes de 8 coefficients : 96 nombres.
2. Biais cachés : 12 nombres.
3. Poids de sortie, 2 lignes de 12 : 24 nombres.
4. Biais de sortie : 2 nombres.

`Genome.fromNetwork()` extrait ces valeurs ; `toNetwork()` reconstruit exactement
les matrices dans l’ordre précédent. `copy()` crée un nouvel objet et un nouveau
tableau. Les tableaux sont gelés ; les paramètres reconstruits ont également
leur propre stockage immuable. Ni crossover, ni mutation, ni élitisme ne modifient
un parent.

Chaque gène doit être fini, dans **[−5,5]**. Les mauvaises dimensions, valeurs
absentes, tableaux clairsemés et architectures incompatibles sont rejetés. Le
réseau générique de l’étape 3 accepte davantage de valeurs et topologies ; un
import d’entraînement est volontairement plus strict. Il ne tronque pas un réseau
incompatible pour le faire entrer dans le génome.

## Conditions d’évaluation comparables

L’engine clone la piste puis gèle récursivement ses données. Cette copie est
partagée en lecture seule : changer la piste source ne modifie pas un essai.
Toutes les voitures partent du même point, au même cap, à vitesse nulle, avec
les mêmes dimensions, capteurs, forces maximales et délais. Aucun jitter initial.
Les voitures ne se collisionnent pas entre elles : seuls les murs les affectent.
La taille de population n’introduit donc pas de trafic différent pour un individu.

La configuration est validée puis gelée pour tout l’essai. L’application et
l’outil expérimental utilisent un pas fixe de **1/120 s**. Changer la vitesse
d’affichage ×1/×2/×5/×10 répète ce même pas, sans augmenter le dt ni la vitesse
physique maximale. Le rattrapage du moteur reste limité ; une machine chargée
peut ralentir le temps simulé par rapport au temps réel.

Le réseau reçoit toujours uniquement les sept distances normalisées et la vitesse.
Les objectifs/checkpoints servent à l’évaluation, jamais à une commande de
direction codée à la main. Les forces passent par Simulation → Car.control →
applyForce et la locomotion de l’étape 2.

## Fitness de référence TP 9

Soit C le nombre de checkpoints validés. La fitness brute est :

```text
F_ref = 2^min(C, 1023)
```

Pour les valeurs ordinaires, c’est exactement l’exponentielle du `vehicle.js`
original, malgré son commentaire « au carré ». Le plafonnement à 1023 évite
Infinity. C est ramené à un entier non négatif ; une valeur invalide devient zéro.
Une voiture sans progrès reçoit donc 1, comme dans le TP 9.

La roulette normalise implicitement ces poids par leur somme ; une normalisation
préalable du champ fitness n’est pas nécessaire. L’amplification exponentielle
concentre fortement la sélection ; de très petits poids peuvent devenir
négligeables face au maximum. Temps, collision, stagnation et tours ne modifient
pas directement cette fitness.

Cette option reproduit la **formule de référence**, pas les bugs ou le protocole
entier du TP : NeuroDrive garde ses checkpoints stricts, sa piste stable et son
réseau 8→12→2. Il ne crédite pas un checkpoint parce que la voiture se trouve près
de sa droite infinie et ne crédite pas gratuitement la porte de départ.

## Fitness améliorée : formule exacte

Pour un individu évalué :

- C : nombre de checkpoints réellement franchis, dans l’ordre et le bon sens.
- L : nombre de tours validés par le manager existant.
- f : meilleur avancement partiel dans le secteur courant, borné à [0;0,999].
- t : temps effectivement simulé pour cet individu.
- T : durée maximale d’une génération, commune à la population.
- q_collision : 0,75 en cas de collision, sinon 1.
- q_stagnation : 0,5 si l’élimination est due à la stagnation, sinon 1.

```text
B = 100 C + 50 f + 500 L
F_améliorée = max(0, B) / (1 + t/T) × q_collision × q_stagnation
```

Un tour récompense à la fois ses checkpoints et un bonus de 500 ; ce cumul est
intentionnel. Un timeout n’ajoute pas de facteur distinct : son coût temporel
est déjà inclus. Une progression identique plus rapide reçoit davantage de
fitness. Une collision ne remet pas à zéro les checkpoints déjà obtenus.

Les métriques numériques invalides deviennent zéro ; C, L et t sont bornés à
1e6 et C/L sont entiers. T doit être fini et strictement positif. Ces précautions
et le plafonnement de f garantissent une fitness finie, positive ou nulle.

### Progression et protection contre les récompenses artificielles

Dans le premier secteur, A est le départ. Ensuite, A est le centre de la dernière
porte valide ; B est le centre de la prochaine porte attendue. Pour la position P :

```text
f_courant = clamp(dot(P−A, B−A) / |B−A|², 0, 0,999)
progression_courante = C + f_courant
progression = maximum atteint depuis le départ
```

Le meilleur f du secteur courant est conservé jusqu’au vrai checkpoint suivant.
Une proximité ne valide aucune porte. Au franchissement strict, C augmente et
le secteur change. Le compteur ne peut pas augmenter en sautant une porte, à
contresens ou après une collision, grâce au CheckpointManager et au mouvement
accepté avant contact. La distance parcourue et le temps de survie ne rapportent
aucun bonus : un véhicule parfaitement immobile reçoit zéro avec cette fitness.
Des oscillations ne s’additionnent pas, puisqu’on conserve un maximum et non la
somme des déplacements.

La projection est un **signal partiel approximatif**, pas une distance certifiée
le long de la piste. Une translation latérale ou un trajet incorrect peut
rapporter un petit crédit partiel, toujours inférieur à un checkpoint brut, mais
ne peut créer un checkpoint ou un tour. Les murs continus empêchent de traverser
l’intérieur de l’ovale pour couper la piste. Il reste nécessaire de comparer
les poids de cette formule et de tester d’autres pistes avant de la considérer
comme une métrique de qualité générale.

## Stagnation et fin d’évaluation

Un individu garde une marque de progression significative. Chaque fois que
`C + f_courant` dépasse cette marque de **plus de 0,01**, la marque et son horloge
de progrès sont mises à jour. Les petites avancées successives se cumulent pour
atteindre ce seuil ; osciller sous le maximum déjà atteint ne le rafraîchit pas.
Sans nouveau progrès significatif pendant `stagnationTime`, l’individu est éliminé.

Les causes finales sont distinctes : **collision**, **stagnation**, **timeout**.
Une expiration de délai désactive la voiture mais ne lui invente pas un accident.
Avant tout remplacement, un résultat immuable conserve identifiant, génération,
checkpoints, tours, fraction, progression, temps, distance et cause de fin. La
fitness finale est calculée sur ce résultat. Les doubles appels de finalisation
ne changent pas un résultat déjà enregistré.

Une génération se termine lorsque toutes les voitures sont éliminées ou que T
est atteint. Un dernier pas est tronqué si nécessaire pour respecter T. Les
voitures encore actives sont finalisées explicitement comme timeout ; aucune
n’est écartée sans résultat. Les dernières positions restent disponibles au
passage de la frontière de génération, puis la reproduction démarre au tick suivant.

## Sélection, crossover, mutation et élitisme

**Roulette.** Les fitness finies positives sont divisées par la plus grande avant
la somme : cela évite le débordement même pour de très grandes valeurs. Les
valeurs négatives/non finies valent zéro pour la sélection. Si la somme est
nulle, le parent est choisi uniformément. Le tirage exact zéro ne sélectionne
pas un candidat de poids zéro et ne produit pas d’indice −1. Une dernière borne
de repli absorbe les arrondis de la somme.

**Tournoi.** Tirer `tournamentSize` candidats avec remise et garder le meilleur.
Les égalités conservent le premier candidat tiré. Cela fonctionne aussi avec
un seul individu et avec des fitness toutes égales. Une population vide est
rejetée explicitement par les opérateurs et par Population.

**Crossover uniforme.** Pour chacun des 134 coefficients, choisir le gène du
parent A ou B avec probabilité 1/2. La longueur et la topologie restent fixes.
Un enfant possède son propre tableau et son propre réseau. Les deux parents
peuvent être identiques ; l’opérateur ne promet pas d’améliorer leur performance.

**Mutation.** Chaque gène a une probabilité `mutationRate` de recevoir :

```text
nouveau_gène = clamp(gène + amplitude × clamp(N(0,1), −5, 5), −5, 5)
```

Le bruit est obtenu par Box–Muller depuis le PRNG local Mulberry32, sans
Math.random. La probabilité est dans [0,1], l’amplitude dans [0,5]. Une amplitude
ou probabilité nulle conserve les valeurs. Le bruit tronqué et les bornes
interdisent des poids non finis ou hors de la plage de sécurité.

**Élitisme.** Trier par fitness finale et recopier les `eliteCount` meilleurs
génomes sans crossover ni mutation. Les valeurs sont identiques, le stockage
reste indépendant. Zéro élite est autorisé ; toute la population peut aussi être
conservée. Ce dernier réglage bloque l’exploration. Les élites sont réévaluées
au départ dans la nouvelle génération, pas créditées d’une ancienne mesure.

## Cycle et reproductibilité

```text
Initialiser les réseaux par graines
→ simuler et finaliser chaque individu
→ enregistrer les statistiques et archiver le meilleur
→ recopier les élites
→ sélectionner deux parents par enfant restant
→ crossover uniforme → mutation
→ reconstruire de nouvelles simulations au départ
→ génération suivante
```

Un seul flux PRNG d’essai produit les graines d’initialisation et les tirages des
opérateurs. Les réseaux conservent leur initialisation déterministe de l’étape 3.
Même graine, configuration, piste et suite de dt donnent les mêmes générations
dans le même environnement JavaScript. Pause ne consomme ni temps ni tirage.
Reset recrée la population initiale et le PRNG. La graine stockée dans un réseau
évolué indique une origine ; elle ne suffit plus à reconstruire ses poids après
crossover/mutation. Les poids exportés sont la source de vérité.

## Paramètres

| Paramètre | Défaut | Plage / effet |
| --- | --- | --- |
| Population | 50 | 1–200 voitures. |
| Graine d’essai | 2026 | uint32. |
| Sélection | tournoi | tournoi ou roulette. |
| Taille tournoi | 5 | 1–100, tirage avec remise. |
| Fitness | améliorée | améliorée ou référence TP 9. |
| Mutation | 0,10 | probabilité par coefficient, 0–1. |
| Amplitude | 0,20 | écart-type avant troncature, 0–5. |
| Élites | 2 | 0–taille de population. |
| Durée maximale | 20 s | 0,1–120 secondes simulées. |
| Stagnation | 4 s | 0,1–120 secondes sans progrès significatif. |
| Vitesse UI | ×1 | ×1, ×2, ×5 ou ×10, répétitions du pas fixe. |

Les paramètres génétiques et les conditions ne changent jamais au milieu d’une
évaluation. Le formulaire peut être édité, mais Démarrer un nouvel essai ou
Réinitialiser IA est nécessaire pour l’appliquer. Ces actions effacent historique
et archive ; exporter le champion avant de recommencer si on veut le conserver.
La vitesse peut varier immédiatement car elle ne modifie pas le problème simulé.

## Statistiques et meilleur réseau

Chaque génération enregistre dans `engine.history` : numéro, durée, population,
fitness max et moyenne, nombre de voitures ayant au moins un checkpoint, somme
des tours, collisions, stagnations, timeouts, maximum de checkpoints dans la
population (`bestCheckpoints`) et diversité. La moyenne est calculée avec une
mise à l’échelle par le maximum pour éviter Infinity avec la référence exponentielle.

Diversité simplifiée : racine carrée de la moyenne, sur les 134 gènes, des variances
de ces gènes dans la population. Des clones exacts donnent zéro. Cette mesure
n’est ni une distance entre comportements, ni une preuve d’exploration utile.

Toutes les statistiques sont conservées en mémoire, les 20 dernières sont
affichées. `lastResults` conserve les résultats individuels de la dernière
génération terminée ; les génomes/trajectoires de toutes les générations ne sont
pas conservés indéfiniment. L’archive globale stocke une copie indépendante du
meilleur génome évalué, son résultat, sa fitness et sa génération. Une égalité
ne remplace pas le précédent champion.

Exporter le meilleur utilise le **format neuronal v1 existant**, sans conversion
de poids. Le JSON peut être importé dans le panneau neuronal ou dans l’archive
d’entraînement, puis utilisé en autonome. Importer une archive ne fabrique pas
de score : sa fitness et sa génération deviennent inconnues (`null`) tant qu’elle
n’a pas été évaluée. Cela ne remplace pas la population en cours et ne reprend
pas une session avec son PRNG. Un import invalide est atomique : l’ancien modèle
reste en place. L’archive peut être remplacée explicitement par un import.

Le graphe inspecte le leader courant en entraînement. Les boutons du réseau
individuel sont alors désactivés pour éviter de confondre ce leader et le réseau
autonome. L’inspection des poids utilise une vue séparée en lecture seule : elle
n’écrase pas le champ de JSON exporté ou collé pendant que le leader change.

## Tests et vérifications

```powershell
npm test
```

Résultat de livraison : **88 tests réussis, zéro échec**, comprenant les 60 tests
existants sans modification et 28 nouveaux tests dans quatre fichiers :

- `tests/evolution-operators.test.js` : génomes, reconstruction, copie, bornes,
  deux fitness, roulette, tournoi, crossover, mutations, PRNG et statistiques.
- `tests/evolution-engine.test.js` : conditions figées, population vide, timeouts,
  stagnation, élitisme 0/partiel/total, fitness nulles, pause/reset, plusieurs
  générations reproductibles, archive, progression partielle, collision réelle,
  cumul des petits progrès et absence de récompense cumulative par oscillation.
- `tests/evolution-interface.test.js` : entrée réelle de l’application avec contrat
  DOM/Canvas, modes, démarrage, pause/reprise/reset, export/import du champion,
  réutilisation autonome, erreurs de paramètres et inspection sans écrasement JSON.
- `tests/evolution-artifacts.test.js` : relecture du champion livré et reproduction
  de ses checkpoints/tours après 12 secondes dans le moteur autonome.

Le test prolongé effectue **20 000 ticks évolutifs**, avec populations de deux
individus et durées courtes, traverse plus de 100 générations et vérifie les
résultats finaux, les fitness et la diversité finies. Il ne se contente pas de
répéter une voiture déjà inactive. Les tests prolongés du moteur et du contrôleur
neuronal des étapes précédentes sont également conservés.

Les tests de contrat UI ne vérifient pas les pixels. Aucun navigateur connecté
n’est disponible dans l’outil Browser de cette session ; la validation visuelle
reste à effectuer. Aucun rendu en navigateur réel n’est prétendu vérifié.

## Premier essai expérimental

Commande depuis le dossier projet :

```powershell
npm run experiment -- 6 50 docs/experiments/nouvel-essai
```

Le script utilise Node et le vrai module p5.Vector via l’adaptateur headless
déjà utilisé par les tests. Il ne nécessite aucun navigateur ni installation.
L’argument de sortie est facultatif ; s’il est fourni, `resultats.json` et
`champion.json` sont écrits dans ce dossier. Un dossier nouveau évite d’écraser
un précédent essai.

Protocole : Node 24.18.0, ovale unique, 50 voitures, graine 2026, dt=1/120 s,
6 générations, durée max **12 s**, stagnation **3 s**, tournoi de 5, mutation
0,10 / amplitude 0,20, 2 élites, fitness améliorée. Le protocole a été exécuté
deux fois et a reproduit les mêmes statistiques par génération.

| Génération | Fitness max | Moyenne | Voitures avec CP | Max CP | Tours | Collisions | Diversité |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 85,07 | 19,54 | 8 | 2 | 0 | 26 | 0,3265 |
| 2 | 321,40 | 43,77 | 15 | 6 | 0 | 32 | 0,3208 |
| 3 | 415,65 | 81,42 | 22 | 8 | 0 | 39 | 0,3121 |
| 4 | 415,65 | 97,17 | 27 | 8 | 0 | 43 | 0,2985 |
| 5 | 415,65 | 108,21 | 29 | 8 | 0 | 45 | 0,2796 |
| 6 | 551,87 | 149,69 | 26 | 11 | 0 | 41 | 0,2723 |

Le champion provient de la génération 6 : fitness **551,869358956088**, 11 portes
validées, **zéro tour complet**. La croissance des scores et des checkpoints est
un progrès mesuré sur ce protocole d’entraînement, pas une preuve de conduite
fiable ou de généralisation. Les collisions restent importantes, le nombre de
voitures franchissant des portes n’augmente pas à chaque génération, et la
diversité diminue. Aucun essai témoin sans sélection, comparaison multi-graines
ou circuit de validation indépendant n’a été réalisé.

Fichiers livrés : [rapport complet](experiments/essai-2026/resultats.json) et
[champion neuronal compatible v1](experiments/essai-2026/champion.json).

## Utilisation dans le navigateur

```powershell
cd 'C:\Users\Simo\Desktop\SteeringBehavioursM2IA2_Casa_2026_2027\NeuroDriveAI'
npm start
```

Ouvrir `http://127.0.0.1:8000` :

1. Choisir Entraînement IA, régler la population et les paramètres puis Démarrer
   un nouvel essai. Pour reproduire le tableau, régler durée 12 et stagnation 3.
2. Observer les voitures, la génération, les actives, les fitness, les checkpoints,
   tours, le temps simulé, la sélection et le taux de mutation.
3. Mettre Pause IA ou utiliser la pause globale ; Reprendre IA conserve l’essai.
   Quitter le mode entraînement le suspend. Changer d’onglet met aussi en pause.
4. Modifier la vitesse ; les dt restent identiques. Les modifications génétiques
   attendent le prochain nouvel essai/reset, jamais la génération courante.
5. Ouvrir l’historique, exporter le meilleur JSON, puis Utiliser en autonome pour
   tester l’archive au départ. Le moteur d’entraînement est alors suspendu.
6. Pour le champion livré, copier `docs/experiments/essai-2026/champion.json` dans
   le champ JSON, cliquer Importer depuis le champ JSON puis Utiliser en autonome.
7. Revenir en Manuel et réinitialiser pour retrouver le contrôle clavier.
8. Vérifier l’absence d’erreurs console et de ressources CDN : tout reste local.

## Inventaire de livraison

Créés : neuf modules `src/evolution/`, `src/view/TrainingPanel.js`, quatre suites
`tests/evolution-*.test.js`, `tools/experiment.mjs`, le présent document et les
deux JSON `docs/experiments/essai-2026/`.

Modifiés : `src/main.js`, `src/view/Renderer.js`, `src/view/NeuralPanel.js`,
`index.html`, `styles.css`, `README.md`, `package.json` (0.4.0 et commande experiment).

## Limites et arrêt de l’étape

- Un seul circuit, aucune validation multi-graines ou sur des tracés inconnus.
- Coefficients de fitness et seuils de stagnation heuristiques. La progression
  partielle est une projection bornée ; la fitness n’est pas une garantie de
  conduite sûre. Le crossover uniforme peut casser des combinaisons utiles.
- Pas de mémoire neuronale, gestion de trafic ou contrôle réaliste des pneus.
- Raycasting/collisions linéaires dans le nombre de murs. Une grande population
  avec accélération ×10 peut diminuer fortement les FPS et ralentir le temps réel.
- Historique en mémoire jusqu’au reset ; pas de reprise complète de session,
  ni persistance automatique des entraînements UI. Exporter l’archive est nécessaire.
- Les hypothèses de validité géométrique des pistes et la marge conservatrice de
  collision de l’étape 2 demeurent. Aucun apprentissage garanti par un test unitaire.

Les TPs originaux, EvolutionArena et tous les autres projets restent intacts.
Aucun commit, push ou déploiement. L’étape 5 n’est pas commencée ; validation
utilisateur attendue avant toute suite.
