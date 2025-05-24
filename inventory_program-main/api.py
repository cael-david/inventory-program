import sqlite3

import webview

DB_NAME = 'stock.db'

class Api:
    def __init__(self):
        pass

    def _connect(self):
        conn = sqlite3.connect(DB_NAME)
        conn.execute('PRAGMA foreign_keys = ON')
        return conn

    # --- Stocks ---
    def list_stocks(self):
        conn = self._connect()
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, description FROM stocks ORDER BY name")
        rows = cursor.fetchall()
        conn.close()
        return [{'id': r[0], 'name': r[1], 'description': r[2]} for r in rows]

    def add_stock(self, name, description=''):
        try:
            conn = self._connect()
            cursor = conn.cursor()
            cursor.execute("INSERT INTO stocks (name, description) VALUES (?, ?)", (name, description))
            conn.commit()
            conn.close()
            return {'success': True, 'message': 'Stock added successfully!'}
        except sqlite3.IntegrityError as e:
            return {'success': False, 'message': f'Error: {str(e)}'}

    def delete_stock(self, stock_id):
        try:
            conn = self._connect()
            cursor = conn.cursor()
            cursor.execute("DELETE FROM stocks WHERE id = ?", (stock_id,))
            conn.commit()
            conn.close()
            if cursor.rowcount == 0:
                return {'success': False, 'message': 'No stock found with the given ID.'}
            else:
                return {'success': True, 'message': 'Stock removed successfully!'}
        except sqlite3.Error as e:
            return {'success': False, 'message': f'Error: {str(e)}'}

    def get_stock_by_id(self, stock_id):
        conn = self._connect()
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, description FROM stocks WHERE id = ?", (stock_id,))
        row = cursor.fetchone()
        conn.close()
        if row:
            return {'id': row[0], 'name': row[1], 'description': row[2]}
        return None

    # --- Products ---
    def list_products(self):
        conn = self._connect()
        cursor = conn.cursor()
        cursor.execute("SELECT id, code, fraction, description FROM products ORDER BY code")
        rows = cursor.fetchall()
        conn.close()
        return [{'id': r[0], 'code': r[1], 'fraction': r[2], 'description': r[3]} for r in rows]

    def get_products_by_stock(self, stock_id):
        conn = self._connect()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT p.id, p.code, p.fraction, p.description
            FROM products p
            JOIN stock_entries se ON p.id = se.product_id
            WHERE se.stock_id = ?
            GROUP BY p.id, p.code, p.fraction, p.description
            ORDER BY 
                LENGTH(REPLACE(UPPER(p.code), ' ', '')) ASC,
                REPLACE(UPPER(p.code), ' ', '') ASC
        """, (stock_id,))
        rows = cursor.fetchall()
        conn.close()
        return [{'id': r[0], 'code': r[1], 'fraction': r[2], 'description': r[3]} for r in rows]

    def add_product(self, code, fraction='', description=''):
        try:
            conn = self._connect()
            cursor = conn.cursor()
            cursor.execute("INSERT INTO products (code, fraction, description) VALUES (?, ?, ?)",
                           (code, fraction, description))
            conn.commit()
            conn.close()
            return {'success': True, 'message': 'Product added successfully!'}
        except sqlite3.IntegrityError as e:
            return {'success': False, 'message': f'Error: {str(e)}'}

    def add_item_and_address_only(self, stock_id, code, fraction, description, quantity, street, session, shelf):
        try:
            conn = self._connect()
            cursor = conn.cursor()

            cursor.execute("""
                SELECT id FROM addresses
                WHERE street = ? AND session = ? AND shelf = ?
            """, (street, session, shelf))
            address = cursor.fetchone()
            if address:
                address_id = address[0]
            else:
                cursor.execute("INSERT INTO addresses (street, session, shelf) VALUES (?, ?, ?)",
                            (street, session, shelf))
                address_id = cursor.lastrowid

            cursor.execute("SELECT id FROM products WHERE code = ?", (code,))
            product = cursor.fetchone()
            if product:
                product_id = product[0]
            else:
                cursor.execute("INSERT INTO products (code, fraction, description) VALUES (?, ?, ?)",
                            (code, fraction, description))
                product_id = cursor.lastrowid

            cursor.execute("""
                INSERT INTO stock_entries (stock_id, product_id, address_id, quantity)
                VALUES (?, ?, ?, ?)
            """, (stock_id, product_id, address_id, quantity))

            conn.commit()
            conn.close()
            return {'success': True, 'message': 'Item/produto adicionado com sucesso!'}

        except sqlite3.IntegrityError as e:
            return {'success': False, 'message': f'Erro de integridade: {str(e)}'}
        except Exception as e:
            return {'success': False, 'message': f'Erro inesperado: {str(e)}'}

    def delete_product_only(self, product_id):
        try:
            conn = self._connect()
            cursor = conn.cursor()
            # Primeiro, pegar todos os address_id das stock_entries ligadas a este produto
            cursor.execute("SELECT DISTINCT address_id FROM stock_entries WHERE product_id = ?", (product_id,))
            address_ids = [row[0] for row in cursor.fetchall()]
            # Remove das entradas de estoque antes
            cursor.execute("DELETE FROM stock_entries WHERE product_id = ?", (product_id,))
            cursor.execute("DELETE FROM products WHERE id = ?", (product_id,))
            conn.commit()
            conn.close()
            # Para cada address_id, verificar e deletar se ficou órfão
            for address_id in address_ids:
                self.delete_address_if_orphan(address_id)
            if cursor.rowcount == 0:
                return {'success': False, 'message': 'No product found with the given ID.'}
            else:
                return {'success': True, 'message': 'Product removed successfully!'}
        except sqlite3.Error as e:
            return {'success': False, 'message': f'Error: {str(e)}'}

    # --- Stock Entries ---
    def list_entries(self):
        conn = self._connect()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT se.id, s.name, p.code, p.description, se.quantity, a.street, a.session, a.shelf, se.entry_date
            FROM stock_entries se
            JOIN stocks s ON se.stock_id = s.id
            JOIN products p ON se.product_id = p.id
            JOIN addresses a ON se.address_id = a.id
            ORDER BY se.entry_date DESC
        ''')
        rows = cursor.fetchall()
        conn.close()
        results = []
        for r in rows:
            results.append({
                'id': r[0],
                'stock_name': r[1],
                'product_code': r[2],
                'product_description': r[3],
                'quantity': r[4],
                'street': r[5],
                'session': r[6],
                'shelf': r[7],
                'entry_date': r[8]
            })
        return results

    # --- Addresses ---

    def get_addresses_by_stock(self, stock_id):
        conn = self._connect()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT a.id, a.street, a.session, a.shelf
            FROM addresses a
            JOIN stock_entries se ON a.id = se.address_id
            WHERE se.stock_id = ?
            GROUP BY a.id, a.street, a.session, a.shelf
            ORDER BY a.street, a.session, a.shelf
        """, (stock_id,))
        rows = cursor.fetchall()
        conn.close()
        return [{'id': r[0], 'street': r[1], 'session': r[2], 'shelf': r[3]} for r in rows]


    def list_addresses(self):
        conn = self._connect()
        cursor = conn.cursor()
        cursor.execute("SELECT id, street, session, shelf FROM addresses ORDER BY street, session, shelf")
        rows = cursor.fetchall()
        conn.close()
        return [{'id': r[0], 'street': r[1], 'session': r[2], 'shelf': r[3]} for r in rows]

    def delete_address_if_orphan(self, address_id):
        conn = self._connect()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM stock_entries WHERE address_id = ?", (address_id,))
        count = cursor.fetchone()[0]
        if count == 0:
            cursor.execute("DELETE FROM addresses WHERE id = ?", (address_id,))
            conn.commit()
        conn.close()

    # ====== LOTES ======
    def get_batches_by_product_id(self, product_id):
        conn = self._connect()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT b.id, b.bcode, b.quantity,
                IFNULL(SUM(se.quantity), 0) as total_estoque,
                b.entry_date
            FROM batches b
            JOIN stock_entries se ON b.id = se.batch_id
            WHERE se.product_id = ?
            GROUP BY b.id, b.bcode, b.quantity, b.entry_date
        ''', (product_id,))
        rows = cursor.fetchall()
        conn.close()
        return [
            {
                'id': r[0],
                'bcode': r[1],
                'quantity_original': r[2],
                'quantity_total': r[3],
                'entry_date': r[4]
            } for r in rows
        ]

    def add_batch_to_product(self, product_id, bcode, quantity, entry_date):
        try:
            conn = self._connect()
            cursor = conn.cursor()
            cursor.execute('''
                SELECT b.id FROM batches b
                JOIN stock_entries se ON b.id = se.batch_id
                WHERE se.product_id = ? AND b.bcode = ?
            ''', (product_id, bcode))
            exists = cursor.fetchone()
            if exists:
                conn.close()
                return {'success': False, 'message': 'Já existe um lote com esse código para este produto.'}

            cursor.execute("INSERT INTO batches (bcode, quantity, entry_date) VALUES (?, ?, ?)", (bcode, quantity, entry_date))
            batch_id = cursor.lastrowid

            cursor.execute("SELECT id, stock_id, address_id FROM stock_entries WHERE product_id = ? ORDER BY id DESC LIMIT 1", (product_id,))
            last_entry = cursor.fetchone()
            if last_entry:
                cursor.execute('''
                    INSERT INTO stock_entries (stock_id, product_id, batch_id, address_id, quantity)
                    VALUES (?, ?, ?, ?, ?)
                ''', (last_entry[1], product_id, batch_id, last_entry[2], quantity))
            else:
                conn.rollback()
                conn.close()
                return {'success': False, 'message': 'Produto ainda não possui entrada de estoque/endereço para associar o lote.'}
            conn.commit()
            conn.close()
            return {'success': True, 'message': 'Lote adicionado ao produto com sucesso!'}
        except sqlite3.Error as e:
            return {'success': False, 'message': f'Erro: {str(e)}'}

    def delete_batch(self, batch_id):
        try:
            conn = self._connect()
            cursor = conn.cursor()
            # Pega todos os address_id das stock_entries ligadas a esse lote
            cursor.execute("SELECT DISTINCT address_id FROM stock_entries WHERE batch_id = ?", (batch_id,))
            address_ids = [row[0] for row in cursor.fetchall()]
            # Remove entradas de estoque associadas
            cursor.execute("DELETE FROM stock_entries WHERE batch_id = ?", (batch_id,))
            # Remove o lote
            cursor.execute("DELETE FROM batches WHERE id = ?", (batch_id,))
            conn.commit()
            conn.close()
            # Para cada address_id, verifica se ficou órfão
            for address_id in address_ids:
                self.delete_address_if_orphan(address_id)
            if cursor.rowcount == 0:
                return {'success': False, 'message': 'Nenhum lote encontrado com o ID informado.'}
            else:
                return {'success': True, 'message': 'Lote removido com sucesso!'}
        except sqlite3.Error as e:
            return {'success': False, 'message': f'Erro: {str(e)}'}

    def get_batch_by_id(self, batch_id):
        conn = self._connect()
        cursor = conn.cursor()
        cursor.execute("SELECT id, bcode, quantity, entry_date FROM batches WHERE id = ?", (batch_id,))
        row = cursor.fetchone()
        conn.close()
        if row:
            return {'id': row[0], 'bcode': row[1], 'quantity': row[2], 'entry_date': row[3]}
        return None

    def update_batch(self, batch_id, new_bcode, new_quantity, new_entry_date):
        try:
            conn = self._connect()
            cursor = conn.cursor()
            cursor.execute("UPDATE batches SET bcode = ?, quantity = ?, entry_date = ? WHERE id = ?", (new_bcode, new_quantity, new_entry_date, batch_id))
            conn.commit()
            conn.close()
            if cursor.rowcount == 0:
                return {'success': False, 'message': 'Nenhum lote encontrado para atualizar.'}
            else:
                return {'success': True, 'message': 'Lote atualizado com sucesso!'}
        except sqlite3.Error as e:
            return {'success': False, 'message': f'Erro: {str(e)}'}
        

    def salvar_csv_em_dialogo(self, csv_content, suggested_filename='lista_estoque.csv'):
        """Abre um diálogo para o usuário escolher onde salvar o arquivo e salva o CSV lá"""
        window = webview.windows[0]  # pega a janela principal
        # Abre o diálogo para salvar arquivo
        path = window.create_file_dialog(
            webview.SAVE_DIALOG,
            save_filename=suggested_filename,
            file_types=('CSV Files (*.csv)', 'All files (*.*)')
        )
        if path:
            with open(path, 'w', encoding='utf-8', newline='') as f:
                f.write(csv_content)
            return {'success': True, 'path': path}
        return {'success': False, 'path': None}