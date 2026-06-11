# Capacidades da Plataforma

Cada site hospedado no Port recebe automaticamente todas as capacidades abaixo. Nada de configurar serviços separados — é tudo incluído no deploy.

---

## 📄 Static File Serving

Servidor de arquivos estáticos com MIME types corretos para HTML, CSS, JS, imagens (PNG, JPG, GIF, SVG, WebP, ICO), JSON e TXT.

```
meu-site/
├── index.html          ← página principal (obrigatório)
├── css/style.css
├── js/app.js
├── img/logo.png
└── functions/          ← backend isolado (opcional)
    └── itens.js
```

Acessível via `http://{site-id}.seudominio.com` ou `http://{site-id}.localhost:10000` em dev.

> 🔒 Paths bloqueados por segurança: `/functions/`, `/config/`, `/node_modules/`, `.env`, `.git`

---

## 🗄️ Banco de Dados (PostgreSQL)

Cada site ganha um **schema PostgreSQL dedicado** com tabela `documents` para coleções:

| Método SDK | Descrição |
|------------|-----------|
| `port.db.collection('items').create(data)` | Cria um documento |
| `port.db.collection('items').get(id)` | Busca por ID |
| `port.db.collection('items').list(query)` | Lista documentos |
| `port.db.collection('items').update(id, data)` | Atualiza documento |
| `port.db.collection('items').delete(id)` | Remove documento |

**Isolamento total**: Site A não acessa os dados do Site B. Cada schema é prefixado com `site_` + ID do site.

```js
// Frontend
const item = await window.port.db.collection('produtos').create({
  nome: 'Teclado Mecânico',
  preco: 299.90
});

const { docs } = await window.port.db.collection('produtos').list();
```

---

## 📦 Blob Storage

Upload e armazenamento de arquivos com URL pública:

```js
// Upload via frontend
const file = await window.port.storage.upload(fileInput.files[0]);
// → { id: 'uuid', url: '/api/storage/uuid', filename: 'foto.jpg' }

// URL direta
const url = window.port.storage.getUrl(file.id);
// → '/api/storage/uuid'

// Server-side (nas functions)
const buffer = await port.storage.get('file-id');
```

Limite de 50MB por upload. Arquivos ficam em `/data/uploads/`.

---

## 🤖 AI Endpoint

Um endpoint de IA configurado via variáveis de ambiente (`AI_ENDPOINT_URL` e `AI_API_KEY`). Compatível com OpenAI e providers compatíveis.

```js
// Frontend
const resposta = await window.port.ai.chat({
  messages: [
    { role: 'system', content: 'Você é um assistente.' },
    { role: 'user', content: 'Qual a capital do Brasil?' }
  ],
  model: 'gpt-4'     // opcional
});

// O response pode ser stream ou JSON, depende do provider
```

**Mesmo endpoint disponível nas server-side functions** com a mesma API.

---

## ⚡ Server-Side Functions (RPC)

Funções JavaScript que rodam no servidor, em **worker threads isoladas** com sandbox `node:vm`.

```js
// meu-site/functions/pedidos.js
export async function calcularFrete({ cep, peso }, { port, userId }) {
  // Validação server-side
  if (peso > 30) throw new Error('Peso excede limite');

  // Acesso ao banco
  const regras = await port.db.collection('regras').list();

  // Cálculo
  return { frete: peso * 1.5, prazo: '5 dias úteis' };
}
```

Chamado do frontend via SDK:

```js
const frete = await window.port.functions.pedidos.calcularFrete({
  cep: '01310-100',
  peso: 2.5
});
```

**Limitações das functions:**
- Sem acesso a `require`, `process`, `fs`, `net`
- Heap: 128MB old generation, 32MB young generation
- Stack: 4MB
- Timeout: 15s por chamada (30s na função RPC)
- Console com prefixo para debug (`[fn:nome]`)

---

## 🔧 SDK Client (`/sdk/port.js`)

Carregado com uma linha de HTML:

```html
<script src="/sdk/port.js"></script>
```

Disponibiliza `window.port` com todas as capacidades:

| API | Descrição |
|-----|-----------|
| `port.db.collection(nome)` | CRUD no banco do site |
| `port.functions.ns.fn(args)` | Chama função server-side |
| `port.ai.chat({ messages })` | Chat com LLM configurado |
| `port.config.get(chave)` | Lê config pública do site |
| `port.storage.upload(file)` | Upload de arquivos |
| `port.user.get()` | Identidade do usuário |
| `port.realtime.*` | WebSocket pub/sub |

Todas as chamadas incluem `credentials: 'include'` para autenticação via cookie.

---

## 🔐 Config Pública e Privada

Cada site tem dois objetos JSONB armazenados no banco:

| Tipo | Visível no Frontend | Visível nas Functions | Exemplo |
|------|-------------------|----------------------|---------|
| `config_public` | ✅ `port.config.get('key')` | ✅ `port.config.get('key')` | Tema, textos, URLs públicas |
| `config_private` | ❌ | ✅ `port.config.private('key')` | API keys, senhas, endpoints internos |

Gerenciado via admin dashboard (`/api/config/:key`) ou diretamente pela API:

```bash
# Setar config pública
curl -X POST http://localhost:10000/api/config/theme.primaryColor \
  -H "Content-Type: application/json" \
  -d '{"value": "#4361ee"}'

# Ler config pública
curl http://localhost:10000/api/config/theme.primaryColor

# Config privada (só backend)
curl -X POST http://localhost:10000/api/config/private/whatsapp.apiKey \
  -H "Content-Type: application/json" \
  -d '{"value": "sk-xxx"}'
```

---

## 🔌 WebSocket Realtime

Pub/sub em tempo real por canal, por site:

```js
// Conectar
window.port.realtime.connect();

// Inscrever em um canal
const unsubscribe = window.port.realtime.subscribe('chat', (data) => {
  console.log('Nova mensagem:', data);
});

// Publicar
window.port.realtime.publish('chat', {
  user: 'João',
  message: 'Olá!'
});

// Desinscrever
unsubscribe();

// Desconectar
window.port.realtime.disconnect();
```

Cada site tem canais isolados — Site A não recebe mensagens do Site B.

---

## 👤 Identidade do Usuário

```js
const user = await window.port.user.get();
// → { id, email, name, avatar_url } ou null se não autenticado

// Limpar cache local
window.port.user.clear();
```

Autenticação via Microsoft Entra (Azure AD) configurável. Em modo dev, usa mock.

---

## Resumo

| Capacidade | Inclusa | Isolada por Site | Acessível via |
|-----------|---------|-----------------|---------------|
| Static files | ✅ | ✅ | URL do site |
| PostgreSQL | ✅ | ✅ (schema próprio) | SDK + Functions |
| Blob Storage | ✅ | ✅ | SDK + Functions |
| AI Endpoint | ✅ | ❌ (compartilhado) | SDK + Functions |
| Functions (RPC) | ✅ | ✅ (worker próprio) | SDK |
| Config | ✅ | ✅ | SDK + API + Dashboard |
| WebSocket | ✅ | ✅ (canais isolados) | SDK |
| Auth | ✅ | ✅ | SDK |