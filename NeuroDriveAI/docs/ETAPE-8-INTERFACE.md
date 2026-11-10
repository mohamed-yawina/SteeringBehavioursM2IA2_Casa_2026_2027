# Étape 8 — Interface NeuroDrive AI / Evolution Racing

## 1. Direction artistique et périmètre

Le thème associe une base bleu nuit, des surfaces hiérarchisées et des accents
cyan/violet. Les titres, cartes, chiffres tabulaires, contours et états de focus
utilisent les mêmes variables. La marque NEURODRIVE AI / EVOLUTION RACING est
accompagnée du contexte Master IA2. Typographie système moderne, aucune police
distante, aucune bibliothèque graphique installée. Le logo est un SVG local
intégré ; l’aperçu d’accueil est le véritable Training Oval dessiné par Renderer,
immobile et explicitement décrit comme aperçu statique.

Les documents des étapes 2 à 7, les vues et les contrats DOM/Canvas ont été
examinés. Les anciens identifiants et contrôles sont conservés. Les 200 tests
précédents restent inchangés. Aucun changement des missions, capteurs, physique,
checkpoints, fitness ou opérateurs génétiques ; aucun résultat n’est produit
par une animation décorative.

`styles.css` demeure la base existante. `ui-theme.css`, chargé ensuite, définit
les composants, grilles, états, contrastes et variantes responsive. La refonte
est limitée aux fichiers de vue, au document HTML et à leur liaison dans main.

## 2. Architecture UI

| Module | Rôle |
|---|---|
| `ApplicationUI.js` | Navigation complémentaire, mode présentation, cartes de mission, sélection du concurrent et orchestration des vues. |
| `TelemetryView.js` | Lecture pure des données, champs pertinents par mode, écritures DOM uniquement si modifiées. |
| `TutorialDialog.js` | Ouverture/fermeture, pause, focus, Escape, Tab et repli sans dialogue natif. |
| `Renderer.js` | Couleurs, halo de sélection, collision et trace de positions acceptées ; aucune intégration physique. |
| `RaceView.js` | Identification cyan/violet et véhicule inspecté, sans déplacer les voitures. |
| `TrackPanel.js` | Aperçu statique redessiné seulement au changement de piste, taille, DPR ou effets. |
| `NetworkView.js` | Graphe neuronal signé, activations, valeurs et cache de disposition. |
| `NeuralPanel.js` | Entrées/sorties et inspection des poids existante, sans réécriture identique. |
| `GamePanel.js`, `TrainingPanel.js` | Contrôles existants conservés, fréquence des textes de diagnostic plafonnée. |

La nouvelle couche se monte sur les éléments dédiés lorsqu’ils sont présents.
Les anciens contrats de test minimalistes restent supportés. Les vues de jeu
composent toujours les Car et Simulation existantes. La seule nouvelle Simulation
de présentation est l’aperçu statique d’accueil ; elle n’est jamais avancée.

## 3. Navigation et accueil

Quatre portes d’entrée :

- **AI Laboratory** : manuel, autonome, entraînement mono/multi, transfert,
  paramètres génétiques, réseau et archive.
- **Championship** : cinq cartes de mission, verrous, étoiles et records séparés
  humain/IA ; le sélecteur historique reste disponible au clavier.
- **Racing Arena** : Human vs AI et AI vs AI, concurrents identifiés et tableau
  déterministe. Les courses sont toujours fantômes.
- **Science Center** : comparaison A–D et matrice de généralisation existantes,
  calculées depuis les rapports JSON, avec liens vers méthodes et limites.

Les cartes de l’accueil lisent le registre réel des circuits, le catalogue des
champions effectivement chargés et la sauvegarde de carrière. Aucun nombre de
victoires, fitness ou génération fictif n’est affiché. Le menu permet toujours
de revenir à l’accueil. L’espace actif possède `aria-current="page"`.

Changer d’espace conserve la politique de pause de l’étape 7. Science Center
suspend les simulations et ne dessine pas le laboratoire caché. Une reprise
explicite est nécessaire pour relancer le moteur. L’affichage d’un rapport ne
réentraîne jamais son champion.

## 4. Simulation, sélection et trajectoires

Les cinq géométries physiques restent exactes : murs, portes, départ et arrivée
sont lus directement dans Track. Le rendu change seulement couleurs, largeur
des traits, libellés et ombres. Le prochain checkpoint et l’arrivée sont mis
en évidence. La voiture sélectionnée reçoit un contour blanc ; une collision
réelle produit une couleur rouge et le libellé COLLISION.

Les voitures de population utilisent des teintes déterministes dans la famille
cyan/violet, sans tirage aléatoire consommé par les algorithmes. En compétition,
le concurrent 1 est cyan et le 2 violet, avec étiquettes et identités A/B. Le
sélecteur « Voiture inspectée » change simultanément le contour, les capteurs,
le réseau et le HUD. Il ne change ni contrôleur ni paramètres physiques.

La trajectoire optionnelle échantillonne les positions acceptées de la voiture
sélectionnée. Elle est bornée à 180 points, stockés dans un WeakMap par Car.
Elle n’est pas une trajectoire idéale fournie au réseau. Réactiver l’option
recommence la trace, sans relier artificiellement une longue période non observée.
Les autres membres d’une grande population ne reçoivent pas chacun une trace.

Effets et traces se désactivent indépendamment. Désactiver les effets retire les
ombres et transitions ; les contours nécessaires à l’identification restent.
Les réglages ne modifient aucune collision, mesure de rayon ou commande.

## 5. Visualisation neuronale

Le réseau par défaut conserve huit entrées, douze neurones cachés, deux sorties,
120 connexions et 134 paramètres. Le graphe s’adapte à une topologie importée
compatible au lieu d’afficher une architecture fictive.

Cyan désigne un poids/une activation positifs, violet un signe négatif. L’épaisseur
des connexions dépend du poids ; l’intensité du neurone dépend de la valeur absolue
de son activation. Les huit entrées et les deux sorties sont chiffrées ; les
diagnostics textuels détaillés restent accessibles. Une activation absente est
neutre et indiquée par « — ». En manuel, aucune inférence cachée n’est inventée.
Les valeurs correspondent à la dernière inférence réelle, avant le déplacement
associé ; elles peuvent rester figées après l’arrêt d’un épisode.

Les positions des nœuds sont calculées une fois par réseau/taille/DPR. Le graphe
se redessine à 15 Hz maximum pour les activations courantes ; une nouvelle taille,
un autre réseau ou un changement d’effets invalide immédiatement le rendu.
Un diagnostic inchangé en pause ne se redessine pas. Les poids sont uniquement lus.

## 6. Telemetry HUD et entraînement

Les cartes affichent les données du moteur ou du concurrent inspecté : mode,
circuit, identité, vitesse, progression stricte, checkpoints, tours, temps,
collisions et état. En entraînement seulement : génération, population active,
fitness maximale courante et moyenne. Les champs non pertinents sont masqués,
sans zéro présenté comme une mesure inexistante. Avant le démarrage d’une course,
aucune télémétrie d’un ancien laboratoire n’est réutilisée.

La progression de gameplay reste le ratio des portes strictes sur l’objectif ;
Mountain 9/18 représente 100 % de sa mission et 50 % du tour. En laboratoire,
la carte de progression stricte sature au premier tour, tandis que le nombre
de tours et les diagnostics détaillés conservent leurs valeurs réelles. Les
collisions d’entraînement comptent les épisodes courants, y compris chaque piste
en multi ; ce nombre n’est pas un cumul de toute la campagne.

Le temps est simulé, hors pauses et compte à rebours. La fitness maximale de la
carte est celle du leader courant ; l’archive historique reste distincte dans
le panneau d’entraînement. Aucune normalisation graphique ne modifie la fitness.

Population, stratégie, sélection, taux/amplitude de mutation, élites, graine,
durée, stagnation, taille du tournoi, vitesse, adaptation et immigration restent
réglables. Le rendu identifie le leader courant. Les paramètres restent appliqués
aux nouveaux essais conformément au moteur existant, sans changement silencieux.

## 7. Championship et Racing Arena

Les cinq cartes de mission sont créées une seule fois ; leurs verrous et étoiles
se mettent à jour lorsque la progression change. Les missions 4 et 5 sont marquées
DÉFI AVANCÉ. La condition de neuf portes Mountain et le tour Championship sont
inchangés. Les meilleurs temps, scores, récompenses uniques et sauvegardes de
l’étape 7 sont conservés. Les écrans de victoire/défaite restent des résultats
du moteur, pas des écrans de réussite décoratifs.

Les compétitions affichent concurrents, circuit, temps commun, progression,
classement et état final. Une inspection différente ne change pas le rang, les
poids ou la course. Les collisions voiture-voiture ne sont pas ajoutées. Les
égalités, abandons et arrêts conservent les règles de l’étape 7.

## 8. Presentation Mode

Le bouton du bandeau active une classe de présentation, sans passer à un moteur
de simulation différent. Le circuit est agrandi, les paramètres avancés et
imports sont repliés visuellement, les diagnostics essentiels et le réseau
restent visibles. Navigation, lancement, pause, reprise et retour au mode normal
restent disponibles. Le tutoriel est accessible dans les deux modes.

Les avertissements persistants, messages d’état, description de mission et
limites du Science Center ne sont pas supprimés. Le bandeau scientifique demeure
hors des zones simplifiées. Le mode ne démarre pas automatiquement un champion,
ne change pas la vitesse simulée et ne prédit aucune réussite. Le retour normal
restaure les réglages existants ; aucune donnée de simulation n’est réinitialisée.

## 9. Tutoriel et accessibilité

Huit étapes : raycasting, réseau, commandes, fitness, sélection, mutations,
générations et généralisation. Le contenu distingue explicitement inférence,
apprentissage et transfert sans réentraînement.

Le tutoriel utilise un dialogue natif, un titre accessible et un bouton de fermeture
libellé. L’ouverture suspend le moteur. Tab/Shift+Tab restent dans la fenêtre,
Escape ferme et le focus revient au bouton d’ouverture. Le repli sans dialogue
natif rend l’arrière-plan inerte puis restaure son état. Fermer ne reprend pas
automatiquement la conduite : utiliser Reprendre.

Lien d’évitement vers le contenu, boutons natifs, libellés existants conservés,
focus cyan visible, états de navigation et de verrouillage explicites. Les
palettes testées pour texte courant et boutons dépassent 4,5:1. Les activations
possèdent aussi des valeurs textuelles, et les concurrentes des étiquettes :
l’information ne dépend pas exclusivement de la couleur. La télémétrie rapide
n’est pas annoncée en boucle au lecteur d’écran ; les événements et résultats
gardent leurs annonces distinctes.

Les grilles s’adaptent aux écrans de bureau, portables et petites résolutions.
`prefers-reduced-motion` et le bouton Effets désactivent transitions/animations.
Il n’y a pas d’animation continue décorative. Ces contrôles automatisés de base
ne constituent pas une certification WCAG complète.

## 10. Performances et mesures

- Cache de disposition du réseau ; fréquence maximale de diagnostic 15 Hz.
- Aperçus statiques conservés tant que piste, taille et options restent identiques.
- Télémétrie, textes de course et entraînement limités à 10 Hz en situation
  stable ; les nouveaux résultats/changements de phase sont affichés immédiatement.
- Les cartes et options ne sont pas recréées à chaque image. Les écritures de
  télémétrie sont évitées si le texte est identique.
- Traces uniquement pour la voiture sélectionnée, 180 points maximum et WeakMap.
- DPR limité à 2 ; aucune bibliothèque lourde, image distante ou police téléchargée.
- L’espace scientifique ne fait pas avancer la simulation cachée. Les options
  visuelles ne consomment pas le PRNG de l’entraînement.

Benchmark exécuté avec le véritable champion C/2028 et deux simulations parallèles,
l’une avec rendu, l’autre de référence : 1200 pas physiques chacune, 10 secondes
simulées, 600 demandes de rendu. Résultat : **133 rendus neuronaux**, **une seule
construction de disposition**, **180 points de trace**, trajectoires identiques,
poids inchangés, voitures encore actives. Le rapport est dans
[benchmark-interface.json](experiments/etape-8/benchmark-interface.json).

Le temps Node observé est 688,375 ms pour ce scénario synthétique. Les méthodes
Canvas y sont instrumentées sans rasterisation : ce n’est **pas** une mesure
de FPS Chrome, de coût GPU ou de mise en page DOM. Les tests vérifient également
5000 images de la nouvelle couche UI sans recréation de cartes/options, et 5000
rafraîchissements de télémétrie identique sans écriture supplémentaire.

```powershell
npm.cmd run benchmark:ui
# sauvegarder un nouvel essai sans écraser le rapport livré :
node tools/benchmark-interface.mjs output/benchmark-ui-nouvel-essai.json
```

## 11. Tests et limites

`npm.cmd test` : **220 tests réussis, zéro échec**, dont les 200 précédents
conservés et 20 nouveaux tests. Les ajouts couvrent menu/navigation, Science
Center, données réelles, présentation réversible, tutoriel et focus, missions,
inspection des concurrentes, effets/traces, changement de circuit, entraînement,
cache neuronal, bornes mémoire, couleurs/contraste, structure HTML/CSS, absence
de NaN/Infinity et stabilité de la couche UI. Les validations prolongées physiques,
neuronales, évolutives, multi-circuits et courses restent dans la suite.

Chrome a été demandé à l’outil d’automatisation : aucun navigateur Chrome connecté
n’est disponible. Les interactions DOM/Canvas sont vérifiées par contrat, mais
les pixels, polices réellement affichées, espacements, dialogues natifs, zoom et
ergonomie humaine restent **à vérifier visuellement dans Chrome**. Aucun screenshot
ou contrôle navigateur réel n’est revendiqué. Le contrôle CSS teste structure,
règles et couleurs déclarées, sans remplacer le moteur de style d’un navigateur.

Les missions 4/5 n’ont toujours pas de réussite neuronale démontrée parmi les
champions livrés de l’équilibrage. Les résultats expérimentaux sont conservés,
sans réévaluation embellie. L’interface n’ajoute ni politique, ni apprentissage,
ni mémoire neuronale, ni généralisation garantie.

## 12. Procédure de démonstration Chrome

```powershell
cd "C:\Users\Simo\Desktop\SteeringBehavioursM2IA2_Casa_2026_2027\NeuroDriveAI"
npm.cmd start
```

1. Ouvrir `http://localhost:8000`. Vérifier les quatre espaces et les statistiques
   d’accueil : cinq circuits, champions effectivement chargés, progression locale.
   Redimensionner à 1920×1080, 1366×768 et environ 390 px ; tester zoom 125 %.
2. AI Laboratory : choisir un circuit, piloter au clavier, vérifier capteurs,
   checkpoint suivant, arrivée et collision. Activer/désactiver Effets et
   Trajectoire : le mouvement et les règles doivent rester les mêmes.
3. Charger un champion via les contrôles existants, passer en autonome et reprendre.
   Vérifier huit entrées, douze neurones cachés, deux sorties, signes des poids et
   valeurs. En manuel, le graphe ne doit pas inventer des activations.
4. Entraînement : population modeste pour la démonstration, graine explicite,
   sélection puis nouvel essai. Contrôler génération, actives, fitness max/moyenne
   et leader. Les paramètres restent conservés en quittant Presentation Mode.
5. Championship : choisir FIRST STEPS et un champion Oval pour une démonstration
   reproductible ; les missions avancées doivent rester annoncées et verrouillées
   selon la progression existante. Vérifier les records humain/IA séparés.
6. Racing Arena : sélectionner deux champions, démarrer puis inspecter chaque
   voiture. Contour, capteurs, réseau et HUD doivent correspondre à la même
   concurrente. Vérifier pause, résultat, égalité avec deux champions identiques.
7. Science Center : ouvrir les comparaisons et charger les rapports livrés.
   Vérifier leurs tableaux et les limites, sans simulation cachée en progression.
8. Presentation Mode : vérifier agrandissement du circuit et réseau visible,
   puis retour normal. Les avertissements doivent rester consultables.
9. Tutoriel : ouvrir au clavier, parcourir avec Tab/Shift+Tab, fermer par Escape,
   vérifier le retour du focus. La simulation doit rester en pause.
10. Vérifier la console JavaScript, les chargements réseau locaux et l’absence
    de débordement des graphiques. Mesurer les FPS et la charge dans Chrome avant
    de conclure sur les performances d’un vidéoprojecteur ou d’un autre poste.

L’étape 8 s’arrête ici. Aucun changement de l’étape 9, commit, push, déploiement
ou installation de dépendance. Les TPs originaux, EvolutionArena et tous les
Vehicle/vehicle.js sont préservés.

## 13. Inventaire de livraison

**10 fichiers créés :**

- `ui-theme.css`.
- `src/view/ApplicationUI.js`, `TelemetryView.js`, `TutorialDialog.js`.
- `tests/interface-v8.test.js`, `tests/visual-performance.test.js`,
  `tests/support/interface-dom.mjs`.
- `tools/benchmark-interface.mjs`.
- `docs/ETAPE-8-INTERFACE.md` et
  `docs/experiments/etape-8/benchmark-interface.json`.

**11 fichiers modifiés :** `README.md`, `index.html`, `package.json`,
`src/main.js`, puis les vues `GamePanel.js`, `NetworkView.js`, `NeuralPanel.js`,
`RaceView.js`, `Renderer.js`, `TrackPanel.js`, `TrainingPanel.js`.

Aucun fichier supprimé. `styles.css`, tous les anciens tests/documents/rapports,
les modules game, IA, évolution, géométrie, piste et simulation restent inchangés.
La copie finale utilise un manifeste et compare les empreintes avant/après,
uniquement dans NeuroDriveAI. Les paramètres génétiques et les conditions de
réussite ne sont pas modifiés pour améliorer l’apparence des résultats.
