import os
import time
import json
import re
from http.server import SimpleHTTPRequestHandler, HTTPServer
import threading
from PyPDF2 import PdfReader
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

# Configurações
DIRECTORY = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(DIRECTORY, "data.json")
OVERRIDES_FILE = os.path.join(DIRECTORY, "overrides.json")
PDF_PATTERN = re.compile(r".*\.pdf$", re.IGNORECASE)

def extract_text_from_pdf(pdf_path):
    try:
        reader = PdfReader(pdf_path)
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
        return text
    except Exception as e:
        print(f"Erro ao ler PDF {pdf_path}: {e}")
        return ""

def parse_repertoire(text):
    categories = []
    
    # Lista de nomes de categorias conhecidas baseadas no estudo do PDF
    category_names = [
        "Convite", "Celebração/Adoração/Louvor", "Consagração", 
        "Busca", "Contemplação/Adoração e Louvor", "Ceia", 
        "Comunhão", "Fé", "Clássicas"
    ]
    
    # Criar um padrão que encontre as categorias mesmo se estiverem grudadas em outro texto
    cat_pattern = r"(" + "|".join(re.escape(name) for name in category_names) + r")"
    
    # Quebrar o texto por categorias
    parts = re.split(cat_pattern, text)
    
    if len(parts) > 1:
        for i in range(1, len(parts), 2):
            cat_name = parts[i]
            content = parts[i+1] if i+1 < len(parts) else ""
            
            songs = []
            # Regex para capturar músicas numeradas: X. Nome (Artista)
            # Adaptado para texto que pode estar sem quebras de linha
            song_matches = re.finditer(r"(\d+)\.\s*([^\d]+?)(?:\((.+?)\))?\s*(?=\d+\.|$|\[NOVA\]|\[NOVA\*\])", content)
            
            for m in song_matches:
                title = m.group(2).strip()
                artist = m.group(3).strip() if m.group(3) else "Vários"
                # Limpar o título de eventuais restos
                title = re.sub(r"\[NOVA\*?\]", "", title).strip()
                
                songs.append({
                    "title": title,
                    "artist": artist,
                    "status": "NOVA" if "NOVA" in m.group(0) else "",
                    "query": f"{title} {artist}"
                })
            
            if songs:
                categories.append({"name": cat_name, "songs": songs})
                
    return categories

def sync():
    print("Sincronizando repertório...")
    all_categories = {}
    
    # Lista todos os PDFs na pasta
    for filename in os.listdir(DIRECTORY):
        if PDF_PATTERN.match(filename):
            path = os.path.join(DIRECTORY, filename)
            text = extract_text_from_pdf(path)
            cats = parse_repertoire(text)
            for cat in cats:
                if cat["name"] not in all_categories:
                    all_categories[cat["name"]] = []
                all_categories[cat["name"]].extend(cat["songs"])

    # Carrega overrides
    overrides = {}
    if os.path.exists(OVERRIDES_FILE):
        try:
            with open(OVERRIDES_FILE, 'r', encoding='utf-8') as f:
                overrides = json.load(f)
        except: pass

    # Monta JSON final
    final_data = []
    for name, songs in all_categories.items():
        # Aplicar overrides
        for song in songs:
            if song["title"] in overrides:
                song["url"] = overrides[song["title"]]
            else:
                # Se não tem override, gera link de busca
                song["url"] = f"https://www.youtube.com/embed?listType=search&list={song['query']}"
        
        final_data.append({
            "category": name,
            "items": songs
        })

    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(final_data, f, indent=4, ensure_ascii=False)
    
    print(f"Repertório atualizado em {DATA_FILE}")

class RepertoireHandler(FileSystemEventHandler):
    def on_modified(self, event):
        if event.src_path.endswith('.pdf') or event.src_path.endswith('overrides.json'):
            sync()
    def on_created(self, event):
        if event.src_path.endswith('.pdf'):
            sync()

def run_server():
    server_address = ('', 8000)
    httpd = HTTPServer(server_address, SimpleHTTPRequestHandler)
    print("Servidor rodando em http://localhost:8000")
    httpd.serve_forever()

if __name__ == "__main__":
    # Sincronização inicial
    sync()
    
    # Inicia Watcher
    observer = Observer()
    observer.schedule(RepertoireHandler(), DIRECTORY, recursive=False)
    observer.start()
    
    # Inicia Servidor em Thread separada
    server_thread = threading.Thread(target=run_server)
    server_thread.daemon = True
    server_thread.start()
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()
