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

// --- 2. PERFIL Y CONFIGURACIÓN LOCAL ---
let userPrefs = JSON.parse(localStorage.getItem('newsPrefs')) || { 
    blockedKeywords: ['clickbait', 'woke', 'sorprendente'], 
    savedArticles: [] 
};
function savePrefs() { localStorage.setItem('newsPrefs', JSON.stringify(userPrefs)); }

// Mostrar indicador de usuario en vivo
document.getElementById('user-badge').innerText = `👤 Perfil Local`;

// --- 3. ELEMENTOS DE INTERFAZ Y MODALES ---
const tabs = document.querySelectorAll('.categories-scroll button');
const feedContainer = document.getElementById('feed-container');
const readerModal = document.getElementById('reader-modal');
const settingsModal = document.getElementById('settings-modal');

document.getElementById('close-modal').addEventListener('click', () => readerModal.classList.add('hidden'));
document.getElementById('close-settings').addEventListener('click', () => settingsModal.classList.add('hidden'));
document.getElementById('settings-btn').addEventListener('click', () => {
    document.getElementById('blocked-input').value = userPrefs.blockedKeywords.join(', ');
    settingsModal.classList.remove('hidden');
});
document.getElementById('save-settings-btn').addEventListener('click', () => {
    const rawVal = document.getElementById('blocked-input').value;
    userPrefs.blockedKeywords = rawVal.split(',').map(k => k.trim()).filter(k => k.length > 0);
    savePrefs();
    settingsModal.classList.add('hidden');
    alert('Filtros actualizados localmente.');
    location.reload();
});

let articulosEnPantalla = [];
let categoriaActual = 'Resumen del Día';

// --- 4. NAVEGACIÓN POR PESTAÑAS ---
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

// --- 5. GENERADOR DE TL;DR ---
function generarTLDR(textoHtml) {
    if (!textoHtml) return "Sin resumen disponible.";
    let textoPlano = textoHtml.replace(/<[^>]*>?/gm, '');
    let frases = textoPlano.split('. ').filter(f => f.length > 20);
    return frases.length > 0 ? frases.slice(0, 2).join('. ') + '...' : "Contenido breve.";
}

// --- 6. RENDERIZAR TARJETAS CON EVENTOS SEGUROS ---
function renderizarTarjetas(articulos, esGuardado = false) {
    feedContainer.innerHTML = '';
    
    if (articulos.length === 0) {
        feedContainer.innerHTML = `<p style="text-align:center; padding: 40px; color: var(--text-muted);">No hay noticias disponibles en esta sección.</p>`;
        return;
    }

    articulos.forEach((item, index) => {
        const tldr = generarTLDR(item.resumen);
        
        const card = document.createElement('article');
        card.className = 'news-card';
        card.innerHTML = `
            <div class="card-meta">🗞️ ${item.fuente}</div>
            <h2>${item.titulo}</h2>
            <p class="tldr">▶ ${tldr}</p>
            <div class="card-actions">
                <button class="primary btn-leer">🔓 Leer Completa</button>
                <button class="btn-accion">${esGuardado ? '🗑️ Borrar' : '🔖 Guardar'}</button>
                ${!esGuardado ? '<button class="btn-ocultar">❌ Ocultar</button>' : ''}
            </div>
        `;

        // Asociar eventos por código (elimina por completo los fallos de comillas o sintaxis)
        card.querySelector('.btn-leer').addEventListener('click', () => {
            document.getElementById('reader-title').innerText = item.titulo;
            document.getElementById('reader-body').innerHTML = item.contenido || item.resumen;
            readerModal.classList.remove('hidden');
            window.scrollTo(0, 0);
        });

        card.querySelector('.btn-accion').addEventListener('click', () => {
            if (esGuardado) {
                userPrefs.savedArticles.splice(index, 1);
                savePrefs();
                renderizarTarjetas(userPrefs.savedArticles, true);
            } else {
                if (!userPrefs.savedArticles.some(a => a.titulo === item.titulo)) {
                    userPrefs.savedArticles.push(item);
                    savePrefs();
                    alert('🔖 Noticia guardada en tu bóveda local.');
                } else {
                    alert('Esta noticia ya estaba guardada.');
                }
            }
        });

        if (!esGuardado) {
            card.querySelector('.btn-ocultar').addEventListener('click', () => {
                card.remove();
            });
        }

        feedContainer.appendChild(card);
    });
}

// --- 7. CARGA DE RSS ---
async function cargarNoticias(categoria) {
    feedContainer.innerHTML = `<p style="text-align:center; padding: 40px; color: var(--text-muted);">Sincronizando actualidad...</p>`;
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
            const bloqueado = userPrefs.blockedKeywords.some(kw => titular.includes(kw.toLowerCase()));
            
            if (!bloqueado) {
                articulosEnPantalla.push({
                    titulo: item.title,
                    resumen: item.description || "",
                    contenido: item.content || item.description || "",
                    fuente: datos.feed.title || categoria
                });
            }
        });

        renderizarTarjetas(articulosEnPantalla, false);

    } catch (error) {
        console.error(error);
        feedContainer.innerHTML = `<p style="text-align:center; color: #ef4444; padding: 40px;">No se pudieron cargar los datos de la red de origen.</p>`;
    }
}

// Inicializar app
cargarNoticias('Resumen del Día');
