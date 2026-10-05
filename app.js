// Gestión de Tema
const themeToggleBtn = document.getElementById('theme-toggle');
const currentTheme = localStorage.getItem('theme') || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
document.documentElement.setAttribute('data-theme', currentTheme);

themeToggleBtn.addEventListener('click', () => {
    let theme = document.documentElement.getAttribute('data-theme');
    let newTheme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
});

// Filtros y Perfil Local
const userPrefs = JSON.parse(localStorage.getItem('newsPrefs')) || { 
    blockedKeywords: ['clickbait', 'woke', 'sorprendente'], 
    savedArticles: [] 
};
function savePrefs() { localStorage.setItem('newsPrefs', JSON.stringify(userPrefs)); }

// Elementos de la interfaz
const tabs = document.querySelectorAll('.categories-scroll button');
const feedContainer = document.getElementById('feed-container');
const modal = document.getElementById('reader-modal');
const closeModal = document.getElementById('close-modal');

// Bóveda temporal para evitar errores de sintaxis en el HTML
let articulosEnPantalla = []; 

closeModal.addEventListener('click', () => modal.classList.add('hidden'));

// Lógica de Pestañas
tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
        tabs.forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        const categoria = e.target.innerText;
        
        if (categoria.includes('Guardados')) {
            mostrarGuardados();
        } else {
            cargarNoticias(categoria);
        }
    });
});

// Generador de TL;DR
function generarTLDR(textoHtml) {
    if (!textoHtml) return "Sin resumen disponible.";
    let textoPlano = textoHtml.replace(/<[^>]*>?/gm, ''); // Quita etiquetas HTML
    let frases = textoPlano.split('. ').filter(f => f.length > 20);
    return frases.length > 0 ? frases.slice(0, 2).join('. ') + '...' : "Contenido muy breve.";
}

// Funciones globales vinculadas a los botones numéricamente
window.abrirLector = function(index, esGuardado = false) {
    const articulo = esGuardado ? userPrefs.savedArticles[index] : articulosEnPantalla[index];
    document.getElementById('reader-title').innerText = articulo.titulo;
    document.getElementById('reader-body').innerHTML = articulo.contenido || articulo.resumen;
    modal.classList.remove('hidden');
    window.scrollTo(0, 0);
};

window.guardarNoticia = function(index) {
    const articulo = articulosEnPantalla[index];
    if (!userPrefs.savedArticles.some(a => a.titulo === articulo.titulo)) {
        userPrefs.savedArticles.push(articulo);
        savePrefs();
        alert('🔖 Noticia guardada para leer sin conexión.');
    }
};

window.borrarGuardado = function(index) {
    userPrefs.savedArticles.splice(index, 1);
    savePrefs();
    mostrarGuardados();
};

window.ocultarNoticia = function(btnElement) {
    btnElement.closest('.news-card').style.display = 'none';
};

// Inyector visual
function renderizarTarjetas(articulos, esGuardado = false) {
    feedContainer.innerHTML = '';
    
    if (articulos.length === 0) {
        feedContainer.innerHTML = '<p style="text-align:center; padding: 40px;">No hay noticias para mostrar en esta sección.</p>';
        return;
    }

    articulos.forEach((item, index) => {
        const tldr = generarTLDR(item.resumen);
        
        // El botón ahora solo pasa el índice numérico (0, 1, 2...), blindando el código
        let actionBtn = esGuardado 
            ? `<button onclick="borrarGuardado(${index})">🗑️ Borrar</button>`
            : `<button onclick="guardarNoticia(${index})">🔖 Guardar</button>`;

        const articuloHTML = `
            <article class="news-card">
                <div class="card-meta"><span class="source">🗞️ ${item.fuente}</span></div>
                <h2>${item.titulo}</h2>
                <p class="tldr">▶ ${tldr}</p>
                <div class="card-actions">
                    <button onclick="abrirLector(${index}, ${esGuardado})">🔓 Leer Completa</button>
                    ${actionBtn}
                    ${!esGuardado ? `<button onclick="ocultarNoticia(this)">❌ Ocultar</button>` : ''}
                </div>
            </article>
        `;
        feedContainer.insertAdjacentHTML('beforeend', articuloHTML);
    });
}

function mostrarGuardados() {
    renderizarTarjetas(userPrefs.savedArticles, true);
}

// Extracción y Filtrado
async function cargarNoticias(categoria) {
    feedContainer.innerHTML = '<p style="text-align:center; padding: 40px;">Buscando información limpia...</p>';
    articulosEnPantalla = []; // Limpiar la bóveda al cambiar de pestaña
    
    let rssUrl = 'https://feeds.bbci.co.uk/mundo/rss.xml'; // Resumen global
    if (categoria === 'Finanzas') rssUrl = 'https://e00-expansion.uecdn.es/rss/mercados.xml';
    if (categoria === 'Tecnología') rssUrl = 'https://feeds.weblogssl.com/xataka2';
    if (categoria === 'Deportes') rssUrl = 'https://as.com/rss/futbol/primera.xml';

    const proxyUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;

    try {
        const respuesta = await fetch(proxyUrl);
        const datos = await respuesta.json();
        
        if (datos.status !== "ok") throw new Error("Fallo en la conversión RSS");

        datos.items.forEach(item => {
            const titular = item.title ? item.title.toLowerCase() : "";
            const bloqueado = userPrefs.blockedKeywords.some(kw => titular.includes(kw.toLowerCase()));
            
            if (!bloqueado) {
                // Se guardan temporalmente de forma segura
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
        console.error("Error extrañendo datos:", error);
        feedContainer.innerHTML = '<p style="text-align:center; color: red;">Fallo en la conexión. Los servidores de origen podrían estar bloqueando la petición.</p>';
    }
}

// Arrancar app al iniciar
cargarNoticias('Resumen del Día');
