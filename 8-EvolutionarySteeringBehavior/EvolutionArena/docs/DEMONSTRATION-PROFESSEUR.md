# Démonstration professeur — 9 minutes

## Préparation avant la séance

Lancer `node tools/serve.mjs`, ouvrir http://127.0.0.1:8088, vérifier zoom 100 %, console sans erreur et fenêtre d'au moins 1280 px. Ouvrir les rapports `output/science/summary.csv` et `output/browser/report.json` à côté. Exécuter auparavant la suite Node. Ne pas présenter des résultats anciens comme une exécution en direct.

Dérouler une répétition entière avant le cours. Les traces sont volatiles : ne pas recharger une page préparée. La progression locale peut contenir des étoiles ; le signaler. La mission 1 reste rejouable sans effacer quoi que ce soit. Garder le mode économique disponible si la machine de projection ralentit.

## Scénario chronométré

| Temps | Explication | Manipulation précise |
| --- | --- | --- |
| 0:00–0:40 | Problème : obtenir des comportements globaux à partir de règles locales, puis observer les effets de l'hérédité. | Montrer l'accueil et ses deux modes. Dire que le joueur modifie l'environnement, sans piloter les créatures. |
| 0:40–1:50 | Steering : vitesse désirée moins vitesse actuelle, force bornée, locomotion héritée. Attraction et répulsion sont des forces, pas des trajectoires imposées. | Ouvrir le Laboratoire, cocher Rayons de perception, sélectionner une créature. Montrer sa direction et les ressources voisines ; Pause facilite l'explication. |
| 1:50–2:40 | Les quatre gènes : deux poids signés [−2,2], deux perceptions [0,100]. Un poids poison positif attire vers le poison. | Lire l'ADN de l'inspecteur et le tableau des gènes. Ne pas dire que chaque individu cherche nécessairement à survivre efficacement. |
| 2:40–3:25 | Reproduction asexuée, copie indépendante, génération parent+1. Mutation de référence 1 % par gène ; conditions énergétiques et coût en Arena. | Montrer le mode Arena, le slider mutation, âge et coût ; reprendre puis observer naissances/G2 si elles apparaissent. Si aucune naissance immédiate, expliquer le tirage probabiliste au lieu de changer les gènes. |
| 3:25–4:20 | Pursue anticipe la proie ; Evade construit une vitesse désirée opposée à la menace. Wander explore sans cible. | Activer les prédateurs et Diagnostic. Attendre la grâce initiale de trois secondes. Montrer les projections ; laisser les agents agir. Les captures ne se produisent pas forcément immédiatement. |
| 4:20–5:45 | Le joueur doit soutenir un écosystème avec un budget limité. Le score n'est pas une fitness génétique. | Accueil → Jouer, graine 2026 → Premiers pas. Laisser tourner 60 s. Après 15 s, choisir Nourriture et cliquer près d'un groupe ; montrer le coût et le cooldown. Le reste du temps, commenter autonomie, énergie, génération et condition d'au moins dix survivants. Lire le résultat réel, sans promettre trois étoiles. |
| 5:45–6:55 | Mesurer plutôt que simplement regarder : effectif, vies terminées, dispersion des gènes. D est une variance normalisée, pas un progrès. | Retour Laboratoire, désactiver les diagnostics pour la lisibilité. Montrer les neuf graphiques et les statistiques min/max/écart-type. Mettre en pause pour lire. Expliquer qu'une population vide produit une diversité indisponible. |
| 6:55–8:20 | Comparaison expérimentale à environnement, horizon et graines contrôlés. | Déplier Expériences reproductibles et export CSV. Conserver la trace actuelle avec un nom indiquant ses interventions, puis appliquer Arena sans prédateurs/mutation 0 %, graine 2026. Montrer l'action de relance, sans comparer des durées inégales. Ouvrir le rapport multigraines préparé : huit profils, cinq graines, 120 s. Expliquer qu'il a été obtenu avec Node et doublure vectorielle, pas depuis cette courte séquence en direct. Exporter le CSV et montrer ses métadonnées. |
| 8:20–9:00 | Conclusion : steering local + héritage + environnement donnent une dynamique évolutive, mais l'adaptation n'est pas démontrée. | Citer cinq graines seulement, horizon censuré, coût différent entre modes, biais des survivants et limites de validation humaine. Montrer le rapport final et proposer un protocole plus long avec évaluation commune des ADN. |

## Éléments de réponse au professeur

- **Pourquoi Evade n'est-il pas −Pursue ?** Inverser toute la force inverserait aussi le terme de vitesse actuelle. On inverse la direction désirée avant la soustraction.
- **Où est la sélection ?** Les individus morts ne se reproduisent plus ; l'accès aux ressources et les conditions de reproduction filtrent les lignées. Pas de classement artificiel des parents.
- **Pourquoi TP et Arena diffèrent-ils ?** Le TP comparable n'impose pas les mêmes contraintes/coûts ; une population plus grande peut être liée à l'énergie créée, pas à un meilleur ADN.
- **Que signifie D qui diminue ?** Moins de dispersion marginale ; cela peut être un goulot démographique. Ce n'est pas forcément un progrès.
- **Est-ce reproductible ?** Même configuration, même graine et mêmes pas dans le même moteur. Les interventions ne sont pas rejouées, les chemins aléatoires divergent entre configurations, et l'identité bit à bit entre environnements n'est pas garantie.
- **Que sauvegarde le jeu ?** Étoiles/progression et préférences d'affichage, jamais toute la simulation ni les traces scientifiques.

## Plan de secours

Si le port est occupé, utiliser 8089 et rappeler que le stockage local dépend du port. En cas de ralentissement, passer qualité économique et couper les diagnostics, sans changer la physique. Si une mission échoue, montrer le résultat réel, expliquer la condition puis rejouer : ne pas modifier l'ADN pour forcer une victoire. Si une fonction de navigateur échoue pendant la séance, montrer la capture ou le CSV préparé en l'identifiant clairement comme une exécution précédente.

La séance ne doit pas dépendre du déblocage et de la réussite des cinq missions en neuf minutes. Leur jouabilité multigraines est documentée séparément.
