// Configure Tailwind for class-based dark mode
if (window.tailwind) {
  tailwind.config = {
    darkMode: 'class'
  };
}

// 1. Immediately apply theme before HTML finishes rendering (prevents screen flashing)
(function applyInitialTheme() {
  const savedTheme = localStorage.getItem('tt_theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = savedTheme === 'dark' || (!savedTheme && prefersDark);

  if (isDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
})();

// 2. Global Toggle Handler
function toggleTheme() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('tt_theme', isDark ? 'dark' : 'light');
  updateThemeToggleUI();
}

// 3. Keep toggle buttons synced across all pages
function updateThemeToggleUI() {
  const isDark = document.documentElement.classList.contains('dark');
  const icons = document.querySelectorAll('.theme-icon');
  const labels = document.querySelectorAll('.theme-label');

  icons.forEach(el => el.innerText = isDark ? '🌙' : '☀️');
  labels.forEach(el => el.innerText = isDark ? 'Dark' : 'Light');
}

// Run UI icon update when DOM is loaded
document.addEventListener('DOMContentLoaded', updateThemeToggleUI);
