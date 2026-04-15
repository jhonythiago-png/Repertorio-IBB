let repertoireData = [];
const categoriesContainer = document.getElementById('categoriesContainer');
const searchInput = document.getElementById('searchInput');
const modal = document.getElementById('videoModal');
const closeModal = document.querySelector('.close-modal');
const videoIframe = document.getElementById('videoIframe');
const header = document.getElementById('header');

// Fetch data from local server
async function fetchData() {
    try {
        const response = await fetch('data.json');
        repertoireData = await response.json();
        renderRepertoire(repertoireData);
        updateHero(repertoireData);
    } catch (error) {
        console.error("Erro ao carregar dados:", error);
    }
}

// Extract YouTube ID from URL or search link
function getYouTubeThumbnail(song) {
    if (song.vid_id) {
        return `https://img.youtube.com/vi/${song.vid_id}/hqdefault.jpg`;
    }
    
    const url = song.url;
    const idMatch = url.match(/(?:id=|\/embed\/|\/watch\?v=|\/v\/|youtu\.be\/|\/shorts\/)([^&?#/ ]+)/);
    if (idMatch && !url.includes('listType=search')) {
        return `https://img.youtube.com/vi/${idMatch[1]}/hqdefault.jpg`;
    }
    // Miniatura padrão de louvor se for link de busca
    return 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?q=80&w=400&auto=format&fit=crop';
}

function renderRepertoire(data) {
    categoriesContainer.innerHTML = '';
    
    data.forEach(category => {
        if (category.items.length === 0) return;
        
        const row = document.createElement('div');
        row.className = 'category-row';
        row.innerHTML = `<h2>${category.category}</h2>`;
        
        const container = document.createElement('div');
        container.className = 'row-container';
        
        category.items.forEach(song => {
            const card = document.createElement('div');
            card.className = 'song-card';
            card.innerHTML = `
                <img src="${getYouTubeThumbnail(song)}" alt="${song.title}">
                <div class="card-info">
                    <h4>${song.title}</h4>
                    <p>${song.artist} ${song.status ? '• ' + song.status : ''}</p>
                </div>
            `;
            card.onclick = () => openVideo(song);
            container.appendChild(card);
        });
        
        row.appendChild(container);
        categoriesContainer.appendChild(row);
    });
}

function updateHero(data) {
    if (data.length > 0 && data[0].items.length > 0) {
        const firstSong = data[0].items[0];
        document.getElementById('heroTitle').innerText = firstSong.title;
        document.getElementById('heroInfo').innerText = `${firstSong.artist} • ${data[0].category}`;
        window.currentHeroSong = firstSong;
    }
}

function openVideo(song) {
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
    videoIframe.src = song.url.includes('?') ? `${song.url}&autoplay=1` : `${song.url}?autoplay=1`;
    document.getElementById('modalTitle').innerText = song.title;
    document.getElementById('modalArtist').innerText = song.artist;
    
    document.getElementById('editUrlBtn').onclick = () => {
        const newUrl = prompt("Insira a nova URL do YouTube para esta música:", song.url);
        if (newUrl) {
            alert("Para salvar permanentemente, adicione esta URL no arquivo 'overrides.json' e o sistema atualizará automaticamente.");
        }
    };
}

function openHeroVideo() {
    if (window.currentHeroSong) openVideo(window.currentHeroSong);
}

// Search Logic
searchInput.oninput = (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = repertoireData.map(cat => ({
        ...cat,
        items: cat.items.filter(song => 
            song.title.toLowerCase().includes(term) || 
            song.artist.toLowerCase().includes(term)
        )
    }));
    renderRepertoire(filtered);
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

// Poll for updates from the backend (every 5 seconds)
setInterval(fetchData, 5000);
