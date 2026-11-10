# Validation finale — 25 octobre 2026

## État de livraison

Le projet conserve ses cinq missions, ses quatre gènes, la reproduction, les prédateurs, les neuf graphiques, les quatre traces et le CSV. La finalisation ajoute une sauvegarde locale validée, une procédure de profilage, un test Chrome réel et les documents de présentation. Aucun composant fonctionnel du moteur n'a été réécrit ; aucune optimisation spéculative appliquée.

**177 tests Node réussis, zéro échec, zéro ignoré.** Les 168 tests antérieurs restent présents ; neuf nouveaux scénarios couvrent la persistance. Une validation Chrome headless a réellement été exécutée avec p5 local, avec les limites indiquées ci-dessous. Le projet n'est pas déclaré entièrement validé pour toutes les utilisations humaines.

## Audit et corrections

README et documents 2–7 consultés, architecture du dépôt relue, interfaces publiques du moteur examinées. Les commandes restent sans installation : serveur HTTP Node, tests Node natifs, p5 fourni. Le moteur est séparé du rendu ; les mondes Laboratoire/Survie restent indépendants. Le modèle génétique et ses quatre bornes ne changent pas.

Corrections et améliorations :

- Section scientifique du README avec caractères remplacés par des `?` : réécriture en UTF-8 et documentation de lancement unifiée.
- Préférences et progression volatiles : sauvegarde légère, validation stricte et rechargement sans restauration du monde.
- Textes UI devenus obsolètes sur la progression : actualisés pour le stockage local.
- Données corrompues, schéma inconnu, getter localStorage refusé et quota : repli et avertissements sans bloquer la simulation.
- Reset accidentel : deux clics nécessaires ; la navigation annule l'armement.
- Aucun défaut de steering, de génétique ou de capture identifié nécessitant une modification du moteur.

## Fichiers

Créés :

- `src/persistence/LocalPreferences.js`
- `tests/persistence.test.js`
- `tools/performance.mjs`
- `tools/browser-smoke.mjs`
- `docs/GUIDE-UTILISATEUR.md`
- `docs/ARCHITECTURE.md`
- `docs/DEMONSTRATION-PROFESSEUR.md`
- `docs/VALIDATION-FINALE.md`

Modifiés :

- `README.md` : présentation et instructions actuelles.
- `index.html` : reset, statut de sauvegarde et texte de progression.
- `src/main.js` : chargement et sauvegarde événementielle, avertissement et libération des écouteurs.
- `src/game/MissionProgress.js` : callback de changement et reset.
- `src/ui/AppShell.js` : bouton de reset en deux clics, annulable par navigation.
- `tests/helpers/runtime.js` : deux nouveaux éléments DOM simulés.

Rapports créés : `output/tests-final.tap`, `output/mission-balance-final.jsonl`, `output/performance/final.json`, `output/browser/report.json`, `output/browser/{home,laboratory,mission,mobile}.png`, `output/browser/downloads/evolution-arena-live.csv`. Les trois rapports `output/science/` ont été régénérés et sont identiques à leurs versions de début de finalisation.

## Tests exécutés

```powershell
node --test --test-reporter=tap tests/*.test.js
node --expose-gc tools/performance.mjs
node tools/mission-balance.mjs
node tools/science-batch.mjs --duration 120 --seeds 1,7,42,2026,9001
node tools/browser-smoke.mjs
```

Node v24.18.0. Le rapport TAP donne 177/177. Les suites moteur, génétique, prédation, gameplay, interface, science, serveur et syntaxe sont toutes exécutées. Elles comprennent les cas limites de force, de population vide, de données invalides, d'absence de NaN, d'isolation et de reproductibilité.

Les neuf nouveaux tests couvrent valeurs par défaut indépendantes ; aller-retour de stockage ; JSON corrompu/version inconnue/taille excessive ; étoiles invalides et progression discontinue ; liste blanche sans simulation ; lecture/écriture refusées ; meilleures étoiles et callback ; confirmation/annulation/désabonnement ; montage de deux applications successives avec réhydratation et absence d'écritures par pas physique.

Les endurances historiques de 20 000 pas et le test scientifique de 40 000 pas restent actifs et réussissent. Aucun NaN détecté par les assertions. Les nouveaux profils de performance ajoutent 60 000 pas mesurés, plus leur échauffement, sans valeur non finie.

### Missions

75 essais Node : cinq missions × cinq graines (1, 7, 42, 2026, 9001) × trois politiques déjà existantes (`idle`, `food`, `efficient`). Rapport JSONL conservé.

| Mission | Victoires sans action | Nourrissage | Politique économe |
| --- | --- | --- | --- |
| 1 | 5/5 | 5/5 | 5/5 |
| 2 | 5/5 | 5/5 | 5/5 |
| 3 | 5/5 | 5/5 | 5/5 |
| 4 | 5/5 | 5/5 | 5/5 |
| 5 | 3/5 | 5/5 | 4/5 |

Ce sont des politiques automatisées avec accès aux états du moteur, pas une garantie de réussite pour un joueur humain. Le nourrissage choisit des individus attirés par la nourriture ; il ne modifie pas leur génome.

### Science

Les 40 essais (huit profils, cinq graines, 120 s) reproduisent les résultats de l'étape 7. Aucune extinction observée à l'horizon, tous les essais censurés. Moyennes finales : TP entre 118,6 et 120 individus ; Arena sans prédateurs entre 16 et 16,2 ; Arena avec prédateurs entre 8,4 et 8,6. Les coûts et conditions de reproduction diffèrent : ces effectifs ne démontrent aucune supériorité ni adaptation. Les fichiers JSON/CSV contiennent paramètres et dispersion entre graines.

## Performance mesurée

Machine : AMD Ryzen 7 5800H, Windows ; mesures Node avec doublure vectorielle, sans DOM ni rendu. Après 600 pas d'échauffement, 20 000 pas par taille. Pour conserver un effectif fixe : reproduction désactivée, drain nul, aucun poison, trois prédateurs au repos (seuil de chasse 300). Ce protocole est une charge contrôlée, pas une partie naturelle ni un pire cas de chasse. Ressources et mesures scientifiques restent actives.

| Population constante | Moyenne mise à jour | p95 des moyennes de blocs de 100 pas | Heap après GC début → fin |
| --- | --- | --- | --- |
| 36 | 0,00966 ms/pas | 0,01324 ms/pas | 5 295 064 → 5 899 808 octets |
| 120 | 0,02513 ms/pas | 0,02984 ms/pas | 5 495 736 → 5 970 288 octets |
| 300 | 0,06379 ms/pas | 0,07277 ms/pas | 5 758 736 → 6 161 560 octets |

Les 344 échantillons de chaque essai expliquent une partie de la rétention ; leur plafond reste 600. Les deltas heap après GC sont environ +0,60/+0,47/+0,40 Mo décimaux. Ce relevé à deux instants ne prouve pas l'absence de fuite mémoire. Les tests bornent historiques, notifications et effets ; aucun objet mort n'est volontairement conservé dans ces historiques. Aucun profil mémoire prolongé du navigateur n'a été effectué.

Chrome headless 155.0.8059.85, Laboratoire avec environ 34 individus, deux prédateurs et diagnostic, fenêtre 1440×1000 : **181 rendus sur environ 3 secondes, 59,99 FPS**, 180 pas, moyenne **0,243 ms/pas** et **1,290 ms par dessin d'arène**. Les temps sont instrumentés autour de `Simulation.step()` et `ArenaRenderer.draw()` puis les méthodes sont restaurées ; aucun algorithme n'est changé. Ils excluent notamment la présentation GPU et n'isolent pas toutes les tâches DOM/graphiques scientifiques. Heap Chrome instantané : 4 494 837 octets utilisés, sans GC contrôlé.

Le champ FPS instantané p5 du rapport est perturbé par la capture pleine page ; utiliser le profil sur trois secondes ci-dessus pour cette observation. Ce résultat court ne garantit ni cadence soutenue ni comportement sur matériel de projection, tactile ou autres navigateurs. Aucun changement scientifique destiné à améliorer artificiellement les chiffres.

## Navigateur réel

L'outil Browser connecté a répondu liste vide et « No browser is available ». Chrome local étant installé, le script autonome headless sans dépendance a été utilisé avec un profil temporaire neuf. Le premier essai dans le bac à sable a expiré lors de `Runtime.enable`. L'exécution autorisée hors du bac à sable a réussi ; le profil temporaire du dernier essai a été fermé et nettoyé. Aucun profil personnel n'est lu.

Le rapport final compte **18 assertions réussies**, un téléchargement CSV terminé, aucune exception JavaScript ni appel console.error capturé. Sont vérifiés réellement : chargement HTTP/p5, accueil, sept étapes du guide, réglage et persistance du contraste après rechargement, Laboratoire, neuf canvas non vides, pause, dépliage des contrôles scientifiques, deux traces, activation des prédateurs, cinq cartes/verrouillage, démarrage des cinq missions et reset persistant de progression. Pour tester les cinq démarrages sans attendre leur déblocage, une progression valide est injectée dans le profil temporaire de test : ce n'est pas une victoire obtenue dans le navigateur.

Captures complètes produites pour accueil, Laboratoire, mission et largeur 390 px ; examinées statiquement, elles montrent l'arène et les panneaux attendus. Ce n'est pas un audit exhaustif de chaque fenêtre et état. Les interactions automatisées utilisent les événements DOM, sans prétendre mesurer la précision du clic humain dans l'arène.

Les cinq missions n'ont pas été jouées jusqu'à leur résultat dans Chrome. Victoires/défaites, coûts/protection, progression et étoiles sont testés sous Node. Leur validation humaine complète et le ciblage réel des actions restent à réaliser.

## Checklist humaine restante

- [ ] Refaire le scénario de neuf minutes sur la machine et le projecteur prévus.
- [ ] Vérifier 1440, 1024, 760, 390 px et zoom 200 %, particulièrement les tables longues et les notifications.
- [ ] Parcourir tous les contrôles HTML au clavier ; vérifier focus visible, retour des menus et lecteur d'écran.
- [ ] Vérifier souris et tactile pour sélectionner un individu et placer nourriture, nettoyage et protection.
- [ ] Observer des captures, leurs effets et la fin de la protection dans une partie réelle.
- [ ] Terminer/rejouer chaque mission, constater victoire/défaite et étoiles ; confirmer les déblocages après fermeture puis réouverture.
- [ ] Importer le CSV dans le tableur du professeur avec UTF-8/virgule et examiner métadonnées et valeurs indisponibles.
- [ ] Tester stockage bloqué/navigation privée et réduction système dans le navigateur cible.
- [ ] Observer une session prolongée avec plusieurs tailles de population, FPS et mémoire ; aucun objectif chiffré de fluidité universelle n'est garanti.
- [ ] Vérifier un second navigateur ; seul Chrome headless a été exécuté ici.

## Intégrité et limites scientifiques

Les empreintes SHA-256 des fichiers préexistants du workspace relevées avant cette finalisation ont été comparées après modification : aucun fichier hors EvolutionArena n'est changé. Tous les fichiers `vehicle.js` relevés restent identiques, dont `vendor/vehicle.js`. ADN, règles de reproduction, Simulation, entités, comportements et modules scientifiques restent inchangés. Les rapports scientifiques régénérés sont identiques. Aucun fichier SmartCity situé hors de ce workspace n'a été modifié ; ce constat ne prétend pas être un audit de l'ensemble de son dépôt. Aucun commit, push, publication ou déploiement.

Persistance limitée à progression/préférences : pas de restauration du moteur. Les quatre traces disparaissent au rechargement et les historiques sont bornés. Les interventions ne sont pas rejouées. La durée de vie des morts est conditionnelle aux vies terminées ; les moyennes génétiques concernent les survivants. Une diversité basse n'est pas nécessairement positive. Les comparaisons restent exploratoires et requièrent davantage de graines/horizons et une évaluation commune pour étudier une adaptation.

## Démonstration et lancement

Depuis EvolutionArena : `node tools/serve.mjs`, ouvrir http://127.0.0.1:8088. Le [scénario professeur](DEMONSTRATION-PROFESSEUR.md) déroule neuf minutes avec manipulations, limites et plan de secours. Le [guide utilisateur](GUIDE-UTILISATEUR.md) décrit les commandes et le [document d'architecture](ARCHITECTURE.md) précise les responsabilités.

Finalisation arrêtée après cette livraison, dans l'attente de validation.
