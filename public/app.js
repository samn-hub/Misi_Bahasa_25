const $ = id => document.getElementById(id);
const practice = new URLSearchParams(location.search).get('mod') === 'latihan';
const key = practice ? 'misi-bahasa-25-practice-v1' : 'misi-bahasa-25-v1';
let data, state, busy = false, retryTimer, retries = 0;
const zones = ['Gerbang kata', 'Bengkel bahasa', 'Jejak makna', 'Arena ayat', 'Menara bacaan'];

function persist() {
  try { localStorage.setItem(key, JSON.stringify(state)); }
  catch { $('status').textContent = 'Storan pelayar tidak tersedia. Kekalkan tab ini terbuka semasa bermain.'; }
}
function score() {
  return state.a.reduce((sum, answer, i) => sum + Number(answer === data.questions[i].answer), 0);
}
function go(i) {
  state.i = i;
  state.pick = null;
  persist();
  render();
  $('number').focus({preventScroll: true});
  $('number').scrollIntoView({block: 'start'});
}
function render() {
  const i = state.i, question = data.questions[i], locked = state.a[i] >= 0;
  const answered = state.a.filter(n => n >= 0).length;
  $('zone').textContent = zones[Math.floor(i / 5)];
  $('stars').textContent = '★ ' + score() + ' / 25';
  $('progress').value = answered;
  $('map').replaceChildren();
  data.questions.forEach((q, j) => {
    const button = document.createElement('button');
    button.textContent = j + 1;
    button.className = (state.a[j] >= 0 ? 'done ' : '') + (j === i ? 'current' : '');
    button.setAttribute('aria-label', 'Soalan ' + (j + 1) + (state.a[j] >= 0 ? ', sudah dijawab' : ''));
    button.onclick = () => go(j);
    $('map').append(button);
  });
  $('topic').textContent = question.topic;
  $('number').textContent = 'Soalan ' + (i + 1) + ' / 25';
  $('stem').textContent = question.stem;
  $('passage').hidden = i < 20;
  $('passageText').textContent = data.passage;
  $('options').replaceChildren();
  question.options.forEach((option, n) => {
    const button = document.createElement('button');
    button.className = 'option';
    button.classList.toggle('chosen', (locked ? state.a[i] : state.pick) === n);
    button.classList.toggle('correct', locked && question.answer === n);
    button.setAttribute('aria-pressed', String((locked ? state.a[i] : state.pick) === n));
    const label = document.createElement('b'), text = document.createElement('span');
    label.textContent = 'ABCD'[n]; text.textContent = option;
    button.append(label, text); button.disabled = locked;
    button.onclick = () => { state.pick = n; render(); };
    $('options').append(button);
  });
  $('confirm').hidden = locked;
  $('confirm').disabled = state.pick === null;
  $('feedback').textContent = locked
    ? (state.a[i] === question.answer ? '★ Tepat! ' : 'Jawapan yang tepat ialah ' + 'ABCD'[question.answer] + '. ') + question.why
    : '';
  $('back').disabled = i === 0;
  $('next').disabled = i === 24;
  $('submit').hidden = answered < 25;
}
$('confirm').onclick = () => {
  if (state.pick === null || state.a[state.i] >= 0) return;
  state.a[state.i] = state.pick;
  persist(); render();
};
$('back').onclick = () => go(state.i - 1);
$('next').onclick = () => go(state.i + 1);
$('entry').onsubmit = e => {
  e.preventDefault();
  const name = $('name').value.trim(), group = $('classroom').value.trim().toUpperCase();
  if (!name || !group) return;
  state = {id: crypto.randomUUID(), name, group, i: 0, pick: null, a: Array(25).fill(-1), version: data.version};
  persist(); openGame();
};
function openGame() {
  $('lobby').hidden = true;
  if (state.frozen) { showResult(); if (!state.saved && !practice) send(); return; }
  $('game').hidden = false; render();
}
function showResult() {
  $('game').hidden = true; $('result').hidden = false;
  $('resultTitle').textContent = practice ? 'Latihan selesai' : state.saved ? 'Keputusan berjaya disimpan' : 'Menunggu pengesahan simpanan';
  $('score').textContent = (state.saved ? state.saved.score : score()) + ' / 25';
  $('receipt').textContent = practice ? 'Markah latihan ini hanya untuk semakan cikgu.' :
    state.saved ? 'Nama ranking anda · ' + state.saved.alias + '. Kod penerimaan · ' + state.id.slice(0, 8) : 'Kekalkan tab ini terbuka sehingga pengesahan simpanan diterima.';
  $('restart').hidden = !practice && !state.saved;
  $('review').replaceChildren();
  data.questions.forEach((q, i) => {
    const item = document.createElement('div'); item.className = 'review-item';
    item.textContent = (i + 1) + '. ' + q.stem + '\nJawapan anda · ' + 'ABCD'[state.a[i]] +
      '\nJawapan tepat · ' + 'ABCD'[q.answer] + '. ' + q.options[q.answer] + '\n' + q.why;
    $('review').append(item);
  });
}
$('submit').onclick = () => {
  if (state.a.some(n => n < 0) || !confirm('Hantar keputusan misi ini?')) return;
  state.frozen = true; persist(); showResult();
  if (!practice) send();
};
async function send() {
  if (busy || state.saved || practice) return;
  clearTimeout(retryTimer); busy = true; $('retry').hidden = true;
  try {
    const response = await fetch('/api/kuiz', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(state)});
    if (!response.ok) throw Error();
    state.saved = await response.json(); persist(); showResult(); refreshRanking();
    $('status').textContent = '';
  } catch {
    $('status').textContent = 'Keputusan belum disahkan. Sistem akan cuba menghantar semula.';
    $('retry').hidden = false;
    retryTimer = setTimeout(send, Math.min(60000, 3000 * 2 ** Math.min(retries++, 4)) + Math.random() * 5000);
  } finally { busy = false; }
}
$('retry').onclick = send;
$('restart').onclick = () => {
  if (!confirm('Mulakan percubaan baharu pada peranti ini?')) return;
  try { localStorage.removeItem(key); } catch {}
  location.reload();
};
async function refreshRanking() {
  if (practice || $('refresh').disabled) return;
  $('refresh').disabled = true;
  try {
    const response = await fetch('/api/kuiz', {cache: 'no-store'});
    if (!response.ok) throw Error();
    const rows = await response.json(); $('leaders').replaceChildren();
    rows.forEach(row => {
      const li = document.createElement('li'), points = document.createElement('strong');
      li.textContent = row.alias; points.textContent = row.score + ' / 25';
      li.append(points); $('leaders').append(li);
    });
    $('rankStatus').textContent = rows.length ? '' : 'Jadilah penjelajah bahasa pertama yang melengkapkan misi!';
  } catch { $('rankStatus').textContent = 'Ranking belum dapat dimuatkan. Tekan Muat semula untuk mencuba lagi.'; }
  finally { $('refresh').disabled = false; }
}
$('refresh').onclick = refreshRanking;
if (practice) {
  $('practice').hidden = false; $('ranking').hidden = true;
  $('name').value = 'Cikgu'; $('classroom').value = 'Latihan';
}
try {
  const response = await fetch('questions.json');
  if (!response.ok) throw Error();
  data = await response.json();
  $('start').disabled = false; $('start').textContent = 'Mulakan misi →';
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (saved?.version === data.version && Array.isArray(saved.a) && saved.a.length === 25) { state = saved; openGame(); }
  } catch {}
  refreshRanking();
} catch { $('status').textContent = 'Soalan belum dapat dimuatkan. Muat semula halaman untuk mencuba lagi.'; }
