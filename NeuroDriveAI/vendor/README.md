# p5.js local

`p5.min.js` : p5.js **1.7.0**, en-tête daté du 10 juillet 2023.
Copie à l’identique de `1-Seek/libraries/p5.min.js` du dépôt de cours.
Aucune installation ou modification de la source. Aucun appel CDN.

Le moteur utilise uniquement `p5.Vector` ; le rendu est assuré par Canvas 2D.
La distribution originale est conservée intégralement, avec son en-tête.

p5.js est distribué sous LGPL-2.1 ; voir `LICENSE-p5.txt`, également fourni.
Projet amont : https://github.com/processing/p5.js

Le préchargement Node des tests évalue uniquement le module Vector (306) de ce
bundle Browserify. Le point d’entrée et les constantes nécessaires sont isolés
pour éviter l’initialisation DOM ; les méthodes vectorielles sont celles de p5.
Ce chargeur est lié à ce bundle : son remplacement exige d’adapter le chargeur.
