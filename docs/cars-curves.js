'use strict';
(() => {
  const methods = ['EFS', 'RFECV', 'Lasso', 'Backward', 'SFS'];
  const params = new URLSearchParams(location.search);
  let method = methods.includes(params.get('curve')) ? params.get('curve') : 'EFS';
  let count = Math.min(5, Math.max(1, Number(params.get('k')) || 1));
  const rows = CARS_CURVES.rows;
  $('curve-count').value = count;
  $('curve-compare').checked = params.get('compare') === '1';
  function chooseCurve(name, k = count) { method = name; count = k; render(); }
  function interactive(el, name, k) {
    el.addEventListener('click', () => chooseCurve(name, k));
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); chooseCurve(name, k); }
    });
  }
  for (const name of methods) {
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = name; button.dataset.curve = name;
    button.addEventListener('click', () => chooseCurve(name));
    $('curve-tabs').append(button);
  }
  function chart(target, metric) {
    const names = $('curve-compare').checked ? methods : [method];
    const visible = rows.filter(r => names.includes(r.Method));
    const values = visible.map(r => r[metric]);
    let lo = Math.min(...values), hi = Math.max(...values);
    const pad = (hi - lo || Math.abs(hi) || 1) * .14;
    lo -= pad; hi += pad;
    if (metric === 'RMSE') lo = Math.max(0, lo);
    const w = 540, h = 330, l = 80, r = 22, t = 25, b = 62;
    const x = k => l + (k - 1) / 4 * (w - l - r);
    const y = v => h - b - (v - lo) / (hi - lo) * (h - t - b);
    const svg = node('svg', {viewBox: `0 0 ${w} ${h}`, role: 'img', 'aria-label': `${metric} 與特徵數曲線`});
    for (let i = 0; i <= 4; i++) {
      const v = lo + (hi - lo) * i / 4;
      svg.append(node('line', {x1:l, x2:w-r, y1:y(v), y2:y(v), class:'grid-line'}));
      svg.append(node('text', {x:l-10, y:y(v)+4, 'text-anchor':'end', class:'chart-label'}, fmt(v, metric === 'RMSE' ? 0 : 2)));
    }
    for (let k = 1; k <= 5; k++) svg.append(node('text', {x:x(k), y:h-b+23, 'text-anchor':'middle', class:'chart-label'}, k));
    svg.append(node('text', {x:(l+w-r)/2, y:h-12, 'text-anchor':'middle', class:'chart-label'}, 'Number of Features'));
    for (const name of names) {
      const series = rows.filter(row => row.Method === name);
      svg.append(node('polyline', {points:series.map(row => `${x(row['Number of Features'])},${y(row[metric])}`).join(' '), fill:'none', stroke:color(name), 'stroke-width':name === method ? 3 : 1.5, opacity:name === method ? 1 : .6}));
      for (const row of series) {
        const k = row['Number of Features'];
        const label = `${name}, ${k} features, ${metric}: ${fmt(row[metric], 4)}`;
        const point = node('circle', {cx:x(k), cy:y(row[metric]), r:name === method && k === count ? 7 : 4.5, fill:color(name), stroke:'var(--bg)', 'stroke-width':2, class:'chart-point', tabindex:0, role:'button', 'aria-label':label, 'aria-pressed':String(name === method && k === count)});
        point.append(node('title', {}, label)); interactive(point, name, k); svg.append(point);
      }
    }
    $(target).replaceChildren(svg);
  }
  function render() {
    $('curve-count').value = count; $('curve-count-value').textContent = count;
    $('curve-note').textContent = CARS_CURVES.notes[method];
    document.querySelectorAll('#curve-tabs button').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.curve === method));
      button.style.borderBottomColor = button.dataset.curve === method ? color(method) : 'transparent';
      button.style.color = color(button.dataset.curve);
    });
    $('curve-rows').replaceChildren();
    for (const row of rows.filter(r => r.Method === method)) {
      const k = row['Number of Features'];
      const tr = document.createElement('tr'); tr.tabIndex = 0; tr.style.cursor = 'pointer';
      tr.setAttribute('aria-label', `${method}, ${k} 個特徵`);
      if (k === count) tr.style.boxShadow = 'inset 3px 0 var(--teal)';
      for (const value of [k, row['Selected Features'], fmt(row.RMSE, 4), fmt(row['R-squared'], 6)]) {
        const td = document.createElement('td'); td.textContent = value; tr.append(td);
      }
      interactive(tr, method, k); $('curve-rows').append(tr);
      if (k === count) $('curve-selection').textContent = `${method} · ${k} 個特徵 · CV RMSE €${fmt(row.RMSE)} · CV R² ${fmt(row['R-squared'], 6)}`;
    }
    chart('curve-rmse', 'RMSE'); chart('curve-r2', 'R-squared');
    const url = new URL(location.href); url.searchParams.set('curve', method); url.searchParams.set('k', count); url.searchParams.set('compare', $('curve-compare').checked ? '1' : '0'); history.replaceState(null, '', url);
  }
  $('curve-count').addEventListener('input', e => { count = Number(e.target.value); render(); });
  $('curve-compare').addEventListener('change', render);
  new MutationObserver(render).observe(document.documentElement, {attributes:true, attributeFilter:['data-theme']});
  render();
})();
