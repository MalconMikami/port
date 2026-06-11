# Samples

Três sites de exemplo para demonstrar as capacidades do Port.

---

## Site A — Landing Page Estática

`sample/site-a/` — Landing page institucional gerada por IA. Site estático puro, sem backend.

```html
<!-- index.html — site-a -->
<section class="hero">
  <h1>Alpha Tech</h1>
  <p>Transformamos ideias em soluções digitais inteligentes.</p>
</section>
```

**Deploy:**
```bash
cd cli && npm install
npx tsx src/index.ts deploy ../sample/site-a
```

Acesse: [http://site-a.localhost:10000](http://site-a.localhost:10000)

**O que demonstra:**
- Static file serving com HTML + CSS customizados
- Deploy via CLI sem configuração
- Subdomain routing (`site-a.*`)

---

## Site B — Landing Page Estática

`sample/site-b/` — Outra landing page estática.

```bash
npx tsx src/index.ts deploy ../sample/site-b
```

Acesse: [http://site-b.localhost:10000](http://site-b.localhost:10000)

---

## Sample CRUD — Site Completo com Backend

`sample/sample-crud/` — Aplicação CRUD completa com frontend + funções server-side + banco de dados.

### Estrutura

```
sample-crud/
├── index.html                    ← Frontend com formulário e listagem
├── css/style.css                 ← Estilos customizados
├── js/app.js                     ← Lógica frontend com SDK
├── functions/
│   └── itens.js                  ← Funções RPC server-side
└── img/                          ← Assets
```

### Frontend (`js/app.js`)

Usa o SDK do Port para toda a comunicação com o backend:

```js
// Carrega identidade do usuário
const user = await window.port.user.get();

// Aplica tema dinâmico do config_public
const theme = await window.port.config.get('theme');
document.documentElement.style.setProperty('--primary', theme.primaryColor);

// CRUD via RPC — funções rodam no servidor
await window.port.functions.itens.create({ name: 'Teclado', price: 299 });
const { docs } = await window.port.functions.itens.list();
await window.port.functions.itens.remove({ id: itemId });
```

### Funções Server-Side (`functions/itens.js`)

Validação e regras de negócio no servidor, com acesso ao banco:

```js
// Validação server-side
export async function create({ name, price }, { port, userId }) {
  if (!name || name.length < 2) throw new Error('Nome precisa ter pelo menos 2 caracteres');
  if (price === undefined || price < 0) throw new Error('Preço inválido');

  // Cria no banco do site
  return port.db.collection('itens').create({ name, price, owner: userId });
}

// Listagem com filtro opcional
export async function list({ owner }, { port }) {
  const result = await port.db.collection('itens').list();
  if (owner) result.docs = result.docs.filter(d => d.owner === owner);
  return result;
}

// Deleção com verificação de ownership
export async function remove({ id }, { port, userId }) {
  if (!id) throw new Error('ID é obrigatório');
  const result = await port.db.collection('itens').list();
  const item = result.docs.find(d => d.id === id);
  if (!item) throw new Error('Item não encontrado');
  if (item.owner !== userId) throw new Error('Só o criador pode deletar este item');
  await port.db.collection('itens').delete(id);
  return { ok: true };
}
```

### Deploy

```bash
cd cli && npm install
npx tsx src/index.ts deploy ../sample/sample-crud
```

Acesse: [http://sample-crud.localhost:10000](http://sample-crud.localhost:10000)

**O que demonstra:**
- SDK `window.port` completo (db, functions, config, user)
- RPC com funções server-side
- Validação e regras de negócio no backend
- Tema dinâmico via config_public
- CRUD completo com banco PostgreSQL
- Ownership e autorização (só o dono deleta)

---

## ZIPs

Os diretórios `sample/site-a.zip` e `sample/site-b.zip` são os mesmos sites empacotados para deploy via dashboard web (upload direto do ZIP).

---

## Criando Seu Próprio Site

```bash
# Crie uma pasta com index.html
mkdir meu-site
echo '<h1>Olá, Port!</h1>' > meu-site/index.html

# Adicione funções server-side
mkdir meu-site/functions
cat > meu-site/functions/saude.js << 'EOF'
export async function ping({ nome }, { port }) {
  return { mensagem: `Olá, ${nome}!`, timestamp: new Date().toISOString() };
}
EOF

# Deploy
cd cli && npx tsx src/index.ts deploy ../meu-site
```

Seu site está em `http://meu-site.localhost:10000`.

```js
// No frontend:
const result = await window.port.functions.saude.ping({ nome: 'Maria' });
// → { mensagem: 'Olá, Maria!', timestamp: '2026-06-11T...' }
```