// Logical canvas: 1200 x 800. All initial conditions are explicit.
const LabScenarios = {
 historical:{label:'Démonstration historique',goal:'Arrive vers la souris avec obstacle central.',
   vehicles:[{pos:[100,100],vel:[0,0]}],obstacles:[[600,400,100]],target:[300,100],mouse:true},
 empty:{label:'Aucun obstacle',goal:'Sans obstacle, Avoid est nulle ; les autres forces restent actives.',
   vehicles:[{pos:[220,400],vel:[2,0]}],obstacles:[],target:[1000,400]},
 frontal:{label:'Obstacle frontal',goal:'Sur l’axe, la force peut freiner, accélérer ou rester nulle.',
   vehicles:[{pos:[300,400],vel:[4,0]}],obstacles:[[420,400,35]],target:[1000,400]},
 lateral:{label:'Obstacle latéral',goal:'Le point échantillonné produit une répulsion latérale.',
   vehicles:[{pos:[300,400],vel:[4,0]}],obstacles:[[420,420,35]],target:[1000,400]},
 symmetric:{label:'Deux obstacles symétriques',goal:'À distances égales, le premier obstacle du tableau gagne.',
   vehicles:[{pos:[300,400],vel:[4,0]}],obstacles:[[410,420,25],[410,380,25]],target:[1000,400]},
 masked:{label:'Menace masquée',goal:'Un centre proche non menaçant masque un obstacle plus dangereux.',
   vehicles:[{pos:[300,400],vel:[4,0]}],obstacles:[[300,440,1],[420,405,10]],target:[1000,400]},
 gap:{label:'Entre les échantillons',goal:'Un petit obstacle situé entre X et Q15 peut ne pas être détecté.',
   vehicles:[{pos:[300,400],vel:[4,0]}],obstacles:[[330,400,1]],target:[1000,400]},
 narrow:{label:'Passage étroit',goal:'La marge effective et la composition influencent le passage, sans garantie de collision.',
   vehicles:[{pos:[230,400],vel:[3,0]},{pos:[140,410],vel:[2,0]}],
   obstacles:[[550,320,55],[550,480,55],[760,340,35],[760,460,35]],target:[1050,400]}
};
const LabDefaults = Object.freeze({maxSpeed:4,maxForce:0.2,shortHorizon:15,longHorizon:30,
 arrive:0.2,avoid:3,separate:0.2,boundaries:3});
