// Validation Chrome headless indépendante, sans dépendance npm.
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createArenaServer } from './serve.mjs';

const chromePath = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const profile = mkdtempSync(join(tmpdir(), 'evolution-arena-browser-'));
const output = new URL('../output/browser/', import.meta.url); mkdirSync(output, { recursive: true });
const server = createArenaServer(); await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
let chrome, socket, closeBrowser; const pending = new Map(); let sequence = 0;
const report = { date: new Date().toISOString(), origin, checks: [], exceptions: [], consoleErrors: [], downloads: [], screenshots: [], measurements: {} };
try {
  chrome = spawn(chromePath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--window-size=1440,1000', 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  const endpoint = await new Promise((resolveEndpoint, reject) => {
    const timer = setTimeout(() => reject(new Error('Chrome : délai de connexion dépassé.')), 20000);
    chrome.once('error', e => { clearTimeout(timer); reject(e); });
    chrome.stderr.on('data', data => { const match = String(data).match(/DevTools listening on (ws:\/\/[^\s]+)/); if (match) { clearTimeout(timer); resolveEndpoint(match[1]); } });
  });
  socket = new WebSocket(endpoint); await new Promise((r, j) => { socket.onopen = r; socket.onerror = j; });
  function send(method, params = {}, sessionId) {
    const id = ++sequence;
    return new Promise((r, j) => {
      const timeout = setTimeout(() => { pending.delete(id); j(new Error(`CDP timeout ${method}`)); }, 30000);
      pending.set(id, { resolve: value => { clearTimeout(timeout); r(value); }, reject: e => { clearTimeout(timeout); j(e); } });
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
  socket.onmessage = message => {
    const data = JSON.parse(message.data);
    if (data.id) {
      const request = pending.get(data.id); pending.delete(data.id);
      if (request) data.error ? request.reject(new Error(JSON.stringify(data.error))) : request.resolve(data.result);
    } else if (data.method === 'Runtime.exceptionThrown') report.exceptions.push(data.params.exceptionDetails);
    else if (data.method === 'Runtime.consoleAPICalled' && data.params.type === 'error') report.consoleErrors.push(data.params.args.map(a => a.value ?? a.description));
    else if (data.method === 'Browser.downloadProgress' && data.params.state === 'completed') report.downloads.push(data.params.guid);
  };
  report.browser = await send('Browser.getVersion');
  closeBrowser = () => send('Browser.close');
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: resolve('output/browser/downloads'), eventsEnabled: true });
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const page = (method, params) => send(method, params, sessionId);
  await page('Runtime.enable'); await page('Page.enable');
  const evaluate = async expression => {
    const result = await page('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    return result.result.value;
  };
  const wait = async expression => {
    for (let n = 0; n < 100; n++) { if (await evaluate(expression)) return; await new Promise(r => setTimeout(r, 100)); }
    throw new Error(`Attente DOM : ${expression}`);
  };
  const check = async (name, expression) => { if (!await evaluate(expression)) throw new Error(name); report.checks.push(name); };
  const click = id => evaluate(`document.getElementById(${JSON.stringify(id)}).click()`);
  const screenshot = async name => {
    await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
    const { cssContentSize: size } = await page('Page.getLayoutMetrics');
    const shot = await page('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true,
      clip: { x: 0, y: 0, width: Math.ceil(size.width), height: Math.ceil(size.height), scale: 1 } });
    writeFileSync(new URL(name, output), Buffer.from(shot.data, 'base64')); report.screenshots.push(name);
  };
  await page('Page.navigate', { url: origin });
  await wait('!!document.querySelector("#arena canvas")');
  await check('Accueil chargé avec p5 réel', '!document.getElementById("screen-home").hidden && typeof p5.Vector === "function"');
  await screenshot('home.png');
  await click('home-help');
  for (let i = 0; i < 6; i++) await click('tutorial-next');
  await check('Tutoriel : sept étapes', 'document.getElementById("tutorial-counter").textContent.includes("7 / 7")');
  await click('tutorial-next'); await click('home-settings');
  await click('pref-high-contrast');
  await check('Paramètres appliqués', 'document.getElementById("app-root").dataset.contrast === "high"');
  await page('Page.reload'); await wait('!!document.querySelector("#arena canvas")');
  await check('Préférence persistante après rechargement', 'document.getElementById("app-root").dataset.contrast === "high"');
  await click('home-laboratory'); await new Promise(r => setTimeout(r, 2200));
  await check('Laboratoire : neuf Canvas scientifiques', 'document.querySelectorAll(".science-charts canvas").length === 9');
  await check('Graphiques dessinés', '[...document.querySelectorAll(".science-charts canvas")].every(c=>c.width>0&&c.height>0&&c.getContext("2d").getImageData(0,0,c.width,c.height).data.some(v=>v>0))');
  await click('pause');
  const pausedTime = await evaluate('document.getElementById("sim-time").textContent'); await new Promise(r => setTimeout(r, 300));
  await check('Pause : chronomètre figé', `document.getElementById("sim-time").textContent === ${JSON.stringify(pausedTime)}`);
  await evaluate('document.querySelector(".scientific-protocol summary").click()');
  await check('Contrôles scientifiques dépliés', 'document.querySelector(".scientific-protocol").open');
  await click('science-save'); await click('science-save');
  await check('Comparaison : deux traces', '!document.getElementById("experiment-row-0").hidden && !document.getElementById("experiment-row-1").hidden');
  await click('science-export');
  await click('predators-enabled'); await click('reset');
  await new Promise(r => setTimeout(r, 1200));
  await check('Prédateurs actifs', 'Number(document.getElementById("active-predators").textContent) > 0');
  await click('predator-debug'); await screenshot('laboratory.png');
  report.measurements = await evaluate(`({ fps: frameRate(), heap: performance.memory ? {used:performance.memory.usedJSHeapSize,total:performance.memory.totalJSHeapSize} : null, canvas: {width:width,height:height}, population:document.getElementById('population').textContent, note:'Instantané Chrome headless, pas un benchmark matériel représentatif.' })`);
  report.measurements.profile = await evaluate(`(async()=>{
    const {Simulation}=await import('/src/simulation/Simulation.js');
    const {ArenaRenderer}=await import('/src/ui/ArenaRenderer.js');
    const oldStep=Simulation.prototype.step, oldDraw=ArenaRenderer.prototype.draw;
    let updateMs=0,renderMs=0,steps=0,frames=0; const times=[];
    Simulation.prototype.step=function(...args){const t=performance.now();try{return oldStep.apply(this,args);}finally{updateMs+=performance.now()-t;steps++;}};
    ArenaRenderer.prototype.draw=function(...args){const t=performance.now();try{return oldDraw.apply(this,args);}finally{renderMs+=performance.now()-t;frames++;times.push(t);}};
    try {await new Promise(r=>setTimeout(r,3000));return {durationMs:times.at(-1)-times[0],frames,steps,fps:(frames-1)*1000/(times.at(-1)-times[0]),meanUpdateMs:steps?updateMs/steps:null,meanArenaRenderMs:frames?renderMs/frames:null,note:'Laboratoire par défaut avec deux prédateurs et diagnostic, headless ; rendu CPU, pas temps GPU ni latence écran.'};}
    finally{Simulation.prototype.step=oldStep;ArenaRenderer.prototype.draw=oldDraw;}
  })()`);
  await click('nav-home'); await click('home-play');
  await check('Cinq missions affichées et verrouillage', '[1,2,3,4,5].every(i=>!!document.getElementById("mission-"+i)) && document.getElementById("mission-2").disabled');
  await click('mission-1'); await check('Mission 1 démarrée', '!document.getElementById("game-hud").hidden');
  await screenshot('mission.png');
  // Fixture de progression valide pour vérifier le lancement des cinq interfaces,
  // sans prétendre avoir gagné les missions dans le navigateur.
  await evaluate(`(()=>{const k='evolution-arena.preferences.v1';const p=JSON.parse(localStorage.getItem(k));p.stars=[[1,3],[2,3],[3,3],[4,3],[5,3]];localStorage.setItem(k,JSON.stringify(p));})()`);
  await page('Page.reload'); await wait('!!document.querySelector("#arena canvas")'); await click('home-play');
  for (let i = 1; i <= 5; i++) {
    await click(`mission-${i}`); await check(`Mission ${i} : démarrage avec fixture de déverrouillage`, '!document.getElementById("game-hud").hidden');
    await click('game-selection');
  }
  await click('nav-settings'); await click('progress-reset'); await click('progress-reset');
  await page('Page.reload'); await wait('!!document.querySelector("#arena canvas")'); await click('home-play');
  await check('Reset progression persistant', 'document.getElementById("mission-2").disabled');
  await page('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
  await screenshot('mobile.png');
  await new Promise(r => setTimeout(r, 500));
  if (!report.downloads.length) throw new Error('Aucun téléchargement CSV terminé.');
  if (report.exceptions.length || report.consoleErrors.length) throw new Error('Erreurs JavaScript navigateur.');
  report.status = 'passed';
  report.limitations = 'Headless : pas de validation humaine du rendu, pas de fin des cinq missions en navigateur ; lancement vérifié avec fixture de progression. FPS instantané non représentatif.';
} catch (error) {
  report.status = 'failed'; report.error = String(error.stack ?? error); process.exitCode = 1;
} finally {
  if (closeBrowser) { try { await closeBrowser(); } catch {} }
  socket?.close();
  if (chrome && chrome.exitCode === null) {
    await Promise.race([new Promise(r => chrome.once('exit', r)), new Promise(r => setTimeout(r, 1500))]);
    if (chrome.exitCode === null) chrome.kill();
  }
  server.close();
  // Uniquement le profil temporaire créé par ce script, jamais un profil utilisateur.
  const safe = resolve(profile); if (safe.startsWith(resolve(tmpdir()) + '\\') && safe.includes('evolution-arena-browser-')) {
    try { rmSync(safe, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }); } catch { report.profileCleanup = 'Profil temporaire encore verrouillé par Chrome.'; }
  }
  writeFileSync(new URL('report.json', output), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
}
