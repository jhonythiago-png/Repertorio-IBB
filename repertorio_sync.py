import os
import time
import json
import re
import requests
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
    category_names = [
        "Convite", "Celebração/Adoração/Louvor", "Consagração", 
        "Busca", "Contemplação/Adoração e Louvor", "Ceia", 
        "Comunhão", "Fé", "Clássicas"
    ]
    
    cat_pattern = r"(" + "|".join(re.escape(name) for name in category_names) + r")"
    text = re.sub(r"REPERTÓRIO 2024-2", "", text)
    parts = re.split(cat_pattern, text)
    
    if len(parts) > 1:
        for i in range(1, len(parts), 2):
            cat_name = parts[i]
            content = parts[i+1] if i+1 < len(parts) else ""
            songs = []
            
            # Regex melhorada para capturar músicas numeradas
            matches = re.finditer(r"(\d+)\.\s*(.+?)(?=\d+\.|$)", content, re.DOTALL)
            
            for m in matches:
                full_text = m.group(2).strip()
                status = ""
                # Detectar [NOVA] em qualquer lugar do texto da música
                if "[NOVA]" in full_text.upper() or "[NOVA*]" in full_text.upper():
                    status = "NOVA"
                    full_text = re.sub(r"\[NOVA\*?\]", "", full_text, flags=re.IGNORECASE).strip()
                
                title = full_text
                artist = "Vários"
                artist_match = re.search(r"\((.+?)\)", full_text)
                if artist_match:
                    artist = artist_match.group(1).strip()
                    title = full_text.replace(artist_match.group(0), "").strip()
                
                songs.append({
                    "title": title,
                    "artist": artist,
                    "status": status,
                    "query": f"{title} {artist}"
                })
            
            if songs:
                categories.append({"name": cat_name, "songs": songs})
                
    return categories

def get_youtube_id(query):
    """Busca o ID real do vídeo no YouTube."""
    try:
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"}
        search_query = query.replace(' ', '+')
        url = f"https://www.youtube.com/results?search_query={search_query}"
        response = requests.get(url, headers=headers, timeout=10)
        
        matches = re.findall(r"\"videoId\":\"(.*?)\"", response.text)
        if matches:
            for vid in matches:
                if len(vid) == 11:
                    return vid
    except Exception as e:
        print(f"Erro ao buscar ID para {query}: {e}")
    return None

def sync():
    print("Sincronizando repertório...")
    all_categories = {}
    
    for filename in os.listdir(DIRECTORY):
        if PDF_PATTERN.match(filename):
            path = os.path.join(DIRECTORY, filename)
            text = extract_text_from_pdf(path)
            cats = parse_repertoire(text)
            for cat in cats:
                if cat["name"] not in all_categories:
                    all_categories[cat["name"]] = []
                all_categories[cat["name"]].extend(cat["songs"])

    overrides = {}
    if os.path.exists(OVERRIDES_FILE):
        try:
            with open(OVERRIDES_FILE, 'r', encoding='utf-8') as f:
                overrides = json.load(f)
        except: pass

    cache = {}
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                old_data = json.load(f)
                for cat in old_data:
                    for item in cat["items"]:
                        if item.get("vid_id"):
                            cache[item["title"]] = item["vid_id"]
        except: pass

    final_data = []
    total_songs = 0
    for name, songs in all_categories.items():
        processed_songs = []
        for song in songs:
            total_songs += 1
            vid_id = None
            raw_url = overrides.get(song["title"])
            if raw_url:
                id_m = re.search(r"(?:v=|\/embed\/|youtu\.be\/|\/v\/|shorts\/)([^&?#/ ]+)", raw_url)
                if id_m: vid_id = id_m.group(1)
            
            if not vid_id:
                vid_id = cache.get(song["title"])
                if not vid_id:
                    print(f"Buscando ID ({total_songs}): {song['query']}")
                    vid_id = get_youtube_id(song["query"])
                    if vid_id: cache[song["title"]] = vid_id
                    time.sleep(0.5) # Evitar bloqueio
            
            if vid_id:
                song["vid_id"] = vid_id
                song["url"] = f"https://www.youtube.com/embed/{vid_id}"
            else:
                song["url"] = f"https://www.youtube.com/embed?listType=search&list={song['query']}"
            
            processed_songs.append(song)
        
        final_data.append({"category": name, "items": processed_songs})

    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(final_data, f, indent=4, ensure_ascii=False)
    
    print(f"Sincronismo concluído: {total_songs} louvores identificados.")

class RepertoireHandler(FileSystemEventHandler):
    def on_modified(self, event):
        if event.src_path.endswith('.pdf') or event.src_path.endswith('overrides.json'):
            sync()

class CustomHandler(SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/update_override':
            content_length = int(self.headers['Content-Length'])
            data = json.loads(self.rfile.read(content_length).decode('utf-8'))
            title, url = data.get('title'), data.get('url')
            if title and url:
                overrides = {}
                if os.path.exists(OVERRIDES_FILE):
                    with open(OVERRIDES_FILE, 'r', encoding='utf-8') as f:
                        overrides = json.load(f)
                overrides[title] = url
                with open(OVERRIDES_FILE, 'w', encoding='utf-8') as f:
                    json.dump(overrides, f, indent=4, ensure_ascii=False)
                sync()
                self.send_response(200); self.end_headers(); self.wfile.write(b'{"status":"success"}')
        else: self.send_response(404); self.end_headers()

    def do_OPTIONS(self):
        self.send_response(200); self.send_header('Access-Control-Allow-Origin', '*'); self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS'); self.send_header('Access-Control-Allow-Headers', 'Content-Type'); self.end_headers()

def run_server():
    HTTPServer(('', 8000), CustomHandler).serve_forever()

if __name__ == "__main__":
    sync()
    observer = Observer()
    observer.schedule(RepertoireHandler(), DIRECTORY, recursive=False)
    observer.start()
    threading.Thread(target=run_server, daemon=True).start()
    print("Servidor em http://localhost:8000")
    try:
        while True: time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()
