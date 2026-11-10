# Étape 6 — Interface et direction artistique

Projet : **EVOLUTION ARENA — Survival of the Smartest**. Date : 25 octobre 2026. Version 0.6.

## Périmètre et vérifications préalables

Les documents des étapes 2 à 5, l'architecture et les composants UI existants ont été examinés. La référence initiale comptait 126 tests réussis. Les modes Laboratoire et Survie, diagnostics, sélection des créatures, paramètres scientifiques, cinq missions, objectifs, actions, points, progression et étoiles sont préservés.

La refonte ne modifie aucun module physique, génétique, de prédation ou de règles de jeu. Les dessins lisent les états existants. Les empreintes SHA-256 des modules moteur (`core`, `entities`, `evolution`, `behaviors`, `predation`, `simulation`, `game`), des bibliothèques fournies et des fichiers voisins sont identiques au relevé initial. Aucun `vehicle.js`, TP original, EvoSwarm ou SmartCity modifié. Aucune dépendance installée, aucun commit, push ou déploiement.

## Direction artistique

Le thème est un **poste d'observation génétique futuriste** : bleu nuit, panneaux sombres, accents cyan, violet et vert. Les informations principales utilisent une typographie système moderne, sans police distante. Les grandes valeurs du HUD sont séparées des explications scientifiques et des détails d'action.

L'accueil associe un titre typographique fort, quatre entrées claires et une illustration géométrique native : orbites, grille et hélice stylisée. Cette décoration HTML/CSS n'est pas une simulation biologique ni une entité physique. Aucun asset généré, image externe ou framework graphique n'est ajouté.

La palette de base utilise notamment `#080f1d` pour le fond, `#101b2d` pour les panneaux, `#e6eefc` pour le texte, `#a5b6d0` pour le secondaire, `#79e7fa` pour le cyan et `#b99bff` pour le violet. Les contrastes de trois couples de référence sont vérifiés mathématiquement à au moins 4,5:1 ; cela ne remplace pas un audit de toutes les surfaces rendues.

## Fichiers créés et modifiés

| Statut | Fichier | Responsabilité |
| --- | --- | --- |
| Créé | `src/ui/AppShell.js` | Navigation entre accueil, poste, tutoriel et paramètres ; retour, focus et suspension de l'activité. |
| Créé | `src/ui/DisplaySettings.js` | Préférences visuelles validées, instantanés immuables et valeurs par défaut. |
| Créé | `src/ui/Tutorial.js` | Sept étapes pédagogiques, navigation bornée et redémarrage. |
| Créé | `src/ui/NotificationCenter.js` | Trois notifications maximum, déduplication, expiration et fermeture. |
| Créé | `theme.css` | Nouvelle couche artistique, responsive, contrastes, focus et mouvements réduits. |
| Créé | `tests/interface-modern.test.js` | 20 tests de navigation, présentation et invariants du rendu. |
| Créé | `docs/ETAPE-6-INTERFACE.md` | Ce document. |
| Modifié | `src/main.js` | Accueil au point d'entrée navigateur, assemblage du shell, préférences graphiques, routage et cadence du HUD. |
| Modifié | `src/ui/ArenaRenderer.js` | Fond, entités, signes de génération, sélection, poursuite et effets légers. |
| Modifié | `src/ui/GameRenderer.js` | Zone protectrice plus lisible, effets optionnels, informations critiques toujours visibles. |
| Modifié | `src/ui/GameInterface.js` | Énergie/prédateurs dans le HUD, raisons de désactivation, récupération, notifications et états de résultat. |
| Modifié | `index.html` | Structure des quatre écrans, navigation native, paramètres, guide et notifications. |
| Modifié | `tests/helpers/runtime.js` | Éléments et focus simulés pour les nouveaux composants. |
| Modifié | `tests/evolution.test.js` | Ajout de `line()` au faux p5 d'un test de dessin ; aucune assertion ni règle génétique supprimée. |
| Modifié | `README.md`, `package.json` | Instructions et version 0.6. |

`styles.css` reste la base de mise en page ; `theme.css`, chargé ensuite, applique la nouvelle présentation sans réécrire les contrôleurs scientifiques. Les documents des étapes 2 à 5 restent historiques.

## Navigation et indépendance des modes

Le point d'entrée réel `window.setup()` ouvre **l'accueil**. `mountApp()` garde son défaut Laboratoire pour les intégrations existantes et les tests historiques ; l'option `{ startScreen: 'home' }` permet de reproduire l'entrée utilisateur. Un test appelle aussi le point d'entrée avec des doublures de window/document/p5 pour vérifier cette différence explicitement.

Les quatre entrées d'accueil sont :

- **Jouer** : poste Survie, sélection des missions ou tentative en cours conservée.
- **Ouvrir le Laboratoire** : simulation scientifique et paramètres existants.
- **Comment jouer** : tutoriel en sept étapes.
- **Paramètres** : confort et qualité visuels, sans réglage physique ou génétique.

Accueil, guide et paramètres suspendent l'envoi de pas au monde actif. Ils ne réinitialisent ni la mission, ni la simulation du Laboratoire, ni la pause choisie par l'utilisateur. Les actions de Survie sont désactivées hors du poste. Le retour reprend la session et ses effets à leur temps simulé précédent.

Un petit historique borné à quatre entrées permet les retours depuis les écrans secondaires. Les titres reçoivent le focus au changement d'écran ; l'interface n'utilise pas de fenêtre modale imposant un piège clavier. Les boutons HTML natifs restent activables par Entrée/Espace et parcourables par Tab.

## Tutoriel

Le guide couvre, dans l'ordre : créatures autonomes, nourriture, poison, prédateurs et anticipation, ADN/mutations, missions et limites de l'interprétation scientifique, puis actions du joueur.

Chaque étape possède un titre, une description, un symbole décoratif et un compteur. Précédent est désactivé au début, Continuer devient Terminer à la dernière étape. Recommencer remet l'index à zéro. Fermer retourne à l'écran précédent, sans altérer la partie. Aucun passage du guide ne modifie de gène ou de créature.

## Rendu de l'arène

`ArenaRenderer` ajoute six bandes de fond en qualité standard pour une profondeur légère, une grille régulière et des angles de cadre. Aucun shader, texture distante ou filtre par créature.

| Élément | Représentation conservée / améliorée |
| --- | --- |
| Créature | Triangle orienté par la vitesse ; barre d'énergie ; signe supplémentaire de faible énergie. |
| Génération | Palette existante conservée, plus une à quatre encoches selon un cycle. Le numéro exact reste dans l'inspecteur. |
| Sélection | Cercle blanc et repères latéraux ; ce n'est pas seulement un changement de couleur. |
| Prédateur | Double triangle plus grand, rouge orangé ; repos plus terne ; petite impulsion visuelle en poursuite. |
| Cible | Réticule à angles autour de la cible actuelle, distinct du cercle de sélection. |
| Capture | Halo bref au lieu de capture, statique lorsque les mouvements sont réduits. |
| Nourriture | Disque vert avec centre clair en qualité standard. |
| Poison | Croix rose encadrée d'un losange en qualité standard. La croix reste en économique. |
| Protection | Disque translucide et contour cyan ; le cercle utile reste affiché même sans effets. |

Les signes de génération bouclent après quatre, comme les couleurs : ils ne permettent pas à eux seuls de distinguer G1 de G5. Le panneau individuel donne la filiation et le numéro exact. La couleur ne classe pas l'intelligence ou l'adaptation.

Les animations p5 utilisent seulement le temps simulé et des champs déjà présents (`birthFlash`, `captureFlash`, `state`). Elles ne tirent aucun nombre aléatoire et n'écrivent ni position, ni vitesse, ni énergie. Les tests comparent l'état complet du monde avant et après dessin et interdisent un appel à Math.random durant ce contrôle.

La réduction des animations retire les pulsations de poursuite et remplace les halos expansifs par des cercles statiques. Elle ne fige pas le mouvement des créatures : pour cela, utiliser Pause. Les diagnostics scientifiques Pursue/Evade, projections, cibles et rayons sont conservés.

## HUD, objectifs, actions et résultats

En Survie, le HUD affiche mission et objectif, temps simulé/limite, population, génération atteinte, énergie moyenne, points et prédateurs actifs. La barre de progression et les seuils d'étoiles restent ceux de l'étape 5.

Chaque action conserve son prix et ses règles. La présentation ajoute :

- Le coût et le temps de récupération dans le bouton.
- Une barre de récupération individuelle.
- Un état textuel visible : disponible, points insuffisants, récupération ou mission en pause/terminée.
- Une description liée au bouton via `aria-describedby`, et un titre explicatif.
- Un état armé perceptible par le contour, le fond et `aria-pressed`.

Les boutons désactivés ont une bordure discontinue et une explication ; leur seule opacité ou couleur n'est pas utilisée pour communiquer l'état. Le clic produit aussi un retour d'enfoncement CSS léger lorsque les animations sont autorisées.

Les résultats affichent explicitement **Victoire** ou **Défaite**, le résumé et les étoiles. Un état de présentation `data-result` détermine le fond et l'accent ; la réussite possède un effet d'une seconde, supprimé en animations réduites. Les étoiles ont un libellé accessible « N étoiles sur 3 ». Rejouer et Mission suivante suivent toujours les règles existantes.

`NotificationCenter` conserve au plus trois éléments pendant quatre secondes de temps d'interface, avec un préfixe textuel Information, Réussite ou Attention. Les messages identiques encore actifs sont dédupliqués. Les notifications annoncent notamment début/fin de mission, actions et certains clics du Laboratoire. Elles sont fermables par un bouton natif et annoncées poliment, sans déplacer le focus.

Le texte d'action détaillé reste disponible dans le panneau, même après disparition du toast. Les notifications peuvent expirer dans un menu ou pendant une pause : leur durée est une durée d'interface, indépendante du chronomètre, des cooldowns et des effets physiques de la mission.

## Paramètres visuels

| Paramètre | Défaut | Effet |
| --- | --- | --- |
| `reducedMotion` | Préférence système au chargement, sinon false | Pas de rotations d'ambiance ou de pulsations ; halos statiques ; transitions réduites. |
| `highContrast` | false | Texte, bordures et palette HTML renforcés ; grille p5 plus contrastée. |
| `effects` | true | Effets facultatifs de naissance, capture, poursuite et retour d'action. Les états critiques restent visibles. |
| `quality` | `standard` | Standard : densité de pixels jusqu'à 2 et 60 images/s visées. Économique : densité 1, 30 images/s visées et moins de détails. |

La préférence système de réduction des mouvements détectée au chargement ne peut pas être contournée par la case. Les règles CSS `prefers-reduced-motion` complètent cette prise en charge. La détection JavaScript est initiale : un changement système en cours de session n'est pas surveillé par un listener ; utiliser la case ou recharger pour actualiser les effets p5.

Les préférences sont validées avant application et stockées en mémoire seulement. Rétablir les valeurs par défaut conserve la préférence système détectée. Aucun paramètre de vitesse, énergie, ADN, reproduction, difficulté ou mission n'est modifié.

## Accessibilité et responsive

- Navigation, tutoriel, paramètres et actions utilisent des contrôles HTML natifs, avec labels et focus visibles.
- Un lien d'évitement conduit à la navigation principale.
- Les écrans masqués utilisent `hidden`, donc leurs contrôles ne restent pas normalement dans l'ordre Tab.
- Les notifications utilisent `aria-live="polite"` et ne capturent pas le focus.
- Les entités se distinguent par leurs formes, tailles et marques, pas seulement leurs couleurs.
- Le HUD possède des valeurs textuelles, y compris énergie, progression et étoiles.
- Les dispositions se replient à 1150 et 760 pixels ; cartes, actions et paramètres passent sur moins de colonnes.
- La préférence CSS de réduction des mouvements supprime les animations d'interface ; le réglage explicite agit aussi sur les effets p5.

Ces dispositions et trois contrastes de palette sont testés statiquement ou avec un DOM simulé. L'ordre réel de focus, le lecteur d'écran, le zoom, les surfaces composites et les tailles de fenêtre doivent encore être vérifiés dans un navigateur. Le ciblage dans l'arène reste à la souris/tactile p5 ; les tests ne revendiquent pas un contrôle intégral du jeu au clavier.

## Performances

Le moteur conserve son pas fixe à 60/s. Une cadence de rendu de 30 images/s reçoit deux pas physiques par image lorsque le temps disponible le permet ; ce n'est pas un ralentissement volontaire des algorithmes. Un test compare les états après un même temps simulé à 30 et 60 rendus/s.

Le HUD et les grands panneaux sont actualisés à environ 10 Hz, alors que le canvas suit sa cadence p5. Les clics et changements de réglages actualisent immédiatement leurs composants. Le rendu canvas est arrêté lorsque le poste est masqué ; aucune simulation ne progresse derrière les menus.

Les décorations reposent sur quelques primitives, aucune ombre ou texture générée pour chaque agent. La pulsation de poursuite concerne au plus huit prédateurs. Les constantes de palette et les entrées d'actions sont réutilisées ; le dessin ne construit pas de nouveaux vecteurs. Le mode économique retire les bandes de profondeur et les détails secondaires des ressources/zones.

Les FPS annoncés sont des **cibles**, pas des mesures. Aucun profilage graphique réel n'est disponible dans cette session. De grandes populations et les diagnostics cumulés peuvent toujours réduire la fluidité ; le réglage économique ne remplace pas une optimisation du moteur.

## Tests et résultats

Commande exécutée avec Node.js v24.18.0 :

```powershell
node --test tests/*.test.js
```

**146 tests exécutés, 146 réussites, 0 échec et 0 test ignoré.** Les 126 scénarios historiques sont conservés et 20 tests nouveaux couvrent cette interface. Le seul ajustement d'un test historique ajoute `line()` à son faux p5, parce que les marques graphiques utilisent désormais cette primitive ; les assertions restent présentes.

Les nouveaux tests vérifient : navigation et retour/focus simulé, accueil réel au point d'entrée avec doublures, tutoriel complet, paramètres invalides, réduction système, notifications bornées et fermables, missions verrouillées, HUD, coûts/cooldowns et explications, résultats/étoiles accessibles, HTML sans ID dupliqué et correctement imbriqué, règles CSS, contrastes de référence, rendu en lecture seule sans aléatoire/NaN, détails économiques et suspension des mondes dans les menus.

La sélection de créature, les résultats de mission, les actions, la génétique et les endurances de 20 000 pas déjà présentes continuent de passer. Les tests n'effacent pas la frontière entre score de jeu et adaptation génétique.

### Validation réelle indisponible

La tentative de connexion a renvoyé **« No browser is available »**, suivie d'une liste vide. **Aucun rendu visuel réel, aucune console navigateur, aucun audit clavier/lecteur d'écran complet et aucun FPS réel ne sont validés.** Les tests utilisent p5.Vector et le DOM simulés autour de la vraie base Vehicle ; l'application, elle, charge le p5 local réel.

## Procédure de validation visuelle

```powershell
cd "C:\Users\Simo\Desktop\SteeringBehavioursM2IA2_Casa_2026_2027\8-EvolutionarySteeringBehavior\EvolutionArena"
node tools/serve.mjs
```

Ouvrir **http://127.0.0.1:8088**. Pas d'installation nécessaire ; Ctrl+C arrête le serveur.

1. **Accueil** : vérifier titre, quatre entrées, hélice, lisibilité et absence de débordement à 1440, 1024, 760 et 375 pixels.
2. **Clavier** : parcourir le lien d'évitement et les boutons avec Tab ; activer avec Entrée/Espace. Vérifier le focus lors des retours et l'absence de contrôle actif dans les écrans masqués.
3. **Guide** : parcourir les sept sujets, revenir, recommencer et terminer. Le compteur et les boutons doivent rester cohérents.
4. **Paramètres** : tester contraste, effets, qualité et réduction des animations. Activer aussi la réduction système avant rechargement. Les réglages scientifiques et la mission ne doivent pas changer.
5. **Laboratoire** : vérifier forme/orientation des créatures, barre d'énergie, signes de génération, sélection et inspecteur. Activer prédateurs et diagnostics, observer cibles, prévisions et captures.
6. **Survie** : vérifier cinq cartes, verrouillage et progression conservés. Démarrer la mission 1 : mission, objectif, temps, population, génération, énergie, points et prédateurs doivent être lisibles.
7. **Actions** : observer coût, armement, cooldown et explication d'un bouton indisponible. Tester nourriture, nettoyage, protection et abondance ; aucune information critique ne doit disparaître lorsque les effets sont coupés.
8. **Menus pendant une partie** : noter temps et points, ouvrir aide/paramètres ou accueil, attendre puis revenir. Aucune avancée de simulation ne doit avoir eu lieu ; la pause manuelle doit être conservée.
9. **Résultats** : terminer une mission et observer victoire, étoiles, notification et bouton suivant. Tester une extinction ou un objectif manqué pour la défaite ; aucun déblocage indu.
10. **Performances** : comparer standard/économique avec des effectifs raisonnables puis élevés. Mesurer les FPS dans le navigateur, vérifier la console et limiter les diagnostics si nécessaire.

## Limites et arrêt

Le rendu doit encore être confirmé visuellement sur un vrai navigateur. Les préférences et la progression ne sont pas persistées. Le tutoriel est textuel, pas un scénario interactif guidant les créatures. Les marques de génération restent cycliques et les FPS ne sont pas garantis. Les limites de ciblage au clavier et de détection dynamique du changement système sont indiquées plus haut.

Aucune étape 7 commencée. Arrêt après cette livraison.
