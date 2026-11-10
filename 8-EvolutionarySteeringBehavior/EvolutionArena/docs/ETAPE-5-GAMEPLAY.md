# Étape 5 — Missions, Survie et décisions du joueur

Projet : **EVOLUTION ARENA — Survival of the Smartest**. Date : 25 octobre 2026. Version 0.5.

## Préparation et périmètre

Les documents des étapes 2, 3 et 4 et l'architecture ont été relus. Les 91 tests préexistants ont réussi avant développement. Le moteur offrait déjà `Simulation.step()`, `advance()`, `stats`, `togglePause()`, `reset()`, `selectAt()`, `addResource()`, `configureEvolution()` et `configurePredation()`.

Cette étape ajoute une couche de jeu au-dessus du moteur, sans modifier DNA, Creature, les règles d'hérédité, les mutations ou la reproduction. Les scénarios changent des paramètres environnementaux explicites, pas l'ADN des agents. Aucun nouveau gène, son, musique, boutique, multijoueur ou déploiement. Aucun commit ou push. Le TP original, EvoSwarm, SmartCity et tous les fichiers `vehicle.js` sont préservés.

Vérification finale : les empreintes SHA-256 des fichiers voisins, des bibliothèques fournies et des fichiers DNA, Creature et reproduction sont identiques au relevé de début d'étape.

## Architecture et fichiers

| Statut | Fichier | Responsabilité |
| --- | --- | --- |
| Créé | `src/game/GameMode.js` | Routage Laboratoire/Survie et suspension du monde inactif. |
| Créé | `src/game/MissionDefinitions.js` | Cinq scénarios immuables et validation des objectifs/configurations. |
| Créé | `src/game/MissionManager.js` | Session, chronomètre, états, actions et transitions. |
| Créé | `src/game/MissionProgress.js` | Déblocage séquentiel et meilleures étoiles en mémoire. |
| Créé | `src/game/EcosystemPoints.js` | Budget, dépenses et régénération plafonnée. |
| Créé | `src/game/PlayerActions.js` | Actions payantes, cooldowns, effets temporaires et RNG propre. |
| Créé | `src/game/GameResults.js` | Conditions de fin et résultat immuable avec étoiles. |
| Créé | `src/entities/ProtectionZone.js` | Zone statique visible héritant de Vehicle, position en p5.Vector. |
| Créé | `src/ui/GameInterface.js` | Sélection, HUD, actions, résultats et progression. |
| Créé | `src/ui/GameRenderer.js` | Cercle de protection, retours d'action et bordure d'abondance. |
| Créé | `tools/mission-balance.mjs` | Évaluation reproductible des cinq scénarios et stratégies limitées. |
| Créé | `tests/gameplay.test.js` | Tests de règles, intégration, équilibrage et session longue. |
| Créé | `docs/ETAPE-5-GAMEPLAY.md` | Ce document. |
| Modifié | `src/simulation/Simulation.js` | Deux extensions optionnelles de jeu et conservation des fractions de ressources. |
| Modifié | `src/predation/capture.js` | Consultation de la protection locale avant capture. |
| Modifié | `src/ui/Interface.js` | Délégation optionnelle des boutons partagés pause/reset ; comportement historique par défaut. |
| Modifié | `src/main.js` | Assemblage, monde affiché, routage des clics et contrôles communs. |
| Modifié | `index.html`, `styles.css` | Deux modes, sélection des missions, HUD, résultats et dispositions adaptatives. |
| Modifié | `tests/helpers/runtime.js` | Nouveaux éléments DOM simulés ; aucun ancien scénario supprimé. |
| Modifié | `README.md`, `package.json` | Commandes et version actualisées. |

### Interfaces moteur ajoutées, sans dépendance du moteur au jeu

`Simulation` accepte un objet optionnel `hooks` à la construction :

- `isCaptureProtected(position, time)` : vrai seulement à l'intérieur d'une zone active.
- `foodRateBonus(time)` : bonus de débit alimentaire fini, entre 0 et 30/s.

Sans ces callbacks, la protection est absente et le bonus nul. Le Laboratoire ne les installe pas. Le moteur ne connaît ni missions, ni étoiles, ni points. Une configuration d'extension invalide est refusée.

Les budgets d'apparition conservaient auparavant seulement un nombre plafonné à 1 puis repartaient à zéro, perdant la fraction excédentaire. Cela faussait les nouveaux taux comme 3,5 ressources/s. La fraction est désormais conservée après chaque apparition. Un élément par type et par pas reste la limite, sans arriéré illimité. Un test vérifie 7 apparitions sur 2 secondes à 3,5/s et le débit réel d'abondance. Ce changement concerne les ressources, pas les algorithmes génétiques ; les 91 tests historiques restent réussis.

## Deux mondes indépendants

Au lancement, le mode **Laboratoire** garde toutes ses fonctionnalités : réglages génétiques et de prédation, diagnostics, statistiques scientifiques, sélection, clic nourriture et Maj + clic poison.

Le mode **Survie** crée une nouvelle instance de Simulation pour chaque tentative. Il n'importe ni les réglages ni les créatures du Laboratoire. Le monde inactif ne reçoit aucun pas de simulation. Quitter temporairement une mission pour le Laboratoire suspend son temps et ses actions ; revenir reprend la même tentative. Choisir une autre mission/abandonner arrête la tentative sans attribuer d'étoiles.

Les préférences purement visuelles de perception/diagnostic peuvent rester cochées ; elles ne changent ni les gènes ni les règles du scénario. Les réglages scientifiques sont masqués en Survie. Les boutons communs Pause/Reprendre et Réinitialiser/Rejouer sont routés vers le monde actif.

Une victoire ou défaite fige le monde et les points. Rejouer construit un monde neuf avec la même mission et la même graine : points, effets, cooldowns, temps et compteurs sont remis à zéro. La progression acquise reste en mémoire. Elle n'est pas sauvegardée et disparaît au rechargement de la page.

## Missions et fins de partie

| Mission | Victoire | Défaite / limite |
| --- | --- | --- |
| 1 — Premiers pas | Atteindre 60 s avec au moins 10 créatures vivantes | Extinction à tout instant, ou moins de 10 à 60 s |
| 2 — Équilibre naturel | Atteindre 120 s avec au moins une créature, dans le scénario nourriture/poison | Extinction avant ou à 120 s |
| 3 — Première évolution | Génération maximale atteinte ≥3 et au moins une créature vivante | Extinction ou objectif non atteint à 150 s |
| 4 — Invasion | Survivre 180 s avec trois prédateurs actifs et au moins une créature | Extinction, menace requise rompue, ou objectif manqué à la limite |
| 5 — Survival of the Smartest | Génération maximale atteinte ≥5 et au moins 15 créatures vivantes simultanément | Extinction ou conditions non réunies à 240 s |

L'extinction est évaluée avant la victoire. Atteindre un objectif exactement à sa limite est accepté ; l'atteindre après la limite ne l'est pas. Les missions 3 et 5 se terminent au premier pas satisfaisant toutes leurs conditions. Le numéro de génération est la filiation réelle et son maximum historique, comme dans le moteur précédent ; il ne classe pas l'intelligence.

La mission 1 ne demande pas de rester constamment au-dessus de 10 : une baisse récupérable avant 60 s ne provoque pas une défaite immédiate. La mission 5 demande la présence de 15 créatures lors de la victoire, sans durée de maintien supplémentaire cachée.

En mission 2, nourriture et poison sont présents au départ et leurs flux restent actifs. Ce sont les caractéristiques du scénario, pas l'obligation qu'aucun des deux tableaux ne puisse être momentanément vide après consommation/nettoyage. Aucune élimination arbitraire d'ADN n'est utilisée pour produire une réussite.

En mission 4, les trois prédateurs sont persistants : leur drain énergétique vaut zéro. Ils continuent de chercher, se déplacer, poursuivre et capturer normalement ; leurs autres limites restent actives. Ce réglage explicite empêche de gagner en attendant simplement leur mort de faim. Le moteur du Laboratoire conserve son drain normal.

`validateMission()` refuse notamment une durée supérieure à la limite, un objectif de population au-dessus du plafond, des seuils d'étoiles invalides, un objectif génétique sans reproduction, une menace obligatoire absente ou un scénario nourriture/poison incomplet. Cela ne transforme pas chaque tirage aléatoire en victoire garantie.

## Points d'écosystème et actions

Budget initial : **60** ; plafond : **100** ; régénération : **0,35 point par seconde simulée**. La pause, le monde inactif et la fin de partie ne régénèrent rien. Les naissances ne donnent pas de points : on ne confond pas succès reproductif et monnaie du jeu.

| Action | Coût | Cooldown | Durée | Effet |
| --- | --- | --- | --- | --- |
| Nourriture | 12 | 6 s | Instantané | Jusqu'à 10 nourritures dans un disque de 45 px autour du clic, sous le plafond de ressources |
| Nettoyage | 18 | 12 s | Instantané | Retire jusqu'à 6 poisons les plus proches à moins de 120 px du clic |
| Protection | 28 | 25 s | 8 s | Une seule zone de rayon 95 px, bloquant les captures à l'intérieur |
| Abondance | 35 | 40 s | 10 s | Bonus de 6 nourritures/s sur le flux normal, positions aléatoires et plafond conservé |

Les trois premières actions sont armées par leur bouton puis placées par un clic dans l'arène. Abondance est globale et immédiate. Annuler une action armée ne coûte rien. Un clic non armé sélectionne une créature ; il n'ajoute jamais gratuitement nourriture ou poison en Survie. Les actions sont refusées en pause ou après la fin de partie.

Points insuffisants, cooldown actif, coordonnées invalides, nettoyage sans poison local ou nourriture au plafond : aucun coût ni cooldown n'est consommé. Un ajout partiel de nourriture à proximité du plafond coûte le prix normal ; l'interface annonce un maximum de 10, pas une garantie de 10.

La protection ne rend pas invincible : elle est locale, temporaire, unique, coûteuse et moins longue que son cooldown. Elle ne restaure aucune énergie, n'empêche ni faim ni poison, et ne téléporte personne. Les prédateurs peuvent encore poursuivre une proie protégée ; seul le contact létal est bloqué. Les créatures entrent et sortent de la zone selon leurs propres forces.

Les ressources créées sont des entités réelles, consommées via le moteur existant. Aucun gène, parent, âge, génération ou énergie de créature n'est modifié directement par une action. Les décisions de mouvement restent Seek/Flee/Pursue/Evade/Wander.

Les retours visuels sont sobres : cercle vert de nourrissage, cercle violet de nettoyage, zone bleue translucide et bordure verte pendant l'abondance. Les durées restantes sont affichées ; effets et cooldowns suivent le temps simulé, donc se figent en pause. Un seul retour d'action récent et une seule zone sont conservés, sans liste d'effets croissante.

## Progression et étoiles

La mission 1 est disponible au départ. Une victoire débloque la suivante ; une défaite ne débloque rien. Les missions déjà débloquées restent rejouables. Le meilleur nombre d'étoiles de chaque mission est conservé en mémoire et ne diminue pas après un essai moins bon. Mission suivante n'est disponible qu'après une victoire et n'existe pas après la finale.

Une défaite donne **0 étoile**. Une victoire donne **1 étoile**, avec deux bonus indépendants :

| Mission | +1 étoile : population finale au moins | +1 étoile : dépenses totales au plus |
| --- | --- | --- |
| 1 | 45 | 24 points |
| 2 | 24 | 60 points |
| 3 | 35 | 48 points |
| 4 | 21 | 60 points |
| 5 | 20 | 84 points |

Les seuils sont inclusifs. Trois étoiles nécessitent les deux bonus ; deux étoiles en nécessitent un seul. Les dépenses sont cumulées, sans soustraire les points régénérés. Les critères sont affichés pendant la mission et enregistrés dans un résultat immuable.

Ce score récompense l'atteinte d'un objectif et l'économie d'interventions. Il ne mesure pas une adaptation génétique. Une stratégie peut faire naître davantage de générations tout en donnant moins d'étoiles, et une intervention peut être inutile ou contre-productive selon la graine.

## Paramètres d'équilibrage

Les règles sont centralisées dans `MissionDefinitions.js`, `EcosystemPoints.js` et `PlayerActions.js`. Elles sont configurables dans ces modules, avec validation au démarrage ; elles ne sont pas modifiables par les contrôles du Laboratoire pendant une tentative.

Toutes les missions gardent la reproduction Arena de référence : probabilité 0,002/pas admissible, mutation 1 % par gène, amplitude ×1, seuil énergétique 1,15, coût transféré 0,4, âge minimal 6 s, délai 8 s et plafond de 120 créatures. Aucun ADN favorable n'est imposé aux fondateurs.

| Mission | Fondateurs | Nourriture initiale / flux par s / plafond | Poison initial / flux par s | Drain créature /s | Prédateurs |
| --- | --- | --- | --- | --- | --- |
| 1 | 36 | 100 / 4 / 140 | 0 / 0 | 0,025 | Désactivés |
| 2 | 36 | 100 / 3,5 / 140 | 28 / 0,2 | 0,035 | Désactivés |
| 3 | 36 | 100 / 3 / 140 | 28 / 0,2 | 0,035 | Désactivés |
| 4 | 40 | 100 / 4 / 180 | 22 / 0,15 | 0,03 | 3 persistants ; vitesse 2,5 ; perception 160 ; capture 9 ; délai 6 s ; Evade ×2,5 |
| 5 | 44 | 110 / 3,5 / 200 | 24 / 0,18 | 0,035 | 2 ; vitesse 2,6 ; perception 170 ; capture 10 ; délai 4 s ; drain 0,008/s |

Les paramètres non indiqués restent ceux de l'étape 4. Le poison reste plafonné à 45. Le début est accessible pour apprendre ; la difficulté monte surtout par les objectifs combinés, les risques et les bonus, sans promettre une difficulté strictement croissante sur chaque graine.

## Essais de jouabilité et reproductibilité

Commande reproductible :

```powershell
node tools/mission-balance.mjs
```

Le script exécute **75 essais** : cinq missions × cinq graines (`1`, `7`, `42`, `2026`, `9001`) × trois politiques. Chaque essai utilise le moteur normal, sans accélération du temps interne, création artificielle de descendants ni modification d'ADN. Les missions sont débloquées artificiellement uniquement dans cet outil de test pour les évaluer indépendamment ; le jeu impose la progression normale.

Politiques :

- `idle` : aucune intervention.
- `food` : après 6 s, nourrir dès que budget et cooldown l'autorisent, près d'une créature attirée par la nourriture ; priorité à la génération la plus élevée puis à l'énergie la plus basse.
- `efficient` : utiliser l'abondance avant 50 s si le budget de dépenses du bonus d'étoile le permet ; après 15 s, nourrir les individus attirés par la nourriture et les plus faibles en énergie, sans dépasser ce budget. Cette politique n'est pas forcément optimale.

Résultats finaux exécutés :

| Mission | Victoires sans action | Victoires nourrissage | Victoires politique économe |
| --- | --- | --- | --- |
| 1 | 5/5 | 5/5 | 5/5 |
| 2 | 5/5 | 5/5 | 5/5 |
| 3 | 5/5 | 5/5 | 5/5 |
| 4 | 5/5 | 5/5 | 5/5 |
| 5 | 3/5 | 5/5 | 4/5 |

La finale est donc réalisable sur les cinq graines avec une stratégie limitée, mais ni l'inaction ni une politique arbitraire n'assurent une victoire. Sur la graine 2026 : sans action, défaite à 240 s avec 7 créatures ; avec nourrissage ciblé, victoire à 80,70 s avec 15 créatures, G5 et 84 points dépensés.

Trois étoiles ont été obtenues dans chaque mission sur au moins un essai :

| Mission | Graine / politique | Population finale | Dépenses |
| --- | --- | --- | --- |
| 1 | 42 / économe | 46 | 24 |
| 2 | 7 / sans action | 24 | 0 |
| 3 | 42 / nourrissage | 35 | 36 |
| 4 | 2026 / économe | 21 | 59 |
| 5 | 7 / économe | 20 | 83 |

Ces exemples sont des tests de règles et de jouabilité, pas des preuves d'adaptation ou des garanties sur toutes les graines. L'échantillon reste limité et les politiques automatisées ne remplacent pas des essais humains. La correction du budget fractionnaire fait partie de ces valeurs finales ; les chiffres exploratoires calculés avant cette correction ne sont pas la référence.

## Tests automatisés

Commande exécutée avec Node.js v24.18.0 :

```powershell
node --test tests/*.test.js
```

**Résultat final : 126 tests exécutés, 126 réussites, 0 échec, 0 test ignoré.** Les 91 tests historiques sont conservés ; 35 tests supplémentaires couvrent le gameplay.

La suite conserve les **91 tests précédents** et couvre en plus : sélection et verrouillage, scénarios invalides, victoire/défaite aux seuils, chronomètre fixe, pause, extinction prioritaire, points, coûts, cooldowns, échec sans coût, protection locale et expiration, abondance réelle, progression, étoiles, reset, isolation des mondes, routage complet de l'application et rendu simulé.

Les tests exécutent les cinq missions avec cinq graines via la stratégie de nourriture, vérifient au moins un résultat trois étoiles par mission, puis une session de **20 000 pas actifs** avec relecture d'une mission terminée. Les vecteurs et énergies restent finis, les points sont bornés et l'historique reste limité à 600 entrées. Les longues simulations génétiques et de prédation des étapes précédentes restent présentes.

### Limite de validation navigateur

La connexion a répondu « No browser is available » puis une liste vide. Aucun rendu réel, aucune console navigateur ni fluidité ne sont donc présentés comme vérifiés. Les tests Node utilisent la vraie classe Vehicle, une doublure de p5.Vector et du DOM. Le HTML réel, les liens/imports HTTP et la syntaxe JavaScript sont vérifiés automatiquement ; le moteur p5 réel et l'ergonomie des clics rapides restent à valider dans un navigateur.

## Tester les cinq missions dans le navigateur

```powershell
cd "C:\Users\Simo\Desktop\SteeringBehavioursM2IA2_Casa_2026_2027\8-EvolutionarySteeringBehavior\EvolutionArena"
node tools/serve.mjs
```

Ouvrir **http://127.0.0.1:8088**. Aucun `npm install` nécessaire ; Ctrl+C arrête le serveur.

1. **Laboratoire** : modifier un réglage, sélectionner un individu et noter le temps. Passer en Survie : les réglages scientifiques sont masqués et le temps du Laboratoire n'avance plus.
2. **Premiers pas** : graine 2026, jouer. Vérifier le HUD, le budget de 60 points, les cooldowns, la pause et l'objectif à 60 s. Ne pas dépenser sans raison ; trois étoiles exigent 45 créatures et au plus 24 points de dépenses.
3. **Équilibre naturel** : après victoire, Mission suivante. Observer nourriture et poison. Placer un nettoyage près de vrais poisons ; un clic sans poison doit être refusé sans coût. Tenir 120 s.
4. **Première évolution** : observer G1, les naissances puis G2/G3 ; sélectionner des créatures pour vérifier la filiation. La mission gagne à G3 avant 150 s, pas à une génération modifiée manuellement.
5. **Invasion** : vérifier trois prédateurs actifs. Placer une protection près d'un groupe menacé, observer les 8 s et l'expiration. La faim et le poison restent dangereux. Utiliser l'abondance si nécessaire et tenir 180 s.
6. **Finale** : atteindre G5 tout en gardant 15 créatures avant 240 s. La graine 2026 échoue sans aide dans l'essai automatisé. Inspecter les gènes et soutenir les lignées attirées par la nourriture, surtout celles de génération élevée. Les déplacements restent autonomes ; le placement des ressources est la décision du joueur.
7. Après chaque résultat : vérifier les étoiles, Rejouer et Mission suivante. Une défaite ne doit débloquer aucune nouvelle mission. La dernière mission n'a pas de suivante.
8. Revenir au Laboratoire : retrouver ses réglages et son monde, sans points de Survie ni zone protectrice importés. Reprendre ensuite une mission suspendue, ou abandonner pour revenir à la sélection.
9. Examiner la console, le redimensionnement et les affichages sur fenêtre étroite ; cette vérification réelle n'a pas pu être faite dans cette session.

## Limites connues et suite proposée

- Progression uniquement en mémoire, sans sauvegarde ; un rechargement la remet à zéro.
- Cinq graines ne couvrent pas toute la variabilité ; aucune stratégie gagnante universelle n'est garantie.
- Les premiers niveaux restent volontairement accessibles sans intervention ; les bonus et la finale demandent davantage de décisions.
- Les étoiles jugent une mission, pas la qualité scientifique des gènes.
- La protection bloque le contact létal, sans changer les objectifs des prédateurs : ils peuvent attendre près d'une proie protégée.
- Le compteur de génération est historique ; il ne garantit pas que la plus haute génération soit encore vivante à la victoire.
- Le rendu réel, l'accessibilité complète et l'ergonomie du ciblage restent à éprouver sur navigateur.

Pour une étape suivante, proposer d'abord une validation humaine de l'interface et de la difficulté, un ciblage d'action plus lisible et une matrice d'équilibrage sur davantage de graines/stratégies. Une sauvegarde locale de progression pourrait ensuite être discutée. Aucun de ces ajouts n'est commencé ici.

Arrêt après l'étape 5, dans l'attente de validation.
