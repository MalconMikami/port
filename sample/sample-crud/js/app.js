// ── Frontend — usa SDK do Port + RPC ──

const form = document.getElementById('item-form');
const list = document.getElementById('items-list');
const loading = document.getElementById('loading');
const userInfo = document.getElementById('user-info');

let currentUser = null;

// ── Init ──
async function init() {
  // Carrega identidade do usuário
  currentUser = await window.port.user.get();
  if (currentUser) {
    userInfo.textContent = `👤 ${currentUser.name || currentUser.email}`;
  }

  // Aplica tema do config/public.json
  const theme = await window.port.config.get('theme');
  if (theme) {
    document.documentElement.style.setProperty('--primary', theme.primaryColor);
    document.documentElement.style.setProperty('--bg', theme.backgroundColor);
    document.documentElement.style.setProperty('--card', theme.cardBackground);
    document.documentElement.style.setProperty('--text', theme.textColor);
    document.documentElement.style.setProperty('--radius', theme.borderRadius);
  }

  await loadItems();
}

// ── Listar itens via RPC ──
async function loadItems() {
  try {
    loading.textContent = 'Carregando...';
    loading.style.display = 'block';

    // Chama a função RPC no backend do site
    const result = await window.port.functions.itens.list({});
    renderItems(result.docs || []);
  } catch (err) {
    loading.textContent = `Erro: ${err.message}`;
    loading.style.display = 'block';
  }
}

// ── Renderizar itens ──
function renderItems(items) {
  loading.style.display = 'none';

  if (items.length === 0) {
    list.innerHTML = '<li class="empty">Nenhum item cadastrado.</li>';
    return;
  }

  list.innerHTML = items.map(item => `
    <li class="item" data-id="${item.id}">
      <div class="item-info">
        <strong>${item.name}</strong>
        <span class="price">R$ ${Number(item.price).toFixed(2)}</span>
        <small class="owner">${item.owner === currentUser?.email ? '🧑‍💻 você' : item.owner}</small>
      </div>
      ${item.owner === currentUser?.email ? `
        <button class="delete-btn" data-id="${item.id}" title="Excluir">✕</button>
      ` : ''}
    </li>
  `).join('');

  // Event listeners para deletar
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteItem(btn.dataset.id));
  });
}

// ── Criar item via RPC ──
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.textContent = 'Criando...';

  try {
    // Validação e criação no servidor
    await window.port.functions.itens.create({
      name: data.name,
      price: parseFloat(data.price),
    });

    form.reset();
    await loadItems();
  } catch (err) {
    alert(`Erro: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Criar Item';
  }
});

// ── Deletar item via RPC ──
async function deleteItem(id) {
  if (!confirm('Tem certeza que quer excluir este item?')) return;

  try {
    await window.port.functions.itens.remove({ id });
    await loadItems();
  } catch (err) {
    alert(`Erro: ${err.message}`);
  }
}

// ── Start ──
init();
