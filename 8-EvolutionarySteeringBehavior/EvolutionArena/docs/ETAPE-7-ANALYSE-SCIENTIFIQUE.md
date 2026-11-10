# Étape 7 — Analyse scientifique

## Périmètre et architecture

Le Laboratoire observe le moteur existant sans modifier les règles de mouvement, de reproduction, de mutation ou de capture. La Survie conserve son monde indépendant. Les fichiers Vehicle, DNA, entités et comportements restent inchangés. Aucune dépendance ajoutée.

Fichiers créés :

- `src/science/Statistics.js` : dispersion normalisée et agrégation des répétitions.
- `src/science/Experiments.js` : huit profils, configurations, instantanés immuables et relance.
- `src/science/CSVExport.js` : sérialisation et téléchargement CSV.
- `src/science/ExperimentBatch.js` : essais à horizon fixe et agrégats.
- `src/ui/TimeSeriesCharts.js` : neuf graphiques Canvas 2D.
- `src/ui/ScienceInterface.js` : contrôles et tableau de comparaison.
- `tools/science-batch.mjs` : protocole multigraines en ligne de commande.
- `tests/science.test.js` : 22 tests supplémentaires.
- Ce document et les résultats `output/science/{batch.json,summary.csv,trials.csv}`.

Fichiers modifiés : `src/evolution/EvolutionMetrics.js`, `src/simulation/Simulation.js`, `src/ui/Interface.js`, `src/main.js`, `index.html`, `theme.css`, `tests/helpers/runtime.js`, `package.json`, `README.md`. Dans Simulation, seuls les appels d'échantillonnage reçoivent les paramètres d'environnement et le type de mesure ; les algorithmes restent identiques.

## Métriques et formules

`EvolutionMetrics.summarize()` réutilise les compteurs existants : population vivante, naissances et décès cumulés, génération maximale historique, énergie et âge moyens des vivants, nourriture et poison consommés, captures, attaques, morts par prédation. La durée de vie moyenne concerne uniquement les vies terminées ; sans décès, elle est indisponible, pas nulle. Elle est biaisée par l'exclusion des survivants.

Les quatre gènes de `src/core/DNA.js` restent :

| Indice | Gène | Bornes |
| --- | --- | --- |
| 0 | Poids nourriture | −2 à 2 |
| 1 | Poids poison | −2 à 2 |
| 2 | Perception nourriture | 0 à 100 pixels |
| 3 | Perception poison | 0 à 100 pixels |

Un poids négatif produit une répulsion ; un poids positif une attraction. Une grande perception n'implique pas une meilleure survie. Pour N vivants, moyenne μ = somme(x)/N, variance de population v = somme((x−μ)²)/N et écart-type σ = racine(v). Minimum et maximum sont mesurés sur ces mêmes individus. Avec N=1, σ=0. Avec N=0, les nouvelles statistiques génétiques et la diversité sont indisponibles (`null`, affichage —, cellule CSV vide). Les anciennes moyennes internes à zéro sont conservées pour compatibilité, sans être présentées comme un ADN de population éteinte.

`Statistics.normalizedDiversity()` définit D = (1/4) × somme des quatre v[j]/R[j]², où R = [4,4,100,100]. Cette normalisation rend comparables poids et distances. D appartient à [0 ; 0,25]. D=0 indique une population homogène sur les quatre gènes ; une population vide n'a pas de diversité mesurable. Une faible diversité n'est pas nécessairement favorable : elle peut refléter un goulot d'étranglement. Cet indicateur marginal ne mesure ni les associations entre gènes, ni le nombre de génotypes, ni leur efficacité.

Les statistiques entre graines utilisent au contraire l'écart-type d'échantillon, avec diviseur n−1 (`describeReplicates`). Pour une seule répétition, cet écart-type est indisponible.

## Historique et graphiques

`EvolutionMetrics.sample()` enregistre une mesure initiale puis une par seconde simulée (60 pas). Les changements de paramètres ajoutent des mesures de configuration ; l'export peut ajouter une photo terminale sans modifier le moteur. `sampleType` distingue ces cas. Les abscisses des graphiques représentent le temps réel simulé, y compris les mesures au même instant.

Maximum 600 mesures par monde ; la plus ancienne est retirée ensuite. Les compteurs cumulés continuent depuis le début même si leur historique initial a disparu. Les paramètres initiaux sont conservés séparément. Le calcul génétique est linéaire dans la population et réutilise les passes existantes ; le nouveau panneau et ses graphiques sont rafraîchis à l'échantillonnage, pas à chaque image. Les graphiques ne recalculent pas les statistiques.

Neuf graphiques : population, naissances/décès cumulés, énergie moyenne, génération maximale, quatre moyennes génétiques et diversité. Les échelles génétiques utilisent leurs bornes ; les valeurs indisponibles interrompent les courbes. Canvas natif, densité de pixels plafonnée à 2 et aucun moteur graphique supplémentaire.

## Utilisation et comparaison

1. Lancer `node tools/serve.mjs` depuis EvolutionArena, ouvrir http://127.0.0.1:8088 et choisir Laboratoire.
2. Dans le panneau scientifique, sélectionner un profil et une graine entière non signée sur 32 bits, puis appliquer. Cela redémarre le Laboratoire ; enregistrer/exporter la trace précédente avant de le faire.
3. Observer les métriques, mettre en pause à un horizon choisi, donner un libellé puis enregistrer une trace. Quatre traces maximum en mémoire ; la cinquième remplace la plus ancienne. Un rechargement efface ces traces.
4. Comparer les lignes du tableau, exporter chaque trace et relancer ses paramètres si nécessaire. La relance utilise les paramètres finaux enregistrés au temps zéro : ce n'est pas une restauration de l'état courant ni une lecture des interventions.

`comparisonProfiles()` fournit le plan factoriel 2×2×2 : TP comparable/Arena, prédateurs désactivés/activés, mutation 0 %/1 % par gène. Le nombre demandé de prédateurs est 2 dans tous les profils ; seul leur activation diffère. Les autres paramètres viennent de la configuration courante, y compris l'amplitude des mutations. Ils sont enregistrés pour permettre leur vérification.

Exemple : graine 2026, Arena sans prédateurs et mutation désactivée, puis même graine et mutation activée, avec même horizon et aucun clic dans l'arène. Répéter avec les graines 1, 7, 42 et 9001 ; comparer ensuite les mêmes configurations avec prédateurs. Changer un seul facteur à la fois facilite l'interprétation. La graine seule ne suffit pas : conserver tous les paramètres et la version du moteur.

Les interventions manuelles sont comptées et signalées, mais leur chronologie n'est pas enregistrée. Un générateur externe ou des extensions non sérialisables rendent la relance désactivée. À configuration constante, même graine et même nombre de pas, les tests vérifient une trajectoire identique dans le même environnement d'exécution. Une mutation activée peut consommer des tirages supplémentaires : les trajectoires aléatoires ultérieures ne sont pas appariées exactement entre profils. Aucune identité numérique entre différents navigateurs et la doublure vectorielle Node n'est garantie.

## Export

`experimentCSV()` exporte un CSV UTF-8 avec BOM, séparateur virgule et lignes CRLF. Les métadonnées répétées sur chaque ligne comprennent version, exécution, graine, configurations initiale/finale, définition de D, pas fixe, intervalle, limite et pertes d'historique, nombre de mesures et avertissements. Chaque mesure conserve aussi ses paramètres, son type, les compteurs de consommation/prédation, la durée de vie des morts et les statistiques des quatre gènes. Les valeurs numériques gardent leur précision JavaScript ; les valeurs indisponibles sont vides. Les chaînes susceptibles d'être interprétées comme formules de tableur sont neutralisées. Le téléchargement libère son URL Blob.

## Protocole automatisé exécuté

Depuis le dossier du projet :

```powershell
node tools/science-batch.mjs --duration 120 --seeds 1,7,42,2026,9001
```

Cet outil exécute séquentiellement les huit profils, soit 40 essais indépendants sans interventions, au pas fixe 1/60 s. Il utilise le vrai moteur avec la doublure `p5.Vector` de `tests/helpers/runtime.js` sous Node 24.18.0 ; ce n'est pas une mesure de rendu p5 dans un navigateur. Les configurations complètes sont dans `output/science/batch.json`, les répétitions dans `trials.csv` et les agrégats dans `summary.csv`. Une nouvelle exécution remplace ces trois fichiers. Maximum : 30 graines distinctes, horizon entier de 1 à 3600 secondes.

Un essai s'arrête à l'extinction ou à l'horizon. La survie restreinte est min(temps d'extinction, horizon). Un essai encore vivant est censuré à droite ; 120 s ne signifie pas qu'il serait mort à 120 s. L'agrégation de diversité ignore les populations éteintes et donne son effectif : elle est conditionnelle aux survivants.

Résultats descriptifs à 120 secondes (p = prédateurs, m = mutation ; moyenne ± écart-type entre cinq graines) :

| Profil | Population finale | Génération maximale | Diversité moyenne |
| --- | --- | --- | --- |
| tp-p0-m0 | 119,6 ± 0,55 | 12,4 ± 1,67 | 0,06020 |
| tp-p0-m1 | 119,6 ± 0,55 | 13,0 ± 1,41 | 0,06133 |
| tp-p1-m0 | 120,0 ± 0,00 | 12,6 ± 1,14 | 0,06969 |
| tp-p1-m1 | 118,6 ± 1,52 | 12,4 ± 0,55 | 0,06070 |
| arena-p0-m0 | 16,0 ± 0,71 | 5,2 ± 1,30 | 0,02795 |
| arena-p0-m1 | 16,2 ± 1,30 | 4,8 ± 1,10 | 0,02838 |
| arena-p1-m0 | 8,4 ± 2,30 | 5,0 ± 0,71 | 0,02030 |
| arena-p1-m1 | 8,6 ± 1,52 | 5,2 ± 0,45 | 0,02263 |

Pour chaque profil : 0 extinction sur 5, cinq essais censurés, survie restreinte moyenne 120 s. Aucune estimation de survie complète n'est possible avec cet horizon. Le TP comparable peut créer de l'énergie lors de la reproduction et atteint le plafond de population : ses effectifs élevés ne prouvent pas une meilleure adaptation. Les cinq graines sont exploratoires, sans test statistique ni intervalle d'incertitude inférentielle. Les résultats JSON/CSV fournissent également l'écart-type de diversité.

## Tests et limites

Commande exécutée : `node --test --test-reporter=tap tests/*.test.js` : **168 réussites, 0 échec, 0 ignoré**, dont les 146 tests antérieurs inchangés et 22 nouveaux tests. Couverture : moments connus, bornes de D, population vide, données non finies, historique borné et copie des paramètres, instantanés indépendants, huit profils, relance déterministe et validation atomique, CSV et métadonnées, nettoyage Blob, géométrie/cache des graphiques, contrôles du panneau et désabonnement, extinction/censure, agrégats multigraines et 40 000 pas sans NaN.

Le navigateur automatisé n'était pas disponible (liste de navigateurs vide). Le rendu réel des graphiques, la disposition responsive et le téléchargement interactif restent à valider visuellement. Les tests d'interface et Canvas utilisent des doublures ; ils ne constituent pas une validation visuelle.

Pour cette validation : ouvrir Laboratoire, vérifier les neuf graphiques après quelques secondes, vérifier qu'ils se figent en pause, exporter puis ouvrir le CSV, enregistrer deux profils et relancer l'un d'eux. Vérifier que Survie conserve ses missions et que le retour au Laboratoire conserve ses propres traces. Réduire la fenêtre pour contrôler les colonnes.

Une évolution de moyenne génétique décrit les survivants et leurs descendants, pas une causalité ni une fitness démontrée. Les limites supplémentaires incluent biais des vies terminées, horizon court, plafond démographique, tailles de populations différentes, absence de journal des interventions et absence de test de performance sur matériel réel. Une étude d'adaptation demanderait davantage de graines, horizons et témoins contrôlés, et des mesures de performance dans un environnement d'évaluation commun. Aucun score de jeu n'est utilisé comme mesure d'adaptation.

L'étape 7 s'arrête ici ; aucune fonctionnalité de l'étape 8 n'est commencée.
