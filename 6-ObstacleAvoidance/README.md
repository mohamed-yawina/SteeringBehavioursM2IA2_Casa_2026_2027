# TD6 — Obstacle Avoidance : laboratoire pédagogique

Le laboratoire expose la détection historique du TD de Michel Buffa et ses limites.
Il conserve la physique corrigée en phase 2 et le moteur p5.js local.
Aucun énoncé officiel distinct n'est présent dans ce dossier.

## Lancement et tests

Depuis la racine du dépôt, lancer un serveur statique, par exemple avec Python 3 :

```powershell
py -m http.server 8000
```

Puis ouvrir http://localhost:8000/6-ObstacleAvoidance/.
Sur un système avec python3, utiliser python3 -m http.server 8000.
Un serveur HTTP d'éditeur convient également. Aucun CDN ni paquet npm n'est requis.

Tests avec Node récent (exécution actuelle : Node 24) :

```powershell
node --test 6-ObstacleAvoidance/tests/*.test.mjs
```

Les tests du harness exécutent le véritable p5.Vector local, avec graphisme et DOM
simulés. Une réussite Node n'est pas une validation visuelle dans Chrome.
Les dix contrôles Chrome de phase 2 ont été validés par l'utilisateur ; ils ne
constituent pas une validation de cette nouvelle interface.

## Algorithme actif conservé

Pour une position X et une vitesse V :

- Qc = X + h_court V, avec h_court = 15 par défaut ;
- Ql = X + h_long V, avec h_long = 30 par défaut.

Ces horizons sont des multiplicateurs en pas, pas des distances fixes.
À vitesse 4, Qc est à 60 pixels et Ql à 120 pixels.

L'obstacle est sélectionné par la distance de son **centre C à X**, indépendamment
de son rayon et avant de déterminer s'il est dangereux. Une égalité conserve le
premier obstacle du tableau. Les obstacles invalides sont ignorés.

Le point Q le plus proche de C parmi Ql, Qc et X est retenu ; les égalités gardent
cet ordre. Détection strictement lorsque :

distance_min < rayon_obstacle + largeurZoneEvitementDevantVaisseau.

La marge historique vaut 24 pixels (r/2). L'égalité exacte ne déclenche rien.
Le rayon du véhicule n'est pas ajouté une seconde fois.

En cas de détection, la force Avoid suit désormais la formule de steering :

```text
direction = Q - C
desiredVelocity = normalize(direction) × maxSpeed
steering = limit(desiredVelocity - velocity, maxForce / 2)
```

Le budget individuel conserve la moitié de `maxForce`, comme dans la limite
d'intensité historique. Le steering s'oppose donc à la vitesse courante lorsque
celle-ci ne correspond pas à la direction désirée. Il est ensuite pondéré puis
composé avec les autres forces ; la résultante reste plafonnée globalement à
`maxForce`.

Si `Q = C`, la direction est nulle et la vitesse désirée vaut `(0,0)`. Le véhicule
en mouvement reçoit un freinage borné à `maxForce / 2`; à vitesse nulle la force
reste nulle. Le diagnostic conserve `detected=true` et la raison géométrique
`coincident-sample`. Si `maxForce=0`, aucune force ne peut être produite. Aucun
choix gauche/droite n'est inventé.

## Composition et unités

Les poids historiques configurés au démarrage et après Reset sont :
0,2 Arrive + 3 Avoid + 0,2 Separate + 3 Boundaries.
La somme pondérée est limitée globalement à maxForce, puis appliquée une seule fois.
Les quatre poids peuvent être ajustés de 0 à 10 ; zéro reste une valeur valide.
Le commutateur Avoid sépare le poids configuré du poids effectif : désactivé,
le poids effectif vaut exactement zéro sans effacer le réglage choisi. La détection
continue d'être calculée et reste informative, mais sa contribution à la somme est nulle.
Chaque véhicule valide est intégré une fois par pas. Obstacle et Target héritent
de Vehicle mais ne reçoivent aucune force et ne sont jamais intégrés.

Unités : pixels, pixels/pas pour la vitesse, pixels/pas² pour accélération/force
(masse 1), pas pour les horizons et coefficients sans unité pour les poids.

Arrive, Separate et Boundaries restent les comportements de phase 2.
Seek, applyForce, update et edges ne sont pas modifiées.
La boucle p5 vise 60 FPS : ce TD n'introduit pas de pas fixe indépendant du FPS.
edges n'est pas appelée automatiquement.

## Méthodes auxiliaires Pursue / Evade / Flee

Les scénarios actifs du laboratoire n'appellent que Arrive, Avoid, Separate et
Boundaries. Flee, Pursue et Evade sont des méthodes auxiliaires dormantes, testées
directement pour éviter qu'une réutilisation future hérite d'une formule incorrecte.

Flee choisit la direction `position - cible`, construit `desiredVelocity` à
`maxSpeed`, puis retourne `limit(desiredVelocity - velocity, maxForce)`. Evade
conserve la prédiction historique `cible.position + cible.velocity × 10`, puis
applique ce même calcul dans la direction opposée à la cible prédite. Ces méthodes
ne renversent plus une force Seek ou Pursue entière : cela évite d'inverser aussi
la correction liée à une vitesse latérale.

Si la direction opposée est nulle, elle produit une vitesse désirée nulle et le
steering freine la vitesse courante, limité par `maxForce`. Avec `maxSpeed = 0`,
le freinage suit la même règle ; avec `maxForce = 0`, la force retournée est nulle.
Les cibles, états et prédictions non finis donnent une force nulle.

Pursue garde son calcul de prédiction et de Seek, mais ne dessine plus pendant le
calcul. Aucun rendu de marqueur de prédiction n'est ajouté ailleurs. Cela ne change
pas les scénarios actifs, qui n'appellent aucune de ces trois méthodes. La physique
Avoid active, sa détection historique et ses diagnostics restent inchangés.

## Contrôles

- Pause / Reprendre, ou Espace hors d'un champ de formulaire.
- Pas unique : met en pause et effectue une étape physique au prochain draw.
- Reset : restaure la géométrie, les agents, la cible et tous les paramètres du
  scénario choisi. L'état pause est conservé ; les compteurs repartent de zéro.
- Liste « Véhicule observé », ou Maj + clic près d'un véhicule.
- maxSpeed, maxForce et horizons modifiables ; zéro est accepté.
- Horizons finis, positifs ou nuls, avec court <= long. Les valeurs incohérentes
  sont refusées et les contrôles reviennent à l'état réellement utilisé.
- Les paramètres concernent tous les véhicules et les créations suivantes.
- Clic normal sur le canvas : ajout historique d'obstacle aléatoire.
- Éditer les obstacles : met en pause, clic pour sélectionner puis glisser.
- Rayon : modifie l'obstacle sélectionné, accepte zéro et impose la pause.
- Supprimer : retire uniquement l'obstacle sélectionné, en pause.
- v : véhicule aléatoire ; f : dix véhicules au point historique (20,300), avec
  vitesses aléatoires ; d : diagnostics visuels.
- Le mode « cible à la souris » conserve le pilotage historique vers le pointeur
  dans le canvas. Les autres scénarios commencent avec une cible fixe.

Les sliders affichent les coefficients configurés réellement transmis à chaque
véhicule. Les diagnostics donnent, pour chaque comportement, le poids configuré,
le poids effectif, puis la force pondérée. Pour Avoid, l'état activé/désactivé est
également affiché. Une valeur invalide est refusée et le contrôle revient à la
dernière valeur valide ; les coefficients acceptent zéro.

Les positions glissées sont bornées au canvas : une coordonnée extérieure ne sera
pas restaurée lors d'une édition ultérieure. Le rayon reste en pixels logiques.

## Huit scénarios déterministes

| Scénario | Phénomène |
|---|---|
| Démonstration historique | Arrive vers la souris, un obstacle central, départ immobile |
| Aucun obstacle | Avoid nulle sans exception |
| Obstacle frontal | Détection ; lorsque l'échantillon coïncide avec le centre, le steering freine le véhicule |
| Obstacle latéral | Répulsion latérale |
| Deux obstacles symétriques | Départage par ordre du tableau |
| Menace masquée | Centre proche non menaçant cachant une menace plus éloignée |
| Entre les échantillons | Petit obstacle entre X et Qc non détecté |
| Passage étroit | Plusieurs véhicules et obstacles, effet de la marge et des forces |

Les positions, vitesses, rayons et cibles sont explicites dans lab-scenarios.js.
Reset utilise la graine 2027 pour les créations interactives ultérieures.
Le RNG injecté des tests est reproductible mais distinct du RNG de p5 dans Chrome.

## Lire les diagnostics

Activer « Diagnostics visuels » ou d pour les tracés du véhicule sélectionné.
Les diagnostics numériques restent accessibles lorsque les tracés sont masqués.

- Xₙ, Vₙ, Qc et Ql sont ceux du pas **avant intégration**.
- L'anneau blanc entoure le véhicule à sa position **après intégration**.
- C et le cercle orange sont la copie de l'obstacle effectivement sélectionné.
- Le cercle pointillé de rayon R+marge illustre le seuil pour les trois points.
- Les pointillés entre X et Ql sont seulement un guide graphique, jamais un
  détecteur de collision continue.
- Le cercle autour de l'échantillon indique le point retenu.
- Flèches de forces **pondérées**, échelle ×150 ; vitesse ×12.
- Le tableau donne les forces brutes, les poids configurés et effectifs, les
  composantes et les normes.
- La résultante avant et après plafonnement et les limites utilisées sont affichées.

Les identifiants de pas de la géométrie et des forces coïncident.
Changer un paramètre ou la géométrie invalide les décisions précédentes : effectuer
un pas pour obtenir de nouveaux diagnostics. Sélectionner un autre véhicule lit sa
propre dernière décision, sans la recalculer.

Le renderer lit des copies défensives ; il ne rappelle aucun comportement,
n'intègre rien et ne consomme aucun nombre aléatoire.

## Expériences

1. Choisir « Obstacle latéral », mettre en pause, activer les diagnostics, faire un pas.
   Observer C, l'échantillon retenu, le seuil et la force Avoid.
2. Choisir « Entre les échantillons », faire un pas : le trait traverse visuellement
   l'obstacle mais les trois points ne déclenchent pas la détection. Reset puis
   raccourcir l'horizon pour placer un échantillon près de l'obstacle.
3. Choisir « Obstacle frontal » : une détection peut retourner une force nulle.
   Comparer ensuite avec « Menace masquée » : le centre choisi peut être non menaçant.

## Architecture

- vehicle.js : comportements, locomotion et copies des diagnostics ; la composition
  lit les poids validés et garde son plafond global obligatoire à maxForce.
- obstacle.js : géométrie statique éditable, sans locomotion.
- target.js : cible statique contrôlée par interaction.
- lab-controller.js : étapes, scénarios, sélection, édition et paramètres.
- lab-renderer.js : tracés à partir des snapshots.
- lab-ui.js : contrôles DOM et tableaux numériques.
- lab-scenarios.js : conditions initiales et paramètres historiques.
- sketch.js : unique boucle p5, rendu des entités et commandes historiques.
- tests/ : preuves historiques, références phase 2 et nouveaux contrôles du laboratoire.

Le canvas logique reste 1200 × 800 ; le CSS adapte sa taille en conservant son
rapport d'aspect. Aucun redimensionnement physique, changement de rayon ou de
vitesse n'est effectué lors du redimensionnement de la fenêtre.

## Limites et état de validation

- Sélection par centre, trois échantillons et formule directe restent historiques.
- Pas de garantie d'absence de collision ou d'oscillation.
- Pas de comparaison continue ajoutée dans cette phase.
- Aucun plafond du nombre de véhicules/obstacles ; des populations nombreuses coûtent
  davantage à cause des recherches de voisinage.
- Le canvas est redimensionné visuellement : les étiquettes peuvent être petites
  sur mobile ; vérifier le rendu, le tactile et la correspondance du pointeur.
- Les références reference-trajectories.json, historical-sources.json et
  corrected-trajectories.json restent intactes et sont contrôlées par SHA-256.
- La suite actuelle contient 50 tests historiques, 31 tests de correction et 26 tests
  du laboratoire, soit 107 tests.
  Les références historiques restent intactes ; Avoid corrigé possède une fixture
  séparée dans `tests/corrected-avoid-trajectories.json`. Les nombres sont comparés
  à 1e-12.
- Aucune nouvelle validation Chrome n'est revendiquée.

## Référence

Craig W. Reynolds, « Steering Behaviors for Autonomous Characters » :
[article fourni dans le dépôt](../ARTICLE_CRAIG_REYNOLDS/Steering%20Behaviors%20For%20Autonomous%20Characters.pdf).
Le code fourni du TD est conservé comme référence historique dans tests/ ;
aucun énoncé officiel absent n'est revendiqué.
