# Guide utilisateur

## Ouvrir le projet

Dans un terminal PowerShell placé dans EvolutionArena, exécuter `node tools/serve.mjs`, puis ouvrir http://127.0.0.1:8088. Aucun `npm install` nécessaire. Le serveur s'arrête avec Ctrl+C. Node 22+ et un navigateur moderne sont requis. Ne pas ouvrir directement le fichier HTML.

L'accueil propose **Jouer**, **Ouvrir le Laboratoire**, **Comment jouer** et **Paramètres**. Le guide explique les sept concepts principaux. Accueil, Guide et Paramètres suspendent le temps du monde actif ; revenir ne rattrape pas le temps passé dans ces menus.

## Jouer une mission

Choisir Jouer, saisir une graine (2026 convient pour découvrir), puis **Jouer — Premiers pas**. Les quatre missions suivantes se débloquent dans l'ordre après victoire. Le HUD indique objectif, limite temporelle, population, génération, énergie, points et prédateurs.

| Mission | Condition |
| --- | --- |
| 1 | 60 secondes et au moins 10 créatures à la fin |
| 2 | 120 secondes avec nourriture et poison |
| 3 | Atteindre G3 avant 150 secondes |
| 4 | 180 secondes avec trois prédateurs persistants |
| 5 | Atteindre G5 et conserver au moins 15 créatures avant 240 secondes |

L'extinction ou un objectif manqué à l'échéance entraîne la défaite. Le numéro maximal de génération est historique : il peut inclure une génération désormais disparue. Une victoire vaut une étoile ; deux bonus indépendants concernent la population finale et les dépenses, avec seuils visibles par mission. Rejouer reprend la même graine ; Mission suivante est disponible après victoire, sauf pour la finale.

Les créatures restent autonomes. Sélectionner une action puis cliquer dans l'arène place son effet ; Abondance est immédiate. Annuler l'action ne coûte rien.

| Action | Coût | Récupération | Effet |
| --- | --- | --- | --- |
| Nourriture | 12 | 6 s | Jusqu'à 10 ressources autour du clic |
| Nettoyage | 18 | 12 s | Retire jusqu'à 6 poisons dans 120 px |
| Protection | 28 | 25 s | Zone de 95 px pendant 8 s ; bloque les captures, pas faim/poison |
| Abondance | 35 | 40 s | +6 nourritures/s pendant 10 s, sous le plafond |

Budget initial 60, plafond 100, régénération 0,35 point/seconde simulée. Les boutons expliquent pourquoi une action est indisponible. Pause fige énergie, temps, effets et récupération. Les clics gratuits d'ajout de ressources sont réservés au Laboratoire.

## Observer le Laboratoire

Depuis Accueil choisir Laboratoire, ou utiliser le sélecteur dans le poste de simulation. Le monde de Survie est distinct et son inactivité le fige. Les réglages expérimentaux n'affectent pas les missions.

- Triangle orienté : créature, avec barre d'énergie et marques de génération.
- Ressource verte : nourriture ; croix rose : poison ; grande silhouette orangée : prédateur.
- Clic créature : inspecteur (âge, énergie, parent, génération, enfants directs et ADN), même en pause.
- Clic dans le vide : nourriture ; Maj+clic : poison, sous les plafonds et hors pause.
- Rayons de perception : rendre visibles les voisinages génétiques ; diagnostic : afficher aussi cibles, projections et forces de prédation.
- Activer les prédateurs : deux par défaut ; leur chasse commence après une grâce initiale. Les protections démographiques limitent les captures sans garantir la survie.

Les poids signés du génome gouvernent attraction/répulsion nourriture et poison ; les deux autres gènes sont leurs distances de perception. Le mode de reproduction Arena exige énergie, âge et délai ; TP comparable utilise un clonage probabiliste moins contraint ; témoin désactive les naissances. Les réglages valides sont bornés par le moteur.

## Mesurer et comparer

Les neuf graphiques montrent population, naissances/décès, énergie, génération, quatre moyennes génétiques et diversité normalisée. Les statistiques génétiques concernent les vivants. La durée de vie concerne seulement les morts. Une population vide affiche — pour les nouvelles statistiques indisponibles.

Déplier **Expériences reproductibles et export CSV**, choisir profil et graine, puis **Appliquer et redémarrer**. Ce bouton efface la trajectoire en cours. Conserver la trace ou exporter avant de redémarrer. Quatre traces maximum sont conservées en mémoire ; la cinquième remplace la plus ancienne.

Pour une comparaison : même environnement, même horizon, plusieurs graines et aucune intervention. Exemple : graine 2026, Arena sans prédateurs, mutation 0 %, puis 1 %. Répéter avec 1, 7, 42 et 9001. Modifier un facteur à la fois. Relancer une trace réapplique ses paramètres finaux depuis le début : ce n'est pas un enregistrement vidéo ni une restauration des individus.

**Exporter le CSV courant**, ou CSV d'une trace, télécharge les mesures et métadonnées. Dans un tableur, choisir UTF-8 et séparateur virgule ; les cellules vides représentent des données indisponibles. Les historiques restent limités à 600 mesures ; les suppressions anciennes sont indiquées, les compteurs cumulés continuent depuis le début.

La diversité mesure une dispersion, pas une qualité. Une reproduction plus fréquente, une faible diversité ou un score élevé ne démontrent pas l'adaptation.

## Préférences et sauvegarde

Paramètres règle réduction des animations, contraste, effets et qualité standard/économique. La réduction demandée par le système est prioritaire. La qualité vise 60 ou 30 images/s sans changer le pas physique.

Progression, meilleures étoiles, paramètres visuels, affichage de perception et diagnostic sont stockés localement. Les mondes, traces scientifiques, graines expérimentales et réglages génétiques ne sont pas sauvegardés. La sauvegarde dépend du navigateur et de l'adresse, y compris du port ; une navigation privée peut l'effacer à sa fermeture.

**Rétablir les valeurs par défaut** concerne l'affichage. **Réinitialiser la progression**, puis un second clic de confirmation, efface les étoiles et retourne à la sélection ; changer d'écran annule cette confirmation. Le Laboratoire est conservé. Un stockage bloqué ou saturé affiche un message et laisse la session utilisable. Des données corrompues déclenchent des valeurs par défaut.

## Dépannage et vérifications restantes

Port occupé : définir `$env:PORT = "8089"`, puis relancer et ouvrir cette nouvelle adresse. Page blanche : utiliser HTTP, examiner la console et vérifier que les fichiers vendor sont présents. CSV illisible : réimporter avec UTF-8 et virgule. Simulation immobile : revenir au poste actif, vérifier Pause et la sélection d'une mission. Population vide : réinitialiser pour lancer une nouvelle expérience.

Les contrôles HTML utilisent Tab puis Entrée/Espace. Le placement dans l'arène reste à la souris/tactile p5 ; le jeu n'a pas de contrôle complet au clavier. La validation finale headless ne remplace pas les essais humains de confort et d'accessibilité ; voir la checklist du rapport final.
