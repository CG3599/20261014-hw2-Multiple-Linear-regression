'use strict';
// Shared dataset switcher: Cars is the homepage and Startups is the second experiment.
const experimentPages = [
  { path: 'index.html', label: 'Cars · 汽車售價' },
  { path: 'startups.html', label: '50 Startups · 創業獲利' },
  { path: 'custom.html', label: 'Custom Dataset · 自訂資料集' },
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
  if (page && page.path !== currentPage) {
    const destination = new URL(page.path, location.href);
    destination.searchParams.set('v', String(Date.now()));
    location.assign(destination);
  }
});
pageMenu.append(pageLabel, pageSelect);
const sideNav = document.querySelector('aside nav');
if (sideNav) {
  sideNav.before(pageMenu);
  // Both experiment pages use the same section-nav active-state behavior.
  const links = [...sideNav.querySelectorAll('a[href^="#"]')];
  const updateActive = () => {
    const sections = links.filter(link => !link.hidden).map(link => ({ link, section: document.getElementById(link.hash.slice(1)) })).filter(item => item.section && !item.section.closest('[hidden]'));
    const current = [...sections].reverse().find(item => item.section.getBoundingClientRect().top <= 160) || sections[0];
    for (const link of links) {
      if (link.hidden) { link.classList.remove('active'); link.removeAttribute('aria-current'); }
    }
    for (const item of sections) {
      item.link.classList.toggle('active', item === current);
      if (item === current) item.link.setAttribute('aria-current', 'location');
      else item.link.removeAttribute('aria-current');
    }
  };
  addEventListener('scroll', updateActive, { passive: true });
  addEventListener('hashchange', updateActive);
  updateActive();
}
