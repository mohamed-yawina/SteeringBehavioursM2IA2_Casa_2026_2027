# Projection Lab — TD5.1 Scalar Projection

Laboratoire géométrique consacré à la projection scalaire signée, à la projection vectorielle et à la différence entre droite infinie et segment. Il ne contient aucun Vehicle, comportement de steering ou moteur physique.

## Origine et crédits

Le sketch fourni référence Daniel Shiffman, **The Coding Train / The Nature of Code** :

- [Vidéo d'origine](https://youtu.be/DHPfoqiE4yQ)
- [Ressource produit scalaire indiquée dans le sketch](https://thecodingtrain.com/learning/nature-of-code/5.6-dot-product.html)
- [Exemple Angle Between indiqué dans le sketch](https://editor.p5js.org/codingtrain/sketches/ORP5Yx7JX)

La construction originale est conservée : normaliser la direction, calculer le produit scalaire puis multiplier la direction unitaire par le scalaire. Les ajouts d'interface sont des enrichissements pédagogiques ; aucun énoncé officiel spécifique n'a été trouvé dans ce dossier.

## Mathématiques

O est l'origine, P le point à projeter, B définit une direction depuis O. Pour B différent de O :

```text
a = P − O
b = B − O
u = b / ‖b‖
s = a · u
p = s u
H = O + p
r = P − H
distance droite = ‖r‖
t = (a · b) / (b · b) = s / ‖b‖
t borné = min(1, max(0, t))
Q = O + t borné × b
distance segment = ‖P − Q‖
```

s est une longueur signée, p un vecteur, H un point. Si s < 0, H se trouve derrière O. Si t > 1, H dépasse B. La droite est infinie ; Q reste sur le segment. Le résidu PH est perpendiculaire à la droite, mais PQ peut être oblique lorsque Q est une extrémité.

En direction nulle, la projection sur une droite est indéfinie : les champs concernés valent null dans le calcul et affichent un tiret, jamais NaN. Le segment réduit à O possède encore Q = O et une distance à P. Des coordonnées non finies sont invalides ; les dépassements numériques détectés sont signalés séparément. Il n'y a pas de seuil arbitraire assimilant une petite direction non nulle à zéro.

Le calcul utilise les nombres JavaScript à double précision. Les résultats sont approchés aux arrondis flottants près ; les valeurs extrêmes pouvant dépasser la plage représentable ne sont pas garanties. Les valeurs du panneau sont arrondies à trois décimales (notation scientifique pour les très petites valeurs), les calculs ne sont pas arrondis. Chaque résultat est une copie indépendante profondément gelée.

## Manipulation

Glisser O, P et B avec la souris, un stylet ou le toucher. Les points sont limités à la zone utile du repère. Pour des points confondus, choisir d'abord O ou B avec les boutons. Au clavier, choisir un point puis utiliser les flèches dans le canvas : 1 pixel par pression, 10 avec Maj. Tab donne accès aux boutons, sélecteurs et sliders.

L'angle et la longueur de OB sont synchronisés dans les deux sens avec la géométrie. L'origine reste fixe lorsque ces sliders changent. La longueur demandée est plafonnée pour garder B dans la zone utile ; sa valeur effective est affichée. À longueur nulle, le dernier angle est conservé afin de pouvoir reconstruire la direction.

Le repère de référence mesure 1000 × 640 pixels, y croissant vers le bas. Les angles sont exprimés en degrés depuis +x ; le sens positif est donc horaire à l'écran. Le canvas adapte son échelle uniformément : un redimensionnement ne change ni les coordonnées ni les résultats. Ces unités sont géométriques ; aucune unité physique de temps, force ou vitesse n'est introduite.

Options : vecteurs, perpendiculaire/distances et annotations. Les points restent visibles pour la manipulation. Couleurs : a cyan, b gris, u jaune (agrandi ×55), projection violette, résidu corail, point Q et distance au segment verts. H et Q peuvent coïncider ; le cercle vert autour du point distingue Q. Les prolongements pointillés indiquent la droite infinie. Certaines annotations peuvent se superposer dans les cas dégénérés ou sur un écran très étroit.

## Six scénarios et construction guidée

Oblique ; parallèle ; perpendiculaire ; projection négative ; au-delà de B ; direction nulle. Reset rétablit le cas oblique, le point P sélectionné et les options initiales.

La construction guidée comporte six étapes : vecteurs de départ, normalisation, produit scalaire, projection et H, résidu/distance, comparaison droite/segment. Les boutons précédent/suivant avancent manuellement ; aucune animation temporelle n'est ajoutée. La géométrie reste manipulable à chaque étape, et les résultats non encore expliqués sont masqués dans le panneau. Désactiver le guide rétablit la vue complète.

Essais utiles : changer seulement la longueur de OB et constater que H reste fixe ; inverser sa direction et observer le signe de s ; comparer H et Q avant O et après B ; confondre O et B puis restaurer une longueur positive.

## Architecture

- `projection.js` : fonctions pures sur coordonnées numériques, sans DOM ni dépendance p5. Formats CommonJS pour Node et global navigateur.
- `projection-controller.js` : scénarios, manipulations, contrôles et instantané cohérent de calcul.
- `projection-ui.js` : événements DOM, panneau et progression pédagogique.
- `sketch.js` : cycle p5, conversion pointeur/repère, dessin consommant l'instantané sans refaire la projection.
- `index.html`, `style.css` : interface et mise en page responsive.
- `tests/` : tests mathématiques et contrats interactifs Node.

p5.js reste local. Le cycle global p5 est unique et suspendu avec noLoop ; les changements appellent redraw. Pas de boucle requestAnimationFrame supplémentaire. Aucun fichier vehicle.js n'est nécessaire. La référence cassée a été retirée. p5.sound n'est plus chargé, mais son fichier fourni est conservé, comme toutes les bibliothèques. jsconfig.json ne dépend plus d'un chemin personnel macOS.

## Lancement et tests

Navigateur moderne requis. Aucun CDN, paquet npm ou compilation. Depuis la racine du dépôt, avec Python 3 installé :

```powershell
python -m http.server 8000
```

Sous Windows, le lanceur peut être `py -3 -m http.server 8000`. Ouvrir `http://localhost:8000/5-1-ScalarProjection/`. Un autre serveur HTTP statique convient également.

Avec Node.js récent (Node 24 utilisé pour la validation) :

```powershell
node --test 5-1-ScalarProjection/tests/*.test.mjs
```

Les tests Node ne remplacent pas Chrome avec la bibliothèque p5 réelle. Aucune nouvelle validation Chrome n'est revendiquée dans ce document.

Validation automatisée de cette version : **19 tests réussis, 0 échec**. Ils couvrent les propriétés mathématiques sur 300 jeux déterministes, les six scénarios et leurs étapes, les événements DOM/pointeur/clavier avec des doubles de test, l'absence de mutation et le redimensionnement. Les tests d'interaction exécutent les vrais scripts avec un environnement simulé, pas un navigateur réel. Une construction manuelle extrême peut placer H hors du canvas ; les valeurs du panneau restent disponibles. Les exemples prédéfinis gardent leurs points projetés dans la vue.
