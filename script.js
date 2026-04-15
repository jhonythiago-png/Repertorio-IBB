// Configurações Supabase
const SUPABASE_URL = "https://chjirzwxsewlhbnhpvjh.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoamlyend4c2V3bGhibmhwdmpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNTk1NDAsImV4cCI6MjA5MTgzNTU0MH0.tOz51eKBGv0thiZLRIeVv7qcIR8mFANuFJ4qHelPlRA";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let repertoireData = [];
const categoriesContainer = document.getElementById('categoriesContainer');
const searchResultsGrid = document.getElementById('searchResults');
const searchInput = document.getElementById('searchInput');
const modal = document.getElementById('videoModal');
const closeModal = document.querySelector('.close-modal');
const videoIframe = document.getElementById('videoIframe');
const header = document.getElementById('header');
const categoryOverlay = document.getElementById('categoryOverlay');
const categoryList = document.getElementById('categoryList');

// Categorias Fixas e Ordem Desejada
const FIXED_CATEGORIES = [
    "Novos",
    "Convite", 
    "Celebração/Adoração/Louvor", 
    "Consagração", 
    "Busca", 
    "Contemplação/Adoração e Louvor", 
    "Ceia", 
    "Comunhão", 
    "Fé", 
    "Clássicas"
];

// Carregar dados do Supabase
async function fetchData() {
    try {
        const { data, error } = await _supabase
            .from('songs')
            .select('*')
            .order('title', { ascending: true });

        if (error) throw error;

        // Agrupar músicas por categoria respeitando a ordem fixa
        const grouped = {};
        FIXED_CATEGORIES.forEach(cat => grouped[cat] = []);

        data.forEach(song => {
            if (song.categories && Array.isArray(song.categories)) {
                song.categories.forEach(cat => {
                    if (grouped[cat]) {
                        grouped[cat].push(song);
                    } else {
                        // Categoria nova não listada nas fixas
                        if (!grouped[cat]) grouped[cat] = [];
                        grouped[cat].push(song);
                    }
                });
            }
        });

        // Montar estrutura final apenas com categorias que têm músicas
        repertoireData = Object.keys(grouped)
            .filter(name => grouped[name].length > 0)
            .map(name => ({
                category: name,
                items: grouped[name]
            }));

        renderRepertoire(repertoireData);
        populateCategoryMenu();
        updateFooter();
    } catch (error) {
        console.error("Erro ao carregar dados do Supabase:", error);
        // Fallback para JSON local se o banco falhar (opcional)
    }
}

// Extrair Thumbnail
function getYouTubeThumbnail(song, quality = 'hqdefault') {
    if (song.vid_id) {
        return `https://img.youtube.com/vi/${song.vid_id}/${quality}.jpg`;
    }
    const url = song.url;
    if (!url) return 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?q=80&w=600&auto=format&fit=crop';
    
    const idMatch = url.match(/(?:v=|\/embed\/|youtu\.be\/|\/v\/|shorts\/)([^&?#/ ]+)/);
    if (idMatch && !url.includes('listType=search')) {
        return `https://img.youtube.com/vi/${idMatch[1]}/${quality}.jpg`;
    }
    return 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?q=80&w=600&auto=format&fit=crop';
}

function renderRepertoire(data) {
    categoriesContainer.innerHTML = '';
    categoriesContainer.style.display = 'block';
    searchResultsGrid.style.display = 'none';
    categoryOverlay.style.display = 'none';

    data.forEach(category => {
        if (category.items.length === 0) return;
        
        const row = document.createElement('div');
        row.className = 'category-row';
        row.innerHTML = `<h2>${category.category}</h2>`;
        
        const wrapper = document.createElement('div');
        wrapper.className = 'row-wrapper';
        
        const container = document.createElement('div');
        container.className = 'row-container';
        
        const prevBtn = document.createElement('button');
        prevBtn.className = 'nav-btn prev-btn';
        prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
        prevBtn.onclick = () => container.scrollBy({ left: -600, behavior: 'smooth' });
        
        const nextBtn = document.createElement('button');
        nextBtn.className = 'nav-btn next-btn';
        nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
        nextBtn.onclick = () => container.scrollBy({ left: 600, behavior: 'smooth' });
        
        category.items.forEach(song => {
            container.appendChild(createSongCard(song));
        });
        
        wrapper.appendChild(prevBtn);
        wrapper.appendChild(container);
        wrapper.appendChild(nextBtn);
        row.appendChild(wrapper);
        categoriesContainer.appendChild(row);
    });
}

function createSongCard(song) {
    const card = document.createElement('div');
    card.className = 'song-card';
    card.innerHTML = `
        <img src="${getYouTubeThumbnail(song)}" alt="${song.title}" loading="lazy">
        <div class="card-info">
            <h4>${song.title}</h4>
            <p>${song.artist || 'Vários'} ${song.status ? '• ' + song.status : ''}</p>
        </div>
    `;
    card.onclick = () => openVideo(song);
    return card;
}

function renderGrid(songs, title) {
    categoriesContainer.style.display = 'none';
    searchResultsGrid.innerHTML = `
        <div style="grid-column: 1/-1; margin-bottom: 20px;">
            <h2>${title}</h2>
        </div>
    `;
    searchResultsGrid.style.display = 'grid';
    document.getElementById('hero').style.display = 'none';
    categoryOverlay.style.display = 'none';

    songs.forEach(song => {
        searchResultsGrid.appendChild(createSongCard(song));
    });
}

// Preencher Menu de Categorias e Checkboxes
function populateCategoryMenu() {
    categoryList.innerHTML = '';
    const checkboxGrid = document.getElementById('categoryCheckboxes');
    if (checkboxGrid) checkboxGrid.innerHTML = '';

    const fixedCategories = [
        "Convite", "Celebração/Adoração/Louvor", "Consagração", 
        "Busca", "Contemplação/Adoração e Louvor", "Ceia", 
        "Comunhão", "Fé", "Clássicas", "Novos"
    ];

    fixedCategories.forEach(catName => {
        // Menu Overlay
        const item = document.createElement('div');
        item.className = 'category-item';
        item.textContent = catName;
        item.onclick = () => {
            const songs = repertoireData.find(c => c.category === catName)?.items || [];
            renderGrid(songs, catName);
            categoryOverlay.style.display = 'none';
        };
        categoryList.appendChild(item);

        // Cadastro Modal
        if (checkboxGrid) {
            const label = document.createElement('label');
            label.className = 'checkbox-item';
            label.innerHTML = `<input type="checkbox" name="category" value="${catName}"> ${catName}`;
            checkboxGrid.appendChild(label);
        }
    });
}

// Abrir Vídeo
function openVideo(song) {
    document.getElementById('modalTitle').textContent = song.title;
    document.getElementById('modalArtist').textContent = song.artist || 'Vários';
    videoIframe.src = song.url || '';
    modal.style.display = 'block';

    // Resetar painel de edição
    const urlEditorPanel = document.getElementById('urlEditorPanel');
    const newUrlInput = document.getElementById('newUrlInput');
    urlEditorPanel.style.display = 'none';
    newUrlInput.value = song.url || '';

    // Botão Editar Versão → toggle do painel
    const editBtn = document.getElementById('editUrlBtn');
    editBtn.onclick = () => {
        const isVisible = urlEditorPanel.style.display !== 'none';
        urlEditorPanel.style.display = isVisible ? 'none' : 'block';
        if (!isVisible) newUrlInput.focus();
    };

    // Botão Cancelar
    document.getElementById('cancelUrlBtn').onclick = () => {
        urlEditorPanel.style.display = 'none';
        newUrlInput.value = song.url || '';
    };

    // Botão Salvar
    document.getElementById('saveUrlBtn').onclick = async () => {
        const newUrl = newUrlInput.value.trim();
        if (!newUrl) {
            alert('Por favor, cole uma URL válida!');
            return;
        }

        const idMatch = newUrl.match(/(?:v=|\/embed\/|youtu\.be\/|\/v\/|shorts\/)([^&?#/ ]+)/);
        const newVidId = idMatch ? idMatch[1] : null;
        const finalUrl = newVidId ? `https://www.youtube.com/embed/${newVidId}` : newUrl;

        document.getElementById('saveUrlBtn').textContent = 'Salvando...';

        try {
            const { error } = await _supabase
                .from('songs')
                .update({ url: finalUrl, vid_id: newVidId })
                .eq('title', song.title);

            if (error) throw error;

            // Atualiza player na hora
            videoIframe.src = finalUrl;
            song.url = finalUrl;
            song.vid_id = newVidId;
            urlEditorPanel.style.display = 'none';
            document.getElementById('saveUrlBtn').innerHTML = '<i class="fas fa-save"></i> Salvar';
            alert('✅ URL atualizada com sucesso!');
            fetchData();
        } catch (err) {
            document.getElementById('saveUrlBtn').innerHTML = '<i class="fas fa-save"></i> Salvar';
            alert('Erro ao salvar: ' + err.message);
        }
    };
}

// Cadastro de Música
const addSongModal = document.getElementById('addSongModal');
const addSongBtn = document.getElementById('addSongBtn');
const closeAddModal = document.querySelector('.close-add-modal');
const addSongForm = document.getElementById('addSongForm');

if (addSongBtn) {
    addSongBtn.onclick = () => {
        addSongModal.style.display = 'block';
    };
}

if (closeAddModal) {
    closeAddModal.onclick = () => {
        addSongModal.style.display = 'none';
    };
}

if (addSongForm) {
    addSongForm.onsubmit = async (e) => {
        e.preventDefault();
        const title = document.getElementById('addTitle').value;
        const artist = document.getElementById('addArtist').value;
        const url = document.getElementById('addUrl').value;
        const checkedCats = Array.from(document.querySelectorAll('input[name="category"]:checked')).map(cb => cb.value);

        if (checkedCats.length === 0) {
            alert("Selecione pelo menos uma categoria!");
            return;
        }

        const idMatch = url.match(/(?:v=|\/embed\/|youtu\.be\/|\/v\/|shorts\/)([^&?#/ ]+)/);
        const vidId = idMatch ? idMatch[1] : null;

        try {
            const { error } = await _supabase
                .from('songs')
                .upsert({ 
                    title, 
                    artist, 
                    url: url ? `https://www.youtube.com/embed/${vidId}` : null, 
                    vid_id: vidId, 
                    categories: checkedCats,
                    status: checkedCats.includes('Novos') ? 'NOVA' : ''
                }, { onConflict: 'title' });

            if (error) throw error;
            alert("Louvor cadastrado!");
            addSongModal.style.display = 'none';
            addSongForm.reset();
            fetchData();
        } catch (err) {
            alert("Erro ao cadastrar: " + err.message);
        }
    };
}

// Menu Mobile
const menuToggle = document.getElementById('menuToggle');
const navbar = document.getElementById('navbar');

if (menuToggle) {
    menuToggle.onclick = () => {
        navbar.classList.toggle('active');
    };
}

// Search Logic
searchInput.oninput = (e) => {
    const term = e.target.value.toLowerCase().trim();
    if (term === "") {
        resetView();
        return;
    }
    const allSongs = repertoireData.flatMap(cat => cat.items);
    // Remover duplicatas de busca (se a música estiver em várias categorias)
    const uniqueSongs = Array.from(new Set(allSongs.map(s => s.title)))
        .map(title => allSongs.find(s => s.title === title));

    const filtered = uniqueSongs.filter(song => 
        song.title.toLowerCase().includes(term) || 
        (song.artist && song.artist.toLowerCase().includes(term))
    );
    renderGrid(filtered, `Resultados para: "${term}"`);
};

function resetView() {
    renderRepertoire(repertoireData);
    document.getElementById('hero').style.display = 'flex';
    document.querySelectorAll('nav a').forEach(a => a.classList.remove('active'));
    document.getElementById('homeNav').classList.add('active');
    searchInput.value = '';
    categoryOverlay.style.display = 'none';
}

function updateFooter() {
    const footer = document.querySelector('footer');
    if (footer) {
        footer.innerHTML = `<p class="footer-dev">Desenvolvido por Jhony Beraldo</p>`;
    }
}

// Nav Listeners
document.getElementById('homeNav').onclick = (e) => { e.preventDefault(); resetView(); };
document.getElementById('categoriesNav').onclick = (e) => {
    e.preventDefault();
    categoryOverlay.style.display = 'block';
    document.getElementById('hero').style.display = 'none';
    categoriesContainer.style.display = 'none';
    searchResultsGrid.style.display = 'none';
};
document.getElementById('newNav').onclick = (e) => {
    e.preventDefault();
    const songs = repertoireData.find(c => c.category === "Novos")?.items || [];
    renderGrid(songs, "Novos Lançamentos");
};

// Modal Close logic
closeModal.onclick = () => {
    modal.style.display = 'none';
    videoIframe.src = '';
};

window.onclick = (event) => {
    if (event.target == modal) closeModal.onclick();
    if (event.target == categoryOverlay) { categoryOverlay.style.display = 'none'; resetView(); }
    if (event.target == addSongModal) addSongModal.style.display = 'none';
};

window.onscroll = () => {
    if (window.scrollY > 50) header.classList.add('scrolled');
    else header.classList.remove('scrolled');
};

// Start
fetchData();
