async function waitForApiReady(timeout = 5000) {
    const start = Date.now();
    while (!window.pywebview || !window.pywebview.api) {
        if (Date.now() - start > timeout) {
            throw new Error('Timeout: PyWebView API not available');
        }
        await new Promise(r => setTimeout(r, 100));
    }
}

function getStockIdFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

async function loadStockInfo() {
    const nameElem = document.getElementById('nomeEstoque');
    const descElem = document.getElementById('descricaoEstoque');
    const stockId = getStockIdFromURL();

    if (!stockId) {
        nameElem.textContent = "No warehouse selected";
        descElem.textContent = "";
        return;
    }
    try {
        await waitForApiReady();
        const stock = await window.pywebview.api.get_stock_by_id(parseInt(stockId));
        if (stock) {
            nameElem.textContent = stock.name;
            descElem.textContent = stock.description || "No description.";
        } else {
            nameElem.textContent = "Warehouse not found";
            descElem.textContent = "";
        }
    } catch (err) {
        nameElem.textContent = "Error loading warehouse";
        descElem.textContent = "";
        console.error(err);
    }
}

document.getElementById('btnVoltar').addEventListener('click', () => {
    window.location.href = 'index.html';
});

let itemList = [];

document.getElementById('btnLista').addEventListener('click', async () => {
    const resultado = document.getElementById('resultado');
    resultado.innerHTML = `
        <h2>My Item List</h2>
        <button id="btnExportarExcel" type="button">Export to Excel</button>
        <ul id="itensAdicionadosLista" class="lista-produtos"></ul>
        <input type="text" id="inputPesquisaProduto" placeholder="Search by code or description..." autocomplete="off"/>
        <ul id="listaPesquisaLista" class="lista-produtos"></ul>
    `;

    updateAddedList();

    const inputPesquisa = document.getElementById('inputPesquisaProduto');
    const listaResultados = document.getElementById('listaPesquisaLista');

    inputPesquisa.addEventListener('input', async function() {
        const termo = this.value.trim().toLowerCase();
        listaResultados.innerHTML = '';
        if (termo.length < 2) {
            return;
        }
        try {
            await waitForApiReady();
            const products = await window.pywebview.api.list_products();
            const addedIds = new Set(itemList.map(i => i.id));
            const filtered = products.filter(p =>
                !addedIds.has(p.id) &&
                ((p.code && p.code.toLowerCase().includes(termo)) ||
                 (p.description && p.description.toLowerCase().includes(termo)))
            );
            if (filtered.length === 0) {
                listaResultados.innerHTML = '<li class="nenhum-item">No items found.</li>';
                return;
            }
            listaResultados.innerHTML = filtered.map(p => `
                <li class="item-produto">
                    <button 
                        class="btnItemProduto"
                        type="button"
                        style="pointer-events:none;">
                        <strong>Code:</strong> ${p.code} 
                        <span class="item-desc">${p.description ?? ''}</span>
                    </button>
                    <button class="btnAdicionarLista" data-produto-id="${p.id}" type="button">Add to list</button>
                </li>
            `).join('');

            document.querySelectorAll('.btnAdicionarLista').forEach(btn => {
                btn.addEventListener('click', function() {
                    const productId = Number(this.getAttribute('data-produto-id'));
                    const product = filtered.find(p => p.id === productId);
                    if (product && !itemList.some(i => i.id === product.id)) {
                        itemList.push(product);
                        updateAddedList();
                        inputPesquisa.value = "";
                        listaResultados.innerHTML = "";
                        inputPesquisa.focus();
                    }
                });
            });
        } catch (err) {
            listaResultados.innerHTML = '<li class="erro-busca">Error searching items.</li>';
            console.error(err);
        }
    });

    function updateAddedList() {
        const ul = document.getElementById('itensAdicionadosLista');
        if (!ul) return;
        ul.innerHTML = itemList.length === 0
            ? '<li class="nenhum-item">No items added yet.</li>'
            : itemList.map(p => `
                <li class="item-produto">
                    <button 
                        class="btnItemProduto"
                        type="button"
                        style="pointer-events:none;">
                        <strong>Code:</strong> ${p.code}
                        <span class="item-desc">${p.description ?? ''}</span>
                    </button>
                    <button class="btnRemoverLista" data-produto-id="${p.id}" type="button" title="Remove from list">Remove</button>
                </li>
            `).join('');
        ul.querySelectorAll('.btnRemoverLista').forEach(btn => {
            btn.addEventListener('click', function() {
                const productId = Number(this.getAttribute('data-produto-id'));
                itemList = itemList.filter(i => i.id !== productId);
                updateAddedList();
            });
        });
    }

    document.getElementById('btnExportarExcel').addEventListener('click', async () => {
        if (itemList.length === 0) {
            alert('No items in the list to export.');
            return;
        }
        await waitForApiReady();

        const stockId = getStockIdFromURL();
        if (!stockId) {
            alert('Warehouse not selected!');
            return;
        }

        const allEntries = await window.pywebview.api.list_entries();
        const stockName = document.getElementById('nomeEstoque').textContent;

        const itemDetails = [];
        let maxAddresses = 0;

        for (const item of itemList) {
            const entries = allEntries.filter(e =>
                e.product_code === item.code &&
                String(e.stock_name) === String(stockName)
            );
            const totalQuantity = entries.reduce((sum, e) => sum + (e.quantity || 0), 0);

            const addresses = [];
            const addressesSet = new Set();
            for (const ent of entries) {
                const address = [ent.street, ent.session, ent.shelf].filter(Boolean).join('-');
                if (address && !addressesSet.has(address)) {
                    addressesSet.add(address);
                    addresses.push(address);
                }
            }
            if (addresses.length > maxAddresses) maxAddresses = addresses.length;

            itemDetails.push({
                code: item.code ?? '',
                description: item.description ?? '',
                fraction: item.fraction ?? '',
                quantity: totalQuantity,
                addresses
            });
        }

        let header = ["Code", "Description", "Fraction", "Total Quantity"];
        for (let i = 1; i <= maxAddresses; i++) {
            header.push(`Address ${i}`);
        }

        let rows = [header];
        for (const item of itemDetails) {
            let row = [
                item.code,
                item.description,
                item.fraction,
                item.quantity
            ];
            for (let i = 0; i < maxAddresses; i++) {
                row.push(item.addresses[i] ?? "");
            }
            rows.push(row);
        }

        const csv = rows.map(row =>
            row.map(value => {
                if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return value;
            }).join(',')
        ).join('\r\n');

        const res = await window.pywebview.api.salvar_csv_em_dialogo(csv, "warehouse_list.csv");
        if (res.success) {
            alert("File saved at:\n" + res.path);
        } else {
            alert("File not saved.");
        }
    });
});

document.getElementById('btnEnderecos').addEventListener('click', async () => {
    const resultado = document.getElementById('resultado');
    resultado.textContent = 'Loading addresses...';
    try {
        await waitForApiReady();
        const stockId = getStockIdFromURL();
        const addresses = await window.pywebview.api.get_addresses_by_stock(parseInt(stockId));
        if (!addresses.length) {
            resultado.textContent = 'No addresses found.';
            return;
        }
        resultado.innerHTML = `
            <h2>Addresses</h2>
            <ul>
                ${addresses.map(e => `<li><strong>Street:</strong> ${e.street} | <strong>Session:</strong> ${e.session} | <strong>Shelf:</strong> ${e.shelf}</li>`).join('')}
            </ul>
        `;
    } catch (err) {
        resultado.textContent = 'Error loading addresses.';
        console.error(err);
    }
});

document.getElementById('btnItens').addEventListener('click', async () => {
    const resultado = document.getElementById('resultado');
    resultado.innerHTML = 'Loading items/products...';

    try {
        await waitForApiReady();
        const stockId = getStockIdFromURL();
        const products = await window.pywebview.api.get_products_by_stock(parseInt(stockId));
        let html = `
            <h2>Items/Products</h2>
            <div id="formularioAdicionar" style="display:none;"></div>
            <input type="text" id="inputPesquisaProduto" placeholder="Search by code or description..." />
            <button id="btnAdicionarProduto" type="button">Add Item</button>
            <ul id="listaProdutos" class="lista-produtos">
                ${
                    products.map(p => 
                        `<li class="item-produto">
                            <button 
                                class="btnItemProduto" 
                                data-produto-id="${p.id}" 
                                data-produto-codigo="${p.code.toLowerCase()}" 
                                data-produto-descricao="${(p.description ?? '').toLowerCase()}">
                                <strong>Code:</strong> ${p.code} 
                                <span class="item-desc">${p.description ?? ''}</span>
                            </button>
                            <button class="btnExcluirItem" data-produto-id="${p.id}" type="button">🗑️</button>
                        </li>`
                    ).join('')
                }
            </ul>
        `;
        resultado.innerHTML = html;

        document.getElementById('btnAdicionarProduto').addEventListener('click', () => {
            showAddForm();
        });

        const inputPesquisa = document.getElementById('inputPesquisaProduto');
        inputPesquisa.addEventListener('input', function() {
            const termo = this.value.trim().toLowerCase();
            document.querySelectorAll('#listaProdutos .item-produto').forEach(li => {
                const btn = li.querySelector('.btnItemProduto');
                const code = btn.getAttribute('data-produto-codigo');
                const description = btn.getAttribute('data-produto-descricao');
                if (
                    code.includes(termo) ||
                    description.includes(termo)
                ) {
                    li.style.display = '';
                } else {
                    li.style.display = 'none';
                }
            });
        });

        document.querySelectorAll('.btnItemProduto').forEach(btn => {
            btn.addEventListener('click', function() {
                const productId = this.getAttribute('data-produto-id');
                window.location.href = `item.html?id=${encodeURIComponent(productId)}`;
            });
        });

        document.querySelectorAll('.btnExcluirItem').forEach(btn => {
            btn.addEventListener('click', async function() {
                const productId = this.getAttribute('data-produto-id');
                const confirm1 = confirm('Are you sure you want to delete this item/product?');
                if (confirm1) {
                    const confirm2 = confirm('This action cannot be undone. Are you REALLY sure?');
                    if (confirm2) {
                        try {
                            await waitForApiReady();
                            const res = await window.pywebview.api.delete_product_only(parseInt(productId));
                            alert(res.message);
                            if (res.success) {
                                document.getElementById('btnItens').click();
                            }
                        } catch (err) {
                            alert('Error deleting item/product.');
                            console.error(err);
                        }
                    }
                }
            });
        });

    } catch (err) {
        resultado.textContent = 'Error loading items/products.';
        console.error(err);
    }
});

function showAddForm() {
    const formDiv = document.getElementById('formularioAdicionar');
    formDiv.innerHTML = `
        <h3>Add New Item/Product</h3>
        <form id="formAdicionarItem">
            <div class="campos-formulario">
                <label>Product Code:
                    <input type="text" id="novoCodigo" required>
                </label>
                <label>Fraction:
                    <input type="text" id="novaFracao">
                </label>
                <label>Description:
                    <input type="text" id="novaDescricao">
                </label>
                <label>Address - Street:
                    <input type="text" id="novaRua" required>
                </label>
                <label>Address - Session:
                    <input type="text" id="novaSessao" required>
                </label>
                <label>Address - Shelf:
                    <input type="text" id="novaPrateleira" required>
                </label>
            </div>
            <div class="botoes-formulario">
                <button type="submit">Save Item</button>
                <button type="button" id="btnCancelarAdicionar">Cancel</button>
            </div>
        </form>
    `;
    formDiv.style.display = 'block';

    document.getElementById('btnCancelarAdicionar').addEventListener('click', () => {
        formDiv.style.display = 'none';
        formDiv.innerHTML = '';
    });

    document.getElementById('formAdicionarItem').addEventListener('submit', async (e) => {
        e.preventDefault();
        const code = document.getElementById('novoCodigo').value.trim();
        const fraction = document.getElementById('novaFracao').value.trim();
        const description = document.getElementById('novaDescricao').value.trim();
        const street = document.getElementById('novaRua').value.trim();
        const session = document.getElementById('novaSessao').value.trim();
        const shelf = document.getElementById('novaPrateleira').value.trim();
        const stockId = getStockIdFromURL();

        if (!code || !street || !session || !shelf || !stockId) {
            alert('Fill in all required fields.');
            return;
        }

        try {
            await waitForApiReady();
            const res = await window.pywebview.api.add_item_and_address_only(
                parseInt(stockId),
                code,
                fraction,
                description,
                1, // quantity fixo como 1
                street,
                session,
                shelf
            );
            alert(res.message);
            if (res.success) {
                formDiv.style.display = 'none';
                formDiv.innerHTML = '';
                document.getElementById('btnItens').click();
            }
        } catch (err) {
            alert('Error adding item/product.');
            console.error(err);
        }
    });
}

window.onload = loadStockInfo;