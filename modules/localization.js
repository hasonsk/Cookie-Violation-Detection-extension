const DEFAULT_LANGUAGE = 'en';
let currentMessages = {};

async function loadMessages(lang) {
  try {
    const response = await fetch(chrome.runtime.getURL(`_locales/${lang}/messages.json`));
    if (!response.ok) {
      throw new Error(`Failed to load messages for language: ${lang}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Error loading messages for ${lang}:`, error);
    // Fallback to default language if loading fails
    if (lang !== DEFAULT_LANGUAGE) {
      console.warn(`Falling back to default language: ${DEFAULT_LANGUAGE}`);
      return loadMessages(DEFAULT_LANGUAGE);
    }
    return {}; // Return empty if default also fails
  }
}

function applyTranslations(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.getAttribute('data-i18n');
    if (currentMessages[key] && currentMessages[key].message) {
      element.textContent = currentMessages[key].message;
    } else {
      console.warn(`Missing translation for key: ${key}`);
    }
  });

  root.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
    const key = element.getAttribute('data-i18n-placeholder');
    if (currentMessages[key] && currentMessages[key].message) {
      element.placeholder = currentMessages[key].message;
    } else {
      console.warn(`Missing translation for placeholder key: ${key}`);
    }
  });
}

async function initializeLocalization() {
  const settings = await chrome.storage.sync.get('language');
  const userLang = settings.language || DEFAULT_LANGUAGE;
  currentMessages = await loadMessages(userLang);
  applyTranslations();

  // Set the language dropdown to the current language
  const languageSelect = document.querySelector('select[data-setting="language"]');
  if (languageSelect) {
    languageSelect.value = userLang;
  }
}

async function changeLanguage(lang) {
  await chrome.storage.sync.set({ language: lang });
  currentMessages = await loadMessages(lang);
  applyTranslations();
}

export { initializeLocalization, applyTranslations, changeLanguage };
