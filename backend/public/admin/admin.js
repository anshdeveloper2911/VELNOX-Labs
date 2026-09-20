(() => {
  'use strict';

  const API = `${location.origin}/api`;
  let token = localStorage.getItem('velnox_admin_token') || '';
  const $ = id => document.getElementById(id);

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  }

  async function api(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const response = await fetch(`${API}${path}`, {...options, headers});
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      logout(false);
      throw new Error(data.error || 'Session expired.');
    }
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
    return data;
  }

  function showLogin(message = '') {
    $('app').classList.add('hidden');
    $('login').classList.remove('hidden');
    $('loginMsg').textContent = message;
    $('loginMsg').className = message ? 'error' : '';
  }

  function showApp() {
    $('login').classList.add('hidden');
    $('app').classList.remove('hidden');
  }

  function logout(showMessage = true) {
    localStorage.removeItem('velnox_admin_token');
    token = '';
    showLogin(showMessage ? 'Signed out.' : '');
  }

  async function login() {
    const button = $('loginBtn');
    button.disabled = true;
    $('loginMsg').textContent = 'Signing in...';
    $('loginMsg').className = 'muted';
    try {
      const data = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({username: $('u').value.trim(), password: $('p').value})
      });
      token = data.token;
      localStorage.setItem('velnox_admin_token', token);
      $('p').value = '';
      showApp();
      await loadStats();
      await openTab('enquiries');
    } catch (error) {
      $('loginMsg').textContent = error.message;
      $('loginMsg').className = 'error';
    } finally {
      button.disabled = false;
    }
  }

  async function loadStats() {
    const s = await api('/admin/stats');
    $('stats').innerHTML = [
      ['Enquiries', s.enquiries], ['New', s.newEnquiries], ['Projects', s.projects], ['Testimonials', s.testimonials]
    ].map(([label, value]) => `<div class="card"><span class="muted">${label}</span><div class="stat">${value}</div></div>`).join('');
  }

  async function openTab(name) {
    document.querySelectorAll('[data-tab]').forEach(button => button.classList.toggle('active', button.dataset.tab === name));
    try {
      if (name === 'enquiries') await renderEnquiries();
      if (name === 'projects') await renderProjects();
      if (name === 'testimonials') await renderTestimonials();
    } catch (error) {
      $('content').innerHTML = `<div class="card error">${escapeHtml(error.message)}</div>`;
    }
  }

  async function renderEnquiries() {
    const items = await api('/admin/enquiries');
    $('content').innerHTML = `<div class="card"><h2>Enquiries</h2>${items.length ? items.map(item => `
      <div class="item">
        <div class="row"><strong>${escapeHtml(item.name)}</strong>
          <select data-status-id="${item.id}">
            ${['new','contacted','closed'].map(status => `<option value="${status}" ${item.status === status ? 'selected' : ''}>${status}</option>`).join('')}
          </select>
        </div>
        <div class="muted">${escapeHtml(item.email)} ${escapeHtml(item.phone || '')} · ${escapeHtml(item.service)} · ${escapeHtml(item.created_at)}</div>
        <p>${escapeHtml(item.message)}</p>
        <button class="danger" type="button" data-delete-enquiry="${item.id}">Delete</button>
      </div>`).join('') : '<p class="muted">No enquiries yet.</p>'}</div>`;
  }

  async function renderProjects() {
    const items = await api('/admin/projects');
    $('content').innerHTML = `<div class="card"><h2>Add Project</h2>
      <form id="projectForm">
        <div class="formgrid"><div><label>Title</label><input name="title" required><label>Type</label><input name="type" required><label>Image URL</label><input name="image"></div>
        <div><label>Project URL</label><input name="url"><label>Meta (use |)</label><input name="meta"><label>Order</label><input name="sort_order" type="number" value="0"></div></div>
        <label>Description</label><textarea name="description" required></textarea>
        <button class="primary" type="submit">Add project</button>
      </form></div>
      <div class="card"><h2>Projects</h2>${items.length ? items.map(item => `
        <div class="item"><div class="row"><strong>${escapeHtml(item.title)}</strong><div class="actions">
          <button type="button" data-toggle-project="${item.id}" data-published="${item.published ? 0 : 1}">${item.published ? 'Hide' : 'Publish'}</button>
          <button class="danger" type="button" data-delete-project="${item.id}">Delete</button></div></div>
          <div class="muted">${escapeHtml(item.type)} · ${escapeHtml(item.url || '')}</div><p>${escapeHtml(item.description)}</p>
        </div>`).join('') : '<p class="muted">No projects.</p>'}</div>`;
  }

  async function addProject(form) {
    const data = Object.fromEntries(new FormData(form));
    data.published = true;
    await api('/admin/projects', {method:'POST', body:JSON.stringify(data)});
    await renderProjects();
    await loadStats();
  }

  async function toggleProject(id, published) {
    const items = await api('/admin/projects');
    const item = items.find(project => Number(project.id) === Number(id));
    if (!item) throw new Error('Project not found.');
    await api(`/admin/projects/${id}`, {method:'PATCH', body:JSON.stringify({...item, published:Boolean(Number(published))})});
    await renderProjects();
  }

  async function renderTestimonials() {
    const items = await api('/admin/testimonials');
    $('content').innerHTML = `<div class="card"><h2>Add Testimonial</h2>
      <form id="testimonialForm"><div class="formgrid"><div><label>Name</label><input name="name" required></div><div><label>Role</label><input name="role"></div></div>
      <label>Quote</label><textarea name="quote" required></textarea><label>Rating</label><input name="rating" type="number" min="1" max="5" value="5">
      <button class="primary" type="submit">Add testimonial</button></form></div>
      <div class="card"><h2>Testimonials</h2>${items.length ? items.map(item => `
        <div class="item"><strong>${escapeHtml(item.name)}</strong><div class="muted">${escapeHtml(item.role || '')} · ${'★'.repeat(Number(item.rating || 0))}</div>
        <p>${escapeHtml(item.quote)}</p><button class="danger" type="button" data-delete-testimonial="${item.id}">Delete</button></div>`).join('') : '<p class="muted">No testimonials.</p>'}</div>`;
  }

  async function addTestimonial(form) {
    const data = Object.fromEntries(new FormData(form));
    await api('/admin/testimonials', {method:'POST', body:JSON.stringify(data)});
    await renderTestimonials();
    await loadStats();
  }

  document.addEventListener('click', async event => {
    const tabButton = event.target.closest('[data-tab]');
    if (tabButton) return openTab(tabButton.dataset.tab);
    if (event.target.closest('#loginBtn')) return login();
    if (event.target.closest('#logoutBtn')) return logout(true);

    try {
      const deleteEnquiry = event.target.closest('[data-delete-enquiry]');
      if (deleteEnquiry && confirm('Delete this enquiry?')) {
        await api(`/admin/enquiries/${deleteEnquiry.dataset.deleteEnquiry}`, {method:'DELETE'});
        await renderEnquiries(); await loadStats(); return;
      }
      const toggle = event.target.closest('[data-toggle-project]');
      if (toggle) return toggleProject(toggle.dataset.toggleProject, toggle.dataset.published);
      const deleteProject = event.target.closest('[data-delete-project]');
      if (deleteProject && confirm('Delete this project?')) {
        await api(`/admin/projects/${deleteProject.dataset.deleteProject}`, {method:'DELETE'});
        await renderProjects(); await loadStats(); return;
      }
      const deleteTest = event.target.closest('[data-delete-testimonial]');
      if (deleteTest && confirm('Delete this testimonial?')) {
        await api(`/admin/testimonials/${deleteTest.dataset.deleteTestimonial}`, {method:'DELETE'});
        await renderTestimonials(); await loadStats();
      }
    } catch (error) {
      alert(error.message);
    }
  });

  document.addEventListener('change', async event => {
    const statusSelect = event.target.closest('[data-status-id]');
    if (!statusSelect) return;
    try {
      await api(`/admin/enquiries/${statusSelect.dataset.statusId}`, {method:'PATCH', body:JSON.stringify({status:statusSelect.value})});
      await loadStats();
    } catch (error) { alert(error.message); }
  });

  document.addEventListener('submit', async event => {
    try {
      if (event.target.id === 'projectForm') { event.preventDefault(); await addProject(event.target); }
      if (event.target.id === 'testimonialForm') { event.preventDefault(); await addTestimonial(event.target); }
    } catch (error) { alert(error.message); }
  });

  $('p').addEventListener('keydown', event => { if (event.key === 'Enter') login(); });

  if (token) {
    showApp();
    loadStats().then(() => openTab('enquiries')).catch(() => logout(false));
  }
})();
