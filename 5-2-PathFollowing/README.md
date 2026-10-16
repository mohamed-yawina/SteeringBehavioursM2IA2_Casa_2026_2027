# Path Following Lab — TD5.2

Laboratoire de suivi prédictif d'un chemin rectiligne, adapté du code fourni de Daniel Shiffman / The Coding Train / The Nature of Code. Il relie la projection du TD5-1 à une correction locale par Seek. Aucun chemin complexe n'est ajouté : il relève du TD5-3.

## Sources et principe

Crédits conservés dans sketch.js et vehicle.js :
- [Vidéo Path Following](https://youtu.be/LrnR6dc2IfM)
- [Ressource d'origine](https://thecodingtrain.com/learning/nature-of-code/5.7-path-following.html)
- [Sketch de référence](https://editor.p5js.org/codingtrain/sketches/dqM054vBV)
- [Référence Complex Path du code original, hors périmètre](https://editor.p5js.org/codingtrain/sketches/2FFzvxwVt)

Aucun énoncé officiel spécifique n'est présent dans le dossier. Les contrôles et comparaisons sont des enrichissements pédagogiques.

Pour une position X, une vitesse v et une anticipation T en pas :

```text
F = X + v × T
u = (B − A) / ‖B − A‖
H = A + ((F − A) · u) u
d = ‖F − H‖
si d > rayon : force = Seek(H)
sinon : force = (0, 0)
Seek(H) = limit(vitesse désirée vers H − v, maxForce)
```

La projection porte sur la droite infinie AB, pas le segment : H peut dépasser A ou B. Le corridor représente une tolérance de part et d'autre de la droite ; son rayon est sa demi-largeur. À d = rayon, aucune correction n'est produite. L'anticipation est un horizon en pas, pas une distance fixe : sa longueur spatiale augmente avec la vitesse.

Quand la correction est inactive, la vitesse se conserve (sous réserve de maxSpeed). Un véhicule immobile dans le corridor ne démarre pas seul. Seek reste celui fourni, y compris son cas de cible confondue avec la position. Un chemin nul produit désormais une projection indéfinie et une force nulle, conformément à l'autorisation de correction ; les entrées non finies/invalides sont signalées et ne produisent pas de correction.

## Commandes et scénarios

- Sliders : anticipation 0–60 pas, rayon 0–150 px, maxSpeed 0–12 px/pas, maxForce 0–1 px/pas². Zéro est accepté.
- Pause/Reprendre contrôlent l'avancement ; Un pas effectue une seule étape lorsque la simulation est en pause.
- Reset recharge le scénario courant et conserve les paramètres, la comparaison et l'état de pause.
- Scénarios : référence, dans le corridor, au seuil, hors corridor, chemin oblique, vitesse nulle dans le corridor, chemin nul. Le scénario « au seuil » est au seuil pour le rayon initial de 40.
- Glisser A et B pour modifier le chemin. Au clavier, sélectionner une extrémité, donner le focus au canvas et utiliser les flèches (Maj : 10 px).
- L'option « B suit la hauteur du pointeur » conserve l'interaction du sketch initial, limitée au canvas. Elle est désactivée par défaut pour garder un scénario reproductible.
- Comparer anticipation 0 / 20 reconstruit deux véhicules aux mêmes position et vitesse, avec les mêmes limites et le même chemin. Seul T diffère ; le slider T est alors désactivé. Les deux véhicules n'interagissent pas entre eux.

Les couleurs identifient les deux groupes : vert pour le premier, violet pour le second. F est orange, FH jaune, les forces sont agrandies ×350 et la vitesse ×12. Les marqueurs H et vecteurs de force portent la couleur du groupe. Le petit cercle à l'origine d'un vecteur désigne la position du calcul, avant déplacement. Le chemin fini est dessiné plus fortement que son prolongement pointillé ; le corridor prolongé correspond à la vraie règle de distance.

Les diagnostics sont les copies du dernier calcul réellement appliqué, pas une reconstitution. Une édition du chemin ou d'un paramètre les invalide jusqu'au prochain pas. En pause, cette invalidation est visible : utiliser Un pas pour obtenir un nouveau diagnostic. Les diagnostics ne suivent pas artificiellement le véhicule après intégration. Lors d'un rebouclage, le panneau signale qu'ils décrivent la position avant le passage au bord.

## Architecture et invariants

- vehicle.js : état p5.Vector, projection, follow, diagnostics et locomotion fournie. Les modifications autorisées concernent predictionSteps, les gardes géométriques et la séparation calcul/rendu. Seek, applyForce, update et edges restent inchangés.
- path.js : Path extends Vehicle, constructeur super(x1,y1), start alias de pos, end en p5.Vector. maxSpeed et maxForce sont explicitement fixés à zéro après super. Path n'est jamais intégré par le contrôleur ; update est neutre. Aucun steering ni force n'est appliqué au chemin. Les éditions utilisateur et rechargements de scène sont ses seules sources de changement.
- path-controller.js : scénarios déterministes, paramètres, pas, pause et comparaison ; aucune locomotion recopiée.
- path-renderer.js : dessin sans appel à follow ou Seek ; lit les copies de diagnostics.
- path-ui.js : commandes DOM et panneau numérique.
- sketch.js : unique cycle p5 et interactions pointeur/clavier.

À chaque pas et pour chaque véhicule : follow → applyForce → edges → update, chacun une fois, comme dans le sketch initial. Deux véhicules comparés ne constituent pas deux boucles physiques concurrentes : ils avancent dans la même boucle p5. La position prédite, la projection, le seuil strict et l'ordre des opérations conservent la trajectoire numérique initiale pour les entrées valides et les paramètres par défaut. Le chemin nul change intentionnellement de contrat.

## Lancement et tests

Toutes les dépendances sont locales, sans npm ni CDN. p5.sound reste sur disque mais n'est pas chargé. jsconfig.json utilise des chemins relatifs.

Depuis la racine du dépôt, avec Python 3 installé :

```powershell
python -m http.server 8000
```

Ouvrir `http://localhost:8000/5-2-PathFollowing/`. Sous Windows, `py -3 -m http.server 8000` convient si le lanceur et Python sont installés. Tout serveur statique compatible convient.

Avec Node.js récent :

```powershell
node --test 5-2-PathFollowing/tests/*.test.mjs
```

Les 11 tests initiaux sont conservés ; le cas nul est adapté au contrat explicitement autorisé, sans tolérance élargie. La trajectoire sur cinq pas reste comparée aux mêmes valeurs à 1e-12 absolu. Les nouveaux tests couvrent héritage statique, paramètres, copies défensives, états, comparaison, interactions réelles des scripts avec un DOM simulé et ordre HTML. Les doubles vectoriels et p5 ne remplacent pas une validation Chrome réelle. Aucune nouvelle validation Chrome n'est revendiquée.

Résultat de cette implémentation : **22 tests réussis, 0 échec** (11 tests de référence adaptés et 11 nouveaux tests).

## Limites et expériences

Le mouvement reste intégré par frame p5 comme dans la référence : ce laboratoire ne prétend pas être indépendant du FPS. Les coordonnées du monde restent 1200 × 800 ; le CSS adapte uniquement l'affichage pour préserver les unités et le rebouclage fournis. Sur mobile, les annotations peuvent être petites ou se superposer ; le panneau numérique reste lisible. F et H peuvent sortir du canvas : leurs valeurs restent disponibles.

Les bordures sont toriques : elles replacent l'agent sans appliquer de steering. La trajectoire affichée est coupée lors du rebouclage et d'une édition de chemin. Modifier maxSpeed peut laisser une vitesse initiale supérieure à cette limite avant le premier update : le plafonnement hérité intervient à l'intégration. Une force nulle sur chemin invalide ne répare pas un état physique externe déjà corrompu ; les contrôles de l'application bornent leurs propres valeurs.

Expériences : comparer le cas « au seuil » avec un rayon de 39 puis 40 ; observer l'immobilité sans propulsion dans le scénario vitesse nulle ; comparer T=0 et T=20 depuis la référence ; augmenter la vitesse et constater que le futur s'éloigne ; confondre A et B pour examiner l'état indéfini, puis utiliser Un pas après avoir restauré le chemin.
