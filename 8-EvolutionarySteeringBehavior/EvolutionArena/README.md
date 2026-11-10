# EVOLUTION ARENA — Survival of the Smartest

Jeu de survie et laboratoire d'évolution, développé pour le Master IA2 à partir des principes du TP 8 de Michel Buffa. Les créatures prennent des décisions locales : leurs trajectoires émergent des Steering Behaviors, de leurs quatre gènes et de l'environnement. Le joueur agit sur les ressources, jamais directement sur leur ADN.

## Démarrage

Prérequis : Node.js 22 ou supérieur et navigateur moderne. Validation effectuée sous Node 24.18.0 et Chrome headless 155. p5.js 1.7.0 est fourni localement ; aucune installation, compilation ou connexion à un CDN n'est nécessaire.

```powershell
cd "C:\Users\Simo\Desktop\SteeringBehavioursM2IA2_Casa_2026_2027\8-EvolutionarySteeringBehavior\EvolutionArena"
node tools/serve.mjs
```

Ouvrir **http://127.0.0.1:8088**. Ctrl+C arrête le serveur. Ne pas utiliser `file://` : les modules ES nécessitent HTTP. Si le port est occupé : `$env:PORT = "8089"`, puis relancer. `npm start` est également disponible ; aucun `npm install`.

## Objectifs pédagogiques

- Séparer perception, sélection d'action, steering et locomotion.
- Construire une force : `steering = desiredVelocity - currentVelocity`, puis la limiter à `maxForce`.
- Comprendre Seek, Flee, Pursue, Evade, Wander et la combinaison pondérée des forces avec `p5.Vector`.
- Observer héritage asexué, mutations, filiation et sélection naturelle sans fitness imposée.
- Distinguer observation, score de jeu et démonstration expérimentale d'adaptation.

## Fonctionnalités et modes

L'accueil propose Jouer, Laboratoire, Comment jouer et Paramètres. Le tutoriel comporte sept étapes. Les menus suspendent l'avancée des mondes ; Laboratoire et Survie sont indépendants.

**Survie** : cinq missions, points d'écosystème, actions payantes avec cooldowns, victoire/défaite et une à trois étoiles.

| Mission | Objectif |
| --- | --- |
| Premiers pas | Tenir 60 s et conserver au moins 10 créatures |
| Équilibre naturel | Tenir 120 s avec nourriture et poison |
| Première évolution | Atteindre G3 avant 150 s |
| Invasion | Tenir 180 s avec trois prédateurs persistants |
| Survival of the Smartest | Atteindre G5 avec au moins 15 créatures, avant 240 s |

Actions : nourriture (12 points), nettoyage (18), protection temporaire (28), abondance (35). Budget initial 60, plafond 100, régénération 0,35/s. Les seuils d'étoiles sont affichés par mission. Les étoiles évaluent la partie, pas les gènes.

**Laboratoire** : réglages de reproduction et de prédation, graine, inspecteur d'individu, diagnostics, statistiques et neuf graphiques Canvas. Clic sur une créature : sélection ; clic vide : nourriture ; Maj+clic : poison. Pause fige la simulation ; réinitialiser conserve les paramètres et remet les compteurs à zéro.

Les quatre gènes restent les poids nourriture/poison dans [−2,2] et les perceptions nourriture/poison dans [0,100] pixels. Les poids positifs attirent, les négatifs repoussent. Le mode Arena impose énergie, âge et délai de reproduction ; le TP comparable conserve un clonage probabiliste moins contraint. Mutation de référence : 1 % par gène, amplitude uniforme propre à son échelle. Un troisième mode témoin désactive la reproduction.

## Science et CSV

Les mesures sont échantillonnées chaque seconde simulée, avec au plus 600 points par historique. Le tableau présente moyenne, minimum, maximum et écart-type des gènes. La diversité D est la moyenne des quatre variances divisées par le carré de leur étendue. Une population vide donne une valeur indisponible ; une faible diversité n'est pas nécessairement favorable.

Déplier **Expériences reproductibles et export CSV**. Huit profils croisent TP/Arena, prédateurs oui/non, mutations 0/1 %. Appliquer un profil redémarre le Laboratoire : conserver/exporter la trace précédente d'abord. Quatre traces sont comparables en mémoire. La relance remet les paramètres finaux au temps zéro ; les interventions manuelles ne sont pas rejouées.

Le CSV UTF-8 inclut paramètres initiaux/finals, graine, version, limites de reproduction expérimentale et historique. Importer avec séparateur **virgule** dans un tableur français. Les simulations et traces ne sont pas persistées.

## Sauvegarde locale

Progression, meilleures étoiles, paramètres visuels, rayons de perception et diagnostic sont enregistrés dans `localStorage`, uniquement lors des changements. Aucune sauvegarde automatique du monde ni modification des paramètres scientifiques au chargement. Données invalides : valeurs par défaut et avertissement ; stockage refusé/saturé : session utilisable sans sauvegarde.

Dans Paramètres, **Réinitialiser la progression**, puis confirmer au second clic, efface les étoiles et revient à la sélection des missions. Le Laboratoire et les paramètres visuels sont conservés. Changer d'écran annule la confirmation. La sauvegarde dépend de l'origine HTTP : changer de port ou de navigateur utilise un stockage différent.

## Architecture

| Dossier | Rôle |
| --- | --- |
| `vendor/`, `src/core/` | p5/Vehicle fournis, adaptation ES, ADN et aléatoire |
| `src/behaviors/`, `src/entities/` | Forces composables et entités héritant de Vehicle |
| `src/simulation/`, `src/evolution/`, `src/predation/` | Pas fixe, cycle vital, reproduction, mesures et captures |
| `src/game/` | Missions, progression, actions, points et résultats |
| `src/science/` | Expériences, agrégats, diversité et CSV |
| `src/ui/`, `src/persistence/` | Interface/rendu et sauvegarde validée |
| `tests/`, `tools/`, `output/` | Tests, serveurs/protocoles et rapports générés |

## Tests et mesures reproductibles

Depuis le dossier du projet :

```powershell
node --test tests/*.test.js
node --expose-gc tools/performance.mjs
node tools/mission-balance.mjs
node tools/science-batch.mjs --duration 120 --seeds 1,7,42,2026,9001
node tools/browser-smoke.mjs
```

La dernière commande utilise Chrome headless local, sans dépendance npm. Le chemin par défaut est celui de Chrome Windows ; `CHROME_PATH` permet d'en fournir un autre. Le test crée un profil temporaire indépendant, télécharge un CSV et produit des captures dans `output/browser/`. Un environnement qui interdit les sous-processus navigateur peut bloquer cette commande. Les rapports de performance et scientifiques sont remplacés à chaque lancement.

La suite Node utilise le Vehicle fourni avec des doublures vectorielles/DOM ; le test Chrome utilise p5 réel. Les résultats détaillés et leurs limites sont dans [VALIDATION-FINALE](docs/VALIDATION-FINALE.md).

## Limites connues

Le test Chrome headless et des captures ne remplacent pas une validation humaine complète du clavier, du tactile, des lecteurs d'écran, de la fluidité et des cinq missions jusqu'à leur fin. Les FPS dépendent du matériel ; le profilage fourni est court. L'historique est borné, les traces ne survivent pas au rechargement et les interventions ne sont pas rejouées. Cinq graines à horizon court ne prouvent ni adaptation ni supériorité d'un mode. La durée de vie des morts exclut les survivants ; les essais vivants à l'horizon sont censurés.

Les fichiers du TP/EvoSwarm et les fichiers `vehicle.js` restent protégés. Aucun commit, push ou déploiement.

## Documents

- [Guide utilisateur](docs/GUIDE-UTILISATEUR.md)
- [Architecture et interfaces](docs/ARCHITECTURE.md)
- [Démonstration professeur — 9 minutes](docs/DEMONSTRATION-PROFESSEUR.md)
- [Validation finale et checklist restante](docs/VALIDATION-FINALE.md)
- Historique : [étape 2](docs/ETAPE-2-MOTEUR.md), [3](docs/ETAPE-3-EVOLUTION.md), [4](docs/ETAPE-4-PREDATEURS.md), [5](docs/ETAPE-5-GAMEPLAY.md), [6](docs/ETAPE-6-INTERFACE.md), [7](docs/ETAPE-7-ANALYSE-SCIENTIFIQUE.md).

Les documents d'étape décrivent leurs résultats à la date de leur livraison ; le rapport final indique l'état actuel.
