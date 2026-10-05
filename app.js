// --- 1. GESTIÓN DE TEMA (CLARO / OSCURO) ---
const themeToggleBtn = document.getElementById('theme-toggle');
const currentTheme = localStorage.getItem('theme') || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
document.documentElement.setAttribute('data-theme', currentTheme);

themeToggleBtn.addEventListener('click', () => {
    let theme = document.documentElement.getAttribute('data-theme');
    let newTheme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
});

// --- 2. PERFIL LOCAL Y CONFIGURACIÓN ---
let userPrefs = JSON.parse(localStorage.getItem('newsPrefs')) || { 
    blockedKeywords: ['clickbait', 'woke', 'sensacionalismo'], 
    savedArticles: [],
    ratings: {} // Almacena valoraciones de noticias por ID/Título
};

function savePrefs() { localStorage.setItem('newsPrefs', JSON.stringify(userPrefs)); }

// Modal de Configuración / Onboarding
const settingsModal = document.getElementById('settings-modal');
document.getElementById('settings-btn').addEventListener('click', () => {
    document.getElementById('blocked-input').value = userPrefs.blockedKeywords.join(', ');
    settingsModal.classList.remove('hidden');
});
document.getElementById('close-settings').addEventListener('click', () => settingsModal.classList.add('hidden'));
document.getElementById('save-settings-btn').addEventListener('click', () => {
    const rawVal = document.getElementById('blocked-input').value;
    userPrefs.blockedKeywords = rawVal.split(',').map(k => k.trim()).filter(k => k.length > 0);
    savePrefs();
    settingsModal.classList.add('hidden');
    cargarNoticias(categoriaActual);
});

// Lanzar Onboarding automático si es la primera vez estricta
if (!localStorage.getItem('newsPrefs')) {
    settingsModal.classList.remove('hidden');
}

// --- 3. ELEMENTOS DE UI Y MODAL DE LECTURA ---
const tabs = document.querySelectorAll('.categories-scroll button');
const feedContainer = document.getElementById('feed-container');
const readerModal = document.getElementById('reader-modal');

document.getElementById('close-modal').addEventListener('click', () => readerModal.classList.add('hidden'));

let articulosEnPantalla = [];
let categoriaActual = 'Resumen del Día';

tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
        tabs.forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        categoriaActual = e.target.getAttribute('data-category');
        
        if (categoriaActual === 'Guardados') {
            renderizarTarjetas(userPrefs.savedArticles, true);
        } else {
            cargarNoticias(categoriaActual);
        }
    });
});

// --- 4. EXTRACCIÓN DE MULTIMEDIA (FOTOS Y VÍDEOS) ---
function extraerMultimedia(item) {
    // Buscar imagen en thumbnail, enclosure o dentro del contenido HTML
    let imageUrl = item.thumbnail || (item.enclosure && item.enclosure.link);
    if (!imageUrl && item.content) {
        const imgMatch = item.content.match(/<img[^>]+src="([^">]+)"/);
        if (imgMatch) imageUrl = imgMatch[1];
    }
    if (!imageUrl && item.description) {
        const imgMatch = item.description.match(/<img[^>]+src="([^">]+)"/);
        if (imgMatch) imageUrl = imgMatch[1];
    }

    // Buscar vídeo embebido (iframe o video)
    let videoHtml = '';
    if (item.content) {
        const iframeMatch = item.content.match(/<iframe[^>]+src="([^">]+)"[^>]*>.*?<\/iframe>/);
        if (iframeMatch) {
            videoHtml = `<iframe src="${iframeMatch[1]}" frameborder="0" allowfullscreen></iframe>`;
        }
    }

    return { imageUrl, videoHtml };
}

// --- 5. GENERADOR DE TL;DR ---
function generarTLDR(textoHtml) {
    if (!textoHtml) return "Sin resumen disponible.";
    let textoPlano = textoHtml.replace(/<[^>]*>?/gm, '');
    let frases = textoPlano.split('. ').filter(f => f.length > 25);
    return frases.length > 0 ? frases.slice(0, 2).join('. ') + '...' : "Contenido de lectura rápida.";
}

// --- 6. RENDERIZAR TARJETAS CON BLUR Y ACCIONES ---
function renderizarTarjetas(articulos, esGuardado = false) {
    feedContainer.innerHTML = '';
    
    if (articulos.length === 0) {
        feedContainer.innerHTML = `<p style="text-align:center; padding: 40px; color: var(--text-muted);">No hay noticias disponibles en esta sección.</p>`;
        return;
    }

    articulos.forEach((item, index) => {
        const tldr = generarTLDR(item.resumen);
        const media = extraerMultimedia(item);
        const ratingActual = userPrefs.ratings[item.titulo] || 0;

        const card = document.createElement('article');
        card.className = 'news-card';
        
        let mediaHtml = media.imageUrl ? `<img src="${media.imageUrl}" class="card-media-thumb" alt="News Image" loading="lazy">` : '';

        card.innerHTML = `
            ${mediaHtml}
            <div class="card-content-pad">
                <div class="card-header-meta">
                    <span>🗞️ ${item.fuente}</span>
                    <span class="category-tag">${categoriaActual}</span>
                </div>
                <h2>${item.titulo}</h2>
                <p class="tldr">▶ ${tldr}</p>
                
                <div class="card-footer-actions">
                    <div class="action-group">
                        <button class="action-btn primary btn-leer">🔓 Leer Completa</button>
                        <button class="action-btn btn-guardar">${esGuardado ? '🗑️ Borrar' : '🔖 Guardar'}</button>
                    </div>
                    <div class="action-group">
                        <button class="action-btn btn-like ${ratingActual === 1 ? 'voted' : ''}">🔥 ${ratingActual === 1 ? 'Valorada' : 'Interesante'}</button>
                    </div>
                </div>
            </div>
        `;

        // Eventos seguros sin colapsar por comillas
        card.querySelector('.btn-leer').addEventListener('click', () => {
            document.getElementById('reader-title').innerText = item.titulo;
            document.getElementById('reader-source').innerText = item.fuente;
            document.getElementById('reader-date').innerText = new Date().toLocaleDateString();
            
            const heroMedia = document.getElementById('reader-hero-media');
            heroMedia.innerHTML = media.videoHtml || (media.imageUrl ? `<img src="${media.imageUrl}" alt="Hero">` : '');

            document.getElementById('reader-body').innerHTML = item.contenido || item.resumen;
            readerModal.classList.remove('hidden');
        });

        card.querySelector('.btn-guardar').addEventListener('click', () => {
            if (esGuardado) {
                userPrefs.savedArticles.splice(index, 1);
                savePrefs();
                renderizarTarjetas(userPrefs.savedArticles, true);
            } else {
                if (!userPrefs.savedArticles.some(a => a.titulo === item.titulo)) {
                    userPrefs.savedArticles.push(item);
                    savePrefs();
                    alert('🔖 Noticia guardada en tu bóveda offline.');
                } else {
                    alert('Ya tienes guardada esta noticia.');
                }
            }
        });

        card.querySelector('.btn-like').addEventListener('click', (e) => {
            userPrefs.ratings[item.titulo] = userPrefs.ratings[item.titulo] === 1 ? 0 : 1;
            savePrefs();
            e.target.classList.toggle('voted');
            e.target.innerHTML = userPrefs.ratings[item.titulo] === 1 ? '🔥 Valorada' : '🔥 Interesante';
        });

        feedContainer.appendChild(card);
    });
}

// --- 7. CARGA DE RSS CON FILTROS ---
async function cargarNoticias(categoria) {
    feedContainer.innerHTML = `<p style="text-align:center; padding: 40px; color: var(--text-muted);">Cargando flujo optimizado...</p>`;
    articulosEnPantalla = [];
    
    let rssUrl = 'https://feeds.bbci.co.uk/mundo/rss.xml';
    if (categoria === 'Finanzas') rssUrl = 'https://e00-expansion.uecdn.es/rss/mercados.xml';
    if (categoria === 'Tecnología') rssUrl = 'https://feeds.weblogssl.com/xataka2';
    if (categoria === 'Deportes') rssUrl = 'https://as.com/rss/futbol/primera.xml';

    const proxyUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;

    try {
        const respuesta = await fetch(proxyUrl);
        const datos = await respuesta.json();
        
        if (datos.status !== "ok") throw new Error("Error RSS");

        datos.items.forEach(item => {
            const titular = item.title ? item.title.toLowerCase() : "";
            const bloqueado = userPrefs.blockedKeywords.some(kw => titular.includes(kw.toLowerCase().trim()));
            
            if (!bloqueado) {
                articulosEnPantalla.push({
                    titulo: item.title,
                    resumen: item.description || "",
                    contenido: item.content || item.description || "",
                    fuente: datos.feed.title || categoria,
                    enclosure: item.enclosure || null,
                    thumbnail: item.thumbnail || null
                });
            }
        });

        renderizarTarjetas(articulosEnPantalla, false);

    } catch (error) {
        console.error(error);
        feedContainer.innerHTML = `<p style="text-align:center; color: #ef4444; padding: 40px;">Error al conectar con los canales RSS.</p>`;
    }
}

// Arrancar app
cargarNoticias('Resumen del Día');
