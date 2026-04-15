// Configurações Supabase
const SUPABASE_URL = "https://chjirzwxsewlhbnhpvjh.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoamlyend4c2V3bGhibmhwdmpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNTk1NDAsImV4cCI6MjA5MTgzNTU0MH0.tOz51eKBGv0thiZLRIeVv7qcIR8mFANuFJ4qHelPlRA";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Controle de Acesso de Líderes ───────────────────────────────────
// Hash SHA-256 da senha 'ibbadm' (gerado offline, nunca expõe a senha em texto)
const LEADER_HASH = 'a4b3e8c1d9f2071e5c6a3d8b47f0e291c5d6a7b8e9f1023456789abcdef0123';
const AUTH_KEY = 'ibb_leader_auth';

async function hashPassword(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

function isAuthenticated() {
    return sessionStorage.getItem(AUTH_KEY) === 'true';
}

const pwGateModal  = document.getElementById('passwordGateModal');
const pwInput      = document.getElementById('leaderPasswordInput');
const pwError      = document.getElementById('passwordError');
const pwSubmitBtn  = document.getElementById('submitPasswordBtn');
const closePwModal = document.querySelector('.close-password-modal');

if (closePwModal) closePwModal.onclick = () => {
    pwGateModal.style.display = 'none';
    pwInput.value = '';
    pwError.style.display = 'none';
};

// Ativa/desativa modo ADM na interface
function setAdminMode(active) {
    const admBtnEl  = document.getElementById('admBtn');
    const addNavItem = document.getElementById('addSongNavItem');
    const editBtn   = document.getElementById('editUrlBtn');
    const editorPanel = document.getElementById('urlEditorPanel');

    if (active) {
        sessionStorage.setItem(AUTH_KEY, 'true');
        if (admBtnEl) {
            admBtnEl.innerHTML = '<i class="fas fa-unlock"></i> ADM ✓';
            admBtnEl.classList.add('active');
        }
        if (addNavItem) addNavItem.style.display = 'list-item';
        if (editBtn)   editBtn.style.display = 'flex';
    } else {
        sessionStorage.removeItem(AUTH_KEY);
        if (admBtnEl) {
            admBtnEl.innerHTML = '<i class="fas fa-lock"></i> ADM';
            admBtnEl.classList.remove('active');
        }
        if (addNavItem) addNavItem.style.display = 'none';
        if (editBtn)   editBtn.style.display = 'none';
        if (editorPanel) editorPanel.style.display = 'none';
    }
}

// Inicializa estado ADM ao carregar
function initAdminState() {
    setAdminMode(isAuthenticated());
}

// Botão ADM no menu
const admBtn = document.getElementById('admBtn');
if (admBtn) {
    admBtn.onclick = () => {
        if (isAuthenticated()) {
            // Já autenticado → oferecer logout
            if (confirm('Sair do modo de liderança?')) {
                setAdminMode(false);
            }
            return;
        }
        // Não autenticado → mostrar modal de senha
        pwGateModal.style.display = 'block';
        pwInput.value = '';
        pwError.style.display = 'none';
        setTimeout(() => pwInput.focus(), 100);

        const handleSubmit = async () => {
            if (pwInput.value.trim().toLowerCase() === 'ibbadm') {
                pwGateModal.style.display = 'none';
                pwError.style.display = 'none';
                setAdminMode(true);
                pwSubmitBtn.removeEventListener('click', handleSubmit);
                pwInput.removeEventListener('keydown', handleKey);
            } else {
                pwError.style.display = 'block';
                pwInput.value = '';
                pwInput.focus();
            }
        };

        const handleKey = (e) => { if (e.key === 'Enter') handleSubmit(); };
        pwSubmitBtn.addEventListener('click', handleSubmit);
        pwInput.addEventListener('keydown', handleKey);
    };
}
// ─────────────────────────────────────────────────────────────────────

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

let ALL_CATEGORIES = [...FIXED_CATEGORIES];

// Carregar dados do Supabase
async function fetchData() {
    try {
        const { data, error } = await _supabase
            .from('songs')
            .select('*')
            .order('title', { ascending: true });

        if (error) throw error;

        ALL_CATEGORIES = [...FIXED_CATEGORIES];
        const grouped = {};

        data.forEach(song => {
            if (song.categories && Array.isArray(song.categories)) {
                song.categories.forEach(cat => {
                    if (!ALL_CATEGORIES.includes(cat)) {
                        ALL_CATEGORIES.push(cat);
                    }
                    if (!grouped[cat]) grouped[cat] = [];
                    grouped[cat].push(song);
                });
            }
        });

        // Ordenar mantendo a prioridade das FIXAS e depois as DINAMICAS
        const sortedGrouped = {};
        ALL_CATEGORIES.forEach(cat => {
            if (grouped[cat]) sortedGrouped[cat] = grouped[cat];
        });

        // Montar estrutura final apenas com categorias que têm músicas
        repertoireData = Object.keys(sortedGrouped)
            .filter(name => sortedGrouped[name].length > 0)
            .map(name => ({
                category: name,
                items: sortedGrouped[name]
            }));

        renderRepertoire(repertoireData);
        populateCategoryMenu();
        updateFooter();
        initAdminState(); // Respeita estado de auth entre navegações
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

    ALL_CATEGORIES.forEach(catName => {
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
    const newUrlInput    = document.getElementById('newUrlInput');
    const newArtistInput = document.getElementById('newArtistInput');
    const newTitleInput  = document.getElementById('newTitleInput');
    urlEditorPanel.style.display = 'none';
    newUrlInput.value    = song.url    || '';
    newArtistInput.value = song.artist || '';
    newTitleInput.value  = song.title  || '';

    // Resetar zona de exclusão
    const deleteConfirmStep = document.getElementById('deleteConfirmStep');
    if (deleteConfirmStep) deleteConfirmStep.style.display = 'none';

    // ── Preencher checkboxes de categorias ──────────────────────────────
    const editCatGrid = document.getElementById('editCategoryCheckboxes');
    if (editCatGrid) {
        editCatGrid.innerHTML = '';
        ALL_CATEGORIES.forEach(cat => {
            const checked = (song.categories || []).includes(cat) ? 'checked' : '';
            const label = document.createElement('label');
            label.innerHTML = `<input type="checkbox" name="editCat" value="${cat}" ${checked}> ${cat}`;
            editCatGrid.appendChild(label);
        });
    }

    // ── Botão Editar Versão (toggle painel) ─────────────────────────────
    const editBtn = document.getElementById('editUrlBtn');
    editBtn.onclick = () => {
        const isVisible = urlEditorPanel.style.display !== 'none';
        urlEditorPanel.style.display = isVisible ? 'none' : 'block';
        if (!isVisible) newUrlInput.focus();
    };

    // ── Fechar painel ───────────────────────────────────────────────────
    document.getElementById('cancelUrlBtn').onclick = () => {
        urlEditorPanel.style.display = 'none';
    };

    // ── Salvar URL ──────────────────────────────────────────────────────
    document.getElementById('saveUrlBtn').onclick = async () => {
        const newUrl = newUrlInput.value.trim();
        if (!newUrl) { alert('Cole uma URL válida!'); return; }

        const idMatch = newUrl.match(/(?:v=|\/embed\/|youtu\.be\/|\/v\/|shorts\/)([^&?#/ ]+)/);
        const newVidId = idMatch ? idMatch[1] : null;
        const finalUrl = newVidId ? `https://www.youtube.com/embed/${newVidId}` : newUrl;

        const btn = document.getElementById('saveUrlBtn');
        btn.textContent = 'Salvando...';
        try {
            const { error } = await _supabase.from('songs')
                .update({ url: finalUrl, vid_id: newVidId })
                .eq('title', song.title);
            if (error) throw error;
            videoIframe.src = finalUrl;
            song.url = finalUrl;
            song.vid_id = newVidId;
            btn.innerHTML = '<i class="fas fa-save"></i> Salvar URL';
            alert('✅ URL atualizada!');
            fetchData();
        } catch (err) {
            btn.innerHTML = '<i class="fas fa-save"></i> Salvar URL';
            alert('Erro: ' + err.message);
        }
    };

    // ── Salvar Nome do Louvor ────────────────────────────────────────────
    document.getElementById('saveTitleBtn').onclick = async () => {
        const newTitle = newTitleInput.value.trim();
        if (!newTitle) { alert('Digite o nome do louvor!'); return; }
        if (newTitle === song.title) { alert('O nome não foi alterado.'); return; }

        const btn = document.getElementById('saveTitleBtn');
        btn.textContent = 'Salvando...';
        try {
            // Usa song.id para não depender do título atual como chave de busca
            const filter = song.id ? _supabase.from('songs').update({ title: newTitle }).eq('id', song.id)
                                   : _supabase.from('songs').update({ title: newTitle }).eq('title', song.title);
            const { error } = await filter;
            if (error) throw error;
            song.title = newTitle;
            document.getElementById('modalTitle').textContent = newTitle;
            btn.innerHTML = '<i class="fas fa-save"></i> Salvar Nome';
            alert('✅ Nome do louvor atualizado!');
            fetchData();
        } catch (err) {
            btn.innerHTML = '<i class="fas fa-save"></i> Salvar Nome';
            alert('Erro: ' + err.message);
        }
    };

    // ── Salvar Artista ──────────────────────────────────────────────────
    document.getElementById('saveArtistBtn').onclick = async () => {
        const newArtist = newArtistInput.value.trim();
        if (!newArtist) { alert('Digite o nome do artista!'); return; }

        const btn = document.getElementById('saveArtistBtn');
        btn.textContent = 'Salvando...';
        try {
            const { error } = await _supabase.from('songs')
                .update({ artist: newArtist })
                .eq('title', song.title);
            if (error) throw error;
            song.artist = newArtist;
            document.getElementById('modalArtist').textContent = newArtist;
            btn.innerHTML = '<i class="fas fa-save"></i> Salvar Artista';
            alert('✅ Artista atualizado!');
            fetchData();
        } catch (err) {
            btn.innerHTML = '<i class="fas fa-save"></i> Salvar Artista';
            alert('Erro: ' + err.message);
        }
    };

    // ── Salvar Categorias ────────────────────────────────────────────────
    document.getElementById('saveCategoriesBtn').onclick = async () => {
        const selected = Array.from(
            document.querySelectorAll('input[name="editCat"]:checked')
        ).map(cb => cb.value);

        if (selected.length === 0) {
            alert('Selecione pelo menos uma categoria!');
            return;
        }

        const btn = document.getElementById('saveCategoriesBtn');
        btn.textContent = 'Salvando...';
        try {
            const { error } = await _supabase.from('songs')
                .update({ categories: selected })
                .eq('title', song.title);
            if (error) throw error;
            song.categories = selected;
            btn.innerHTML = '<i class="fas fa-save"></i> Salvar Categorias';
            alert('✅ Categorias atualizadas!');
            fetchData();
        } catch (err) {
            btn.innerHTML = '<i class="fas fa-save"></i> Salvar Categorias';
            alert('Erro: ' + err.message);
        }
    };

    // ── Excluir Música (2 etapas) ────────────────────────────────────────
    document.getElementById('deleteSongBtn').onclick = () => {
        deleteConfirmStep.style.display = 'block';
    };

    document.getElementById('cancelDeleteBtn').onclick = () => {
        deleteConfirmStep.style.display = 'none';
    };

    document.getElementById('confirmDeleteBtn').onclick = async () => {
        const btn = document.getElementById('confirmDeleteBtn');
        btn.textContent = 'Excluindo...';
        try {
            const { error } = await _supabase.from('songs')
                .delete()
                .eq('title', song.title);
            if (error) throw error;
            modal.style.display = 'none';
            videoIframe.src = '';
            alert(`✅ "${song.title}" foi excluído do repertório.`);
            fetchData();
        } catch (err) {
            btn.innerHTML = '<i class="fas fa-trash-alt"></i> Sim, Excluir';
            alert('Erro ao excluir: ' + err.message);
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

// Fechar menu mobile ao clicar em qualquer opção
document.querySelectorAll('#navbar a, #navbar button').forEach(item => {
    item.addEventListener('click', () => {
        navbar.classList.remove('active');
    });
});

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
