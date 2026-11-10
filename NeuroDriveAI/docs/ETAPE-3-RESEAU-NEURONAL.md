# Étape 3 — Réseau neuronal feedforward

## Périmètre

Cette étape ajoute une politique neuronale réactive au moteur de l’étape 2.
Le réseau est initialisé aléatoirement avec une graine explicite. Il ne reçoit
ni trajectoire idéale, ni position, ni checkpoint. Aucun entraînement,
algorithme génétique, fitness, reproduction, sélection ou mutation n’est implémenté.
Les compteurs de checkpoints du moteur restent une mesure de parcours, pas une
fonction d’apprentissage.

Avant les changements : lecture de `ANALYSE-TP9.md`, `ETAPE-2-MOTEUR.md`, des
consignes racine et inspection de `Car.js`, `SensorSystem.js`, `Simulation.js`,
du contrôleur manuel et des tests d’interface. Le réseau utilise l’interface
physique existante ; les fichiers Car, SensorSystem, Vehicle, géométrie,
collisions et checkpoints restent inchangés.

## Architecture modulaire

| Module | Responsabilité |
| --- | --- |
| `src/ai/NeuralNetwork.js` | Dimensions, initialisation déterministe, poids/biais immuables, propagation et activations. |
| `src/ai/InputEncoder.js` | Ordre des capteurs, normalisation et traitement des lectures invalides. |
| `src/ai/OutputDecoder.js` | Deux sorties signées vers `steer`, `throttle`, `brake`. |
| `src/ai/NeuralController.js` | Politique capteurs → entrées → réseau → commandes et diagnostic. |
| `src/ai/NetworkSerialization.js` | Import/export JSON versionné et validation. |
| `src/view/NetworkView.js` | Dessin des neurones, connexions et activations avec Canvas 2D. |
| `src/view/NeuralPanel.js` | Mode, choix de graine, inspection, JSON et affichage des diagnostics. |
| `src/simulation/Simulation.js` | Choix de la source des commandes puis application via Car.control. |
| `src/main.js` | Liaison de la vue, HUD et boucle existante. |

Aucune bibliothèque ajoutée : calcul matriciel en JavaScript et rendu Canvas.
Les vecteurs et la locomotion restent ceux du moteur utilisant p5.Vector.
Le contrôleur ne déplace jamais la voiture et n’écrit ni sa vitesse ni son cap.

## Réseau et propagation

Configuration par défaut : **8 entrées, 12 neurones cachés, 2 sorties**, soit
`8×12 + 12 + 12×2 + 2 = 134 paramètres` (120 poids et 14 biais).

```js
const network = new NeuralNetwork({
  sizes: [8, 12, 2], seed: 1,
  activation: 'tanh', outputActivation: 'tanh'
});
const { outputs, activations } = network.forward(inputs);
```

La topologie accepte plusieurs couches configurables. `sizes` contient les
dimensions entrée/couches intermédiaires/sortie. Pour chaque couche `l`,
`parameters[l].weights[j][i]` relie la source `i` au neurone destination `j` ;
`parameters[l].biases[j]` est son biais.

```text
z[l,j] = biais[l,j] + somme_i(poids[l,j,i] × activation[l−1,i])
activation[l,j] = f(z[l,j])
```

`forward` renvoie les deux sorties et toutes les couches d’activations, y compris
les entrées. Il ne modifie ni les paramètres ni l’argument reçu. Les paramètres
sont copiés à la construction et gelés récursivement : le diagnostic ou un
appelant ne peut pas modifier silencieusement le modèle utilisé.

La fonction **tanh** est utilisée dans la couche cachée et en sortie : elle donne
des valeurs dans [−1,1] et permet un braquage et une pédale signés sans décalage.
Le réseau générique propose aussi une sigmoïde calculée avec deux branches pour
éviter le débordement de `exp`. Le contrôleur de conduite exige cependant une
sortie tanh, huit entrées et deux sorties. Les tailles intermédiaires sont libres.

Les entrées numériques non finies et les mauvaises dimensions sont rejetées.
Les poids, biais et entrées génériques sont limités en valeur absolue à 1e6.
La topologie est bornée à 2–8 couches, 1–128 neurones par couche et 65 536
paramètres au maximum. Ces bornes empêchent le débordement des sommes pour les
valeurs admises et limitent la taille des imports. Une activation non finie
éventuelle déclenche une erreur explicite au lieu de propager NaN.

## Initialisation reproductible

La graine est un entier non signé 32 bits : de 0 à 4 294 967 295 inclus. La
valeur par défaut est **1**. Un générateur local de type Mulberry32 produit
les tirages ; aucun appel à Math.random n’intervient dans l’initialisation.

Pour une couche d’entrée n et de sortie m, les poids et biais sont tirés
uniformément dans `±sqrt(6/(n+m))`. Les poids utilisent donc une échelle de type
Xavier ; les biais sont eux aussi aléatoires, avec la même borne. Deux réseaux
de même topologie, activations et graine ont exactement les mêmes paramètres.

Une graine différente fournit une autre politique aléatoire, sans sélection de
performance et sans apprentissage. La graine seule ne remplace pas les paramètres
dans un export : un import utilise toujours les poids et biais enregistrés.

## Huit entrées, ordre exact

Les angles sont relatifs au cap : négatifs à gauche, positifs à droite dans
le repère Canvas. Le contrôleur exige les sept angles par défaut dans cet ordre.

| Indice JavaScript | Mesure | Normalisation |
| --- | --- | --- |
| 0 | Rayon −90° | distance / portée |
| 1 | Rayon −60° | distance / portée |
| 2 | Rayon −30° | distance / portée |
| 3 | Rayon 0°, frontal | distance / portée |
| 4 | Rayon +30° | distance / portée |
| 5 | Rayon +60° | distance / portée |
| 6 | Rayon +90° | distance / portée |
| 7 | Norme de la vitesse | vitesse / vitesse maximale |

Les huit entrées sont bornées dans **[0,1]**. Pour les rayons, **0 signifie
contact et 1 absence d’obstacle à portée**. C’est une distance normalisée,
contrairement à la proximité `1 − distance/portée` utilisée par les TPs originaux
et exposée également par SensorSystem. La portée par défaut reste 190 pixels.

- Une lecture explicite `hit=false` devient 1, même si sa distance est absente
  ou infinie : le résultat indique déjà l’absence d’intersection.
- Une lecture manquante ou une distance non finie sans `hit=false` devient 0.
- Les distances négatives sont bornées à 0 ; celles au-delà de la portée à 1.
- Une portée non finie ou non positive donne sept zéros.
- Une vitesse ou une vitesse maximale invalide donne une entrée vitesse nulle.
- Une voiture inactive ou accidentée reçoit huit zéros ; ses commandes effectives
  sont neutres et elle n’est pas réactivée par le réseau.
- Un nombre ou un ordre d’angles incompatible est rejeté explicitement. Les
  imports n’adaptent pas silencieusement l’ordre sémantique des capteurs.

Le codage conservateur d’une mesure inconnue empêche NaN, mais ne garantit pas
que des poids aléatoires répondront correctement au danger.

## Deux sorties et application des commandes

| Sortie | Intervalle et convention |
| --- | --- |
| 0 : braquage | [−1,1] ; négatif à gauche, positif à droite, zéro droit. |
| 1 : pédale | [−1,1] ; positif pour accélérer, négatif pour freiner, zéro neutre. |

```text
steer = clamp(sortie[0], −1, 1)
pedal = clamp(sortie[1], −1, 1)
throttle = max(0, pedal)
brake = max(0, −pedal)
```

Il n’y a jamais d’accélération et freinage simultanés. Une pédale négative ne
demande pas une marche arrière. Un tableau de sorties invalide déclenche la
commande finie `{steer:0, throttle:0, brake:1}` ; la propagation normale rejette
déjà les entrées et paramètres non finis.

À chaque pas autonome, le contrôleur lit les capteurs de l’état courant, encode
les huit valeurs, exécute le réseau et décode les deux sorties. Simulation passe
ensuite la commande à **Car.control(command, dt)** exactement comme en mode
manuel. La vitesse désirée, le calcul `desired − current`, la borne de force,
applyForce et l’intégration demeurent dans les modules existants. Ni la limite
de braquage, ni l’accélération maximale, ni la collision continue ne sont contournées.

Les capteurs sont actualisés à la création/reset et après chaque déplacement
accepté : la lecture conservée est donc celle de l’état utilisé par le pas
suivant. Il n’y a pas un second raycasting identique avant la décision.
Ce contrat suppose que les appelants ne téléportent pas la voiture ni ne
modifient les murs en dehors de la simulation.

## Modes et cycle de vie

Le mode initial reste **Manuel**. `Simulation.setMode('autonomous')` sélectionne
le réseau ; `setMode('manual')` revient aux commandes clavier. Un autre nom est
rejeté. Le changement de mode ne réinitialise ni position, vitesse, checkpoints
ou tours. Le panneau efface les touches et le reliquat de temps de rattrapage.

La pause suspend les inférences et le déplacement. Le réseau reste sélectionné.
Réinitialiser remet la voiture et la progression au départ, mais conserve le
mode et le réseau. Charger une graine ou importer un réseau remplace le modèle
sans téléportation ; utiliser ensuite Réinitialiser pour comparer des essais
dans les mêmes conditions. Un véhicule accidenté doit être réinitialisé pour
rouler, quel que soit le mode choisi.

## Diagnostics et représentation

Le HUD conserve vitesse, état, FPS, distance, checkpoints et tours, et ajoute
le mode. Le panneau présente les huit entrées nommées, les deux sorties brutes
et les commandes décodées, dont le braquage demandé.

Le canvas du réseau affiche les couches de neurones et leurs connexions :
vert pour les poids positifs, corail pour les négatifs, épaisseur liée à leur
valeur absolue. La couleur et l’intensité des neurones représentent leur
activation. La topologie affichée suit le modèle importé, pas une image figée.
Les poids et biais exacts sont inspectables en cochant la case dédiée, dans
le champ JSON. Aucun biais n’est dessiné comme un nœud supplémentaire.

Les valeurs correspondent à la dernière décision, avant le déplacement associé.
En pause, elles restent figées. En mode manuel, les entrées courantes sont
montrées, mais aucune sortie neuronale n’est prétendue appliquée ; le graphe
sans inférence utilise une activation neutre. Après un accident, l’inférence
diagnostique peut produire des sorties non nulles depuis les entrées nulles
(à cause des biais), mais les commandes effectives sont toutes nulles.

## Format JSON versionné

```json
{
  "format": "NeuroDriveAI.feedforward",
  "version": 1,
  "sizes": [8, 12, 2],
  "seed": 1,
  "activation": "tanh",
  "outputActivation": "tanh",
  "parameters": [
    { "weights": "matrice 12×8 dans un export réel", "biases": "12 nombres" },
    { "weights": "matrice 2×12 dans un export réel", "biases": "2 nombres" }
  ]
}
```

Le bloc ci-dessus illustre les champs ; les chaînes descriptives des paramètres
doivent être remplacées par les tableaux numériques fournis par Exporter JSON.

Exporter remplit et sélectionne le champ texte. Copier ce JSON dans un fichier
permet de le conserver ; aucun accès automatique au disque ou au presse-papiers
n’est nécessaire. Pour importer, coller un export puis cliquer Importer JSON.
Le format est aussi utilisable par `exportNetwork(network)` et `importNetwork(text)`.

L’import exige format/version exacts, présence de chaque champ, dimensions,
activations connues, graine valide et matrices/biais numériques de tailles
cohérentes. Les valeurs non finies, valeurs nulles ou chaînes à la place des
nombres sont rejetées. Le texte est limité à quatre millions de caractères,
ce qui couvre aussi les exports indentés proches de la taille maximale autorisée.
Les tableaux JS clairsemés sont également rejetés par les API de construction.
Le contrôleur valide ensuite les huit entrées, deux sorties et tanh en sortie
avant de remplacer son réseau : un échec laisse l’ancien modèle intact.

Poids et biais sont conservés sans arrondi explicite. Un aller-retour JSON
reproduit exactement les sorties et trajectoires dans le même environnement.
Les dernières décimales des fonctions transcendantes peuvent varier entre
moteurs JavaScript : pas de promesse d’identité binaire entre toutes plateformes.
Le format v1 documente le contrat d’entrées et sorties ci-dessus ; un changement
futur de ce contrat devra être versionné.

## Tests exécutés

```powershell
cd 'C:\Users\Simo\Desktop\SteeringBehavioursM2IA2_Casa_2026_2027\NeuroDriveAI'
npm test
```

**Résultat : 60 tests réussis, zéro échec.** Les cinq fichiers contenant les
35 tests de l’étape 2 sont conservés sans modification. Les 25 nouveaux tests
sont répartis dans :

- `tests/neural-network.test.js` : dimensions, 134 paramètres, calcul manuel
  connu, activations, reproductibilité, immutabilité, nombres invalides,
  tableaux clairsemés, sérialisation et 2 000 prédictions finies.
- `tests/neural-driving.test.js` : normalisation et ordre des entrées, conventions
  des sorties, état accidenté, absence d’écriture physique par le contrôleur,
  modes, pause/reset, import incompatible atomique, limites physiques,
  reproduction de trajectoires et 20 000 pas autonomes avec inférences réelles,
  capteurs, collisions et reset après accident.
- `tests/neural-panel.test.js` : basculement via le panneau, choix de graine,
  diagnostics, dessin de 120 connexions et 22 neurones par défaut, inspection,
  export/import et conservation du réseau après import invalide.

Le scénario de 20 000 pas utilise un réseau **8→12→2** à paramètres connus
(sorties constantes choisies pour produire des déplacements et collisions).
Ce dispositif rend le test reproductible et évite de tester 20 000 fois une
voiture déjà désactivée. Ce réseau de test n’est pas fourni comme pilote dans
l’interface. Les réseaux initialisés par graine sont couverts séparément par
les tests de calcul et de reproduction de trajectoire avec déplacement réel.

Les tests DOM/Canvas vérifient les événements et appels de rendu, pas les pixels.
Aucun navigateur connecté n’est disponible dans l’outil Browser de cette
session : le rendu visuel et le comportement des contrôles natifs dans un vrai
navigateur restent à vérifier. Aucune validation visuelle n’est revendiquée.

## Procédure de validation de la conduite autonome

1. Lancer `npm start`, puis ouvrir **http://127.0.0.1:8000** (HTTP, pas file://).
2. Vérifier le mode Manuel et les contrôles clavier existants. Réinitialiser.
3. Choisir **Autonome** : le modèle de graine 1 contrôle la voiture sans clavier.
   Observer les huit entrées, les sorties signées et les activations. Un poids
   aléatoire ne garantit pas un tour, même si la voiture se déplace.
4. Mettre en pause : position et dernières activations restent fixes. Reprendre.
5. Charger par exemple la graine 42, puis Réinitialiser : ce réseau peut freiner
   dès le départ. Ce résultat est une politique aléatoire valide, pas un pilote
   entraîné. Recharger la graine 1 redonne les mêmes paramètres initiaux.
6. Cocher Inspecter poids et biais ; vérifier les deux matrices et les biais.
7. Exporter JSON et conserver le texte. Charger une autre graine, coller le
   précédent export puis Importer JSON et Réinitialiser. Avec les mêmes actions
   et le même pas de simulation, retrouver le même comportement.
8. Importer un JSON invalide : message Erreur et réseau courant conservé.
9. Revenir en Manuel : les commandes clavier pilotent à nouveau la voiture.
   Après un accident, Réinitialiser reste obligatoire.

## Fichiers de l’étape

Créés : les cinq modules `src/ai/`, `src/view/NetworkView.js`,
`src/view/NeuralPanel.js`, les trois fichiers de tests ci-dessus et ce document.

Modifiés : `src/simulation/Simulation.js`, `src/main.js`, `index.html`,
`styles.css`, `README.md` et `package.json` (version applicative 0.3.0,
aucune dépendance ajoutée).

Les documents des étapes précédentes, les 35 tests initiaux, Car.js,
SensorSystem.js et tous les fichiers Vehicle/vehicle.js restent inchangés.
Les TPs originaux, EvolutionArena et les autres projets ne sont pas modifiés.

## Limites et arrêt de l’étape

- Aucun apprentissage : immobilisation, freinage inopportun, mauvais sens,
  absence de tour complet ou collision sont attendus avec certains réseaux.
- Politique sans mémoire, utilisant seulement les sept rayons et la vitesse.
  Elle ne connaît ni objectif de parcours ni historique de positions.
- L’import peut changer les couches intermédiaires, mais pas le contrat des
  capteurs ou les deux sorties signées du contrôleur de conduite.
- La visualisation est destinée à de petits réseaux ; une topologie importée
  proche des bornes autorisées sera dense et plus coûteuse à dessiner.
- L’export est textuel, sans téléchargement automatique, stockage persistant
  ou catalogue de réseaux. Copier le JSON reste nécessaire pour le conserver.
- Les limites physiques et géométriques documentées à l’étape 2 demeurent.

Le développement s’arrête après cette étape 3. Aucun commit, push, déploiement,
installation, algorithme génétique, fitness, reproduction ou mutation.
Validation utilisateur attendue avant toute suite.
