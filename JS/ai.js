document.addEventListener('componentsLoaded', () => {
  const panel = document.querySelector('#velnox-ai');
  const openButton = document.querySelector('#velnox-ai-open');
  const closeButton = document.querySelector('#velnox-ai-close');
  const form = document.querySelector('#velnox-ai-form');
  const input = document.querySelector('#velnox-ai-input');
  const messages = document.querySelector('#velnox-ai-messages');
  if (!panel || !openButton || !form || !input || !messages) return;

  const addMessage = (text, role) => {
    const item = document.createElement('div');
    item.className = `ai-message ${role}`;
    item.textContent = text;
    messages.appendChild(item);
    messages.scrollTop = messages.scrollHeight;
  };

  openButton.addEventListener('click', () => { panel.hidden = false; input.focus(); });
  closeButton?.addEventListener('click', () => { panel.hidden = true; });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = input.value.trim();
    if (!message) return;
    input.value = '';
    addMessage(message, 'user');
    addMessage('Thinking…', 'assistant pending');
    const pending = messages.lastElementChild;
    try {
      const response = await fetch(`${window.VELNOX_API}/api/ai/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
      const raw = await response.text();
      let data = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch {
        throw new Error(`Server returned an invalid response (${response.status}). Check that the backend is running on port 3000.`);
      }
      pending.remove();
      if (!response.ok) throw new Error(data.error || `AI request failed (${response.status})`);
      if (!data.reply) throw new Error('AI returned no reply. Check the backend terminal for details.');
      addMessage(data.reply, 'assistant');
    } catch (error) {
      pending.textContent = error.message || 'AI is temporarily unavailable.';
      pending.className = 'ai-message assistant error';
    }
  });
});
