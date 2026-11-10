# NeuroDrive AI — Étape 8

Interface cyan/violet, quatre espaces (AI Laboratory, Championship, Racing Arena,
Science Center), télémétrie réelle, tutoriel et Presentation Mode. Les effets
visuels et trajectoires se désactivent indépendamment. La physique, les missions,
les checkpoints, les réseaux et les règles génétiques restent inchangés.

```powershell
npm.cmd test
npm.cmd start
```

Ouvrir `http://localhost:8000` dans Chrome. Depuis l’accueil, ouvrir un espace,
choisir les paramètres puis démarrer/reprendre explicitement. En course,
« Voiture inspectée » sélectionne le véhicule, ses capteurs, son réseau et son
HUD. « Comprendre l’IA » ouvre le tutoriel et suspend la simulation ; fermer
puis Reprendre. Presentation Mode agrandit le circuit et simplifie les réglages,
sans masquer l’avertissement scientifique.

Les 220 tests réussissent. Chrome n’est pas connecté à l’automatisation de cette
session : l’inspection visuelle réelle reste à effectuer. Le benchmark Node
est synthétique et ne mesure aucun FPS navigateur.

```powershell
npm.cmd run benchmark:ui
```

[Direction artistique, architecture UI, tests et démonstration](docs/ETAPE-8-INTERFACE.md).

## Étape 7 — Gameplay

Accueil Championship, cinq missions de carrière, Human vs AI et AI vs AI.
Le laboratoire scientifique reste accessible par son propre onglet. Les deux
voitures d’une course fantôme partent au même point ; elles ont des collisions
avec les murs indépendantes et des checkpoints stricts.

```powershell
npm.cmd test
npm.cmd start
```

Ouvrir `http://localhost:8000` dans Chrome. Choisir Carrière, une mission disponible
et le pilotage humain ou IA. Huit champions locaux sont proposés ; le fichier
JSON ou le champ de texte permettent d’en importer d’autres. Un compte à rebours
de trois secondes précède chaque partie. Les records humains et IA sont sauvegardés
séparément dans un petit profil local ; les réseaux restent en mémoire.

Les missions 1 à 3 sont démontrées avec des champions existants. Les missions
Mountain (9 portes sur 18) et Championship (un tour) passent la faisabilité
physique, mais aucun des 50 champions évalués ne les réussit. Elles restent des
défis manuels : aucune réussite humaine n’est prétendue vérifiée.

```powershell
npm.cmd run balance -- --seeds 2026,2027,2028,2029,2030 --workers 4 --output output/gameplay-nouvel-essai
```

Choisir un dossier neuf. Les mesures livrées sont dans `docs/experiments/etape-7/` :
275 évaluations neuronales sans réentraînement et cinq essais physiques distincts.
[Architecture, équilibrage, règles et démonstration Chrome](docs/ETAPE-7-GAMEPLAY.md).

## Étape 6 — Circuits et généralisation

Cinq circuits, entraînement mono/multi et transfert de champions sans modifier
leurs poids. Le moteur, les checkpoints stricts et le réseau 8→12→2 sont conservés.

```powershell
npm.cmd test
npm.cmd start
```

Dans Chrome : ouvrir `http://localhost:8000`. Choisir une piste pour conduire
manuellement ou entraîner. Le mode multi demande au moins deux pistes cochées.
Pour le transfert, choisir la cible puis coller un champion dans le champ JSON
neuronal et cliquer « Charger le JSON et tester sans réentraînement ». Les
champions livrés sont dans `docs/experiments/etape-6/champions/`.

La section Généralisation charge les résultats sur cinq graines et cinq cibles.
Résultat préliminaire : Oval réussit 4/5 en relecture, son transfert Desert 1/5 ;
aucun tour sur Mountain, Neon ou Championship, même après entraînement spécialisé.
Le multi ne réussit aucun de ses deux circuits tenus à l’écart. Aucune
généralisation robuste n’est démontrée. Les cinq pistes passent géométrie et
faisabilité physique ; la validation humaine dans Chrome reste à effectuer.

```powershell
node tools/validate-tracks.mjs
npm.cmd run generalization -- --seeds 2026,2027,2028,2029,2030 --population 20 --mono-generations 6 --horizon 30 --workers 4 --output output/generalization-nouvel-essai
```

Budget réservé comparable : six générations mono ou deux générations sur trois
pistes. Utiliser un nouveau dossier de sortie. Les rapports JSON/CSV contiennent
30 entraînements et 150 relectures ; aucun résultat n’est généré par l’interface.
[Architecture, résultats, limites et procédure Chrome](docs/ETAPE-6-CIRCUITS-GENERALISATION.md).

## Historique des étapes précédentes

Moteur indépendant des TPs, conduite manuelle, réseau feedforward 8→12→2 et
neuro-évolution par population. Les réseaux sont initialisés de façon reproductible,
puis évalués, sélectionnés, croisés et mutés dans le mode Entraînement IA.
JavaScript ES6, Canvas 2D et copie locale existante de p5.js pour les vecteurs.
Node.js 20 ou ultérieur suffit. Aucune commande `npm install` n’est nécessaire.

```powershell
cd 'C:\Users\Simo\Desktop\SteeringBehavioursM2IA2_Casa_2026_2027\NeuroDriveAI'
npm test
npm start
```

Ouvrir **http://127.0.0.1:8000**. Arrêt du serveur : Ctrl+C.
Alternatives directes : `node tools/serve.mjs` et
`node --import ./tests/support/p5.mjs --test`.
Pour choisir un autre port : `$env:PORT = '8001'`, puis `npm start`.
Les modules ES nécessitent HTTP ; ne pas ouvrir `index.html` avec `file://`.

Flèche haut / Z / W : accélérer. Bas / S : freiner.
Gauche / Q / A et droite / D : braquer.
Suivre les flèches du circuit, départ sur sa droite vers le bas.
Relâcher l’accélérateur et freiner pour les virages ; pas de marche arrière.

Pause/reprise, réinitialisation et capteurs sont accessibles dans l’en-tête.
Une perte de focus met en pause et efface les touches pour éviter une commande
bloquée. Après une collision, utiliser Réinitialiser.

Architecture, formules, protocole de validation et limites :
[docs/ETAPE-2-MOTEUR.md](docs/ETAPE-2-MOTEUR.md).

Pour l’étape 3, choisir **Autonome** dans le menu Mode. Le réseau de graine 1
prend ses décisions à partir des sept distances et de la vitesse. Le clavier
n’intervient plus tant que ce mode est sélectionné. Revenir à Manuel conserve
l’état physique ; Réinitialiser conserve le réseau et le mode, mais repart du
départ avec une voiture intacte.

Le panneau affiche les entrées, sorties, commandes et activations. Entrer une
graine uint32 puis Charger cette graine sélectionne un autre réseau aléatoire.
Cocher Inspecter poids et biais pour consulter tous ses paramètres. Exporter JSON
remplit et sélectionne le champ : copier ce texte dans un fichier pour le garder.
Pour importer, coller un export puis cliquer Importer JSON. Un import invalide
laisse le réseau courant intact.

**Les réseaux simplement chargés par graine ne sont pas entraînés** : certains freinent dès le départ,
s’immobilisent, tournent mal ou percutent un mur. Changer de graine n’est pas un
apprentissage. Pour comparer deux réseaux, Réinitialiser après chaque chargement.

Détails, ordre exact des entrées, conventions de signe, format JSON et tests :
[docs/ETAPE-3-RESEAU-NEURONAL.md](docs/ETAPE-3-RESEAU-NEURONAL.md).

Choisir **Entraînement IA**, régler les paramètres puis cliquer **Démarrer un
nouvel essai**. La population initiale compte 50 voitures. Pause IA/Reprendre IA
conservent l’essai ; Réinitialiser IA applique les paramètres au départ et efface
l’historique et l’archive. La vitesse ×1/×2/×5/×10 multiplie les pas exécutés,
sans changer leur durée physique. Les autres paramètres attendent un nouvel essai.

Exporter le meilleur remplit le champ JSON neuronal, compatible avec l’import
de l’étape 3. Utiliser en autonome charge l’archive au départ et suspend
l’entraînement. Importer depuis le champ JSON charge une archive non évaluée,
sans remplacer les voitures de la génération en cours.

Premier essai reproductible, avec rapport et champion sauvegardés :

```powershell
npm run experiment -- 6 50 docs/experiments/nouvel-essai
```

Les résultats livrés sont dans `docs/experiments/essai-2026/`. Pour essayer le
champion, copier `champion.json` dans le champ JSON, cliquer Importer depuis le
champ JSON puis Utiliser en autonome. Aucun tour complet n’est démontré par
ce premier essai. Protocole, formules, paramètres et résultats :
[docs/ETAPE-4-NEUROEVOLUTION.md](docs/ETAPE-4-NEUROEVOLUTION.md).


L??tape 5 ajoute la fitness optimis?e, la mutation adaptative optionnelle, les
diagnostics et une comparaison A?D sur cinq graines. Les checkpoints et la
physique restent inchang?s. Choisir une strat?gie et la fitness Optimis?e ?tape 5
avant de d?marrer un nouvel essai. Charger les r?sultats livr?s dans la section
Comparer les exp?riences pour voir le r?sum? multi-graines.

```powershell
npm run compare -- --seeds 2026,2027,2028,2029,2030 --strategies A,B,C,D --generations 8 --population 50 --duration 20 --stagnation 4 --workers 4 --output docs/experiments/etape-5/nouvel-essai
```

Les rapports JSON/CSV et les vingt champions sont dans
`docs/experiments/etape-5/comparaison`. La campagne observe 842 tours d??pisodes ;
chaque strat?gie r?ussit sur cinq graines sur cinq. A poss?de la meilleure fitness
maximale moyenne sur cet essai, sans sup?riorit? g?n?rale d?montr?e. Les relectures
exploratoires de 60 s totalisent 95 tours, avec un accident parmi les vingt champions.

L?audit explique le z?ro tour historique : le champion de l??tape 4 termine son
premier tour ? 12,60 s, au-del? des 12 s de l?ancien outil exp?rimental.
[Documentation, protocole et limites de l??tape 5](docs/ETAPE-5-APPRENTISSAGE-AVANCE.md).
