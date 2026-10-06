// --- 1. REPOSITORIO DE FUENTES Y CONFIGURACIÓN INICIAL ---
const GLOBAL_PRESETS = [
    { name: "Xataka", category: "Tecnología", url: "https://feeds.weblogssl.com/xataka2" },
    { name: "Genbeta", category: "Tecnología", url: "https://feeds.weblogssl.com/genbeta" },
    { name: "El País", category: "General", url: "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada" },
    { name: "El Mundo", category: "General", url: "https://e00-elmundo.uecdn.es/elmundo/rss/portada.xml" },
    { name: "Expansion", category: "Finanzas", url: "https://e00-expansion.uecdn.es/rss/mercados.xml" },
    { name: "3DJuegos", category: "Videojuegos", url: "https://www.3djuegos.com/feed/news" },
    { name: "Marca Motor", category: "Deportes", url: "https://as.com/rss/motor/formula1.xml" }
];

let userPrefs = JSON.parse(localStorage.getItem('newsPrefs_v3')) || {
    blockedKeywords: ['clickbait', 'rumor', 'patrocinado'],
    savedArticles: [],
    categories: [
        { id: 'general', name: 'Resumen del Día', type: 'general' },
        { id: 'tech', name: 'Xataka', type: 'feed', url: 'https://feeds.weblogssl.com/xataka2' },
        { id: 'fin', name: 'Finanzas', type: 'topic', query: 'Finanzas' },
        { id: 'saved', name: 'Guardados', type: 'saved' }
    ],
    ratings: {} // Armazena ratings por título: 'like', 'dislike', 'woke'
};

let activeTabId = userPrefs.categories[0]?.id || 'general';
let articulosCargados = [];

function savePrefs() {
    localStorage.setItem('newsPrefs_v3', JSON.stringify(userPrefs));
}

// --- 2. GESTIÓN DE TEMA DARK/LIGHT ---
const themeToggleBtn = document.getElementById('theme-toggle');
const currentTheme = localStorage.getItem('theme') || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
document.documentElement.setAttribute('data-theme', currentTheme);

themeToggleBtn.addEventListener('click', () => {
    let theme = document.documentElement.getAttribute('data-theme');
    let newTheme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
});

// --- 3. MENÚ LATERAL Y CATÁLOGO GLOBAL ---
const sidebarDrawer = document.getElementById('sidebar-drawer');
document.getElementById('sidebar-toggle-btn').addEventListener('click', () => {
    sidebarDrawer.classList.remove('hidden');
    document.body.classList.add('modal-open');
});

const closeSidebar = () => {
    sidebarDrawer.classList.add('hidden');
    document.body.classList.remove('modal-open');
};

document.getElementById('close-sidebar-btn').addEventListener('click', closeSidebar);
document.getElementById('sidebar-backdrop').addEventListener('click', closeSidebar);

function renderCatalogPresets() {
    const container = document.getElementById('preset-catalog-list');
    container.innerHTML = '';

    GLOBAL_PRESETS.forEach(preset => {
        const item = document.createElement('div');
        item.className = 'preset-item';
        item.innerHTML = `
            <div>
                <span>${preset.name}</span>
                <br><small>${preset.category}</small>
            </div>
            <button class="primary-btn-sm">+ Pestaña</button>
        `;
        item.querySelector('button').addEventListener('click', () => {
            const newId = 'feed_' + Date.now();
            userPrefs.categories.push({ id: newId, name: preset.name, type: 'feed', url: preset.url });
            savePrefs();
            renderCategorias();
            switchTab(newId);
            closeSidebar();
        });
        container.appendChild(item);
    });
}

// Agregar Búsqueda por Tema
document.getElementById('add-topic-btn').addEventListener('click', () => {
    const input = document.getElementById('topic-input');
    const topic = input.value.trim();
    if (!topic) return;

    const newId = 'topic_' + Date.now();
    userPrefs.categories.push({ id: newId, name: topic, type: 'topic', query: topic });
    savePrefs();
    renderCategorias();
    switchTab(newId);
    input.value = '';
    closeSidebar();
});

// Agregar Feed Personalizado por URL
document.getElementById('add-custom-feed-btn').addEventListener('click', () => {
    const nameInput = document.getElementById('feed-name-input');
    const urlInput = document.getElementById('feed-url-input');
    if (!nameInput.value || !urlInput.value) return;

    const newId = 'custom_' + Date.now();
    userPrefs.categories.push({ id: newId, name: nameInput.value.trim(), type: 'feed', url: urlInput.value.trim() });
    savePrefs();
    renderCategorias();
    switchTab(newId);
    nameInput.value = '';
    urlInput.value = '';
    closeSidebar();
});

// --- 4. RENDERIZAR PESTAÑAS DE CATEGORÍAS ---
function renderCategorias() {
    const container = document.getElementById('categories-container');
    container.innerHTML = '';

    userPrefs.categories.forEach((cat) => {
        const btn = document.createElement('button');
        btn.className = `category-tab ${cat.id === activeTabId ? 'active' : ''}`;
        
        let icon = cat.type === 'saved' ? '🔖 ' : (cat.type === 'topic' ? '🔍 ' : '');
        btn.innerHTML = `${icon}${cat.name}`;

        if (cat.type !== 'saved' && userPrefs.categories.length > 1) {
            const removeBtn = document.createElement('span');
            removeBtn.className = 'tab-remove';
            removeBtn.innerText = ' ✕';
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                userPrefs.categories = userPrefs.categories.filter(c => c.id !== cat.id);
                if (activeTabId === cat.id) {
                    activeTabId = userPrefs.categories[0]?.id || 'general';
                }
                savePrefs();
                renderCategorias();
                cargarSeccionActiva();
            });
            btn.appendChild(removeBtn);
        }

        btn.addEventListener('click', () => switchTab(cat.id));
        container.appendChild(btn);
    });
}

function switchTab(id) {
    activeTabId = id;
    renderCategorias();
    cargarSeccionActiva();
}

// --- 5. CARGA DE CONTENIDO RSS CON ANTI-CACHÉ Y ORDENACIÓN ---
async function fetchFeedRSS(url) {
    const cacheBuster = Date.now();
    const proxyUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}&_t=${cacheBuster}`;
    const res = await fetch(proxyUrl);
    const data = await res.json();
    return data.status === 'ok' ? data : null;
}

async function cargarSeccionActiva() {
    const feedContainer = document.getElementById('feed-container');
    feedContainer.innerHTML = `<p style="text-align:center; padding: 40px; color: var(--text-muted);">Sincronizando la última hora...</p>`;
    articulosCargados = [];

    const currentTab = userPrefs.categories.find(c => c.id === activeTabId) || userPrefs.categories[0];

    if (currentTab.type === 'saved') {
        renderizarTarjetas(userPrefs.savedArticles, true);
        return;
    }

    try {
        let rawItems = [];

        if (currentTab.type === 'general') {
            const promises = GLOBAL_PRESETS.slice(0, 3).map(p => fetchFeedRSS(p.url));
            const results = await Promise.all(promises);
            results.forEach(res => {
                if (res) {
                    res.items.forEach(item => item.sourceName = res.feed.title);
                    rawItems.push(...res.items);
                }
            });
        } else if (currentTab.type === 'feed') {
            const res = await fetchFeedRSS(currentTab.url);
            if (res) {
                res.items.forEach(item => item.sourceName = res.feed.title);
                rawItems = res.items;
            }
        } else if (currentTab.type === 'topic') {
            // Genera la búsqueda directa en tiempo real en Google News RSS
            const googleNewsUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(currentTab.query)}&hl=es&gl=ES&ceid=ES:es`;
            const res = await fetchFeedRSS(googleNewsUrl);
            if (res) {
                res.items.forEach(item => item.sourceName = currentTab.name);
                rawItems = res.items;
            }
        }

        // Mapeo, filtrado y ordenación cronológica descendente estricta
        let itemsProcesados = rawItems.map(item => ({
            titulo: item.title,
            resumen: item.description || "",
            contenido: (item.content && item.content.length > item.description.length) ? item.content : item.description,
            fuente: item.sourceName || "Actualidad",
            fechaPub: new Date(item.pubDate || Date.now()),
            fecha: new Date(item.pubDate || Date.now()).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
            link: item.link,
            thumbnail: item.thumbnail || (item.enclosure ? item.enclosure.link : null)
        })).sort((a, b) => b.fechaPub - a.fechaPub);

        // Filtrado anti-ruido por palabras vetadas
        articulosCargados = itemsProcesados.filter(item => {
            const titleLower = item.titulo.toLowerCase();
            return !userPrefs.blockedKeywords.some(kw => kw.length > 0 && titleLower.includes(kw.toLowerCase().trim()));
        });

        renderizarTarjetas(articulosCargados, false);

    } catch (err) {
        console.error(err);
        feedContainer.innerHTML = `<p style="text-align:center; color: #ef4444; padding: 40px;">No se pudieron actualizar las noticias de esta sección.</p>`;
    }
}

// --- 6. UTILIDADES: TIEMPO DE LECTURA, IDIOMA Y EXTRACTION ---
function calcularTiempoLectura(textoHtml) {
    if (!textoHtml) return "1 min";
    let textoPlano = textoHtml.replace(/<[^>]*>?/gm, '');
    let palabras = textoPlano.split(/\s+/).length;
    let minutos = Math.ceil(palabras / 180);
    return `${minutos} min lectura`;
}

function detectarIdioma(texto) {
    if (!texto) return "Español";
    let textoLC = texto.toLowerCase();
    let tokensIngles = ['the', 'and', 'with', 'from', 'that', 'this', 'have', 'said', 'will'];
    let matches = tokensIngles.filter(token => textoLC.includes(` ${token} `)).length;
    return matches >= 2 ? "English" : "Español";
}

function extraerMedia(item) {
    let imageUrl = item.thumbnail;
    if (!imageUrl && item.contenido) {
        const match = item.contenido.match(/<img[^>]+src="([^">]+)"/);
        if (match) imageUrl = match[1];
    }
    return imageUrl;
}

// --- 7. RENDERIZADO DE TARJETAS Y SISTEMA DE MEMORIA / RATING ---
function renderizarTarjetas(articulos, esGuardado = false) {
    const feedContainer = document.getElementById('feed-container');
    feedContainer.innerHTML = '';

    if (articulos.length === 0) {
        feedContainer.innerHTML = `<p style="text-align:center; padding: 40px; color: var(--text-muted);">No hay noticias disponibles aquí.</p>`;
        return;
    }

    articulos.forEach((item, index) => {
        const rating = userPrefs.ratings[item.titulo] || null;
        const tiempo = calcularTiempoLectura(item.contenido || item.resumen);
        const idioma = detectarIdioma(item.titulo + " " + item.resumen);
        const mediaUrl = extraerMedia(item);

        const card = document.createElement('article');
        card.className = 'news-card';

        let mediaHtml = mediaUrl ? `<img src="${mediaUrl}" class="card-media-thumb" alt="Media" loading="lazy">` : '';
        let cleanTLDR = item.resumen.replace(/<[^>]*>?/gm, '').slice(0, 160) + '...';

        card.innerHTML = `
            ${mediaHtml}
            <div class="card-content-pad">
                <div class="card-header-meta">
                    <span>🗞️ ${item.fuente}</span>
                    <span>⏱️ ${tiempo} • 🌐 ${idioma}</span>
                </div>
                <h2>${item.titulo}</h2>
                <p class="tldr">▶ ${cleanTLDR}</p>

                <div class="card-footer-actions">
                    <div class="action-group">
                        <button class="action-btn primary btn-leer">🔓 Leer Completa</button>
                        <button class="action-btn btn-guardar">${esGuardado ? '🗑️ Eliminar' : '🔖 Guardar'}</button>
                    </div>
                    <div class="action-group">
                        <button class="action-btn btn-like ${rating === 'like' ? 'voted-like' : ''}">🔥 Interesante</button>
                        <button class="action-btn btn-dislike ${rating === 'dislike' ? 'voted-dislike' : ''}">👎 No me gusta</button>
                        <button class="action-btn btn-woke ${rating === 'woke' ? 'voted-woke' : ''}">🚫 Muy woke</button>
                    </div>
                </div>
            </div>
        `;

        // Botón Leer Completa
        card.querySelector('.btn-leer').addEventListener('click', () => {
            abrirReaderModal(item, tiempo, idioma);
        });

        // Botón Guardar / Eliminar
        card.querySelector('.btn-guardar').addEventListener('click', () => {
            if (esGuardado) {
                userPrefs.savedArticles.splice(index, 1);
                savePrefs();
                renderizarTarjetas(userPrefs.savedArticles, true);
            } else {
                if (!userPrefs.savedArticles.some(a => a.titulo === item.titulo)) {
                    userPrefs.savedArticles.push(item);
                    savePrefs();
                    alert('🔖 Guardada en la sección "Guardados".');
                }
            }
        });

        // Botones de Clasificación / Memoria
        card.querySelector('.btn-like').addEventListener('click', () => setRating(item.titulo, 'like'));
        card.querySelector('.btn-dislike').addEventListener('click', () => setRating(item.titulo, 'dislike'));
        card.querySelector('.btn-woke').addEventListener('click', () => setRating(item.titulo, 'woke'));

        feedContainer.appendChild(card);
    });
}

function setRating(titulo, voteType) {
    if (userPrefs.ratings[titulo] === voteType) {
        delete userPrefs.ratings[titulo];
    } else {
        userPrefs.ratings[titulo] = voteType;
    }
    savePrefs();
    renderizarTarjetas(articulosCargados, activeTabId === 'saved');
}

// --- 8. MODAL DE LECTURA Y CONFIGURACIÓN ---
const readerModal = document.getElementById('reader-modal');
document.getElementById('close-modal').addEventListener('click', () => {
    readerModal.classList.add('hidden');
    document.body.classList.remove('modal-open');
});

function abrirReaderModal(item, tiempo, idioma) {
    document.getElementById('reader-title').innerText = item.titulo;
    document.getElementById('reader-source').innerText = item.fuente;
    document.getElementById('reader-date').innerText = item.fecha;
    document.getElementById('reader-lang').innerText = idioma;
    document.getElementById('reader-time').innerText = tiempo;

    const mediaUrl = extraerMedia(item);
    document.getElementById('reader-hero-media').innerHTML = mediaUrl ? `<img src="${mediaUrl}" alt="Hero">` : '';

    document.getElementById('reader-body').innerHTML = item.contenido || item.resumen;
    document.getElementById('reader-external-link').href = item.link;

    readerModal.classList.remove('hidden');
    document.body.classList.add('modal-open');
    readerModal.querySelector('.modal-scroll-area').scrollTop = 0;
}

// Modal de Configuración
const settingsModal = document.getElementById('settings-modal');
document.getElementById('settings-btn').addEventListener('click', () => {
    document.getElementById('blocked-input').value = userPrefs.blockedKeywords.join(', ');
    settingsModal.classList.remove('hidden');
    document.body.classList.add('modal-open');
});

document.getElementById('close-settings').addEventListener('click', () => {
    settingsModal.classList.add('hidden');
    document.body.classList.remove('modal-open');
});

document.getElementById('save-settings-btn').addEventListener('click', () => {
    const rawKw = document.getElementById('blocked-input').value;
    userPrefs.blockedKeywords = rawKw.split(',').map(k => k.trim()).filter(k => k.length > 0);
    savePrefs();
    settingsModal.classList.add('hidden');
    document.body.classList.remove('modal-open');
    cargarSeccionActiva();
});

// --- INICIALIZACIÓN ---
renderCatalogPresets();
renderCategorias();
cargarSeccionActiva();
