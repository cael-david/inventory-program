import sqlite3

DB_NAME = 'stock.db'

def recreate_database():
    conn = sqlite3.connect(DB_NAME)
    conn.execute('PRAGMA foreign_keys = ON')
    cursor = conn.cursor()

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS stocks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT
    )
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL,
        fraction TEXT,
        description TEXT
    )
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bcode TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        entry_date TEXT NOT NULL
    )
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS addresses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        street TEXT NOT NULL,
        session TEXT NOT NULL,
        shelf TEXT NOT NULL
    )
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS stock_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stock_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        batch_id INTEGER,
        address_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        entry_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (stock_id) REFERENCES stocks(id),
        FOREIGN KEY (product_id) REFERENCES products(id),
        FOREIGN KEY (batch_id) REFERENCES batches(id),
        FOREIGN KEY (address_id) REFERENCES addresses(id)
    )
    ''')

    conn.commit()
    conn.close()
    # print("Banco de dados recriado com sucesso!")

recreate_database()