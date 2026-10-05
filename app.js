// --- 1. GESTIÓN DE TEMA ---
const themeToggleBtn = document.getElementById('theme-toggle');
const currentTheme = localStorage.getItem('theme') || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
document.documentElement.setAttribute('data-theme', currentTheme);

themeToggleBtn.addEventListener('click', () => {
    let theme = document.documentElement.getAttribute('data-theme');
    let newTheme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
});

// --- 2. PERFIL LOCAL Y CATEGORÍAS ---
let userPrefs = JSON.parse(localStorage.getItem('newsPrefs')) || { 
    blockedKeywords: ['clickbait', 'rumor'], 
    savedArticles: [],
    categories: ['Resumen del Día', 'Finanzas', 'Tecnología', 'Deportes', 'Guardados'],
    ratings: {}
};

function savePrefs() { localStorage.setItem('newsPrefs', JSON.stringify(userPrefs)); }

// Renderizar categorías de forma persistente y segura
function renderizarCategorias() {
    const container = document.getElementById('categories-container');
    if (!container) return;
    container.innerHTML = '';
    
    userPrefs.categories.forEach((cat, index) => {
        const btn = document.createElement('button');
        btn.innerText = cat === 'Guardados' ? '🔖 Guardados' : cat;
        if (cat === categoriaActual) btn.className = 'active';
        else if (!categoriaActual && index === 0) {
            btn.className = 'active';
            categoriaActual = cat;
        }
        
        btn.addEventListener('click', (e) => {
            container.querySelectorAll('button').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            categoriaActual = cat;
            
            if (cat === 'Guardados') {
                renderizarTarjetas(userPrefs.savedArticles, true);
            } else {
                cargarNoticias(cat);
            }
        });
        container.appendChild(btn);
    });
}

// Configuración modal
const settingsModal = document.getElementById('settings-modal');
document.getElementById('settings-btn').addEventListener('click', () => {
    document.getElementById('blocked-input').value = userPrefs.blockedKeywords.join(', ');
    document.getElementById('categories-input').value = userPrefs.categories.filter(c => c !== 'Guardados').join(', ');
    settingsModal.classList.remove('hidden');
    document.body.classList.add('modal-open');
});

document.getElementById('close-settings').addEventListener('click', () => {
    settingsModal.classList.add('hidden');
    document.body.classList.remove('modal-open');
});

document.getElementById('save-settings-btn').addEventListener('click', () => {
    const rawKw = document.getElementById('blocked-input').value;
    const rawCats = document.getElementById('categories-input').value;
    
    userPrefs.blockedKeywords = rawKw.split(',').map(k => k.trim()).filter(k => k.length > 0);
    const nuevasCats = rawCats.split(',').map(c => c.trim()).filter(c => c.length > 0);
    if (!nuevasCats.includes('Guardados')) nuevasCats.push('Guardados');
    
    userPrefs.categories = nuevasCats;
    savePrefs();
    settingsModal.classList.add('hidden');
    document.body.classList.remove('modal-open');
    renderizarCategorias();
    cargarNoticias(userPrefs.categories[0]);
});

// --- 3. MODAL DE LECTURA INMERSIVA ---
const readerModal = document.getElementById('reader-modal');
document.getElementById('close-modal').addEventListener('click', () => {
    readerModal.classList.add('hidden');
    document.body.classList.remove('modal-open');
});

let articulosEnPantalla = [];
let categoriaActual = userPrefs.categories[0] || 'Resumen del Día';

// --- 4. UTILIDADES: TIEMPO DE LECTURA, IDIOMA Y MULTIMEDIA ---
function calcularTiempoLectura(textoHtml) {
    if (!textoHtml) return "1 min";
    let textoPlano = textoHtml.replace(/<[^>]*>?/gm, '');
    let palabras = textoPlano.split(/\s+/).length;
    let minutos = Math.ceil(palabras / 200); // 200 palabras por minuto promedio
    return `${minutos} min lectura`;
}

function detectarIdioma(texto) {
    if (!texto) return "Español";
    let textoLC = texto.toLowerCase();
    // Palabras comunes en inglés vs español para una detección rápida y ligera
    let tokensIngles = ['the', 'and', 'with', 'from', 'that', 'this', 'have', 'said', 'will'];
    let matches = tokensIngles.filter(token => textoLC.includes(` ${token} `)).length;
    return matches >= 2 ? "English" : "Español";
}

function extraerMultimedia(item) {
    let imageUrl = item.thumbnail || (item.enclosure && item.enclosure.link);
    if (!imageUrl && item.content) {
        const imgMatch = item.content.match(/<img[^>]+src="([^">]+)"/);
        if (imgMatch) imageUrl = imgMatch[1];
    }
    if (!imageUrl && item.description) {
        const imgMatch = item.description.match(/<img[^>]+src="([^">]+)"/);
        if (imgMatch) imageUrl = imgMatch[1];
    }

    let videoHtml = '';
    if (item.content) {
        const iframeMatch = item.content.match(/<iframe[^>]+src="([^">]+)"[^>]*>.*?<\/iframe>/);
        if (iframeMatch) {
            videoHtml = `<iframe src="${iframeMatch[1]}" frameborder="0" allowfullscreen></iframe>`;
        }
    }

    return { imageUrl, videoHtml };
}

function generarTLDR(textoHtml) {
    if (!textoHtml) return "Sin resumen disponible.";
    let textoPlano = textoHtml.replace(/<[^>]*>?/gm, '');
    let frases = textoPlano.split('. ').filter(f => f.length > 25);
    return frases.length > 0 ? frases.slice(0, 2).join('. ') + '...' : "Contenido de lectura rápida.";
}

// --- 5. RENDERIZAR TARJETAS ---
const feedContainer = document.getElementById('feed-container');

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
        const tiempoLectura = calcularTiempoLectura(item.contenido || item.resumen);
        const idioma = detectarIdioma(item.titulo + " " + item.resumen);

        const card = document.createElement('article');
        card.className = 'news-card';
        
        let mediaHtml = media.imageUrl ? `<img src="${media.imageUrl}" class="card-media-thumb" alt="News Image" loading="lazy">` : '';

        card.innerHTML = `
            ${mediaHtml}
            <div class="card-content-pad">
                <div class="card-header-meta">
                    <span>🗞️ ${item.fuente}</span>
                    <span>⏱️ ${tiempoLectura} • 🌐 ${idioma}</span>
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

        card.querySelector('.btn-leer').addEventListener('click', () => {
            document.getElementById('reader-title').innerText = item.titulo;
            document.getElementById('reader-source').innerText = item.fuente;
            document.getElementById('reader-date').innerText = item.fecha || new Date().toLocaleDateString();
            document.getElementById('reader-lang').innerText = idioma;
            document.getElementById('reader-time').innerText = tiempoLectura;
            
            const heroMedia = document.getElementById('reader-hero-media');
            heroMedia.innerHTML = media.videoHtml || (media.imageUrl ? `<img src="${media.imageUrl}" alt="Hero">` : '');

            document.getElementById('reader-body').innerHTML = item.contenido || item.resumen;
            
            // Abrir modal y bloquear scroll de fondo de forma estricta
            readerModal.classList.remove('hidden');
            document.body.classList.add('modal-open');
            readerModal.querySelector('.modal-scroll-area').scrollTop = 0;
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

// --- 6. CARGA RSS ---
async function cargarNoticias(categoria) {
    feedContainer.innerHTML = `<p style="text-align:center; padding: 40px; color: var(--text-muted);">Sincronizando noticias recientes...</p>`;
    articulosEnPantalla = [];
    
    let rssUrl = 'https://feeds.bbci.co.uk/mundo/rss.xml';
    let catLower = categoria.toLowerCase();
    
    if (catLower.includes('finanz') || catLower.includes('mercado')) {
        rssUrl = 'https://e00-expansion.uecdn.es/rss/mercados.xml';
    } else if (catLower.includes('tecnolog') || catLower.includes('xataka')) {
        rssUrl = 'https://feeds.weblogssl.com/xataka2';
    } else if (catLower.includes('deporte') || catLower.includes('futbol')) {
        rssUrl = 'https://as.com/rss/motor/formula1.xml';
    }

    const proxyUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}&_t=${Date.now()}`;

    try {
        const respuesta = await fetch(proxyUrl);
        const datos = await respuesta.json();
        
        if (datos.status !== "ok") throw new Error("Error RSS");

        let itemsValidos = datos.items.map(item => {
            return {
                titulo: item.title,
                resumen: item.description || "",
                contenido: item.content || item.description || "",
                fuente: datos.feed.title || categoria,
                fechaPub: new Date(item.pubDate || Date.now()),
                fecha: new Date(item.pubDate || Date.now()).toLocaleDateString(),
                enclosure: item.enclosure || null,
                thumbnail: item.thumbnail || null
            };
        }).sort((a, b) => b.fechaPub - a.fechaPub);

        itemsValidos.forEach(item => {
            const titular = item.titulo ? item.titulo.toLowerCase() : "";
            const bloqueado = userPrefs.blockedKeywords.some(kw => titular.includes(kw.toLowerCase().trim()));
            
            if (!bloqueado) {
                articulosEnPantalla.push(item);
            }
        });

        renderizarTarjetas(articulosEnPantalla, false);

    } catch (error) {
        console.error(error);
        feedContainer.innerHTML = `<p style="text-align:center; color: #ef4444; padding: 40px;">Error al conectar con los canales RSS.</p>`;
    }
}

// Inicializar interfaz
renderizarCategorias();
cargarNoticias(userPrefs.categories[0] || 'Resumen del Día');
