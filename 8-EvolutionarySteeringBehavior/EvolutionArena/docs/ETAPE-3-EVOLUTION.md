# Étape 3 — Évolution génétique

Projet : **EVOLUTION ARENA — Survival of the Smartest**. Date : 25 octobre 2026.

## Périmètre et sources

L'étape 2 et ses classes `DNA`, `Creature` et `Simulation` ont été relues avant modification. Le TP original a été vérifié avec `git show HEAD:8-EvolutionarySteeringBehavior/vehicle.js`, référence locale `b7790773543acf9fb73160428f24d376acee57ab`. La version EvoSwarm présente à côté n'a pas servi de base génétique.

Le code fourni `vendor/vehicle.js` reste intact. Seek, `applyForce()` et l'intégration de la locomotion sont toujours réutilisés. Les modules de perception, de steering et le pas fixe de l'étape 2 restent en place. Aucun prédateur, mission, événement spécial, musique, sauvegarde ou menu avancé n'est ajouté. Aucun projet voisin modifié, aucune dépendance installée, aucun commit, push ou déploiement. Les empreintes SHA-256 des fichiers voisins relevées avant intervention et de `vendor/vehicle.js` ont été vérifiées après développement : elles sont identiques.

## Architecture et fichiers concernés

| Fichier | Modification / responsabilité |
| --- | --- |
| `src/core/DNA.js` | Bornes explicites par locus, copie indépendante, mutation uniforme bornée et validation des paramètres. |
| `src/core/random.js` — nouveau | Générateur déterministe à graine entière 32 bits. |
| `src/evolution/reproduction.js` — nouveau | Valeurs par défaut, validation atomique et conditions de reproduction pures. |
| `src/evolution/EvolutionMetrics.js` — nouveau | Agrégation des gènes, diversité, consommation, vies terminées et historique borné. |
| `src/entities/Creature.js` | Identité, filiation, génération, âge en secondes, enfants directs, date de dernière naissance et halo transitoire. |
| `src/simulation/Simulation.js` | Création des descendants, compteurs, plafond, graines, sélection et orchestration des deux modes. |
| `src/behaviors/perception.js` | Retourne le nombre de ressources consommées pour les mesures, sans changer la règle de contact. |
| `src/ui/Interface.js` | Commandes génétiques, graine, statistiques et inspecteur. |
| `src/ui/ArenaRenderer.js` | Couleur de génération, halo de naissance et cercle de sélection. |
| `src/main.js` | Sélection au clic, y compris en pause ; ajout de ressources dans le vide conservé. |
| `index.html`, `styles.css` | Paramètres, statistiques, table des gènes et panneau individuel. |
| `tests/evolution.test.js` — nouveau | Tests unitaires et endurance génétique dans les deux modes. |
| `tests/helpers/runtime.js`, `tests/interface.test.js` | Nouveaux éléments UI simulés et vérification de leur présence dans le vrai HTML. |
| `tests/engine.test.js` | Le test d'endurance de l'étape 2 active explicitement le mode témoin afin de conserver son hypothèse « population sans naissance ». Les 35 tests historiques sont conservés. |
| `README.md`, `package.json`, `vendor/NOTICE.md` | Instructions actualisées et version 0.3 ; crédits conservés. |
| `docs/ETAPE-3-EVOLUTION.md` — nouveau | Ce document. |

Le document de l'étape 2 reste volontairement historique. Les méthodes de clonage et de mutation de la base fournie ne sont pas appelées : Arena appelle toujours `super(x, y)` sans ADN parental, puis utilise ses propres modules génétiques.

## ADN et héritage

Un ADN reste composé de quatre réels, dans l'ordre exact du TP :

| Indice | Signification | Bornes conservées | Perturbation à amplitude 1 |
| --- | --- | --- | --- |
| 0 | Poids nourriture | [-2, 2] | Uniforme entre -0,1 et +0,1 |
| 1 | Poids poison | [-2, 2] | Uniforme entre -0,1 et +0,1 |
| 2 | Perception nourriture | [0, 100] pixels | Uniforme entre -10 et +10 pixels |
| 3 | Perception poison | [0, 100] pixels | Uniforme entre -10 et +10 pixels |

Sources : constante `GENE_LIMITS` dans `DNA.js`, `DNA.constructor()`, `DNA.mutated()` et constructeur original de Vehicle. Les intervalles initiaux de tirage excluent leur borne supérieure ; la saturation des mutations peut, elle, atteindre la borne.

`DNA.copy()` crée un nouvel objet et un nouveau tableau gelé. `DNA.mutated()` fait de même, même quand aucun gène ne change. Le constructeur de `Creature` copie également l'ADN reçu : deux créatures ne partagent donc jamais un objet DNA ni son tableau de gènes. L'ADN parental est immuable.

Le signe des poids conserve sa signification : Seek pour une attraction, Flee pour une répulsion. Chaque rayon influence indépendamment la détection. Ni vitesse maximale ni espérance de vie ne sont de nouveaux gènes.

## Mutation

À chaque naissance, chaque gène subit un tirage indépendant :

```text
si aléatoire < mutationRate :
    delta = uniforme(-1, +1) × amplitude × pasDuGène
    gèneEnfant = borner(gèneParent + delta, minimumDuGène, maximumDuGène)
sinon :
    gèneEnfant = gèneParent
```

La probabilité de référence est **0,01 = 1 % par gène**, comme dans le TP. Pour quatre loci indépendants, la probabilité théorique d'au moins un tirage de mutation est `1 - 0,99^4 ≈ 3,94 %` par naissance. Le compteur « gènes effectivement modifiés » compte uniquement les différences numériques après saturation : un tirage peut ne rien changer si l'amplitude est nulle ou si la perturbation pousse vers l'extérieur d'une borne.

L'amplitude UI est un multiplicateur commun de 0 à 5 : à 1, on retrouve les amplitudes du TP ; à 2, elles doublent. Les poids et perceptions gardent leurs échelles propres. Les perturbations sont uniformes, pas gaussiennes. Les bornes après mutation sont une protection ajoutée à Arena : le TP original n'en applique pas.

## Reproduction et cycle de simulation

La reproduction est asexuée : un parent, pas de couple ni de recombinaison. `canReproduce()` détermine l'admissibilité ; `Simulation.tryReproduce()` effectue le tirage et la création. La probabilité de référence est `0.002`, soit **0,2 % par pas fixe de 1/60 s**, pour chaque individu admissible. Ce n'est pas 0,002 %.

En mode Arena, toutes ces conditions doivent être vraies :

1. Parent vivant et présent dans la simulation, simulation active.
2. Population strictement inférieure au plafond.
3. Énergie au moins égale au seuil configuré et strictement supérieure au coût, afin que le parent conserve une énergie positive.
4. Âge au moins égal à l'âge minimal.
5. Première naissance, ou délai écoulé depuis la dernière naissance du parent.
6. Succès du tirage probabiliste.

Si un test échoue, aucun coût n'est prélevé et le délai ne redémarre pas. Si la naissance réussit :

- Le parent perd `energyCost` ; l'enfant reçoit exactement cette énergie. La somme parent + enfant ne gagne donc aucune énergie lors de la naissance en mode Arena.
- Le descendant apparaît à la position du parent, avec une vitesse `(0, -2)` comme dans le TP et une accélération neuve. Aucune trajectoire n'est imposée ensuite.
- Il reçoit une copie éventuellement mutée de l'ADN, un nouvel ID, l'ID parental, la génération du parent + 1, un âge nul et zéro enfant direct.
- Les compteurs du parent et du monde sont actualisés ; le halo dure 0,8 seconde simulée.

Ordre d'un pas dans `Simulation.step()` : consommation → steering → locomotion et âge → retrait des morts → essais de reproduction sur une photographie des survivants → renouvellement des ressources → éventuel échantillon de mesures. Un nouveau-né ne consomme, ne bouge et ne se reproduit qu'au pas suivant. Aucun clonage post-mortem.

Les naissances sont ajoutées une à une en vérifiant le plafond, donc plusieurs parents ne peuvent pas le dépasser au même pas. Le parcours des parents reste ordonné et peut avantager ceux traités en premier au voisinage du plafond : c'est une limite du modèle, pas un classement par fitness.

## Deux modes comparables, sans prétendre reproduire tout le TP

| Règle | TP original | « TP 8 comparable » dans Arena | Evolution Arena |
| --- | --- | --- | --- |
| Probabilité de naissance | 0,002 par image | 0,002 par pas fixe par défaut | 0,002 par pas admissible par défaut |
| Âge minimal | Aucun | Aucun | Configurable, 6 s par défaut |
| Seuil d'énergie | Aucun | Aucun, mais parent vivant | 1,15 par défaut |
| Coût parental | Aucun | Aucun | 0,4 par défaut |
| Énergie initiale enfant | 1 | 1 | Égale au coût transféré |
| Délai entre naissances | Aucun | Aucun | 8 s par défaut |
| Plafond | Aucun | Configurable | Configurable |
| Mutation | 1 % / gène, uniforme | Même référence, configurable | Même référence, configurable |
| Bornes après mutation | Aucune | Oui | Oui |
| Parent déjà mort | Clonage possible avant retrait | Interdit | Interdit |

Le mode TP conserve la logique de reproduction sans conditions, mais **n'est pas une émulation complète du TP**. Les deux modes Arena partagent la physique, le Flee corrigé, le drain de l'étape 2, les ressources plafonnées, la santé maximale et le retrait des morts. Ils n'ajoutent pas non plus la nourriture issue des cadavres du TP. Cela permet d'isoler une comparaison des règles de reproduction dans un même moteur.

Un troisième mode « témoin sans reproduction » permet de mesurer les changements dus à la mortalité seule. Les contrôles de coût, seuil, âge et délai sont désactivés en mode TP ou témoin, car ces règles n'y sont pas appliquées. Les paramètres sont conservés lors du changement de mode.

## Paramètres et unités

| Paramètre | Défaut | Domaine accepté par le moteur |
| --- | --- | --- |
| `mode` | `arena` | `arena`, `tp`, `off` |
| `mutationRate` | 0,01 | [0, 1] |
| `mutationAmplitude` | 1 | [0, 5] |
| `energyThreshold` | 1,15 | [0 ; 1,5] |
| `energyCost` | 0,4 | [0,01 ; 1,5] |
| `minAge` | 6 s | [0, 300] s |
| `cooldown` | 8 s | [0, 300] s |
| `maxPopulation` | 120 | Entier de 1 à 1000 |
| `birthProbability` | 0,002 / pas | [0, 1], API moteur, pas de slider |
| `seed` | 2026 | Entier de 0 à 4294967295 |

Les sliders exposent des plages pratiques plus courtes pour l'âge et le délai (0 à 60 s), et le coût commence à 0,05. Le moteur valide ses paramètres avant de les remplacer ; une valeur invalide ne modifie pas la configuration.

Diminuer le plafond sous l'effectif actuel bloque les nouvelles naissances sans tuer les créatures. Lors d'un reset, le nombre de fondateurs devient `min(36, plafond)`. Pour comparer deux essais, le plafond doit donc rester identique dès l'initialisation.

## Identité, générations et sélection individuelle

Les IDs suivent `r<expérience>-c<numéro>`, uniques dans l'instance de simulation et non réutilisés après reset. Les créatures créées hors Simulation ont un ID autonome distinct. Un fondateur est de génération 1, sans parent. Un enfant prend exactement la génération du parent + 1 : les générations coexistent et ne constituent pas des vagues de remplacement.

`offspringCount` compte les **enfants directs**, pas tous les descendants de la lignée. Le maximum de génération affiché est historique pour l'expérience : il reste atteint même si cette génération meurt.

Clic sur une créature : sélection avec cercle blanc et panneau ADN, parent, âge, énergie et enfants. Clic vide : désélection et ajout de nourriture si la simulation tourne. Maj + clic : poison. En pause, la sélection reste possible et les ajouts de ressources sont bloqués. Après le décès d'un individu sélectionné, l'interface le signale sans conserver l'objet mort ; le reset efface la sélection.

Les couleurs indiquent G1 bleu, G2 vert, G3 or, G4 violet, puis un cycle. Elles ne codent ni la performance ni une génération exacte au-delà de ce cycle ; le panneau fournit le numéro exact.

## Sélection naturelle et métriques d'adaptation

Il n'y a ni sélection explicite des meilleurs parents ni apprentissage individuel. Les gènes affectent les rencontres avec nourriture et poison ; cela affecte survie et énergie, donc les occasions de reproduction. C'est une sélection différentielle, mêlée au hasard des positions et des tirages. La population subit aussi une dérive génétique et les effets du plafond.

**Naissances, mutation ou augmentation du numéro de génération ne prouvent pas une adaptation.** Un mode qui crée gratuitement de l'énergie peut avoir beaucoup de descendants sans produire des comportements meilleurs.

Métriques disponibles dans `Simulation.stats` et l'interface :

- Population, naissances hors fondateurs, morts et génération maximale historique.
- Âge et énergie moyens des vivants.
- Moyennes initiales et actuelles des quatre gènes ; variance calculée et écart-type affiché par locus, pour observer la diversité.
- Durée de vie moyenne et nombre moyen d'enfants directs sur les **vies terminées**. Les survivants sont censurés et ne sont pas inclus : ces valeurs peuvent sous-estimer les performances des lignées encore vivantes.
- Nourriture et poison consommés par créature-seconde d'exposition, estimée au pas fixe. L'énergie ingérée n'est pas forcément entièrement conservée, à cause du plafond d'énergie.
- Nombre de gènes effectivement modifiés, temps passé au plafond et nombre d'interventions pendant l'expérience.

`EvolutionMetrics.history` garde un échantillon par seconde simulée, plus les changements de paramètres, avec les statistiques, la graine et les paramètres génétiques. Il est limité à 600 entrées ; les plus anciennes disparaissent. Il ne conserve pas d'objets Creature ni d'arbre généalogique complet. Les fondateurs ne comptent pas comme naissances. Le reset remet toutes les métriques à zéro.

Protocole nécessaire pour évaluer une adaptation : répéter plusieurs graines pour chaque mode, garder environnement et paramètres identiques hors variable étudiée, comparer les performances à durée égale et la diversité, utiliser le témoin sans reproduction. Idéalement, évaluer ensuite des ADN descendants et fondateurs dans un environnement commun indépendant de leur entraînement. Cette évaluation commune et une analyse statistique multi-graines ne sont **pas réalisées ni démontrées** ici.

## Reproductibilité et limites expérimentales

`core/random.js` fournit un générateur déterministe. Le reset avec la même graine remet à zéro les flux d'environnement et de génétique. À paramètres et interactions identiques, les positions, ADN et événements de la simulation sont reproductibles. Les IDs changent volontairement pour rester uniques entre expériences.

Les tirages génétiques n'avancent pas le flux d'apparition des ressources. Deux modes avec la même graine ont les mêmes fondateurs et le même environnement initial. Après divergence des populations et consommations, les environnements rencontrés ne sont pas nécessairement identiques, même avec cette séparation des flux.

Un générateur `rng` peut être injecté pour les tests ; son état externe n'est pas rembobiné par reset et `setSeed()` le refuse explicitement. En production, la graine intégrée est utilisée. Les tirages p5 internes au constructeur fourni créent un ADN temporaire ensuite remplacé ; ils n'influencent pas l'ADN actif des créatures, les positions ou les règles génétiques d'Arena.

Les changements de sliders et les clics d'ajout de ressources sont comptés comme interventions ; sélection, perception et pause ne le sont pas. Pour une mesure reproductible, ne pas ajouter de ressources manuellement et réinitialiser après avoir choisi tous les réglages. Modifier un paramètre en cours de route ne réécrit pas l'ADN des créatures existantes.

## Tests et résultats

Commande depuis le dossier EvolutionArena :

```powershell
node --test tests/*.test.js
```

**Résultat exécuté avec Node.js v24.18.0 : 62 tests, 62 réussis, 0 échec, 0 ignoré.** Les 35 tests historiques sont conservés et 27 vérifications supplémentaires couvrent cette étape.

La suite inclut les 35 tests précédents, les tests génétiques et les vérifications supplémentaires d'interface. Les cas couvrent : copies indépendantes, héritage, mutation par locus, probabilités 0/1 et référence 1 %, amplitudes et bornes, paramètres invalides, seuils exacts, coût, délai, échec sans prélèvement, parent/enfant/petit-enfant, coexistence, décès avant reproduction, population maximale, pause, reset et répétabilité, métriques calculées sur des exemples connus, sélection et rendu simulé des halos/générations.

L'endurance comprend **20 000 pas dans chacun des deux modes**, avec reproduction active : pas de NaN ou d'infini dans les vecteurs, âges, halos ou énergies ; ADN borné ; objets DNA et IDs distincts ; parents connus ; relation `fondateurs + naissances - morts = population` conservée. Ces tests utilisent des paramètres accélérés, pas les paramètres biologiques par défaut.

Résultats déterministes observés pour la graine 2026 :

| Scénario | Mode | Population finale | Naissances | Morts | Génération max | Gènes modifiés |
| --- | --- | --- | --- | --- | --- | --- |
| Défauts, 120 s / 7 200 pas | Arena | 18 | 38 | 56 | 6 | 2 |
| Défauts, 120 s / 7 200 pas | TP comparable | 119 | 443 | 360 | 14 | 22 |
| Stress, 20 000 pas | Arena | 64 | 70 | 18 | 5 | 31 |
| Stress, 20 000 pas | TP comparable | 64 | 52 | 0 | 7 | 20 |

Stress : 12 fondateurs, 40 nourritures initiales, aucun poison ni flux de poison, drain 0,002/s ; probabilité naissance 0,05/pas, âge 0,2 s, délai 1 s, seuil 0,4, coût 0,2, plafond 64, mutation 10 %, amplitude ×2. Les autres paramètres restent ceux du moteur. Les deux essais donnent chacun 334 échantillons de temps.

Ces nombres servent à vérifier les mécanismes et la conservation des compteurs. Ce sont des mesures Node avec doublure vectorielle, pas une démonstration d'adaptation ou un résultat indépendant reproduit dans le navigateur.

### Validation navigateur

La tentative de connexion aux outils de navigateur de cette session a renvoyé « No browser is available », puis une liste vide. Aucun contrôle visuel réel ni vérification de console navigateur n'est donc revendiqué. Les tests Node utilisent le vrai Vehicle fourni, mais des doublures minimales de p5.Vector et du DOM. Le HTML réel est vérifié pour la présence des éléments d'interface, les modules pour leur syntaxe et le serveur pour leur disponibilité HTTP. L'application charge le vrai p5 local lorsqu'elle est ouverte dans un navigateur.

## Vérifier l'évolution dans le navigateur

```powershell
cd "C:\Users\Simo\Desktop\SteeringBehavioursM2IA2_Casa_2026_2027\8-EvolutionarySteeringBehavior\EvolutionArena"
node tools/serve.mjs
```

Ouvrir **http://127.0.0.1:8088** (Ctrl+C pour arrêter le serveur).

1. Choisir Arena, graine 2026, puis « Appliquer la graine et réinitialiser ». Les fondateurs commencent à G1 ; naissances et morts sont à zéro.
2. Laisser tourner au moins 20 à 30 secondes. Observer les compteurs et les halos, sans s'attendre à une naissance sur chaque essai : la probabilité par pas est faible.
3. Mettre en pause et cliquer sur une créature. Lire son ADN, son parent et sa génération. Les enfants ont un nouvel ID ; leur génération peut coexister avec celle des fondateurs.
4. Pour voir les mutations plus souvent à titre pédagogique, passer la mutation à 100 % et l'amplitude à ×2, puis réinitialiser. Revenir à 1 % et ×1 pour l'expérience de référence. Un changement à une borne peut être saturé.
5. Pour une démonstration de naissances plus accessible, utiliser seuil 0,7, âge minimal 2 s, coût 0,2 et délai 2 s, puis réinitialiser. Ce réglage est une démonstration, pas la référence scientifique.
6. Passer à « TP 8 comparable », garder graine, mutation, amplitude et plafond identiques, puis réinitialiser. Le coût, le seuil et les délais sont ignorés et leurs contrôles désactivés. Comparer les compteurs à temps simulé égal et répéter avec d'autres graines.
7. Vérifier Pause/Reprendre, Réinitialiser, la limite de population et le témoin sans reproduction. Diminuer le plafond en cours de vie ne doit pas tuer d'individus ; les naissances restent bloquées jusqu'au retour sous ce plafond.
8. Examiner les moyennes **et** écarts-types des gènes, la durée de vie et les consommations. Ne pas conclure à une amélioration à partir des seules couleurs ou naissances. Ouvrir la console du navigateur pour la vérification des erreurs qui n'a pas pu être effectuée dans cette session.

Le travail s'arrête à cette étape. Toute extension demande la validation de l'utilisateur.
