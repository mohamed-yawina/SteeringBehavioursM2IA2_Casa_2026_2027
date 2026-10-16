(function (root) {
  'use strict';
  const descriptions = [
    'a relie O à P ; b relie O à B. Les points restent manipulables à chaque étape.',
    'u garde la direction de b mais sa norme vaut 1. Sa flèche est agrandie ×55.',
    's = a · u est une longueur signée : positive vers B, négative dans le sens opposé.',
    'p = s u est un vecteur. Son extrémité, translatée depuis O, est H.',
    'r = P − H est orthogonal à b. Sa norme mesure la distance de P à la droite.',
    'H appartient à la droite infinie. Q reste sur le segment OB grâce au bornage de t.'
  ];
  const names = { oblique: 'Projection oblique', parallel: 'Parallèle', perpendicular: 'Perpendiculaire',
    negative: 'Projection négative', beyond: 'Au-delà de B', zero: 'Direction nulle', custom: 'Construction personnalisée' };
  const $ = id => document.getElementById(id);
  const number = value => !Number.isFinite(value) ? '—' :
    value !== 0 && Math.abs(value) < .001 ? value.toExponential(2) : String(Number(value.toFixed(3)));
  const vector = value => value ? `(${number(value.x)} ; ${number(value.y)})` : '—';
  function bind(lab) {
    $('reset').addEventListener('click', () => lab.reset());
    $('scenario').addEventListener('change', e => lab.load(e.target.value));
    $('angle').addEventListener('input', e => lab.direction(Number(e.target.value), lab.snapshot.result.length || 0));
    $('length').addEventListener('input', e => lab.direction(lab.snapshot.angle, Number(e.target.value)));
    for (const id of ['vectors', 'perpendicular', 'annotations']) {
      $(id).addEventListener('change', e => lab.option(id, e.target.checked));
    }
    $('guided').addEventListener('change', e => lab.guide(e.target.checked));
    $('previous').addEventListener('click', () => lab.advance(lab.snapshot.step - 1));
    $('next').addEventListener('click', () => lab.advance(lab.snapshot.step + 1));
    document.querySelectorAll('[data-point]').forEach(button => button.addEventListener('click', () => {
      lab.select(button.dataset.point);
      document.querySelector('#canvas-host canvas').focus();
    }));
  }
  function render(state) {
    const d = state.result, stage = state.step;
    $('scenario').value = state.scenario;
    $('angle').value = state.angle; $('length').value = d.length || 0;
    $('angle-value').textContent = `${number(state.angle)}°`;
    $('length-value').textContent = `${number(d.length)} px`;
    $('guided').checked = state.guided;
    for (const key of ['vectors', 'perpendicular', 'annotations']) $(key).checked = state.options[key];
    $('previous').disabled = !state.guided || stage <= 1;
    $('next').disabled = !state.guided || stage >= 6;
    $('step-label').textContent = state.guided ? `${stage} / 6` : 'Vue complète';
    $('step-description').textContent = descriptions[stage - 1];
    $('case-label').textContent = names[state.scenario];
    document.querySelectorAll('[data-point]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.point === state.selected)));
    $('status').textContent = d.valid ? (d.t < 0 ? 's < 0 : la projection est derrière O.' : d.t > 1 ? 't > 1 : la projection dépasse B.' : '0 ≤ t ≤ 1 : H et Q coïncident sur le segment.') :
      d.status === 'degenerate' ? 'Projection sur la droite indéfinie : O et B coïncident. Le segment se réduit à O.' :
      d.status === 'range' ? 'Calcul hors de la plage numérique représentable.' : 'Entrée invalide : les coordonnées doivent être finies.';
    const rows = [
      ['O (px)', vector(d.O), 1], ['P (px)', vector(d.P), 1], ['B (px)', vector(d.B), 1],
      ['a = P − O (px)', vector(d.a), 1], ['b = B − O (px)', vector(d.b), 1], ['‖b‖ (px)', number(d.length), 1],
      ['u (sans unité)', vector(d.u), 2], ['a · b (px²)', number(d.dot), 3], ['s = a · u (px)', number(d.scalar), 3],
      ['p = s u (px)', vector(d.vector), 4], ['H (px)', vector(d.H), 4],
      ['r = P − H (px)', vector(d.residual), 5], ['Distance droite (px)', number(d.distance), 5],
      ['t (sans unité)', number(d.t), 6], ['t borné', number(d.clampedT), 6], ['Q (px)', vector(d.segmentPoint), 6],
      ['Distance segment (px)', number(d.segmentDistance), 6]
    ];
    const readout = $('readout'); readout.replaceChildren();
    for (const [label, value, reveal] of rows) {
      const item = document.createElement('div'), term = document.createElement('dt'), definition = document.createElement('dd');
      term.textContent = label; definition.textContent = stage >= reveal ? value : 'Étape suivante';
      item.append(term, definition); readout.append(item);
    }
    $('canvas-summary').textContent = `O ${vector(d.O)}, P ${vector(d.P)}, B ${vector(d.B)}. ${$('status').textContent}`;
  }
  root.ProjectionUI = { bind, render };
})(globalThis);
