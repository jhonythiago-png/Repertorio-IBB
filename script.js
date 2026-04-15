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

// Fetch data from local server
async function fetchData() {
    try {
        const response = await fetch('data.json');
        repertoireData = await response.json();
        renderRepertoire(repertoireData);
        populateCategoryMenu();
    } catch (error) {
        console.error("Erro ao carregar dados:", error);
    }
}

// Extract YouTube thumbnail from song or fallback
function getYouTubeThumbnail(song, quality = 'hqdefault') {
    if (song.vid_id) {
        return `https://img.youtube.com/vi/${song.vid_id}/${quality}.jpg`;
    }
    const url = song.url;
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
            <p>${song.artist} ${song.status ? '• ' + song.status : ''}</p>
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

function populateCategoryMenu() {
    categoryList.innerHTML = '';
    repertoireData.forEach(cat => {
        const item = document.createElement('div');
        item.className = 'category-item';
        item.innerText = cat.category;
        item.onclick = () => {
            renderGrid(cat.items, cat.category);
            document.querySelectorAll('nav a').forEach(a => a.classList.remove('active'));
            document.getElementById('categoriesNav').classList.add('active');
        };
        categoryList.appendChild(item);
    });
}

function openVideo(song) {
    if (!song || !song.url) return;
    
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
    
    let embedUrl = song.url;
    if (song.vid_id && !embedUrl.includes('/embed/')) {
        embedUrl = `https://www.youtube.com/embed/${song.vid_id}`;
    }
    
    videoIframe.src = embedUrl.includes('?') ? `${embedUrl}&autoplay=1` : `${embedUrl}?autoplay=1`;
    document.getElementById('modalTitle').innerText = song.title;
    document.getElementById('modalArtist').innerText = song.artist;
    
    const editBtn = document.getElementById('editUrlBtn');
    editBtn.onclick = async (e) => {
        e.preventDefault();
        const newUrl = prompt("Insira a nova URL do YouTube para esta música:", song.url);
        if (newUrl) {
            try {
                const res = await fetch('/update_override', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: song.title, url: newUrl })
                });
                if (res.ok) {
                    alert("URL salva com sucesso! O sistema está atualizando...");
                    fetchData();
                    closeModal.onclick();
                } else {
                    alert("Erro ao salvar. Verifique se o servidor Python está rodando.");
                }
            } catch (err) {
                console.error(err);
            }
        }
    };
}

function openHeroVideo() {
    // No modo "Banner Premium", podemos abrir um vídeo de destaque fixo ou o primeiro da lista
    if (repertoireData.length > 0 && repertoireData[0].items.length > 0) {
        openVideo(repertoireData[0].items[0]);
    }
}

// Search Logic
searchInput.oninput = (e) => {
    const term = e.target.value.toLowerCase().trim();
    if (term === "") {
        resetView();
        return;
    }

    const allSongs = repertoireData.flatMap(cat => cat.items);
    const filtered = allSongs.filter(song => 
        song.title.toLowerCase().includes(term) || 
        song.artist.toLowerCase().includes(term)
    );
    
    renderGrid(filtered, `Resultados para: "${term}"`);
};

function resetView() {
    renderRepertoire(repertoireData);
    document.getElementById('hero').style.display = 'flex';
    document.querySelectorAll('nav a').forEach(a => a.classList.remove('active'));
    document.getElementById('homeNav').classList.add('active');
    searchInput.value = '';
}

// Nav Listeners
document.getElementById('homeNav').onclick = (e) => {
    e.preventDefault();
    resetView();
};

document.getElementById('categoriesNav').onclick = (e) => {
    e.preventDefault();
    categoryOverlay.style.display = 'block';
    document.getElementById('hero').style.display = 'none';
    categoriesContainer.style.display = 'none';
    searchResultsGrid.style.display = 'none';
};

document.getElementById('newNav').onclick = (e) => {
    e.preventDefault();
    const newSongs = repertoireData.flatMap(cat => cat.items).filter(s => s.status === "NOVA");
    renderGrid(newSongs, "Novos Lançamentos");
};

// Modal Close logic
closeModal.onclick = () => {
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
    videoIframe.src = '';
};

window.onclick = (event) => {
    if (event.target == modal) {
        closeModal.onclick();
    }
    if (event.target == categoryOverlay) {
        categoryOverlay.style.display = 'none';
        resetView();
    }
};

// Scroll effect
window.onscroll = () => {
    if (window.scrollY > 50) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }
};

// Start
fetchData();
