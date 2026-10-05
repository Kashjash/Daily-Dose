// 1. Gestión del Tema (Claro/Oscuro)
const themeToggleBtn = document.getElementById('theme-toggle');
const currentTheme = localStorage.getItem('theme') || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

// Aplicar el tema guardado al cargar
document.documentElement.setAttribute('data-theme', currentTheme);

themeToggleBtn.addEventListener('click', () => {
    let theme = document.documentElement.getAttribute('data-theme');
    let newTheme = theme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme); // Se guarda en el dispositivo del usuario
});

// 2. Inicialización del Perfil de Usuario Local
function initUserProfile() {
    let userPrefs = JSON.parse(localStorage.getItem('newsPrefs'));
    
    if (!userPrefs) {
        // Es la primera vez que esta persona abre la app
        userPrefs = {
            blockedKeywords: ['clickbait', 'woke', 'right'],
            savedSources: ['Reuters', 'Bloomberg', 'Xataka'],
            savedArticles: []
        };
        localStorage.setItem('newsPrefs', JSON.stringify(userPrefs));
        console.log("Nuevo perfil local creado.");
    } else {
        console.log("Perfil cargado. Palabras bloqueadas:", userPrefs.blockedKeywords);
    }
}

initUserProfile();
