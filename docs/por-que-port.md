# Por que Port?

## O Problema

Empresas estão adotando IA generativa em massa para criar sites, landing pages, dashboards internos, CRUDs, protótipos e MVPs. Ferramentas como Claude, ChatGPT, Cursor e Bolt geram código funcional em segundos — HTML, CSS, JS, até backend completo.

Mas aí vem a pergunta: **onde hospedar isso?**

### O cenário atual

| Opção | Problema |
|-------|----------|
| **Vercel / Netlify** | Excelente para devs, mas time de operações precisa configurar pipeline, build, variáveis de ambiente. Cada site é um projeto separado. |
| **AWS / GCP / Azure** | Curva de aprendizado íngreme. IAM, VPC, load balancers, RDS. Um time não-técnico não consegue usar. |
| **Servidor compartilhado** | Sem isolamento. Um site comprometido expõe todos os outros. |
| **Subir direto num bucket S3** | Sem backend, sem banco, sem funções, sem segurança. |

O resultado: **times de negócio geram dezenas de sites com IA, mas IT vira gargalo**. Cada deploy precisa de aprovação, configuração de infra, abertura de firewall, criação de banco. O que deveria ser velocidade vira burocracia.

### Para times de IA e Inovação

Times que usam IA para gerar MVPs e protótipos enfrentam um problema específico: a IA gera código que **funciona**, mas não existe um ambiente controlado para colocar esse código em produção com:
- Isolamento entre sites
- Governança sobre o que está rodando
- Capacidade de atualizar sem rebuild
- Segurança para dados sensíveis

---

## A Solução

Port resolve isso com um modelo diferente:

1. **Upload único** — ZIP com `index.html` + assets. Sem build, sem CI, sem pipeline.
2. **Tudo incluso** — Cada deploy ganha automaticamente: static serving, banco PostgreSQL, blob storage, endpoint de AI, funções server-side, WebSocket, SDK.
3. **Isolamento por design** — Cada site roda em seu próprio schema de banco, seus próprios arquivos, sua própria worker thread. Um site não acessa os dados do outro.
4. **Governança** — Config público (visível ao frontend) vs config privada (só no backend). Admin dashboard para gerenciar todos os sites.
5. **Sem conhecimento de infra** — CLI simples (`port deploy .`) ou upload via UI. Docker compose para subir a plataforma inteira.

### Para quem é Port?

| Perfil | Como usa |
|--------|----------|
| **Time de Inovação** | Gera protótipos com IA, deploy em 10s, compartilha link com stakeholders |
| **Agência Digital** | Hospeda landing pages de clientes com funções server-side e banco inclusos |
| **Internal Tools** | Cria dashboards e CRUDs internos sem depender de DevOps |
| **Educação** | Alunos geram sites com IA e publicam instantaneamente em ambiente controlado |
| **Startup early-stage** | MVP rodando em minutos com DB + AI + storage sem pagar múltiplos serviços |

---

## Casos de Uso

### Landing Page com Formulário + Banco

IA gera uma landing page com formulário de contato. Com Port, os dados vão direto para um banco PostgreSQL dedicado. A equipe de marketing consulta os leads sem depender de IT.

### CRUD Administrativo

Time de operações gera um CRUD com IA. Port fornece funções server-side com validação, regras de negócio e acesso ao banco. Frontend chama via SDK.

### Chatbot com Histórico

Site com chat AI que salva conversas no banco do site. Config pública define o tema visual, config privada guarda a API key do LLM.

### Dashboard em Tempo Real

App que usa WebSocket para broadcast de eventos. Cada site tem seu próprio canal de realtime, isolado dos demais.

---

## O que Port NÃO é

- **Não é Vercel/Netlify** — não faz build, não tem CI, não otimiza assets. Você sobe o site pronto.
- **Não é um CMS** — não tem editor visual, não gerencia conteúdo. Você gerencia via código + config.
- **Não é um BaaS completo** — foca no essencial: DB, storage, AI, functions. Sem autenticação complexa, sem filas, sem cache distribuído.
- **Não é para qualquer aplicação** — sites estáticos com backend leve. Aplicações que precisam de GPU, streaming pesado, ou low-latency extremo têm limitações.

Port é **deliberadamente simples**. Resolve um problema específico bem, em vez de tentar ser tudo para todos.