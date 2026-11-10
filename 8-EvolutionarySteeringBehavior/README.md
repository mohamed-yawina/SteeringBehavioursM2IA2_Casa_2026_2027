# EvoSwarm — Evolutionary Steering Behaviors

**Auteur** : [Ton nom]
**Master 2 Miage IA2 — Octobre 2026 — Prof. Michel Buffa**

## 🎯 Objectif du projet

EvoSwarm est un jeu d'évolution où le joueur doit guider une colonie de
véhicules autonomes à travers 8 vagues de difficulté croissante. La colonie
évolue par sélection naturelle : les individus qui mangent bien et fuient les
menaces transmettent leur ADN (6 gènes) à la génération suivante.

## 🧠 Comportements de steering utilisés

Tous les comportements de base sont implémentés dans la classe **mère
`Vehicle`** (conformément à l'architecture du cours) :

| Comportement | Fichier | Page du cours |
|---|---|---|
| `seek` | `vehicle.js` | p.14 |
| `flee` (inverse de la vitesse désirée) | `vehicle.js` | p.18 |
| `arrive` (avec slowing radius) | `vehicle.js` | p.22 |
| `pursue` (prédiction) | `vehicle.js` | p.19 |
| `evade` (inverse de pursue) | `vehicle.js` | p.20 |
| `wander` (cercle devant) | `vehicle.js` | p.26 |
| `boundaries` | `vehicle.js` | — |
| `separation` | `vehicle.js` | p.39 |
| `alignment` | `vehicle.js` | p.37 |
| `cohesion` | `vehicle.js` | p.38 |
| `obstacleAvoidance` (ahead + ahead2) | `vehicle.js` | p.32-35 |

**Comportements composés** (dans des sous-classes) :
- `FollowerVehicle` : arrive derrière + evade devant + separation
  (**leader following**, p.50-51)
- `BoidVehicle` : separation + alignment + cohesion (**boids**, p.40)

## 🧬 Algorithme génétique

- **ADN** : 6 gènes (poids nourriture, poison, prédateur + 3 rayons de perception)
- **Mutation gaussienne** : réglable par slider
- **Reproduction asexuée** : coût en vie, condition `health > 0.6 && age > 200`
- **Sélection naturelle** : les gènes de fuite émergent par pression de sélection

## 🎛️ BehaviorManager

Chaque `Vehicle` possède un `BehaviorManager` (voir `behavior_manager.js`)
avec l'API demandée :

```js
manager.add(name, fn, weight, active)
manager.remove(name)
manager.activate(name)  /  deactivate(name)
manager.changeWeight(name, w)
manager.getBehavior(name)
manager.getSteeringForce(context)  // somme pondérée