# Guias e How-Tos

---

## Guia Rápido: Do Zero ao Site Rodando em 5 Minutos

```bash
# 1. Clone e sobe a plataforma
git clone https://github.com/MalconMikami/port.git
cd port
docker compose up -d

# 2. Cria um site mínimo
mkdir meu-primeiro-site
cat > meu-primeiro-site/index.html << 'HTML'
<!DOCTYPE html>
<html lang="pt-BR">
<head><title>Meu Primeiro Site</title></head>
<body>
  <h1>🚢 Rodando no Port!</h1>
  <script src="/sdk/port.js"></script>
  <script>
    window.port.db.collection('visitas').create({ data: new Date().toISOString() });
  </script>
</body>
</html>
HTML

# 3. Deploy
cd port/cli && npm install
npx tsx src/index.ts deploy ../meu-primeiro-site
```

Acesse [http://meu-primeiro-site.localhost:10000](http://meu-primeiro-site.localhost:10000) ✅

---

## Como Adicionar Funções Server-Side ao Seu Site

1. Crie a pasta `functions/` na raiz do seu site
2. Adicione arquivos `.js` — cada arquivo vira um namespace
3. Cada função exportada vira um método chamável

```
meu-site/
├── index.html
└── functions/
    ├── usuario.js      →  port.functions.usuario.*
    └── pagamentos.js   →  port.functions.pagamentos.*
```

**Exemplo: `functions/usuario.js`**
```js
export async function criar({ nome, email }, { port, userId }) {
  if (!email || !email.includes('@')) throw new Error('Email inválido');
  return port.db.collection('usuarios').create({ nome, email, criadoPor: userId });
}

export async function listar({ }, { port }) {
  return port.db.collection('usuarios').list();
}
```

**No frontend:**
```js
await window.port.functions.usuario.criar({ nome: 'João', email: 'joao@email.com' });
const { docs } = await window.port.functions.usuario.listar();
```

---

## Como Usar Config para Customizar o Tema

### 1. Setar config via API

```bash
curl -X POST 'http://localhost:10000/api/config/theme.primaryColor?site=meu-site' \
  -H 'Content-Type: application/json' \
  -d '{"value": "#4361ee"}'

curl -X POST 'http://localhost:10000/api/config/theme.backgroundColor?site=meu-site' \
  -H 'Content-Type: application/json' \
  -d '{"value": "#f8f9fc"}'
```

### 2. Aplicar no frontend

```js
const theme = await window.port.config.get('theme');
if (theme) {
  document.documentElement.style.setProperty('--primary', theme.primaryColor);
  document.documentElement.style.setProperty('--bg', theme.backgroundColor);
}
```

### 3. Usar no CSS

```css
:root {
  --primary: #4361ee;
  --bg: #f8f9fc;
}
body { background: var(--bg); }
.button { background: var(--primary); }
```

---

## Como Usar o Storage para Upload de Arquivos

### Frontend

```html
<input type="file" id="fileInput" accept="image/*">
<button onclick="upload()">Enviar</button>
<img id="preview">

<script src="/sdk/port.js"></script>
<script>
async function upload() {
  const file = await window.port.storage.upload(
    document.getElementById('fileInput').files[0]
  );
  document.getElementById('preview').src = window.port.storage.getUrl(file.id);
}
</script>
```

### Server-Side (nas functions)

```js
export async function processarArquivo({ fileId }, { port }) {
  const buffer = await port.storage.get(fileId);
  if (!buffer) throw new Error('Arquivo não encontrado');
  // processa o buffer...
}
```

---

## Como Usar o AI Chat

```html
<script src="/sdk/port.js"></script>
<script>
async function perguntar() {
  const resposta = await window.port.ai.chat({
    messages: [
      { role: 'user', content: 'Resuma a teoria da relatividade em 1 parágrafo.' }
    ]
  });
  document.getElementById('resposta').textContent = resposta.choices[0].message.content;
}
</script>
```

Configure o endpoint no `.env`:

```env
AI_ENDPOINT_URL=https://api.openai.com/v1/chat/completions
AI_API_KEY=sk-proj-xxxxx
```

Compatível com qualquer API compatível com OpenAI (OpenAI, Anthropic via proxy, Ollama, etc.).

---

## Como Usar WebSocket para Realtime

```js
// Conectar
window.port.realtime.connect();

// Inscrever em canal
const unsub = window.port.realtime.subscribe('notificacoes', (dado) => {
  mostrarNotificacao(dado);
});

// Publicar
document.getElementById('btn-enviar').onclick = () => {
  window.port.realtime.publish('chat', {
    usuario: 'João',
    mensagem: 'Olá pessoal!'
  });
};

// Desinscrever quando não precisar mais
unsub();
```

---

## Como Fazer o Deploy Pelo Admin Dashboard

1. Acesse `http://localhost:10000`
2. Clique em "Deploy"
3. Selecione um arquivo ZIP que contenha `index.html` na raiz
4. Dê um nome ao site
5. Confirme

O dashboard lista todos os sites com opções para:
- Visualizar (abre o site)
- Deletar
- Editar config
- Ver status

---

## Como Fazer o Deploy via CLI com NPM Global

```bash
# Instalar globalmente
cd cli && npm install && npm link

# Agora o comando 'port' está disponível
port deploy ./meu-site
port login
port --help
```

---

## Como Rodar em Produção com SSL

1. **Configure o domínio** — no `.env`, defina `DOMAIN=seu-dominio.com`
2. **Ajuste o Caddyfile** — substitua `DOMAIN.example.com` pelo seu domínio real
3. **Gere secrets fortes**:
   ```bash
   openssl rand -hex 32  # para JWT_SECRET
   ```
4. **Suba com perfil de produção**:
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
   ```

O Caddy vai automaticamente:
- Obter certificado SSL via Let's Encrypt
- Fazer proxy reverso para a API
- Servir sites em `https://{site-id}.seu-dominio.com`

---

## Como Adicionar um Site ZIP pelo Admin Dashboard

1. Empacote seu site:
   ```bash
   cd meu-site && zip -r ../meu-site.zip .
   ```
2. Acesse `http://localhost:10000`
3. Clique em "Escolher arquivo"
4. Selecione `meu-site.zip`
5. Dê um nome e confirme

---

## Como Resetar o Ambiente Dev

```bash
# Para tudo e remove volumes
docker compose down -v

# Sobe de novo (fresh)
docker compose up -d

# O init.sql vai rodar e recriar as tabelas
```

⚠️ Remove todos os sites e dados.

---

## Como Verificar se o Worker Está Rodando

```bash
curl http://localhost:10000/api/rpc/status
# → { "activeWorkers": 3 }
```

Se um site tem functions/ mas o worker não aparece, verifique os logs:

```bash
docker compose logs api
```

---

## Dicas de Segurança

- **Nunca coloque senhas no `config_public`** — use `config_private`
- **Sites que não são mais usados devem ser deletados**
- **Em produção, use senha forte no PostgreSQL**
- **O JWT secret em produção deve ser único e forte**
- **Revise as functions antes do deploy em produção** — o sandbox ajuda, mas revisão é melhor
- **Separe ambientes dev e prod** em instâncias diferentes do Port