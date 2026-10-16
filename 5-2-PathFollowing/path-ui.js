const PathUI = (() => {
  const $ = id => document.getElementById(id);
  const format = n => Number.isFinite(n) ? String(Number(n.toFixed(3))) : '—';
  const vector = p => p ? `(${format(p.x)} ; ${format(p.y)})` : '—';
  function init(lab) {
    for (const key of ['prediction', 'radius', 'maxSpeed', 'maxForce']) $(key).addEventListener('input', e => lab.setParameter(key, Number(e.target.value)));
    $('pause').addEventListener('click', () => { lab.state.paused = true; });
    $('resume').addEventListener('click', () => { lab.state.paused = false; });
    $('step').addEventListener('click', () => lab.singleStep());
    $('reset').addEventListener('click', () => lab.reset());
    $('scenario').addEventListener('change', e => lab.setScenario(e.target.value));
    $('compare').addEventListener('change', e => lab.compare(e.target.checked));
    for (const key of ['showDiagnostics', 'showTrails', 'mousePath']) $(key).addEventListener('change', e => { lab.state[key] = e.target.checked; });
    $('endpoint').addEventListener('change', e => { lab.state.selectedEndpoint = e.target.value; });
  }
  function update(lab) {
    const s = lab.state;
    $('simulation-status').textContent = `${s.paused ? 'En pause' : 'Simulation en cours'} · ${s.tick} pas`;
    $('step').disabled = !s.paused;
    $('prediction').disabled = s.comparison;
    for (const key of ['prediction', 'radius', 'maxSpeed', 'maxForce']) {
      $(key).value = String(s[key]); $(`${key}-value`).textContent = format(s[key]);
    }
    $('mousePath').checked = s.mousePath;
    $('endpoint').value = s.selectedEndpoint;
    $('compare').checked = s.comparison;
    const panel = $('diagnostics'); panel.replaceChildren();
    s.vehicles.forEach((v, i) => {
      const d = v.copyFollowDiagnostics(), card = document.createElement('section'); card.className = `diagnostic cohort-${i}`;
      const title = document.createElement('h3'); title.textContent = s.comparison ? `Anticipation ${i * 20} pas` : `Anticipation ${s.prediction} pas`; card.append(title);
      const status = document.createElement('p'); status.className = 'correction-status';
      status.textContent = !d ? 'En attente du prochain pas physique.' : d.status === 'undefined' ? 'Projection indéfinie : chemin nul. Force nulle.' : d.status === 'invalid' ? 'Entrée invalide : force nulle.' : d.active ? 'Correction active : d > rayon' : 'Correction inactive : d ≤ rayon';
      card.append(status);
      const dl = document.createElement('dl');
      const rows = [['Position du calcul (px)', vector(d?.origin)], ['Vitesse (px/pas)', vector(d?.velocity)],
        ['Futur F (px)', vector(d?.future)], ['Projection H (px)', vector(d?.target)],
        ['Distance FH (px)', format(d?.distance)], ['Rayon du calcul (px)', format(d?.radius)],
        ['Force appliquée (px/pas²)', vector(d?.force)], ['Norme de force', d?.force ? format(d.force.mag()) : '—']];
      for (const [name, value] of rows) {
        const term = document.createElement('dt'), def = document.createElement('dd'); term.textContent = name; def.textContent = value; dl.append(term, def);
      }
      card.append(dl);
      if (s.wrapped[i] && d) { const note = document.createElement('p'); note.textContent = 'Rebouclage : le diagnostic décrit la position avant le passage au bord.'; card.append(note); }
      panel.append(card);
    });
  }
  return { init, update };
})();
