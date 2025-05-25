import webview
from api import Api
from database import recreate_database


def main():
    api = Api()  
    recreate_database()

    window = webview.create_window(
        "Inventory Manager",
        "ui/index.html",  
        js_api=api,
        width=800,
        height=600,
        resizable=True
    )

    webview.start(debug=False)  

if __name__ == '__main__':
    main()
