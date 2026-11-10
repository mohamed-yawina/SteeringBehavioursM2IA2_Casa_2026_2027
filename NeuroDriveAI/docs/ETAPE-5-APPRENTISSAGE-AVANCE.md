# Étape 5 — Apprentissage avancé et comparaison expérimentale

## 1. Audit initial consigné avant modification du moteur évolutif

Les quatre documents précédents et les modules Fitness, EvolutionEngine,
Population, Selection, Mutation, Crossover, CheckpointManager, Simulation,
NeuralController et tools/experiment.mjs ont été relus. L’audit utilise le
champion JSON livré à l’étape 4, sans réentraînement ni changement de règles.
Les sondes brutes sont dans [audit-initial.json](experiments/etape-5/audit-initial.json).

### Mesures sur le champion existant

| Horizon de relecture | Checkpoints | Tours | État |
| --- | --- | --- | --- |
| 12 s | 11 | 0 | actif, vitesse 170,50 px/s, arrivée à 95,83 px |
| 20 s | 20 | 1 | actif, vitesse 190,30 px/s |
| 30 s | 25 | 2 | accident à 23,65 s |

Premier franchissement légal de l’arrivée : **12,60 s**, puis deuxième tour à
**22,4333 s**. Les 12 checkpoints sont traversés dans l’ordre, sans proximité
substituée à un franchissement. L?ancien outil experiment.mjs imposait 12 s, contre 20 s par d?faut dans l?interface.
Le timeout de 12 s explique donc l’absence de
tour pour CE champion ; cela ne prouve pas que tous les autres individus étaient
capables de finir. La conduite reste fragile : collision ensuite au deuxième
début de tour suivant (25 checkpoints validés au total).

### Observations et hypothèses séparées

1. **Temps insuffisant observé.** Le meilleur individu manque seulement 0,60 s
   pour finir dans l’ancien protocole. Le protocole comparatif réservera 20 s
   pour chaque individu de chaque stratégie, sans réentraîner ce champion d’audit.
2. **Incitations risquées identifiées dans la formule.** La division de toute
   progression par `1+t/T` peut préférer une mort rapide à une progression lente
   comparable ; une collision ne coûte que 25 %. Une nouvelle option de fitness
   supprimera cet avantage temporel sur les parcours incomplets, renforcera les
   tours et le coût des collisions. Les formules précédentes seront préservées.
3. **Stagnation cohérente dans le code.** La marque est un maximum avec seuil
   cumulatif de 0,01 secteur ; osciller sous ce maximum ne rafraîchit pas le délai.
   Les petites avancées cumulées sont déjà testées. Ce seuil est heuristique,
   mais aucune raison empirique de modifier le mécanisme n’est identifiée ici.
4. **Collisions correctement séparées des timeouts.** Le résultat final conserve
   `crashed` et la cause ; une collision réelle est prioritaire au même pas.
   La collision continue précède la validation des seules portes situées avant
   l’impact. Le comptage porte sur des épisodes, pas des accidents uniques de
   génotypes (un même élite peut être réévalué dans plusieurs générations).
5. **Diversité en baisse, pas d’effondrement démontré.** La métrique RMS des
   écarts-types passe de 0,32647 à 0,27232, soit −16,59 %. Six générations et
   une seule graine ne permettent pas de conclure à une homogénéité excessive.
   L’immigration restera désactivée dans la comparaison principale pour isoler
   l’effet de la mutation adaptative ; son mécanisme sera optionnel et testé.
6. **Entrées/sorties suffisantes pour un tour sur l’ovale.** Le réseau inchangé
   le démontre à 12,60 s. Il ne possède cependant ni mémoire, ni vision arrière,
   ni cible de vitesse spécialisée. Le partage de l’accélération entre tournage
   et propulsion rend les virages rapides difficiles. Aucun de ces constats ne
   justifie d’assouplir les portes ou de modifier la locomotion pendant l’essai.

### Protocole prévu avant comparaison

Quatre stratégies A/B/C/D, mêmes graines **2026, 2027, 2028, 2029, 2030**,
population **50**, **8 générations**, horizon **20 s**, stagnation **4 s**,
dt **1/120 s**, circuit principal inchangé, réseaux 8→12→2 tanh.
A : roulette sans élites ; B : tournoi sans élites ; C : tournoi avec 2 élites ;
D : tournoi avec 2 élites et mutation adaptative. Mutation de base 0,10,
amplitude 0,20, tournoi de 5 ; immigration nulle pour les quatre stratégies.
La nouvelle fitness sera commune à A–D. Aucune sélection de graines après résultat.

Budget réservé par exécution : 50×8×20×120 = **960 000 emplacements individu-pas**.
Les épisodes accidentés/stagnants n’obtiennent aucune génération supplémentaire :
le reliquat est comptabilisé comme budget réservé inutilisé. Le nombre réel de
pas physiques actifs sera publié séparément, car il dépend des éliminations.

Variante de généralisation pré-déclarée : transformation affine de l’ovale
autour du centre, x×0,92 et y×1,08, sans changer le circuit principal ni les règles.
Relecture de chaque champion gelé sur les deux pistes, sans réentraînement.

Les résultats et détails d’implémentation sont ajoutés ci-dessous après exécution.


## 2. Modifications et invariants

La locomotion, les capteurs, les entr?es/sorties neuronales, le circuit principal,
Simulation et CheckpointManager sont inchang?s. Les empreintes de ces sources
prot?g?es figurent dans l?audit. Les 88 tests pr?c?dents sont conserv?s sans ?dition.
Une garde emp?che d?sormais de finaliser deux fois la m?me g?n?ration et de doubler ses statistiques.
La fitness r?f?rence TP 9 et la fitness am?lior?e de l??tape 4 restent disponibles
et conservent leurs formules. La nouvelle option se nomme optimized ; l?interface
la propose par d?faut, alors que l?API EvolutionEngine conserve son ancien d?faut
pour permettre la reproduction historique.

Nouveaux modules : AdaptiveMutation, TrackVariants, exp?riences Strategies,
Statistics et Comparison, outil compare et son worker, panneau ExperimentPanel.
Population mesure le premier tour et le nombre de vrais pas d?int?gration.
EvolutionEngine journalise le taux utilis? et le prochain taux, les plateaux,
la faible diversit? et l?immigration. Aucun r?seau n?est pilot? par une trajectoire
pr?d?finie ; l??valuation utilise la progression mais le contr?leur ne la re?oit pas.

## 3. Fitness optimis?e

C = checkpoints strictement valid?s ; L = tours termin?s ; f = maximum de progression
partielle du secteur courant, born? ? [0 ; 0,999] ; t1 = temps du premier tour ;
T = dur?e maximale. Les anciennes r?gles de maximum emp?chent la r?addition
d?oscillations. Aucun bonus de distance ni de simple survie n?est ajout?.

Formule :

    B = 100 C + 25 f + 4000 L
    S = L > 0 ? 200 clamp(1 - t1/T, 0, 1) : 0
    q = collision ? 0,4 : stagnation ? 0,6 : 1
    F = (B + S) q

Un premier tour ? 12 s dans un ?pisode de 20 s, avec 12 portes et f=0, donne
5280 ; une collision ult?rieure r?duit cette valeur ? 2112. Onze portes sans
tour et f=0,999 donnent au plus 1124,975 avant p?nalit?s. Le temps ne r?compense
que la vitesse d?un tour effectivement accompli. Une progression incompl?te
identique ne gagne plus de points en mourant plus t?t. Rester immobile donne z?ro.
La collision co?te 60 %, contre 25 % auparavant ; ce choix reste heuristique.

C et L sont des entiers non n?gatifs plafonn?s ? 1e6 ; les valeurs non finies
sont neutralis?es et T doit ?tre strictement positif et fini. Un temps de tour
inconnu ne fournit pas un bonus maximal : le temps d??pisode valide sert de
repli, sinon T. La fraction est une projection born?e d?j? document?e ? l??tape 4,
pas une longueur exacte sur la courbe. Un petit cr?dit lat?ral reste possible,
mais ne cr?e ni porte ni tour. Les nouveaux coefficients ne doivent pas ?tre
compar?s num?riquement aux scores de l??tape 4 comme s?ils avaient la m?me ?chelle.

## 4. Mutation adaptative et diversit?

La diversit? est inchang?e : racine de la moyenne des variances de chacun des
134 g?nes, avec variance de population (division par N). Elle est ind?pendante
de l?ordre des g?nomes, nulle pour des clones et exprim?e dans l?unit? des poids.
Ce n?est pas une mesure de diversit? des trajectoires.

R?glages principaux : taux de base 0,10 ; minimum 0,02 ; maximum 0,30 ; amplitude
fix?e ? 0,20 ; patience 2 g?n?rations ; seuil de diversit? 0,25. Les bornes sont
configurables. L?amplitude n?est pas automatiquement augment?e.

Une am?lioration significative d?passe le meilleur score significatif pr?c?dent
de max(1e-9, 1 % de sa valeur absolue). Les petits gains peuvent donc se cumuler
avant de franchir ce seuil. ? la premi?re observation ou apr?s une am?lioration
significative : compteur de plateau remis ? z?ro, retour au taux de base.
Sinon le compteur s?incr?mente. Si la diversit? passe sous le seuil OU si la
patience est atteinte, le taux de la prochaine reproduction devient :

    niveau = max(1, compteurPlateau - patience + 1)
    taux = min(tauxMax, max(tauxMin, tauxBase, 0,01) ? (1 + 0,5 ? niveau))

Sans cette pression, le taux revient ? la base. Le taux base doit appartenir
? l?intervalle min/max lorsque l?adaptation est activ?e. Un changement concerne
les enfants suivants, jamais les g?nomes en cours d??valuation. Les ?lites ne
sont pas mut?es. Le PRNG local d?terministe et les bornes [-5,5] sont conserv?s.
L?historique distingue mutationRate utilis?e et nextMutationRate pr?vue.

Immigration optionnelle : si faible diversit? ET plateau au moins ?gal ? la
patience, ajouter floor(N ? fractionImmigration) nouveaux r?seaux al?atoires,
plafonn? ? N - nombre?lites. La fraction est born?e ? [0 ; 0,20]. Les nouveaux
g?nomes occupent les derni?res places non ?lites, pas les meilleurs individus.
Le m?canisme est test? et reproductible mais reste ? z?ro dans A?D : les donn?es
initiales ne d?montraient pas un effondrement justifiant ce facteur suppl?mentaire.
Il ne faut pas attribuer ? la mutation adaptative un ?ventuel effet d?immigration.

## 5. Protocole, budgets et crit?res de mesure

A : roulette, aucune ?lite ; B : tournoi, aucune ?lite ; C : tournoi, deux ?lites ;
D : tournoi, deux ?lites et adaptation. Le crossover uniforme, l?amplitude, les
capteurs et la physique sont communs. Le tournoi tire 5 candidats avec remise.
Les graines initiales de r?seaux sont identiques entre A?D pour une m?me graine
d?essai ; leurs empreintes sont enregistr?es. Les tirages divergent ensuite
normalement suivant les op?rateurs. Le parall?lisme n?utilise aucun ?tat partag?.

Chaque essai r?serve 960000 emplacements individu-pas. Si tous les individus
meurent avant T, la fin de cr?neau est compt?e comme inutilis?e, sans r?investir
ce temps en g?n?rations suppl?mentaires. Les pas physiques actifs, le reliquat
de ticks et les budgets r?serv?s sont distincts dans les exports. Ce protocole
?galise le budget maximal d??valuation, pas le nombre de calculs utiles ni le
co?t CPU r?el, qui d?pendent des morts. Le budget des relectures de champions
est ?galement commun : deux ?pisodes suppl?mentaires de 20 s au maximum.

Une r?ussite d?ex?cution signifie qu?au moins un individu a termin? un tour l?gal
dans les huit g?n?rations. La g?n?ration de premi?re r?ussite est null si aucune
n?existe, pas z?ro. Les tours cumul?s additionnent les ?pisodes, y compris les
r??valuations d??lites ; ils ne repr?sentent pas autant de politiques ind?pendantes.
Le maximum de checkpoints est le maximum observ? sur toutes les g?n?rations.
La fitness maximale est le meilleur score historique ; la fitness moyenne publi?e
est celle de la derni?re g?n?ration. La diversit? est celle de la derni?re population.

Pour chaque m?trique, les statistiques utilisent les graines comme unit?s :
moyenne, m?diane, ?cart-type ?chantillonnal (N-1), minimum, maximum et effectif.
L??cart-type vaut z?ro pour un seul ?l?ment. Une liste vide donne des valeurs
inconnues null. Les temps de premi?re r?ussite sont r?sum?s conditionnellement
aux succ?s, avec leur effectif ; les ?checs sont censur?s. Aucun test de significativit?
ni intervalle de confiance ?troit n?est pr?tendu sur cinq graines de convenance.

## 6. Outils et exports

Depuis NeuroDriveAI, sans navigateur ni installation :

    npm run compare -- --seeds 2026,2027,2028,2029,2030 --strategies A,B,C,D --generations 8 --population 50 --duration 20 --stagnation 4 --workers 4 --output docs/experiments/etape-5/nouvel-essai

Les arguments acceptent aussi --fitness, --mutation-rate, --amplitude, --tournament,
--min-rate, --max-rate, --patience et --diversity-threshold. L?immigration reste
nulle dans cet outil comparatif ; elle peut ?tre exp?riment?e s?par?ment via l?API
ou le panneau d?entra?nement. Un dossier contenant d?j? resultats.json est refus?
pour pr?server le rapport existant ; choisir un nouveau dossier.

Sorties : resultats.json complet ; un JSON par strat?gie/graine ; champion neuronal
v1 pour chaque ex?cution ; runs.csv ; generations.csv ; summary.csv. Le JSON contient
le protocole, les configurations, les budgets et les relectures sur les deux pistes.
Les CSV permettent une analyse externe sans biblioth?que suppl?mentaire. Les tours
et collisions par g?n?ration sont des entiers ; les scores restent non arrondis.
Le r?sum? affich? dans l?application est recalcul? depuis les ex?cutions import?es,
apr?s contr?le des graines appari?es, configurations et budgets, sans r?entra?nement.

L?ancien outil npm run experiment reste disponible pour reproduire l??tape 4.

## 7. G?n?ralisation pr?liminaire sans r?entra?nement

Chaque champion final est relu sur le circuit principal et sur oval-affine-v1,
une transformation inversible x?0,92, y?1,08 autour de (500,350). Les deux limites,
les portes et le d?part sont transform?s ; les normales et le cap initial sont
recalcul?s. Les 12 portes gardent leur ordre et les r?gles de franchissement.
Le circuit principal et son constructeur sont intacts. Les dimensions et forces
de la voiture restent identiques. Une telle transformation change la courbure
et la largeur effective ; elle n?est pas un circuit enti?rement nouveau.

Aucun poids n?est ajust? apr?s cette relecture et la variante n?est pas utilis?e
pour choisir des param?tres durant la comparaison. M?me en cas de r?ussite,
ce test local ne remplace pas un jeu de circuits de validation in?dit.

## 8. Interface et v?rification

Le panneau d?entra?nement ajoute les pr?r?glages A?D, les bornes d?adaptation,
le seuil de diversit? et l?immigration optionnelle dans une section repliable.
Les diagnostics affichent le taux actuel et pr?vu, la diversit? RMS, la progression
du leader, les g?n?rations de plateau et les tours cumul?s. Les param?tres d?un
essai actif restent fig?s jusqu?au prochain D?marrer/R?initialiser.

Une seconde section repliable charge le rapport livr? ou un JSON coll?, et montre
une comparaison compacte A?D. Elle ne s?lectionne pas un r?seau, ne modifie pas
l?entra?nement et ne pr?tend pas valider une provenance scientifique du fichier.
Les modes manuel/autonome, les exports neuronaux et le moteur physique restent disponibles.


## 9. R?sultats r?ellement ex?cut?s

Les 20 ex?cutions A?D sur cinq graines sont termin?es : 8000 ?pisodes
d??valuation, 160 g?n?rations de population et 842 tours d??pisodes l?gaux.
Budget r?serv? : 19 200 000 emplacements individu-pas ; int?grations physiques
actives : 6 165 631. Le temps inutilis? n?a financ? aucune g?n?ration suppl?mentaire.
Les quatre premi?res populations sont identiques pour chaque graine selon leurs
empreintes, et les variantes partagent les conditions d?clar?es.

| Strat?gie | Graines avec tour | Fitness max : moyenne ? ET | M?diane | Min?max | Fitness moyenne G8 | Tours cumul?s | Collisions / 2000 | Diversit? finale moyenne |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A | 5/5 | 6200,44 ? 7,54 | 6203,46 | 6188,65?6207,41 | 1992,01 | 354 | 1006 | 0,1575 |
| B | 5/5 | 6153,96 ? 169,17 | 6203,25 | 5887,05?6294,61 | 752,64 | 109 | 1231 | 0,2705 |
| C | 5/5 | 6135,58 ? 162,92 | 6201,55 | 5874,66?6302,69 | 1298,49 | 217 | 1149 | 0,2139 |
| D | 5/5 | 6134,57 ? 137,30 | 6194,86 | 5889,08?6201,55 | 986,16 | 162 | 1168 | 0,2369 |

Tous les taux de r?ussite d?ex?cution valent 5/5, mais cela ne signifie ni 100 %
des voitures ni une probabilit? g?n?rale de succ?s ?gale ? 1. La graine 2028
poss?de d?j? des tours dans la population initiale commune : on ne doit pas
attribuer ces r?ussites initiales aux op?rateurs g?n?tiques. Les premi?res
r?ussites sont observ?es en g?n?rations 1 ? 5 pour A/C, 1 ? 4 pour B, 1 ? 8 pour D.

Selon le crit?re principal pr?-d?clar?, les strat?gies sont ? ?galit?. Selon le
second crit?re descriptif, **A obtient la meilleure moyenne des meilleures fitness**
(6200,44), ainsi que le plus de tours d??pisodes et la meilleure fitness moyenne
de derni?re g?n?ration. Le plus haut score individuel est toutefois C, graine
2028 : 6302,685917213212. Meilleure moyenne de configuration et meilleur individu
unique ne sont pas le m?me objet. Aucun test ne d?montre une sup?riorit? universelle.

D ne montre pas d?avantage moyen sur C avec les r?glages choisis : moins de tours
d??pisodes (162 contre 217) et fitness maximale moyenne l?g?rement inf?rieure.
La diversit? finale est plus ?lev?e en D qu?en C, sans b?n?fice d?montr? de conduite.
A a au contraire la diversit? finale la plus basse et les meilleurs r?sultats moyens :
maximiser la diversit? n?est pas, ? lui seul, un objectif de performance.
Le taux adaptatif effectivement utilis? varie de 0,10 ? 0,20 dans cette campagne ;
les bornes plus larges sont v?rifi?es par les tests. L?immigration n?a jamais ?t?
activ?e. Le seuil significatif de 1 %, combin? ? un gros bonus de tour, peut
qualifier de plateau de petits gains fractionnaires utiles. Ce r?glage sera ?
?tudier dans un protocole ult?rieur, sans retoucher les essais d?j? publi?s.

### Variante sans r?entra?nement

Les 20 champions terminent au moins un tour sur la variante affine : 5/5 par
strat?gie, sans mise ? jour des poids. Les relectures principales et variantes
sont enregistr?es s?par?ment dans chaque ex?cution. Ce transfert local est r?el,
mais l?ovale affine est proche de la piste d?entra?nement et le crit?re est seulement
un tour dans 20 s. La g?n?ralisation ? des trac?s tr?s diff?rents n?est pas ?tablie.

### Contr?le prolong? exploratoire, r?alis? apr?s la comparaison

Tous les champions ont aussi ?t? relus, gel?s, 60 s sur le circuit principal.
Cette analyse post-hoc n?a servi ni ? r?entra?ner, ni ? ajuster les param?tres,
ni ? modifier le classement principal. Les scores calcul?s avec T=60 ne sont
pas m?lang?s aux scores principaux T=20.

| Strat?gie | Champions atteignant 60 s sans accident | Tours sur ces cinq relectures | Collisions |
| --- | --- | --- | --- |
| A | 4/5 | 22 | 1 |
| B | 5/5 | 24 | 0 |
| C | 5/5 | 25 | 0 |
| D | 5/5 | 24 | 0 |

Total distinct : **95 tours de relecture prolong?e**, en plus des 842 tours
d?entra?nement. A/2027 entre en collision ? 27,6083 s apr?s deux tours ; les
19 autres champions atteignent 60 s, avec quatre ou cinq tours chacun. Ainsi A
reste meilleur selon la moyenne principale, mais n?est pas le meilleur sur tous
les crit?res exploratoires de robustesse. Il serait incorrect de cacher cet ?chec.

Rapports : [JSON complet](experiments/etape-5/comparaison/resultats.json),
[CSV par ex?cution](experiments/etape-5/comparaison/runs.csv),
[CSV par g?n?ration](experiments/etape-5/comparaison/generations.csv),
[CSV synth?tique](experiments/etape-5/comparaison/summary.csv),
[statistiques d?taill?es](experiments/etape-5/comparaison/statistics.csv),
[relectures 60 s](experiments/etape-5/robustesse-60s.json).
Les 20 champions v1 et les 20 JSON individuels sont dans le m?me dossier de comparaison.

Commande du contr?le prolong? :

    node tools/replay-comparison.mjs docs/experiments/etape-5/comparaison/resultats.json 60 docs/experiments/etape-5/nouvelle-robustesse.json

## 10. Tests et limites scientifiques

La suite comporte **114 tests**, dont les 88 pr?c?dents conserv?s sans modification.
Les nouveaux tests couvrent la formule optimis?e, l?absence de cumul artificiel,
les bornes d?adaptation, le retour ? la base, les petits gains cumulatifs, la diversit?,
l?injection r?elle sans ?craser les ?lites, le d?terminisme, JSON/CSV, les budgets
appari?s, les quatre strat?gies, les diagnostics et le chargement de rapports.
Le CLI est test? en un et deux workers avec comparaison exacte des JSON.
Les artefacts livr?s sont relus : budgets, empreintes des premi?res populations,
CSV, valeurs finies et reproduction du meilleur individu sur les deux pistes.
Le tour ? 12,60 s de l?ancien champion et les empreintes des r?gles prot?g?es
sont ?galement des tests de r?gression. Une validation de 5000 ticks adaptatifs
avec immigration s?ajoute aux validations prolong?es conserv?es (dont 20000
ticks ?volutifs). La validation visuelle r?elle reste non effectu?e : aucun
navigateur connect? n?est disponible ; les interactions sont test?es par contrat DOM/Canvas.

Cinq graines cons?cutives constituent un premier ?chantillon de convenance, pas
un sondage al?atoire de tous les comportements. L??tude a d?j? ex?cut? plus de
six millions de vrais pas physiques, puis les relectures ; le nombre de graines
n?a pas ?t? augment? dans cette livraison afin de garder une campagne born?e.
Les donn?es brutes et l?outil permettent une extension pr?-d?clar?e.
Les m?dianes, ?carts-types et minima/maxima sont publi?s pour ?viter de r?sumer
la variabilit? ? un score unique. Les ?pisodes et les g?n?rations d?une m?me
graine ne sont pas trait?s comme des r?plications ind?pendantes.

Aucune ablation s?par?e ne distingue ici l?effet du nouvel horizon de celui de
la nouvelle fitness : A?D utilisent tous deux. L?audit prouve qu?allonger l?ancien
champion ? 12,60 s suffit d?j? ? observer un tour ; ce r?sultat n?est pas un
apprentissage suppl?mentaire. Les changements de formule, d?horizon et de
nombre de g?n?rations rendent les fitness num?riques de l??tape 4 non comparables.
Les r?glages adaptatifs ne sont pas optimis?s sur un jeu ind?pendant.
La projection partielle demeure approximative ; la variante est tr?s limit?e ;
les relectures de champions s?lectionn?s sont conditionnelles ? cette s?lection.
La r?ussite de tours est observ?e dans ce p?rim?tre, pas une garantie de conduite
autonome fiable sur des circuits inconnus.

## 11. Recommandations pour l??tape 6, sans impl?mentation

1. Pr?-d?clarer davantage de graines, plusieurs circuits non elliptiques et une
   s?paration entra?nement/validation/test. Conserver les m?mes budgets maximaux.
2. Ajouter des ablations horizon seul / fitness seule et une population al?atoire
   sans reproduction pour distinguer capacit? initiale et effet d?apprentissage.
3. ?tudier des seuils adaptatifs adapt?s ? l??chelle de fitness et comparer sans
   s?lectionner les param?tres sur le circuit de test. Ne pas pr?sumer D sup?rieur.
4. Mesurer s?curit?, temps au tour et tenue prolong?e, pas seulement fitness et
   succ?s dans un horizon court. Pr?server strictement les r?gles des portes.
5. Examiner le co?t du raycasting avant des campagnes beaucoup plus larges ; ne
   pas changer la physique ou la g?om?trie pour rendre les r?sultats plus faciles.

Aucun d?veloppement de l??tape 6 n?est commenc?. Aucun commit, push, d?ploiement
ou installation de d?pendance. Les TPs originaux, EvolutionArena et les autres
projets sont pr?serv?s ; tous les fichiers Vehicle/vehicle.js restent inchang?s.


## 12. Inventaire de livraison et conservation

Fichiers de code cr??s :

- src/evolution/AdaptiveMutation.js.
- src/experiments/Strategies.js, Statistics.js, Comparison.js.
- src/track/TrackVariants.js et src/view/ExperimentPanel.js.
- tools/compare.mjs, comparison-worker.mjs, replay-comparison.mjs.
- tests/advanced-learning.test.js, comparison.test.js, advanced-interface.test.js,
  advanced-artifacts.test.js.
- Le pr?sent document ETAPE-5-APPRENTISSAGE-AVANCE.md.

Donn?es cr??es : audit-initial.json et robustesse-60s.json dans
 docs/experiments/etape-5/ ; dans comparaison/, 20 JSON A?D ? 2026?2030,
20 champions dans champions/, resultats.json, runs.csv, generations.csv,
summary.csv et statistics.csv. Soit 47 fichiers de donn?es, et **61 fichiers
nouveaux au total** avec le code, les tests et ce document.

Fichiers modifi?s : src/evolution/Fitness.js, EvolutionEngine.js, Population.js ;
src/view/TrainingPanel.js ; src/main.js ; index.html ; styles.css ; README.md ;
package.json (0.5.0 et commande compare). **Neuf fichiers existants modifi?s.**

Les anciennes suites, documents et r?sultats des ?tapes 1?4 sont pr?serv?s.
Les empreintes de tous les fichiers des autres projets et celles des sources
physiques prot?g?es sont v?rifi?es avant livraison. La campagne est ex?cut?e
dans un dossier temporaire isol? puis seuls les fichiers pr?vus sont copi?s
vers NeuroDriveAI. Aucun changement aux TPs d?origine ou ? EvolutionArena.
