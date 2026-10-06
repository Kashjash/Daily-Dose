// --- 1. CONFIGURACIÓN Y CATÁLOGO GLOBAL ---
const GLOBAL_PRESETS = [
    { name: "Xataka", category: "Tecnología", url: "https://feeds.weblogssl.com/xataka2" },
    { name: "Genbeta", category: "Tecnología", url: "https://feeds.weblogssl.com/genbeta" },
    { name: "El País", category: "General", url: "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada" },
    { name: "El Mundo", category: "General", url: "https://e00-elmundo.uecdn.es/elmundo/rss/portada.xml" },
    { name: "Expansión", category: "Finanzas", url: "https://e00-expansion.uecdn.es/rss/mercados.xml" },
    { name: "3DJuegos", category: "Videojuegos", url: "https://www.3djuegos.com/feed/news" },
    { name: "As Motor", category: "Deportes", url: "https://as.com/rss/motor/formula1.xml" }
];

let userPrefs = JSON.parse(localStorage.getItem('newsPrefs_v6')) || {
    blockedKeywords: ['clickbait', 'rumor', 'patrocinado'],
    savedArticles: [],
    categories: [
        { id: 'general', name: 'Resumen del Día', type: 'general' },
        { id: 'tech', name: 'Tecnología', type: 'parent', feeds: ['https://feeds.weblogssl.com/xataka2', 'https://feeds.weblogssl.com/genbeta'] },
        { id: 'games', name: 'Videojuegos', type: 'parent', feeds: ['https://www.3djuegos.com/feed/news'] },
        { id: 'saved', name: 'Guardados', type: 'saved' }
    ],
    ratings: {}
};

let activeTabId = userPrefs.categories[0]?.id || 'general';
let articulosCargados = [];

function savePrefs() {
    localStorage.setItem('newsPrefs_v6', JSON.stringify(userPrefs));
}

// --- 2. TEMA OSCURO / CLARO ---
const themeToggleBtn = document.getElementById('theme-toggle');
const currentTheme = localStorage.getItem('theme') || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
document.documentElement.setAttribute('data-theme', currentTheme);

themeToggleBtn.addEventListener('click', () => {
    let theme = document.documentElement.getAttribute('data-theme');
    let newTheme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
});

// --- 3. MENÚ LATERAL Y ANIDACIÓN ---
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
                <span>${preset.name}</span><br><small>${preset.category}</small>
            </div>
            <button class="primary-btn-sm">+ Añadir</button>
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

document.getElementById('add-nested-btn').addEventListener('click', () => {
    const parentName = document.getElementById('parent-cat-input').value.trim();
    const subTopic = document.getElementById('sub-topic-input').value.trim();
    if (!parentName || !subTopic) return;

    let parentCat = userPrefs.categories.find(c => c.name.toLowerCase() === parentName.toLowerCase());
    const googleNewsUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(subTopic)}&hl=es&gl=ES&ceid=ES:es`;

    if (parentCat) {
        if (!parentCat.feeds) parentCat.feeds = [];
        parentCat.feeds.push(googleNewsUrl);
    } else {
        userPrefs.categories.push({
            id: 'cat_' + Date.now(),
            name: parentName,
            type: 'parent',
            feeds: [googleNewsUrl]
        });
    }

    savePrefs();
    renderCategorias();
    document.getElementById('parent-cat-input').value = '';
    document.getElementById('sub-topic-input').value = '';
    closeSidebar();
    cargarSeccionActiva();
});

// --- 4. GESTIÓN DE PESTAÑAS ---
function renderCategorias() {
    const container = document.getElementById('categories-container');
    container.innerHTML = '';

    userPrefs.categories.forEach((cat) => {
        const btn = document.createElement('button');
        btn.className = `category-tab ${cat.id === activeTabId ? 'active' : ''}`;
        let icon = cat.type === 'saved' ? '🔖 ' : (cat.type === 'parent' ? '📂 ' : '📰 ');
        btn.innerHTML = `${icon}${cat.name}`;
        btn.addEventListener('click', () => switchTab(cat.id));
        container.appendChild(btn);
    });
}

function switchTab(id) {
    activeTabId = id;
    renderCategorias();
    cargarSeccionActiva();
}

document.getElementById('refresh-tab-btn').addEventListener('click', () => {
    cargarSeccionActiva();
});

// --- 5. FILTRO DE DESDUPLICACIÓN INTELIGENTE ---
function eliminarDuplicados(articulos) {
    const titulosVistos = new Set();
    const urlsVistas = new Set();

    return articulos.filter(item => {
        const tituloClean = item.titulo.toLowerCase().replace(/[^\w\s]/gi, '').trim();
        const urlClean = item.link ? item.link.split('?')[0] : '';

        if (titulosVistos.has(tituloClean) || (urlClean && urlsVistas.has(urlClean))) {
            return false;
        }

        titulosVistos.add(tituloClean);
        if (urlClean) urlsVistas.add(urlClean);
        return true;
    });
}

// --- 6. CARGA RSS Y PROCESAMIENTO ---
async function fetchFeedRSS(url) {
    const cacheBuster = Date.now();
    const proxyUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}&_t=${cacheBuster}`;
    try {
        const res = await fetch(proxyUrl);
        const data = await res.json();
        return data.status === 'ok' ? data : null;
    } catch {
        return null;
    }
}

async function cargarSeccionActiva() {
    const feedContainer = document.getElementById('feed-container');
    feedContainer.innerHTML = `<p style="text-align:center; padding: 40px; color: var(--text-muted);">Sincronizando actualidad...</p>`;
    articulosCargados = [];

    const currentTab = userPrefs.categories.find(c => c.id === activeTabId) || userPrefs.categories[0];
    document.getElementById('active-feed-label').innerText = `Sección: ${currentTab.name}`;

    if (currentTab.type === 'saved') {
        renderizarTarjetas(userPrefs.savedArticles, true, false);
        return;
    }

    try {
        let targets = [];
        if (currentTab.type === 'general') {
            targets = GLOBAL_PRESETS.map(p => ({ category: p.category, url: p.url }));
        } else if (currentTab.type === 'feed') {
            targets = [{ category: currentTab.name, url: currentTab.url }];
        } else if (currentTab.type === 'parent' && currentTab.feeds) {
            targets = currentTab.feeds.map(url => ({ category: currentTab.name, url }));
        }

        let rawItems = [];
        for (let target of targets) {
            const res = await fetchFeedRSS(target.url);
            if (res && res.items) {
                res.items.forEach(item => {
                    item.sourceName = res.feed.title;
                    item.categoryTag = target.category;
                });
                rawItems.push(...res.items);
            }
        }

        let itemsProcesados = rawItems.map(item => {
            const link = item.link || "";
            const isPaywall = link.includes('elpais.com') || link.includes('ft.com') || link.includes('wsj.com') || (item.content && item.content.length < 300);
            
            return {
                titulo: item.title,
                resumen: item.description || "",
                contenido: item.content || item.description || "",
                fuente: item.sourceName || "Actualidad",
                categoria: item.categoryTag || "General",
                fechaPub: new Date(item.pubDate || Date.now()),
                fecha: new Date(item.pubDate || Date.now()).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
                link: link,
                thumbnail: item.thumbnail || (item.enclosure ? item.enclosure.link : null),
                paywall: isPaywall
            };
        }).sort((a, b) => b.fechaPub - a.fechaPub);

        let itemsUnicos = eliminarDuplicados(itemsProcesados);

        articulosCargados = itemsUnicos.filter(item => {
            const titleLower = item.titulo.toLowerCase();
            const blocked = userPrefs.blockedKeywords.some(kw => kw.length > 0 && titleLower.includes(kw.toLowerCase().trim()));
            const rating = userPrefs.ratings[item.titulo];
            if (blocked || rating === 'dislike' || rating === 'woke') return false;
            return true;
        });

        const esModoFYI = (currentTab.type === 'general');
        renderizarTarjetas(articulosCargados, false, esModoFYI);

    } catch (err) {
        console.error(err);
        feedContainer.innerHTML = `<p style="text-align:center; color: #ef4444; padding: 40px;">Error al actualizar la sección.</p>`;
    }
}

// --- 7. RENDERIZADO (TARJETAS ESTÁNDAR VS MODO FYI COMPACTO) ---
function renderizarTarjetas(articulos, esGuardado = false, esModoFYI = false) {
    const feedContainer = document.getElementById('feed-container');
    feedContainer.innerHTML = '';

    if (articulos.length === 0) {
        feedContainer.innerHTML = `<p style="text-align:center; padding: 40px; color: var(--text-muted);">No hay noticias disponibles.</p>`;
        return;
    }

    if (esModoFYI && !esGuardado) {
        const grupos = {};
        articulos.forEach(item => {
            const cat = item.categoria || "General";
            if (!grupos[cat]) grupos[cat] = [];
            grupos[cat].push(item);
        });

        for (let [catName, itemsEnGrupo] of Object.entries(grupos)) {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'fyi-group';
            groupDiv.innerHTML = `<div class="fyi-group-title">📌 ${catName}</div>`;

            itemsEnGrupo.forEach(item => {
                const tiempo = calcularTiempoLectura(item.contenido || item.resumen);
                const cleanDesc = item.resumen.replace(/<[^>]*>?/gm, '').slice(0, 100) + '...';

                const card = document.createElement('div');
                card.className = 'compact-card';
                card.innerHTML = `
                    <div class="compact-header">
                        <span>🗞️ ${item.fuente} • ${tiempo}</span>
                        <span>${item.paywall ? '🔒' : '🔓'}</span>
                    </div>
                    <h3>${item.titulo}</h3>
                    <p class="compact-desc">${cleanDesc}</p>
                `;

                card.addEventListener('click', () => abrirReaderModal(item, tiempo, detectarIdioma(item.titulo), generarTLDRReal(item.resumen)));
                groupDiv.appendChild(card);
            });

            feedContainer.appendChild(groupDiv);
        }
        return;
    }

    articulos.forEach((item, index) => {
        const rating = userPrefs.ratings[item.titulo] || null;
        const tiempo = calcularTiempoLectura(item.contenido || item.resumen);
        const idioma = detectarIdioma(item.titulo + " " + item.resumen);
        const mediaUrl = extraerMedia(item);
        const cleanTLDR = generarTLDRReal(item.resumen);

        const card = document.createElement('article');
        card.className = 'news-card';

        let mediaHtml = mediaUrl ? `<img src="${mediaUrl}" class="card-media-thumb" alt="Media" loading="lazy">` : '';
        let paywallBadge = item.paywall ? '🔒 De pago' : '🔓 Libre';

        card.innerHTML = `
            ${mediaHtml}
            <div class="card-content-pad">
                <div class="card-header-meta">
                    <span>🗞️ ${item.fuente} • ${paywallBadge}</span>
                    <span>⏱️ ${tiempo} • 🌐 ${idioma}</span>
                </div>
                <h2>${item.titulo}</h2>
                <p class="tldr">▶ ${cleanTLDR}</p>

                <div class="card-footer-actions" onclick="event.stopPropagation()">
                    <div class="action-group">
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

        card.addEventListener('click', () => abrirReaderModal(item, tiempo, idioma, cleanTLDR));

        let touchStartX = 0;
        card.addEventListener('touchstart', (e) => { touchStartX = e.changedTouches[0].screenX; }, {passive: true});
        card.addEventListener('touchend', (e) => {
            let diff = e.changedTouches[0].screenX - touchStartX;
            if (diff > 80) {
                if (!userPrefs.savedArticles.some(a => a.titulo === item.titulo)) {
                    userPrefs.savedArticles.push(item);
                    savePrefs();
                    alert('🔖 Guardado por gesto.');
                }
            } else if (diff < -80) {
                articulosCargados.splice(index, 1);
                renderizarTarjetas(articulosCargados, esGuardado, false);
            }
        }, {passive: true});

        card.querySelector('.btn-guardar').addEventListener('click', (e) => {
            e.stopPropagation();
            if (esGuardado) {
                userPrefs.savedArticles.splice(index, 1);
                savePrefs();
                renderizarTarjetas(userPrefs.savedArticles, true, false);
            } else {
                if (!userPrefs.savedArticles.some(a => a.titulo === item.titulo)) {
                    userPrefs.savedArticles.push(item);
                    savePrefs();
                    alert('🔖 Guardado en bóveda.');
                }
            }
        });

        card.querySelector('.btn-like').addEventListener('click', (e) => { e.stopPropagation(); setRating(item.titulo, 'like'); });
        card.querySelector('.btn-dislike').addEventListener('click', (e) => { e.stopPropagation(); setRating(item.titulo, 'dislike'); });
        card.querySelector('.btn-woke').addEventListener('click', (e) => { e.stopPropagation(); setRating(item.titulo, 'woke'); });

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
    cargarSeccionActiva();
}

// --- 8. UTILIDADES ---
function calcularTiempoLectura(textoHtml) {
    if (!textoHtml) return "1 min";
    let palabras = textoHtml.replace(/<[^>]*>?/gm, '').split(/\s+/).length;
    return `${Math.ceil(palabras / 180)} min`;
}

function detectarIdioma(texto) {
    if (!texto) return "Español";
    let tokensIngles = ['the', 'and', 'with', 'from', 'that', 'this', 'have', 'said', 'will'];
    let matches = tokensIngles.filter(token => texto.toLowerCase().includes(` ${token} `)).length;
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

function generarTLDRReal(textoHtml) {
    if (!textoHtml) return "Resumen automático no disponible.";
    let textoPlano = textoHtml.replace(/<[^>]*>?/gm, '');
    let frases = textoPlano.split('. ').filter(f => f.length > 30);
    return frases.length > 0 ? frases.slice(0, 2).join('. ') + '.' : "Contenido de lectura rápida.";
}

// --- 9. MODALES ---
const readerModal = document.getElementById('reader-modal');
let articuloActualModal = null;

document.getElementById('close-modal').addEventListener('click', () => {
    readerModal.classList.add('hidden');
    document.body.classList.remove('modal-open');
});

function abrirReaderModal(item, tiempo, idioma, tldrText) {
    articuloActualModal = item;
    document.getElementById('reader-title').innerText = item.titulo;
    document.getElementById('reader-source').innerText = item.fuente;
    document.getElementById('reader-date').innerText = item.fecha;
    document.getElementById('reader-lang').innerText = idioma;
    document.getElementById('reader-time').innerText = tiempo;
    document.getElementById('reader-paywall-badge').innerText = item.paywall ? '🔒 De pago' : '🔓 Libre';

    document.getElementById('reader-tldr').innerHTML = `<strong>TL;DR:</strong> ${tldrText}`;

    const mediaUrl = extraerMedia(item);
    document.getElementById('reader-hero-media').innerHTML = mediaUrl ? `<img src="${mediaUrl}" alt="Hero">` : '';

    document.getElementById('reader-body').innerHTML = item.contenido || item.resumen;
    document.getElementById('reader-external-link').href = item.link;

    readerModal.classList.remove('hidden');
    document.body.classList.add('modal-open');
    readerModal.querySelector('.modal-scroll-area').scrollTop = 0;
}

document.getElementById('share-immaculate-btn').addEventListener('click', () => {
    if (!articuloActualModal) return;
    const cleanText = `📰 *${articuloActualModal.titulo}*\n🗞️ Fuente: ${articuloActualModal.fuente}\n\n${generarTLDRReal(articuloActualModal.resumen)}\n\n🔗 ${articuloActualModal.link}`;
    navigator.clipboard.writeText(cleanText).then(() => {
        alert('✨ ¡Contenido copiado con exportación inmaculada!');
    });
});

const settingsModal = document.getElementById('settings-modal');
document.getElementById('settings-btn').addEventListener('click', () => {
    document.getElementById('blocked-input').value = userPrefs.blockedKeywords.join(', ');
    renderManageTabsList();
    settingsModal.classList.remove('hidden');
    document.body.classList.add('modal-open');
});

document.getElementById('close-settings').addEventListener('click', () => {
    settingsModal.classList.add('hidden');
    document.body.classList.remove('modal-open');
});

function renderManageTabsList() {
    const container = document.getElementById('manage-tabs-list');
    container.innerHTML = '';
    userPrefs.categories.forEach(cat => {
        const row = document.createElement('div');
        row.style.cssText = "display:flex; justify-content:space-between; align-items:center; background:var(--card-bg); padding:6px 10px; border-radius:8px; border:1px solid var(--card-border); font-size:13px;";
        row.innerHTML = `<span>${cat.name}</span>`;
        if (cat.type !== 'saved' && userPrefs.categories.length > 1) {
            const delBtn = document.createElement('button');
            delBtn.className = 'action-btn';
            delBtn.innerText = 'Eliminar';
            delBtn.style.background = '#ef4444';
            delBtn.style.color = 'white';
            delBtn.addEventListener('click', () => {
                userPrefs.categories = userPrefs.categories.filter(c => c.id !== cat.id);
                if (activeTabId === cat.id) activeTabId = userPrefs.categories[0].id;
                savePrefs();
                renderCategorias();
                renderManageTabsList();
                cargarSeccionActiva();
            });
            row.appendChild(delBtn);
        }
        container.appendChild(row);
    });
}

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
