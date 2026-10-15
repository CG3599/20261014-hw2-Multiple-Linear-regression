'use strict';
// Add future experiment pages here; every page uses the same menu.
const experimentPages = [
  {path: 'index.html', label: '50 Startups · 創業獲利'},
  {path: 'cars.html', label: 'Cars · 汽車售價'},
];
const pageMenu = document.createElement('div');
pageMenu.className = 'page-menu';
const pageLabel = document.createElement('label');
pageLabel.htmlFor = 'experiment-page';
pageLabel.textContent = '切換實驗 / DATASET';
const pageSelect = document.createElement('select');
pageSelect.id = 'experiment-page';
const currentPage = location.pathname.split('/').pop() || 'index.html';
for (const page of experimentPages) {
  const option = document.createElement('option');
  option.value = page.path;
  option.textContent = page.label;
  option.selected = page.path === currentPage;
  pageSelect.append(option);
}
pageSelect.addEventListener('change', () => {
  const page = experimentPages.find(item => item.path === pageSelect.value);
  if (page && page.path !== currentPage) location.assign(new URL(page.path, location.href));
});
pageMenu.append(pageLabel, pageSelect);
document.querySelector('aside nav').before(pageMenu);
