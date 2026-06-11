// Funções RPC — rodam no servidor (worker thread)
// Cada export vira uma função chamável via port.functions.itens.*

/**
 * Cria um item com validação server-side
 */
export async function create({ name, price }, { port, userId }) {
  // Validação
  if (!name || name.length < 2) {
    throw new Error('Nome precisa ter pelo menos 2 caracteres');
  }
  if (price === undefined || price < 0) {
    throw new Error('Preço inválido');
  }

  // Usa a SDK do Port no servidor
  const item = await port.db.collection('itens').create({
    name,
    price,
    owner: userId,
    created_at: new Date().toISOString(),
  });

  return item;
}

/**
 * Lista itens com filtro opcional
 */
export async function list({ owner }, { port }) {
  const result = await port.db.collection('itens').list();

  if (owner) {
    result.docs = result.docs.filter(d => d.owner === owner);
    result.total = result.docs.length;
  }

  return result;
}

/**
 * Deleta um item (só o dono)
 */
export async function remove({ id }, { port, userId }) {
  if (!id) throw new Error('ID é obrigatório');

  // Busca o item pra verificar ownership
  const result = await port.db.collection('itens').list();
  const item = result.docs.find(d => d.id === id);

  if (!item) throw new Error('Item não encontrado');
  if (item.owner !== userId) throw new Error('Só o criador pode deletar este item');

  await port.db.collection('itens').delete(id);
  return { ok: true };
}

/**
 * Busca um item específico
 */
export async function get({ id }, { port }) {
  if (!id) throw new Error('ID é obrigatório');
  return port.db.collection('itens').get(id);
}
