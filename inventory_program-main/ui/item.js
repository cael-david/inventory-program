async function waitForApiReady(timeout = 5000) {
    const start = Date.now();
    while (!window.pywebview || !window.pywebview.api) {
        if (Date.now() - start > timeout) throw new Error('Timeout: PyWebView API not available');
        await new Promise(r => setTimeout(r, 100));
    }
}

function getIdFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

document.getElementById('btnVoltar').onclick = () => {
    window.history.back();
};

async function loadProductAndBatches() {
    await waitForApiReady();
    const id = getIdFromURL();
    if (!id) {
        document.getElementById('produtoTitulo').textContent = 'Product not found';
        return;
    }

    const products = await window.pywebview.api.list_products();
    const product = products.find(p => String(p.id) === id);
    if (!product) {
        document.getElementById('produtoTitulo').textContent = 'Product not found';
        return;
    }
    document.getElementById('produtoTitulo').textContent = `Code: ${product.code}`;
    document.getElementById('produtoDescricao').textContent = product.description || '';

    const batches = await window.pywebview.api.get_batches_by_product_id(product.id);
    let total = 0;
    batches.forEach(l => total += l.quantity_total);

    document.getElementById('produtoTotal').textContent = `Total: ${total}`;

    const listaLotes = document.getElementById('listaLotes');
    if (batches.length === 0) {
        listaLotes.innerHTML = '<li>No batches registered for this item.</li>';
    } else {
        listaLotes.innerHTML = batches.map(l => `
            <li>
                <strong>Batch:</strong> ${l.bcode} | 
                <strong>Original quantity:</strong> ${l.quantity_original} | 
                <strong>Current quantity:</strong> ${l.quantity_total} | 
                <strong>Entry:</strong> ${l.entry_date || '---'}
                <button class="btnEditarLote" data-lote-id="${l.id}">✏️ Edit</button>
                <button class="btnRemoverLote" data-lote-id="${l.id}">🗑️ Remove</button>
            </li>
        `).join('');
    }

    document.querySelectorAll('.btnEditarLote').forEach(btn => {
        btn.onclick = () => editBatch(btn.getAttribute('data-lote-id'));
    });
    document.querySelectorAll('.btnRemoverLote').forEach(btn => {
        btn.onclick = () => removeBatch(btn.getAttribute('data-lote-id'));
    });
}

document.getElementById('btnAdicionarLote').onclick = async () => {
    const productId = getIdFromURL();
    const bcode = prompt('Enter batch code:');
    if (!bcode) return;
    const quantity = parseInt(prompt('Enter batch quantity:'), 10);
    if (isNaN(quantity)) {
        alert('Invalid quantity.');
        return;
    }
    const entry_date = prompt('Enter batch entry date (exemple: 01/01/2000):');
    if (!entry_date) return;
    await waitForApiReady();
    const res = await window.pywebview.api.add_batch_to_product(productId, bcode, quantity, entry_date);
    alert(res.message);
    if (res.success) loadProductAndBatches();
};

async function editBatch(batchId) {
    await waitForApiReady();
    const batch = await window.pywebview.api.get_batch_by_id(batchId);
    const newBcode = prompt('New batch code:', batch.bcode);
    if (!newBcode) return;
    const newQuantity = parseInt(prompt('New quantity:', batch.quantity), 10);
    if (isNaN(newQuantity)) {
        alert('Invalid quantity.');
        return;
    }
    const newDate = prompt('New entry date:', batch.entry_date || '');
    if (!newDate) return;
    const res = await window.pywebview.api.update_batch(batchId, newBcode, newQuantity, newDate);
    alert(res.message);
    if (res.success) loadProductAndBatches();
}

async function removeBatch(batchId) {
    if (!confirm('Are you sure you want to remove this batch?')) return;
    await waitForApiReady();
    const res = await window.pywebview.api.delete_batch(batchId);
    alert(res.message);
    if (res.success) loadProductAndBatches();
}

window.onload = loadProductAndBatches;