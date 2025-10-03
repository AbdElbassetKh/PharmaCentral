/**
 * PharmaCentral News Aggregator
 * 
 * Features:
 * - Real-time RSS feed aggregation from pharmaceutical news sources
 * - Automatic translation to Arabic using multiple translation APIs
 * - Caching system for both articles and translations
 * - RTL (Right-to-Left) support for Arabic language
 * - Responsive design with mobile support
 * - Enhanced security with XSS protection and CSP
 * - Accessibility features with ARIA labels and keyboard navigation
 * - Performance optimizations with lazy loading and batch processing
 * - Error handling with retry logic and user-friendly notifications
 * 
 * Translation System:
 * - Uses multiple translation APIs (Lingva, Google Translate, MyMemory)
 * - Quality evaluation for translations
 * - Batch processing with progress tracking
 * - Translations are cached in localStorage to avoid re-translating
 * - Articles are translated on-demand when switching to Arabic
 * 
 * Security Features:
 * - Content Security Policy (CSP) headers
 * - XSS protection with HTML sanitization
 * - URL validation for external links
 * - Input validation and escaping
 * 
 * Performance Features:
 * - Lazy loading for images
 * - Batch translation processing
 * - Memory management and cleanup
 * - Optimized mobile performance
 * 
 * Accessibility Features:
 * - ARIA labels and roles
 * - Keyboard navigation support
 * - Skip links for screen readers
 * - High contrast mode support
 * - Focus indicators
 */

// Real RSS Feed Data
const RSS_FEEDS = [
  {
    name: "FiercePharma",
    name_ar: "فييرس فارما",
    url: "https://www.fiercepharma.com/rss/xml",
    category: "Pharma News",
    category_ar: "أخبار الأدوية"
  },
  {
    name: "BioPharma Dive",
    name_ar: "بايو فارما دايف", 
    url: "https://www.biopharmadive.com/feeds/news/",
    category: "Biotechnology",
    category_ar: "التكنولوجيا الحيوية"
  },
  {
    name: "STAT Pharma",
    name_ar: "ستات فارما",
    url: "https://www.statnews.com/category/pharma/feed/",
    category: "Medical News",
    category_ar: "الأخبار الطبية"
  },
  {
    name: "PharmaTimes",
    name_ar: "فارما تايمز",
    url: "https://www.pharmatimes.com/feed",
    category: "Industry News",
    category_ar: "أخبار الصناعة"
  },
  {
    name: "Medical Xpress",
    name_ar: "ميديكال إكسبريس",
    url: "https://medicalxpress.com/rss-feed/",
    category: "Medical Research",
    category_ar: "البحوث الطبية"
  },
  {
    name: "Medical Daily",
    name_ar: "ميديكال ديلي",
    url: "https://www.medicaldaily.com/rss",
    category: "Health News",
    category_ar: "الأخبار الصحية"
  },
  {
    name: "World Pharma News",
    name_ar: "أخبار الأدوية العالمية",
    url: "https://www.worldpharmanews.com/?format=feed",
    category: "Global Pharma",
    category_ar: "الأدوية العالمية"
  },
  {
    name: "MedlinePlus",
    name_ar: "ميدلاين بلس",
    url: "https://medlineplus.gov/groupfeeds/new.xml",
    category: "Health Information",
    category_ar: "المعلومات الصحية"
  },
  {
    name: "FDA Law Blog",
    name_ar: "مدونة قانون إدارة الغذاء والدواء",
    url: "https://www.thefdalawblog.com/feed",
    category: "Regulatory",
    category_ar: "تنظيمي"
  }
];

// CORS Proxies with fallback support - Enhanced list
const CORS_PROXIES = [
  {
    url: "https://api.rss2json.com/v1/api.json?rss_url=",
    type: "json",
    description: "RSS2JSON API (returns JSON instead of XML)"
  },
  {
    url: "https://corsproxy.io/?url=",
    type: "xml",
    description: "CORS Proxy IO"
  },
  {
    url: "https://api.allorigins.win/raw?url=",
    type: "xml",
    description: "AllOrigins Raw API"
  }
];

// Translation cache
const translationCache = new Map();

// Enhanced translation cache with localStorage and Unicode support

// Helper function to encode Unicode strings safely
function unicodeToBase64(str) {
  try {
    const utf8Bytes = new TextEncoder().encode(str);
    const binaryString = String.fromCharCode(...utf8Bytes);
    return btoa(binaryString);
  } catch (error) {
    console.warn('Base64 encoding failed, using simple hash:', error);
    // Fallback: use simple hash if btoa fails
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }
}

function getCachedTranslation(text) {
  try {
    const key = `translation_${unicodeToBase64(text.substring(0, 100))}`;
    const cached = localStorage.getItem(key);
    if (cached) {
      const data = JSON.parse(cached);
      // Check if cache is not older than 7 days
      if (Date.now() - data.timestamp < 7 * 24 * 60 * 60 * 1000) {
        console.log(`✓ Using cached translation for: ${text.substring(0, 50)}...`);
        return data.translation;
      } else {
        // Remove expired cache
        localStorage.removeItem(key);
      }
    }
  } catch (error) {
    console.warn('Cache read error:', error);
  }
  return null;
}

function saveCachedTranslation(text, translation) {
  try {
    const key = `translation_${unicodeToBase64(text.substring(0, 100))}`;
    localStorage.setItem(key, JSON.stringify({
      original: text.substring(0, 100), // Save only preview
      translation: translation,
      timestamp: Date.now()
    }));
    console.log(`💾 Cached translation for: ${text.substring(0, 30)}...`);
  } catch (error) {
    console.warn('Cache save error:', error);
  }
}

function clearTranslationCache() {
  try {
    const keys = Object.keys(localStorage).filter(key => key.startsWith('translation_'));
    keys.forEach(key => localStorage.removeItem(key));
    
    // Also clear in-memory cache
    translationCache.clear();
    
    console.log(`🗑️ Cleared ${keys.length} cached translations from localStorage and memory`);
    
    // Show success message in current language
    const message = currentLanguage === 'ar' ? 
      'تم مسح ذاكرة الترجمة بنجاح!' : 
      'Translation cache cleared successfully!';
    
    if (window.toastManager) {
      window.toastManager.success(message);
    } else {
    alert(message);
    }
  } catch (error) {
    console.error('Failed to clear translation cache:', error);
    const errorMessage = currentLanguage === 'ar' ? 
      'فشل في مسح ذاكرة الترجمة' : 
      'Failed to clear translation cache';
    
    if (window.toastManager) {
      window.toastManager.error(errorMessage);
    } else {
    alert(errorMessage);
    }
  }
}

/**
 * Enhanced Translation API with batch processing and better error handling
 * Manages translation queue, quality evaluation, and progress tracking
 */
class TranslationManager {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.batchSize = 3;
    this.delayBetweenBatches = 2000;
    this.translationStats = {
      total: 0,
      successful: 0,
      failed: 0,
      cached: 0
    };
    this.qualityThreshold = 0.7; // Minimum quality score for translation
  }

  async translateText(text, sourceLanguage = 'en', targetLanguage = 'ar') {
  if (!text || text.trim().length === 0) {
    return '';
  }

  // Clean and normalize text
  const cleanText = text.trim().replace(/\s+/g, ' ');
  if (cleanText.length === 0) {
    console.warn('⚠️ Text is empty after cleaning, returning original');
    return text;
  }

  // Check cache first
  const cached = getCachedTranslation(cleanText);
  if (cached) return cached;

    // Add to queue for batch processing
    return new Promise((resolve) => {
      this.queue.push({
        text: cleanText,
        sourceLanguage,
        targetLanguage,
        resolve
      });
      
      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  async processQueue() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    const totalItems = this.queue.length;
    let processedItems = 0;
    
    // Show initial progress
    this.showProgress(0, totalItems);
    
    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, this.batchSize);
      
      console.log(`🔄 Processing translation batch of ${batch.length} items...`);
      
      // Process batch in parallel
      const promises = batch.map(item => this.translateSingleText(item));
      await Promise.allSettled(promises);
      
      processedItems += batch.length;
      
      // Update progress
      this.showProgress(processedItems, totalItems);
      
      // Delay between batches to respect rate limits
      if (this.queue.length > 0) {
        await this.delay(this.delayBetweenBatches);
      }
    }
    
    // Hide progress and show completion message
    this.hideProgress();
    
    if (window.toastManager) {
      const stats = this.getStats();
      const message = currentLanguage === 'ar' ? 
        `اكتملت الترجمة! نجح: ${stats.successful}/${stats.total}` : 
        `Translation complete! Success: ${stats.successful}/${stats.total}`;
      window.toastManager.success(message);
    }
    
    this.processing = false;
  }

  async translateSingleText(item) {
    const { text, sourceLanguage, targetLanguage, resolve } = item;
    
    this.translationStats.total++;
    
    try {
      const translation = await this.tryTranslationMethods(text, sourceLanguage, targetLanguage);
      
      // Evaluate translation quality
      const quality = this.evaluateTranslationQuality(text, translation, targetLanguage);
      
      if (quality >= this.qualityThreshold) {
        this.translationStats.successful++;
        console.log(`✅ Translation quality: ${Math.round(quality * 100)}%`);
        resolve(translation);
    } else {
        console.warn(`⚠️ Low translation quality: ${Math.round(quality * 100)}%, using original text`);
        this.translationStats.failed++;
        resolve(text);
    }
  } catch (error) {
      console.warn('Translation failed:', error);
      this.translationStats.failed++;
      
      // Handle translation error
      if (window.errorHandler) {
        window.errorHandler.handleTranslationError(error, 'Translation');
      }
      
      resolve(text); // Return original text on failure
    }
  }

  async tryTranslationMethods(cleanText, sourceLanguage, targetLanguage) {
    console.log(`🌐 Translating: "${cleanText.substring(0, 50)}..."`);

    // Method 1: Try Lingva Translate (most reliable)
    try {
      const translation = await this.tryLingvaTranslate(cleanText, sourceLanguage, targetLanguage);
      if (translation) return translation;
    } catch (error) {
      console.log('Lingva failed, trying Google...', error.message);
    }

    // Method 2: Try Google Translate
    try {
      const translation = await this.tryGoogleTranslate(cleanText, sourceLanguage, targetLanguage);
      if (translation) return translation;
    } catch (error) {
      console.log('Google failed, trying MyMemory...', error.message);
    }

    // Method 3: Fallback to MyMemory
    try {
      const translation = await this.tryMyMemoryTranslate(cleanText, sourceLanguage, targetLanguage);
      if (translation) return translation;
    } catch (error) {
      console.log('MyMemory failed:', error.message);
    }

    // If all methods fail, return original text
    console.warn('⚠️ All translation services unavailable. Showing original text.');
    return cleanText;
  }

  async tryLingvaTranslate(cleanText, sourceLanguage, targetLanguage) {
    const lingvaUrl = `https://lingva.ml/api/v1/${sourceLanguage}/${targetLanguage}/${encodeURIComponent(cleanText)}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    const response = await fetch(lingvaUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data && data.translation) {
        const translatedText = data.translation;
        
        if (translatedText && translatedText !== cleanText && translatedText.length > 0) {
          saveCachedTranslation(cleanText, translatedText);
          console.log('✅ Translated via Lingva Translate');
          return translatedText;
        }
      }
    }
    return null;
  }

  async tryGoogleTranslate(cleanText, sourceLanguage, targetLanguage) {
    const cleanTextForGoogle = cleanText
      .replace(/'/g, "'")
      .replace(/—/g, "-")
      .replace(/"/g, '"')
      .replace(/"/g, '"');

    const googleUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLanguage}&tl=${targetLanguage}&dt=t&q=${encodeURIComponent(cleanTextForGoogle)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    let response;
    try {
      response = await fetch(googleUrl, { signal: controller.signal });
    } catch (corsError) {
      response = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(googleUrl)}`, {
      signal: controller.signal
    });
    }
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data && data[0] && data[0][0] && data[0][0][0]) {
        const translatedText = data[0].map(item => item[0]).join('');
        
        if (translatedText && translatedText !== cleanText && translatedText.length > 0) {
          saveCachedTranslation(cleanText, translatedText);
          console.log('✅ Translated via Google Translate');
          return translatedText;
        }
      }
    }
    return null;
  }

  async tryMyMemoryTranslate(cleanText, sourceLanguage, targetLanguage) {
    const myMemoryUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleanText.substring(0, 500))}&langpair=${sourceLanguage}|${targetLanguage}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    const response = await fetch(myMemoryUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.status === 429) {
      console.warn('⚠️ MyMemory API limit reached');
      return null;
    }

    if (response.ok) {
      const data = await response.json();
      if (data.responseData && data.responseData.translatedText) {
        const translatedText = data.responseData.translatedText;
        
        if (translatedText && translatedText !== cleanText && translatedText.length > 0) {
          saveCachedTranslation(cleanText, translatedText);
          console.log('✅ Translated via MyMemory');
          return translatedText;
        }
      }
    }
    return null;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Evaluate translation quality
  evaluateTranslationQuality(original, translation, targetLanguage) {
    if (!original || !translation) return 0;
    
    // Basic quality checks
    let score = 0;
    
    // Length similarity (should be reasonable)
    const lengthRatio = Math.min(translation.length, original.length) / Math.max(translation.length, original.length);
    if (lengthRatio > 0.3 && lengthRatio < 3) score += 0.3;
    
    // Check for common translation issues
    const hasCommonIssues = this.checkCommonIssues(translation);
    if (!hasCommonIssues) score += 0.3;
    
    // Check for Arabic characters (if translating to Arabic)
    if (targetLanguage === 'ar') {
      const hasArabicChars = /[\u0600-\u06FF]/.test(translation);
      if (hasArabicChars) score += 0.2;
    }
    
    // Check for meaningful content (not just repeated characters)
    const hasMeaningfulContent = this.checkMeaningfulContent(translation);
    if (hasMeaningfulContent) score += 0.2;
    
    return Math.min(score, 1);
  }

  checkCommonIssues(translation) {
    const issues = [
      /^[a-zA-Z\s]*$/, // Only English characters
      /^[\u0600-\u06FF\s]*$/, // Only Arabic characters (might be too restrictive)
      /^[0-9\s]*$/, // Only numbers
      /^[^\w\s\u0600-\u06FF]*$/, // Only special characters
      /(.)\1{3,}/, // Repeated characters
      /^.{1,3}$/, // Too short
      /^.{200,}$/ // Too long
    ];
    
    return issues.some(pattern => pattern.test(translation));
  }

  checkMeaningfulContent(translation) {
    // Check for meaningful words (not just single characters or repeated patterns)
    const words = translation.split(/\s+/).filter(word => word.length > 1);
    return words.length >= 2;
  }

  // Get translation statistics
  getStats() {
    return { ...this.translationStats };
  }

  // Reset statistics
  resetStats() {
    this.translationStats = {
      total: 0,
      successful: 0,
      failed: 0,
      cached: 0
    };
  }

  // Show translation progress
  showProgress(current, total) {
    if (window.toastManager) {
      const percentage = Math.round((current / total) * 100);
      const message = currentLanguage === 'ar' ? 
        `جاري الترجمة... ${percentage}%` : 
        `Translating... ${percentage}%`;
      
      // Update existing progress toast or create new one
      if (!this.progressToast) {
        this.progressToast = window.toastManager.info(message, 0); // No auto-dismiss
    } else {
        const messageEl = this.progressToast.querySelector('.toast-message');
        if (messageEl) {
          messageEl.textContent = message;
        }
      }
    }
  }

  // Hide translation progress
  hideProgress() {
    if (this.progressToast) {
      this.progressToast.remove();
      this.progressToast = null;
    }
  }
}

// Global translation manager instance
const translationManager = new TranslationManager();

// Backward compatibility function
async function translateText(text, sourceLanguage = 'en', targetLanguage = 'ar') {
  return translationManager.translateText(text, sourceLanguage, targetLanguage);
}

// Translate article titles and excerpts with enhanced error handling
async function translateArticle(article) {
  if (!article) return article;
  
  // Check if already translated
  if (article.title_ar && article.excerpt_ar) {
    console.log(`✓ Article already translated: ${article.title.substring(0, 30)}...`);
    return article;
  }
  
  try {
    console.log(`🔄 Translating: ${article.title.substring(0, 50)}...`);
    
    // Translate title and excerpt with individual error handling
    let titleAr = article.title;
    let excerptAr = article.excerpt;
    
    try {
      titleAr = await translateText(article.title, 'en', 'ar');
      console.log(`✅ Title translated: ${titleAr.substring(0, 30)}...`);
    } catch (error) {
      console.warn('⚠️ Title translation failed, using original:', error.message);
    }
    
    try {
      excerptAr = await translateText(article.excerpt, 'en', 'ar');
      console.log(`✅ Excerpt translated: ${excerptAr.substring(0, 30)}...`);
    } catch (error) {
      console.warn('⚠️ Excerpt translation failed, using original:', error.message);
    }
    
    // Ensure translations are saved to the article object
    article.title_ar = titleAr;
    article.excerpt_ar = excerptAr;
    
    return article;
  } catch (error) {
    console.error('❌ Failed to translate article:', error);
    // Set fallback to original text
    article.title_ar = article.title;
    article.excerpt_ar = article.excerpt;
    return article;
  }
}

// Note: translateArticles function removed - now using direct translation in toggleLanguage and loadMoreArticles

/**
 * Enhanced HTML sanitization to prevent XSS attacks
 * @param {string} str - The string to sanitize
 * @returns {string} - The sanitized HTML string
 */
function sanitizeHTML(str) {
  if (!str) return '';
  
  // Create a temporary div element
  const div = document.createElement('div');
  
  // Use textContent to safely escape HTML
  div.textContent = str;
  
  // Get the escaped content
  let escaped = div.innerHTML;
  
  // Additional sanitization for common XSS patterns
  escaped = escaped
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    .replace(/<link\b[^<]*(?:(?!<\/link>)<[^<]*)*<\/link>/gi, '')
    .replace(/<meta\b[^<]*(?:(?!<\/meta>)<[^<]*)*<\/meta>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  
  return escaped;
}

/**
 * Enhanced HTML attribute escaping to prevent XSS attacks
 * @param {string} str - The string to escape
 * @returns {string} - The escaped string safe for HTML attributes
 */
function escapeAttribute(str) {
  if (!str) return '';
  
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/`/g, '&#96;')
    .replace(/=/g, '&#61;')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
}

/**
 * Validate and sanitize URLs to prevent XSS and malicious redirects
 * @param {string} url - The URL to validate
 * @returns {string} - The validated URL or '#' if invalid
 */
function validateURL(url) {
  if (!url || typeof url !== 'string') return '#';
  
  try {
    const urlObj = new URL(url);
    
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      console.warn('Invalid protocol in URL:', url);
      return '#';
    }
    
    // Check for suspicious patterns
    const suspiciousPatterns = [
      /javascript:/i,
      /data:/i,
      /vbscript:/i,
      /onload/i,
      /onerror/i,
      /onclick/i
    ];
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(url)) {
        console.warn('Suspicious pattern detected in URL:', url);
        return '#';
      }
    }
    
    return url;
  } catch (error) {
    console.warn('Invalid URL:', url, error);
    return '#';
  }
}

/**
 * Lazy Loading System for Images
 * Uses IntersectionObserver to load images when they come into view
 */
class LazyLoader {
  constructor() {
    this.observer = null;
    this.init();
  }

  init() {
    // Check if IntersectionObserver is supported
    if ('IntersectionObserver' in window) {
      this.observer = new IntersectionObserver(
        (entries) => this.handleIntersection(entries),
        {
          root: null,
          rootMargin: '50px',
          threshold: 0.1
        }
      );
    }
  }

  observe(element) {
    if (this.observer && element) {
      this.observer.observe(element);
    }
  }

  handleIntersection(entries) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        this.loadImage(img);
        this.observer.unobserve(img);
      }
    });
  }

  loadImage(img) {
    const src = img.dataset.src;
    if (src) {
      const image = new Image();
      image.onload = () => {
        img.src = src;
        img.classList.add('loaded');
        img.classList.remove('lazy-image');
      };
      image.onerror = () => {
        img.classList.add('loaded');
        img.classList.remove('lazy-image');
        console.warn('Failed to load image:', src);
      };
      image.src = src;
    }
  }

  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}

// Global lazy loader instance
let lazyLoader;

/**
 * Toast Notification System
 * Manages user notifications with different types and auto-dismiss
 */
class ToastManager {
  constructor() {
    this.container = null;
    this.init();
  }

  init() {
    // Create toast container
    this.container = document.createElement('div');
    this.container.className = 'toast-container';
    this.container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 10px;
    `;
    document.body.appendChild(this.container);
  }

  show(message, type = 'info', duration = 5000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <div class="toast-icon">${this.getIcon(type)}</div>
        <div class="toast-message">${message}</div>
        <button class="toast-close" onclick="this.parentElement.parentElement.remove()" aria-label="Close notification">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    `;

    // Add close button styles
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.style.cssText = `
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      color: var(--color-text-secondary);
      transition: color 0.2s;
    `;

    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.color = 'var(--color-text)';
    });

    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.color = 'var(--color-text-secondary)';
    });

    this.container.appendChild(toast);

    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);

    // Auto remove
    if (duration > 0) {
      setTimeout(() => {
        this.remove(toast);
      }, duration);
    }

    return toast;
  }

  remove(toast) {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }

  getIcon(type) {
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    return icons[type] || icons.info;
  }

  success(message, duration = 5000) {
    return this.show(message, 'success', duration);
  }

  error(message, duration = 7000) {
    return this.show(message, 'error', duration);
  }

  warning(message, duration = 6000) {
    return this.show(message, 'warning', duration);
  }

  info(message, duration = 5000) {
    return this.show(message, 'info', duration);
  }
}

// Global toast manager instance
let toastManager;

/**
 * Enhanced Error Handling System
 * Provides retry logic and user-friendly error messages
 */
class ErrorHandler {
  constructor() {
    this.retryAttempts = 3;
    this.retryDelay = 1000;
    this.maxRetryDelay = 10000;
  }

  async withRetry(operation, context = '') {
    let lastError;
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        console.warn(`${context} - Attempt ${attempt} failed:`, error.message);
        
        if (attempt < this.retryAttempts) {
          const delay = Math.min(this.retryDelay * Math.pow(2, attempt - 1), this.maxRetryDelay);
          console.log(`Retrying in ${delay}ms...`);
          await this.delay(delay);
        }
      }
    }
    
    console.error(`${context} - All attempts failed:`, lastError);
    throw lastError;
  }

  handleNetworkError(error, context = '') {
    console.error(`${context} - Network error:`, error);
    
    if (window.toastManager) {
      let message;
      if (currentLanguage === 'ar') {
        message = 'خطأ في الشبكة. تحقق من اتصالك بالإنترنت.';
      } else {
        message = 'Network error. Please check your internet connection.';
      }
      window.toastManager.error(message);
    }
  }

  handleTranslationError(error, context = '') {
    console.error(`${context} - Translation error:`, error);
    
    if (window.toastManager) {
      let message;
      if (currentLanguage === 'ar') {
        message = 'فشل في الترجمة. سيتم عرض النص الأصلي.';
      } else {
        message = 'Translation failed. Showing original text.';
      }
      window.toastManager.warning(message);
    }
  }

  handleFeedError(error, feedName = '') {
    console.error(`Feed error for ${feedName}:`, error);
    
    if (window.toastManager) {
      let message;
      if (currentLanguage === 'ar') {
        message = `فشل في تحميل ${feedName}. جاري المحاولة مرة أخرى...`;
      } else {
        message = `Failed to load ${feedName}. Retrying...`;
      }
      window.toastManager.warning(message);
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Global error handler instance
let errorHandler;

/**
 * FeedManager Class for handling RSS feeds
 * Manages RSS feed fetching, parsing, caching, and background updates
 */
class FeedManager {
  constructor() {
    this.feeds = RSS_FEEDS;
    this.cache = new Map();
    this.lastUpdate = null;
    this.articles = [];
    this.retryAttempts = 3;
    this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours
    this.updateInterval = 30 * 60 * 1000; // 30 minutes
    this.loadFromCache();
    this.startBackgroundUpdates();
  }

  async fetchAllFeeds() {
    const loadingSpinner = document.getElementById('loadingSpinner');
    loadingSpinner?.classList.remove('hidden');
    
    // Update feed status to show loading
    this.updateFeedStatusLoading();
    
    console.log('Starting RSS feed fetch...');
    const articles = [];
    const feedPromises = this.feeds.map(feed => this.fetchFeedWithRetry(feed));
    
    const results = await Promise.allSettled(feedPromises);
    
    let successCount = 0;
    let failCount = 0;
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value && Array.isArray(result.value)) {
        articles.push(...result.value);
        successCount++;
        console.log(`✓ Successfully loaded ${result.value.length} articles from ${this.feeds[index].name}`);
      } else {
        console.error(`✗ Failed to fetch ${this.feeds[index].name}:`, result.reason?.message || result.reason);
        failCount++;
      }
    });

    this.articles = articles;
    this.lastUpdate = new Date();
    this.saveToCache();
    
    loadingSpinner?.classList.add('hidden');
    console.log(`🎉 Successfully loaded ${articles.length} articles from ${successCount}/${this.feeds.length} RSS feeds`);
    console.log(`📊 Feed Status: ${successCount} successful, ${failCount} failed`);
    
    // Update feed status in UI
    this.updateFeedStatus(successCount, failCount);
    
    // Show error if too many feeds failed
    if (failCount > this.feeds.length / 2) {
      const errorMessage = document.getElementById('errorMessage');
      if (errorMessage && articles.length === 0) {
        errorMessage.classList.remove('hidden');
      }
    }
    
    return articles;
  }

  async fetchFeedWithRetry(feed, proxyIndex = 0, attempt = 1) {
    if (proxyIndex >= CORS_PROXIES.length) {
      // Try direct fetch as last resort
      console.log(`All proxies failed for ${feed.name}, trying direct fetch...`);
      return this.fetchFeedDirect(feed);
    }

    try {
      const proxy = CORS_PROXIES[proxyIndex];
      const url = `${proxy.url}${encodeURIComponent(feed.url)}`;
      
      console.log(`Fetching ${feed.name} via ${proxy.description} (Attempt ${attempt})`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': proxy.type === 'json' ? 'application/json' : 'application/rss+xml, application/xml, text/xml'
        },
        timeout: 10000
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Validate content type
      const contentType = response.headers.get('content-type') || '';
      console.log(`Content-Type: ${contentType}`);

      let feedData;
      
      if (proxy.type === 'json') {
        // Handle JSON response from rss2json
        const jsonData = await response.json();
        
        if (!jsonData || jsonData.status !== 'ok') {
          throw new Error(`RSS2JSON API error: ${jsonData.message || 'Unknown error'}`);
        }
        
        feedData = {
          type: 'json',
          data: jsonData,
          feed: feed
        };
      } else {
        // Handle XML response from other proxies
        let xmlText;
        
        if (proxy.url.includes('allorigins.win')) {
          const json = await response.json();
          xmlText = json.contents;
        } else {
          xmlText = await response.text();
        }

        if (!xmlText || xmlText.length < 100) {
          throw new Error('Empty or invalid RSS response');
        }

        feedData = {
          type: 'xml',
          data: xmlText,
          feed: feed
        };
      }

      return this.parseFeed(feedData);
    } catch (error) {
      console.warn(`Failed to fetch ${feed.name} with proxy ${proxyIndex + 1} (${CORS_PROXIES[proxyIndex].description}): ${error.message}`);
      
      // Handle error with error handler
      if (window.errorHandler) {
        window.errorHandler.handleFeedError(error, feed.name);
      }
      
      if (attempt < this.retryAttempts) {
        // Retry with same proxy
        await this.delay(1000 * attempt);
        return this.fetchFeedWithRetry(feed, proxyIndex, attempt + 1);
      } else if (proxyIndex < CORS_PROXIES.length - 1) {
        // Try next proxy
        return this.fetchFeedWithRetry(feed, proxyIndex + 1, 1);
      } else {
        // Try direct fetch as last resort
        console.log(`All proxies failed for ${feed.name}, trying direct fetch...`);
        return this.fetchFeedDirect(feed);
      }
    }
  }

  // Direct fetch as last resort (bypasses CORS proxies)
  async fetchFeedDirect(feed) {
    try {
      console.log(`Attempting direct fetch for ${feed.name}...`);
      
      const response = await fetch(feed.url, {
        method: 'GET',
        mode: 'cors',
        headers: {
          'Accept': 'application/rss+xml, application/xml, text/xml'
        },
        timeout: 10000
      });

      if (!response.ok) {
        throw new Error(`Direct fetch failed: HTTP ${response.status}: ${response.statusText}`);
      }

      const xmlText = await response.text();
      
      if (!xmlText || xmlText.length < 100) {
        throw new Error('Empty or invalid RSS response from direct fetch');
      }

      const feedData = {
        type: 'xml',
        data: xmlText,
        feed: feed
      };

      return this.parseFeed(feedData);
    } catch (error) {
      console.error(`Direct fetch failed for ${feed.name}:`, error.message);
      throw new Error(`All fetch methods failed for ${feed.name}: ${error.message}`);
    }
  }

  parseFeed(feedData) {
    try {
      const { type, data, feed: feedInfo } = feedData;
      const articles = [];

      if (type === 'json') {
        // Parse JSON response from rss2json
        return this.parseJsonFeed(data, feedInfo);
      } else if (type === 'xml') {
        // Parse XML response
        return this.parseXmlFeed(data, feedInfo);
      } else {
        throw new Error(`Unsupported feed data type: ${type}`);
      }
    } catch (error) {
      console.error(`Feed parsing failed for ${feedData.feed.name}:`, error);
      throw error;
    }
  }

  // Parse JSON feed from rss2json API
  parseJsonFeed(jsonData, feedInfo) {
    try {
      const articles = [];
      
      if (!jsonData.items || !Array.isArray(jsonData.items)) {
        console.warn(`No items found in JSON feed: ${feedInfo.name}`);
        return articles;
      }

      jsonData.items.forEach((item, index) => {
        try {
          const article = this.parseJsonArticle(item, feedInfo, index);
          if (article) {
            articles.push(article);
          }
        } catch (error) {
          console.warn(`Failed to parse JSON article from ${feedInfo.name}:`, error);
        }
      });

      console.log(`Parsed ${articles.length} articles from JSON feed: ${feedInfo.name}`);
      return articles;
    } catch (error) {
      console.error(`JSON feed parsing failed for ${feedInfo.name}:`, error);
      throw error;
    }
  }

  // Parse XML feed
  parseXmlFeed(xmlText, feedInfo) {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
      
      // Check for parser errors
      const parserError = xmlDoc.querySelector('parsererror');
      if (parserError) {
        throw new Error('XML parsing failed: ' + parserError.textContent);
      }

      const articles = [];
      let items = xmlDoc.querySelectorAll('item');
      
      // Fallback for Atom feeds
      if (items.length === 0) {
        items = xmlDoc.querySelectorAll('entry');
      }

      if (items.length === 0) {
        console.warn(`No items found in XML feed: ${feedInfo.name}`);
        return articles;
      }

      items.forEach((item, index) => {
        try {
          const article = this.parseArticle(item, feedInfo, index);
          if (article) {
            articles.push(article);
          }
        } catch (error) {
          console.warn(`Failed to parse XML article from ${feedInfo.name}:`, error);
        }
      });

      console.log(`Parsed ${articles.length} articles from XML feed: ${feedInfo.name}`);
      return articles;
    } catch (error) {
      console.error(`XML feed parsing failed for ${feedInfo.name}:`, error);
      throw error;
    }
  }

  // Parse article from JSON feed (rss2json format)
  parseJsonArticle(item, feedInfo, index) {
    try {
      // Extract basic article data from JSON
      const title = item.title || '';
      const link = item.link || item.url || '';
      const description = item.description || item.content || item.summary || '';
      const pubDate = item.pubDate || item.published || item.date || '';
      
      if (!title) {
        console.warn('JSON article missing title, skipping');
        return null;
      }

      // Clean and truncate description
      let excerpt = this.cleanHtmlContent(description);
      if (excerpt.length > 200) {
        excerpt = excerpt.substring(0, 197) + '...';
      }

      // Parse publication date
      let publishDate = new Date();
      if (pubDate) {
        const parsed = new Date(pubDate);
        if (!isNaN(parsed.getTime())) {
          publishDate = parsed;
        }
      }

      // Extract categories/tags from JSON
      const categories = item.categories || item.tags || [];
      const categoryArray = Array.isArray(categories) ? categories : [categories].filter(Boolean);
      
      return {
        id: `${feedInfo.name}_${index}_${Date.now()}`,
        title: this.cleanText(title),
        excerpt: excerpt || 'No description available.',
        content: excerpt,
        source: feedInfo.name,
        source_url: link,
        category: feedInfo.category,
        category_ar: feedInfo.category_ar,
        publish_date: publishDate.toISOString(),
        tags: categoryArray.length > 0 ? categoryArray : [feedInfo.category],
        feedInfo: feedInfo
      };
    } catch (error) {
      console.warn(`Failed to parse JSON article from ${feedInfo.name}:`, error);
      return null;
    }
  }

  parseArticle(item, feedInfo, index) {
    const getTextContent = (selector) => {
      const element = item.querySelector(selector);
      return element ? element.textContent.trim() : '';
    };

    const getFirstTextContent = (selectors) => {
      for (const selector of selectors) {
        const content = getTextContent(selector);
        if (content) return content;
      }
      return '';
    };

    // Extract basic article data
    const title = getFirstTextContent(['title']);
    const link = getFirstTextContent(['link', 'guid']) || item.querySelector('link')?.getAttribute('href') || '';
    const description = getFirstTextContent(['description', 'summary', 'content']);
    const pubDate = getFirstTextContent(['pubDate', 'published', 'updated']);
    
    if (!title) {
      console.warn('Article missing title, skipping');
      return null;
    }

    // Clean and truncate description
    let excerpt = this.cleanHtmlContent(description);
    if (excerpt.length > 200) {
      excerpt = excerpt.substring(0, 197) + '...';
    }

    // Parse publication date
    let publishDate = new Date();
    if (pubDate) {
      const parsed = new Date(pubDate);
      if (!isNaN(parsed.getTime())) {
        publishDate = parsed;
      }
    }

    // Extract categories/tags
    const categories = Array.from(item.querySelectorAll('category')).map(cat => cat.textContent.trim());
    
    return {
      id: `${feedInfo.name}_${index}_${Date.now()}`,
      title: this.cleanText(title),
      excerpt: excerpt || 'No description available.',
      content: excerpt,
      source: feedInfo.name,
      source_url: link,
      category: feedInfo.category,
      category_ar: feedInfo.category_ar,
      publish_date: publishDate.toISOString(),
      tags: categories.length > 0 ? categories : [feedInfo.category],
      feedInfo: feedInfo
    };
  }

  cleanHtmlContent(html) {
    if (!html) return '';
    
    // Remove HTML tags and decode entities
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    const text = tempDiv.textContent || tempDiv.innerText || '';
    
    // Clean up whitespace
    return text.replace(/\s+/g, ' ').trim();
  }

  cleanText(text) {
    if (!text) return '';
    return text.replace(/\s+/g, ' ').trim();
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  saveToCache() {
    try {
      const cacheData = {
        articles: this.articles,
        lastUpdate: this.lastUpdate,
        timestamp: Date.now()
      };
      localStorage.setItem('pharma_news_cache', JSON.stringify(cacheData));
      
      // Save translation cache
      const translationCacheObj = {};
      translationCache.forEach((value, key) => {
        translationCacheObj[key] = value;
      });
      localStorage.setItem('translation_cache', JSON.stringify(translationCacheObj));
    } catch (error) {
      console.warn('Failed to save to cache:', error);
    }
  }

  loadFromCache() {
    try {
      const cached = localStorage.getItem('pharma_news_cache');
      if (cached) {
        const data = JSON.parse(cached);
        const age = Date.now() - data.timestamp;
        
        if (age < this.cacheExpiry && data.articles) {
          this.articles = data.articles;
          this.lastUpdate = new Date(data.lastUpdate);
          console.log(`📦 Loaded ${this.articles.length} articles from cache`);
          
          // Load translation cache
          const translationCacheData = localStorage.getItem('translation_cache');
          if (translationCacheData) {
            const translationCacheObj = JSON.parse(translationCacheData);
            Object.keys(translationCacheObj).forEach(key => {
              translationCache.set(key, translationCacheObj[key]);
            });
            console.log(`💾 Loaded ${Object.keys(translationCacheObj).length} translations from cache`);
          }
          
          // Load localStorage translation cache info
          const translationKeys = Object.keys(localStorage).filter(key => key.startsWith('translation_'));
          console.log(`🗄️ Found ${translationKeys.length} cached translations in localStorage`);
          
          return true;
        }
      }
    } catch (error) {
      console.warn('Failed to load from cache:', error);
    }
    return false;
  }

  updateFeedStatusLoading() {
    const feedStatusElement = document.getElementById('feedStatus');
    if (!feedStatusElement) return;

    const loadingText = currentLanguage === 'ar' 
      ? 'جاري تحميل المصادر...' 
      : 'Loading feeds...';

    feedStatusElement.innerHTML = `
      <div class="status-item">
        <span class="status-indicator loading"></span>
        <span>${loadingText}</span>
      </div>
    `;
  }

  updateFeedStatus(successCount, failCount) {
    const feedStatusElement = document.getElementById('feedStatus');
    if (!feedStatusElement) return;

    const totalFeeds = this.feeds.length;
    let statusText = currentLanguage === 'ar' 
      ? `تم تحميل ${successCount} من ${totalFeeds} مصدر بنجاح` 
      : `${successCount} of ${totalFeeds} feeds loaded successfully`;

    if (failCount > 0) {
      const failText = currentLanguage === 'ar' 
        ? `، فشل ${failCount} مصدر` 
        : `, ${failCount} failed`;
      statusText += failText;
    }

    feedStatusElement.innerHTML = `
      <div class="status-item">
        <span class="status-indicator ${failCount === 0 ? 'success' : failCount < totalFeeds / 2 ? 'warning' : 'error'}"></span>
        <span>${statusText}</span>
      </div>
    `;
  }

  startBackgroundUpdates() {
    // Store interval ID to allow cleanup
    if (this.updateIntervalId) {
      clearInterval(this.updateIntervalId);
    }
    
    this.updateIntervalId = setInterval(async () => {
      console.log('Background update starting...');
      try {
        await this.fetchAllFeeds();
        if (window.app) {
          window.app.refreshContent();
        }
      } catch (error) {
        console.error('Background update failed:', error);
      }
    }, this.updateInterval);
  }

  stopBackgroundUpdates() {
    if (this.updateIntervalId) {
      clearInterval(this.updateIntervalId);
      this.updateIntervalId = null;
    }
  }

  getArticles() {
    return this.articles || [];
  }

  getCategories() {
    const articles = this.getArticles();
    const categoryMap = new Map();
    
    articles.forEach(article => {
      const category = article.category;
      const categoryAr = article.category_ar || article.category;
      
      if (categoryMap.has(category)) {
        categoryMap.get(category).count++;
      } else {
        categoryMap.set(category, {
          name: category,
          name_ar: categoryAr,
          count: 1
        });
      }
    });
    
    return Array.from(categoryMap.values()).sort((a, b) => b.count - a.count);
  }

  getSources() {
    const articles = this.getArticles();
    const sourceMap = new Map();
    
    articles.forEach(article => {
      const source = article.source;
      if (sourceMap.has(source)) {
        sourceMap.get(source).count++;
      } else {
        const feedInfo = this.feeds.find(f => f.name === source);
        sourceMap.set(source, {
          name: source,
          name_ar: feedInfo ? feedInfo.name_ar : source,
          url: feedInfo ? feedInfo.url : '#',
          count: 1
        });
      }
    });
    
    return Array.from(sourceMap.values()).sort((a, b) => b.count - a.count);
  }
}

// Application State
let currentLanguage = 'en';
let filteredArticles = [];
let displayedArticles = [];
let articlesPerPage = 6;
let currentPage = 1;
let searchQuery = '';
let activeFilters = {
  categories: [],
  sources: [],
  dateRange: 'all',
  sortBy: 'newest'
};

// Global instances
let feedManager;
let searchInput, searchResults, categoryFilters, sourceFilters, dateFilter, sortFilter;
let newsGrid, featuredNews, loadMoreBtn, resultsCount, lastUpdated, footerSources, feedStatus;

// Initialize Application
document.addEventListener('DOMContentLoaded', async function() {
  console.log('Initializing PharmaCentral...');
  
  initializeElements();
  setupEventListeners();
  showLoadingSkeleton();
  
  // Initialize lazy loader
  lazyLoader = new LazyLoader();
  
  // Initialize toast manager
  toastManager = new ToastManager();
  
  // Initialize error handler
  errorHandler = new ErrorHandler();
  
  // Initialize feed manager
  feedManager = new FeedManager();
  
  // If no cached data, fetch fresh feeds
  if (feedManager.getArticles().length === 0) {
    console.log('🔄 No cached data, fetching fresh feeds...');
    await feedManager.fetchAllFeeds();
  } else {
    console.log('✅ Using cached data, articles count:', feedManager.getArticles().length);
    // Update feed status for cached data
    if (feedManager.updateFeedStatus) {
      feedManager.updateFeedStatus(feedManager.feeds.length, 0);
    }
  }
  
  // Set up the application with real data
  window.app = {
    refreshContent: () => {
      applyFilters();
      renderFeaturedNews();
      renderNewsGrid();
      updateUI();
    }
  };
  
  console.log('🔄 Setting up application...');
  console.log('Articles available:', feedManager.getArticles().length);
  
  // Check if we have articles
  if (feedManager.getArticles().length === 0) {
    console.error('❌ No articles available after initialization');
    return;
  }
  
  populateFilters();
  applyFilters();
  renderFeaturedNews();
  renderNewsGrid();
  updateUI();
  hideLoadingSkeleton();
  
  console.log('PharmaCentral initialized successfully');
});

// Initialize DOM Elements
function initializeElements() {
  searchInput = document.querySelector('.search-input');
  searchResults = document.querySelector('.search-results');
  categoryFilters = document.getElementById('categoryFilters');
  sourceFilters = document.getElementById('sourceFilters');
  dateFilter = document.getElementById('dateFilter');
  sortFilter = document.getElementById('sortFilter');
  newsGrid = document.getElementById('news-grid');
  featuredNews = document.getElementById('featuredNews');
  loadMoreBtn = document.getElementById('loadMoreBtn');
  resultsCount = document.getElementById('resultsCount');
  lastUpdated = document.getElementById('lastUpdated');
  footerSources = document.getElementById('footerSources');
  feedStatus = document.getElementById('feedStatus');
}

// Setup Event Listeners
function setupEventListeners() {
  // Search functionality
  if (searchInput) {
    searchInput.addEventListener('input', debounce(handleSearch, 300));
    searchInput.addEventListener('focus', () => {
      if (searchQuery && searchResults.children.length > 0) {
        searchResults.classList.remove('hidden');
        searchResults.setAttribute('aria-expanded', 'true');
      }
    });
    
    // Keyboard navigation for search
    searchInput.addEventListener('keydown', handleSearchKeydown);
  }

  // Hide search results when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-container')) {
      searchResults?.classList.add('hidden');
      searchResults?.setAttribute('aria-expanded', 'false');
    }
  });

  // Filter event listeners
  dateFilter?.addEventListener('change', handleDateFilter);
  sortFilter?.addEventListener('change', handleSortFilter);
  loadMoreBtn?.addEventListener('click', loadMoreArticles);

  // Mobile menu toggle
  const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
  const mainNav = document.querySelector('.main-nav');
  
  if (mobileMenuToggle && mainNav) {
    mobileMenuToggle.addEventListener('click', () => {
      mainNav.classList.toggle('mobile-open');
    });
  }
  
  // Global keyboard navigation
  document.addEventListener('keydown', handleGlobalKeydown);
}

// Handle search keyboard navigation
function handleSearchKeydown(e) {
  if (!searchResults || searchResults.classList.contains('hidden')) return;
  
  const results = searchResults.querySelectorAll('.search-result-item');
  const currentIndex = Array.from(results).findIndex(item => 
    item.classList.contains('focused')
  );
  
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      const nextIndex = currentIndex < results.length - 1 ? currentIndex + 1 : 0;
      updateSearchFocus(results, nextIndex);
      break;
      
    case 'ArrowUp':
      e.preventDefault();
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : results.length - 1;
      updateSearchFocus(results, prevIndex);
      break;
      
    case 'Enter':
      e.preventDefault();
      if (currentIndex >= 0 && results[currentIndex]) {
        results[currentIndex].click();
      }
      break;
      
    case 'Escape':
      searchResults.classList.add('hidden');
      searchResults.setAttribute('aria-expanded', 'false');
      searchInput.blur();
      break;
  }
}

// Update search result focus
function updateSearchFocus(results, index) {
  results.forEach((item, i) => {
    if (i === index) {
      item.classList.add('focused');
      item.setAttribute('aria-selected', 'true');
    } else {
      item.classList.remove('focused');
      item.setAttribute('aria-selected', 'false');
    }
  });
}

// Handle global keyboard navigation
function handleGlobalKeydown(e) {
  // Alt + 1: Skip to main content
  if (e.altKey && e.key === '1') {
    e.preventDefault();
    document.getElementById('main-content')?.focus();
  }
  
  // Alt + 2: Skip to filters
  if (e.altKey && e.key === '2') {
    e.preventDefault();
    document.getElementById('filters')?.focus();
  }
  
  // Alt + 3: Skip to news grid
  if (e.altKey && e.key === '3') {
    e.preventDefault();
    document.getElementById('news-grid')?.focus();
  }
  
  // Alt + L: Toggle language
  if (e.altKey && e.key === 'l') {
    e.preventDefault();
    toggleLanguage();
  }
  
  // Alt + R: Refresh feeds
  if (e.altKey && e.key === 'r') {
    e.preventDefault();
    refreshFeeds();
  }
}

// Language Toggle Function with Rate Limiting
async function toggleLanguage() {
  currentLanguage = currentLanguage === 'en' ? 'ar' : 'en';
  const html = document.documentElement;
  
  if (currentLanguage === 'ar') {
    html.setAttribute('dir', 'rtl');
    html.setAttribute('lang', 'ar');
    
    // Only translate currently visible articles (displayedArticles)
    const articlesToTranslate = displayedArticles.filter(a => !a.title_ar || !a.excerpt_ar);
    
    if (articlesToTranslate.length > 0) {
      console.log(`🔄 Starting translation of ${articlesToTranslate.length} visible articles...`);
      
      // Show loading banner with translation message
      const loadingBanner = document.getElementById('loadingBanner');
      const loadingText = loadingBanner?.querySelector('span');
      const totalToTranslate = articlesToTranslate.length;
      
      if (loadingText) {
        const articleWord = totalToTranslate === 1 ? 'مقالة' : totalToTranslate === 2 ? 'مقالتان' : 'مقالة';
        loadingText.textContent = `جاري ترجمة ${totalToTranslate} ${articleWord}...`;
      }
      loadingBanner?.classList.remove('hidden');
      
      // Translate articles one by one with rate limiting
      for (let i = 0; i < articlesToTranslate.length; i++) {
        const article = articlesToTranslate[i];
        
        // Translate article
        await translateArticle(article);
        console.log(`✅ Translated: ${article.title.substring(0, 50)}...`);
        
        // Update progress
        if (loadingText) {
          const remaining = totalToTranslate - (i + 1);
          if (remaining > 0) {
            loadingText.textContent = `جاري ترجمة... (${remaining} متبقية)`;
          } else {
            loadingText.textContent = 'اكتملت الترجمة...';
          }
        }
        
        // Update display after each article for better UX
        renderFeaturedNews();
        renderNewsGrid();
        
        // Add delay between translations (avoid rate limiting)
        if (i < articlesToTranslate.length - 1) {
          console.log(`⏳ Waiting 1.5s before next translation...`);
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }
      
      loadingBanner?.classList.add('hidden');
      
      console.log(`🎉 Translation complete! Translated ${articlesToTranslate.length} visible articles.`);
      
      // Save updated cache with translations
      if (feedManager) {
        feedManager.saveToCache();
      }
    } else {
      console.log('✅ All visible articles already translated.');
    }
  } else {
    html.setAttribute('dir', 'ltr');
    html.setAttribute('lang', 'en');
  }
  
  updateTextContent();
  updatePlaceholders();
  populateFilters();
  
  // Re-apply search if there's an active search query
  // This ensures search results are updated for the new language
  if (searchQuery && searchQuery.length > 0) {
    applyFilters();
  }
  
  renderFeaturedNews();
  renderNewsGrid();
  updateResultsCount();
}

// Mobile Menu Toggle
function toggleMobileMenu() {
  const mainNav = document.querySelector('.main-nav');
  const mobileMenuBtn = document.querySelector('.mobile-menu-toggle');
  const isOpen = mainNav?.classList.toggle('mobile-open');
  
  // Update ARIA attribute for accessibility
  if (mobileMenuBtn) {
    mobileMenuBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  }
}

// Update Text Content Based on Language
function updateTextContent() {
  console.log('🔄 Updating text content for language:', currentLanguage);
  
  const elements = document.querySelectorAll('[data-en][data-ar]');
  console.log(`Found ${elements.length} elements with translation attributes`);
  
  elements.forEach(element => {
    const text = currentLanguage === 'ar' ? element.getAttribute('data-ar') : element.getAttribute('data-en');
    if (text) {
      element.textContent = text;
      console.log(`Updated element: ${element.tagName} - "${text}"`);
    } else {
      console.warn(`No translation found for element:`, element);
    }
  });
  
  // Update select options
  const options = document.querySelectorAll('option[data-en][data-ar]');
  console.log(`Found ${options.length} select options with translation attributes`);
  
  options.forEach(option => {
    const text = currentLanguage === 'ar' ? option.getAttribute('data-ar') : option.getAttribute('data-en');
    if (text) {
      option.textContent = text;
      console.log(`Updated option: "${text}"`);
    }
  });
  
  // Special handling for specific elements that might not be found
  const latestNewsTitle = document.querySelector('h2[data-en="Latest News"]');
  if (latestNewsTitle) {
    const text = currentLanguage === 'ar' ? 'آخر الأخبار' : 'Latest News';
    latestNewsTitle.textContent = text;
    console.log(`✅ Manually updated Latest News title: "${text}"`);
  } else {
    console.warn('❌ Latest News title element not found');
  }
  
  console.log('✅ Text content update completed');
}

// Update Input Placeholders
function updatePlaceholders() {
  const inputs = document.querySelectorAll('[data-placeholder-en][data-placeholder-ar]');
  inputs.forEach(input => {
    const placeholder = currentLanguage === 'ar' ? 
      input.getAttribute('data-placeholder-ar') : 
      input.getAttribute('data-placeholder-en');
    if (placeholder) input.setAttribute('placeholder', placeholder);
  });
}

// Show Loading Skeleton
function showLoadingSkeleton() {
  if (newsGrid) {
    newsGrid.innerHTML = Array.from({length: 6}, () => `
      <div class="skeleton-card">
        <div class="skeleton skeleton-image"></div>
        <div class="skeleton-content">
          <div class="skeleton skeleton-text skeleton-title"></div>
          <div class="skeleton skeleton-text"></div>
          <div class="skeleton skeleton-text"></div>
          <div class="skeleton skeleton-text skeleton-meta"></div>
        </div>
      </div>
    `).join('');
  }
}

// Hide Loading Skeleton
function hideLoadingSkeleton() {
  // Remove skeleton loading elements
  const skeletonCards = document.querySelectorAll('.skeleton-card');
  skeletonCards.forEach(card => card.remove());
  
  // Hide filter loading skeletons
  const filterLoading = document.querySelectorAll('.filter-loading');
  filterLoading.forEach(loading => loading.classList.add('hidden'));
}

// Populate Filter Sections
function populateFilters() {
  if (!feedManager) return;
  
  const categories = feedManager.getCategories();
  const sources = feedManager.getSources();

  // Populate category filters
  if (categoryFilters && categories.length > 0) {
    categoryFilters.innerHTML = categories.map(category => `
      <div class="filter-item">
        <div class="filter-checkbox" data-category="${escapeAttribute(category.name)}" onclick="toggleCategoryFilter('${escapeAttribute(category.name)}')"></div>
        <label class="filter-label" onclick="toggleCategoryFilter('${escapeAttribute(category.name)}')">
          <span data-en="${escapeAttribute(category.name)}" data-ar="${escapeAttribute(category.name_ar)}">${sanitizeHTML(currentLanguage === 'ar' ? category.name_ar : category.name)}</span>
        </label>
        <span class="filter-count">${category.count}</span>
      </div>
    `).join('');
  }

  // Populate source filters
  if (sourceFilters && sources.length > 0) {
    sourceFilters.innerHTML = sources.map(source => `
      <div class="filter-item">
        <div class="filter-checkbox" data-source="${escapeAttribute(source.name)}" onclick="toggleSourceFilter('${escapeAttribute(source.name)}')"></div>
        <label class="filter-label" onclick="toggleSourceFilter('${escapeAttribute(source.name)}')">
          <span data-en="${escapeAttribute(source.name)}" data-ar="${escapeAttribute(source.name_ar)}">${sanitizeHTML(currentLanguage === 'ar' ? source.name_ar : source.name)}</span>
        </label>
        <span class="filter-count">${source.count}</span>
      </div>
    `).join('');
  }

  // Populate footer sources with URL validation
  if (footerSources && sources.length > 0) {
    footerSources.innerHTML = sources.map(source => {
      const validatedURL = validateURL(source.url);
      return `
        <li><a href="${escapeAttribute(validatedURL)}" target="_blank" rel="noopener" data-en="${escapeAttribute(source.name)}" data-ar="${escapeAttribute(source.name_ar)}">${sanitizeHTML(currentLanguage === 'ar' ? source.name_ar : source.name)}</a></li>
      `;
    }).join('');
  }
}

// Toggle Category Filter
function toggleCategoryFilter(category) {
  const checkbox = document.querySelector(`[data-category="${category}"]`);
  const index = activeFilters.categories.indexOf(category);
  
  if (index === -1) {
    activeFilters.categories.push(category);
    checkbox?.classList.add('checked');
  } else {
    activeFilters.categories.splice(index, 1);
    checkbox?.classList.remove('checked');
  }
  
  applyFilters();
}

// Toggle Source Filter
function toggleSourceFilter(source) {
  const checkbox = document.querySelector(`[data-source="${source}"]`);
  const index = activeFilters.sources.indexOf(source);
  
  if (index === -1) {
    activeFilters.sources.push(source);
    checkbox?.classList.add('checked');
  } else {
    activeFilters.sources.splice(index, 1);
    checkbox?.classList.remove('checked');
  }
  
  applyFilters();
}

// Handle Date Filter
function handleDateFilter(e) {
  activeFilters.dateRange = e.target.value;
  applyFilters();
}

// Handle Sort Filter
function handleSortFilter(e) {
  activeFilters.sortBy = e.target.value;
  applyFilters();
}

// Apply All Filters
function applyFilters() {
  if (!feedManager) {
    console.error('❌ feedManager not available');
    return;
  }
  
  const articles = feedManager.getArticles();
  console.log('🔄 Applying filters...');
  console.log('Total articles from feedManager:', articles.length);
  
  filteredArticles = articles.filter(article => {
    // Search filter
    if (searchQuery) {
      let titleMatch, excerptMatch;
      
      // Search in Arabic translations if in Arabic mode
      if (currentLanguage === 'ar') {
        const titleAr = article.title_ar || article.title;
        const excerptAr = article.excerpt_ar || article.excerpt;
        const categoryAr = article.category_ar || article.category;
        titleMatch = titleAr.toLowerCase().includes(searchQuery.toLowerCase());
        excerptMatch = excerptAr.toLowerCase().includes(searchQuery.toLowerCase());
        const categoryMatch = categoryAr.toLowerCase().includes(searchQuery.toLowerCase());
        const tagsMatch = article.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
        if (!titleMatch && !excerptMatch && !categoryMatch && !tagsMatch) return false;
      } else {
        // Search in English
        titleMatch = article.title.toLowerCase().includes(searchQuery.toLowerCase());
        excerptMatch = article.excerpt.toLowerCase().includes(searchQuery.toLowerCase());
        const tagsMatch = article.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
        if (!titleMatch && !excerptMatch && !tagsMatch) return false;
      }
    }
    
    // Category filter
    if (activeFilters.categories.length > 0 && !activeFilters.categories.includes(article.category)) {
      return false;
    }
    
    // Source filter
    if (activeFilters.sources.length > 0 && !activeFilters.sources.includes(article.source)) {
      return false;
    }
    
    // Date filter
    if (activeFilters.dateRange !== 'all') {
      const articleDate = new Date(article.publish_date);
      const now = new Date();
      const diffTime = Math.abs(now - articleDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      switch (activeFilters.dateRange) {
        case 'today':
          if (diffDays > 1) return false;
          break;
        case 'week':
          if (diffDays > 7) return false;
          break;
        case 'month':
          if (diffDays > 30) return false;
          break;
      }
    }
    
    return true;
  });
  
  // Sort articles
  filteredArticles.sort((a, b) => {
    switch (activeFilters.sortBy) {
      case 'newest':
        return new Date(b.publish_date) - new Date(a.publish_date);
      case 'oldest':
        return new Date(a.publish_date) - new Date(b.publish_date);
      case 'source':
        return a.source.localeCompare(b.source);
      default:
        return 0;
    }
  });
  
  currentPage = 1;
  displayedArticles = [];
  
  console.log('Filtered articles count:', filteredArticles.length);
  console.log('Active filters:', activeFilters);
  console.log('Search query:', searchQuery);
  
  renderNewsGrid();
  updateResultsCount();
}

// Handle Search
function handleSearch(e) {
  searchQuery = e.target.value.trim();
  
  if (searchQuery.length > 0) {
    const searchResults = filteredArticles
      .filter(article => {
        let titleMatch, excerptMatch;
        
        // Search in Arabic translations if in Arabic mode
        if (currentLanguage === 'ar') {
          const titleAr = article.title_ar || article.title;
          const excerptAr = article.excerpt_ar || article.excerpt;
          const categoryAr = article.category_ar || article.category;
          titleMatch = titleAr.toLowerCase().includes(searchQuery.toLowerCase());
          excerptMatch = excerptAr.toLowerCase().includes(searchQuery.toLowerCase());
          const categoryMatch = categoryAr.toLowerCase().includes(searchQuery.toLowerCase());
          return titleMatch || excerptMatch || categoryMatch;
        } else {
          // Search in English
          titleMatch = article.title.toLowerCase().includes(searchQuery.toLowerCase());
          excerptMatch = article.excerpt.toLowerCase().includes(searchQuery.toLowerCase());
          const categoryMatch = article.category.toLowerCase().includes(searchQuery.toLowerCase());
          return titleMatch || excerptMatch || categoryMatch;
        }
      })
      .slice(0, 5);
    
    renderSearchResults(searchResults);
  } else {
    hideSearchResults();
  }
  
  applyFilters();
}

// Render Search Results
function renderSearchResults(results) {
  if (!searchResults) return;
  
  if (results.length === 0) {
    const noResultsText = currentLanguage === 'ar' ? 'لم يتم العثور على نتائج' : 'No results found';
    searchResults.innerHTML = `
      <div class="search-result-item">
        <span>${noResultsText}</span>
      </div>
    `;
  } else {
    searchResults.innerHTML = results.map(article => {
      const feedInfo = RSS_FEEDS.find(f => f.name === article.source);
      const sourceName = currentLanguage === 'ar' && feedInfo ? feedInfo.name_ar : article.source;
      const title = currentLanguage === 'ar' && article.title_ar ? article.title_ar : article.title;
      return `
        <div class="search-result-item" onclick="selectSearchResult('${escapeAttribute(article.id)}')">
          <div class="search-result-title">${sanitizeHTML(title)}</div>
          <div class="search-result-source">${sanitizeHTML(sourceName)}</div>
        </div>
      `;
    }).join('');
  }
  
  searchResults.classList.remove('hidden');
}

// Hide Search Results
function hideSearchResults() {
  searchResults?.classList.add('hidden');
}

// Select Search Result
function selectSearchResult(articleId) {
  const article = filteredArticles.find(a => a.id === articleId);
  if (article) {
    searchInput.value = article.title;
    searchQuery = searchInput.value;
    hideSearchResults();
    applyFilters();
  }
}

// Render Featured News
function renderFeaturedNews() {
  if (!featuredNews || filteredArticles.length === 0) {
    if (featuredNews) {
      const noNewsText = currentLanguage === 'ar' ? 'لا توجد أخبار مميزة متاحة' : 'No featured news available';
      featuredNews.innerHTML = `<p class="no-content">${noNewsText}</p>`;
    }
    return;
  }
  
  const featured = filteredArticles.slice(0, 5);
  const mainFeatured = featured[0];
  const sidebarFeatured = featured.slice(1, 5);
  
  const categoryColors = {
    'Pharma News': '#2563eb',
    'Biotechnology': '#8b5cf6',
    'Medical News': '#16a34a',
    'Industry News': '#f59e0b',
    'Medical Research': '#7c3aed',
    'Health News': '#ef4444',
    'Global Pharma': '#06b6d4',
    'Pharma Analysis': '#10b981',
    'Health Information': '#f97316',
    'Regulatory': '#dc2626'
  };
  
  const bgColor = categoryColors[mainFeatured.category] || '#6b7280';
  
  const getSourceName = (article) => {
    const feedInfo = RSS_FEEDS.find(f => f.name === article.source);
    return currentLanguage === 'ar' && feedInfo ? feedInfo.name_ar : article.source;
  };
  
  const getArticleTitle = (article) => {
    if (currentLanguage === 'ar') {
      const translated = article.title_ar || article.title;
      console.log(`Featured - Showing title in Arabic: ${translated.substring(0, 30)}...`);
      return translated;
    }
    return article.title;
  };
  
  const getArticleExcerpt = (article) => {
    if (currentLanguage === 'ar') {
      return article.excerpt_ar || article.excerpt;
    }
    return article.excerpt;
  };

  featuredNews.innerHTML = `
    <div class="featured-main" onclick="openArticle('${escapeAttribute(mainFeatured.id)}')">
      <div class="news-card-image">
        <div style="width: 100%; height: 100%; background: ${bgColor}; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 18px; text-align: center; padding: 20px;">
          ${sanitizeHTML(getLocalizedText(mainFeatured, 'category'))}
        </div>
      </div>
      <div class="featured-content">
        <h3 class="featured-title">${sanitizeHTML(getArticleTitle(mainFeatured))}</h3>
        <p class="featured-excerpt">${sanitizeHTML(getArticleExcerpt(mainFeatured))}</p>
        <div class="featured-meta">
          <span class="news-card-source">${sanitizeHTML(getSourceName(mainFeatured))}</span>
          <span class="news-card-date">${sanitizeHTML(formatDate(mainFeatured.publish_date))}</span>
        </div>
      </div>
    </div>
    <div class="featured-sidebar">
      ${sidebarFeatured.map(article => `
        <div class="featured-item" onclick="openArticle('${escapeAttribute(article.id)}')">
          <h4 class="featured-item-title">${sanitizeHTML(getArticleTitle(article))}</h4>
          <div class="featured-item-meta">
            <span>${sanitizeHTML(getSourceName(article))}</span> • <span>${sanitizeHTML(formatDate(article.publish_date))}</span>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// Render News Grid
function renderNewsGrid() {
  if (!newsGrid) {
    console.error('❌ newsGrid element not found');
    return;
  }
  
  console.log('🔄 Rendering news grid...');
  console.log('Filtered articles count:', filteredArticles.length);
  console.log('Displayed articles count:', displayedArticles.length);
  console.log('Current page:', currentPage);
  console.log('Articles per page:', articlesPerPage);
  
  if (filteredArticles.length === 0) {
    const noArticlesText = currentLanguage === 'ar' ? 'لم يتم العثور على مقالات' : 'No articles found';
    const loadingText = currentLanguage === 'ar' ? 'جاري تحميل الأخبار...' : 'Loading news...';
    
    console.log('No articles to display, showing message:', feedManager && feedManager.getArticles().length === 0 ? loadingText : noArticlesText);
    
    newsGrid.innerHTML = `
      <div class="no-articles">
        <p>${feedManager && feedManager.getArticles().length === 0 ? loadingText : noArticlesText}</p>
      </div>
    `;
    
    if (loadMoreBtn) {
      loadMoreBtn.classList.add('hidden');
    }
    return;
  }
  
  const articlesToShow = filteredArticles.slice(0, currentPage * articlesPerPage);
  displayedArticles = articlesToShow;
  
  console.log('Articles to show:', articlesToShow.length);
  console.log('First article sample:', articlesToShow[0] ? {
    id: articlesToShow[0].id,
    title: articlesToShow[0].title,
    title_ar: articlesToShow[0].title_ar,
    excerpt: articlesToShow[0].excerpt,
    excerpt_ar: articlesToShow[0].excerpt_ar,
    category: articlesToShow[0].category,
    source: articlesToShow[0].source
  } : 'No articles');
  
  const categoryColors = {
    'Pharma News': '#2563eb',
    'Biotechnology': '#8b5cf6',
    'Medical News': '#16a34a',
    'Industry News': '#f59e0b',
    'Medical Research': '#7c3aed',
    'Health News': '#ef4444',
    'Global Pharma': '#06b6d4',
    'Pharma Analysis': '#10b981',
    'Health Information': '#f97316',
    'Regulatory': '#dc2626'
  };
  
  const getSourceName = (article) => {
    const feedInfo = RSS_FEEDS.find(f => f.name === article.source);
    return currentLanguage === 'ar' && feedInfo ? feedInfo.name_ar : article.source;
  };
  
  const getArticleTitle = (article) => {
    if (currentLanguage === 'ar') {
      return article.title_ar || article.title;
    }
    return article.title;
  };
  
  const getArticleExcerpt = (article) => {
    if (currentLanguage === 'ar') {
      return article.excerpt_ar || article.excerpt;
    }
    return article.excerpt;
  };
  
  console.log('Current language:', currentLanguage);
  console.log('Sample title translation:', articlesToShow[0] ? {
    original: articlesToShow[0].title,
    translated: getArticleTitle(articlesToShow[0]),
    has_ar: !!articlesToShow[0].title_ar
  } : 'No articles');
  
  newsGrid.innerHTML = displayedArticles.map(article => {
    const bgColor = categoryColors[article.category] || '#6b7280';
    
    const title = getArticleTitle(article);
    const excerpt = getArticleExcerpt(article);
    const category = getLocalizedText(article, 'category');
    const source = getSourceName(article);
    const date = formatDate(article.publish_date);
    
    console.log('Rendering article:', {
      id: article.id,
      title: title,
      excerpt: excerpt,
      category: category,
      source: source,
      date: date
    });
    
    return `
    <article class="news-card fade-in" onclick="openArticle('${escapeAttribute(article.id)}')">
      <div class="news-card-image">
        <div style="width: 100%; height: 100%; background: ${bgColor}; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; text-align: center; padding: 20px; font-size: 14px;">
          ${sanitizeHTML(category)}
        </div>
      </div>
      <div class="news-card-content">
        <span class="news-card-category">${sanitizeHTML(category)}</span>
        <h3 class="news-card-title">${sanitizeHTML(title)}</h3>
        <p class="news-card-excerpt">${sanitizeHTML(excerpt)}</p>
        <div class="news-card-meta">
          <span class="news-card-source">${sanitizeHTML(source)}</span>
          <span class="news-card-date">${sanitizeHTML(date)}</span>
        </div>
      </div>
    </article>
  `;
  }).join('');
  
  // Update load more button
  if (loadMoreBtn) {
    if (displayedArticles.length >= filteredArticles.length) {
      loadMoreBtn.classList.add('hidden');
    } else {
      loadMoreBtn.classList.remove('hidden');
    }
  }
  
  console.log('✅ News grid rendered successfully');
  console.log('Total articles rendered:', displayedArticles.length);
}

// Load More Articles
async function loadMoreArticles() {
  currentPage++;
  
  // Get the new articles that will be displayed
  const newArticles = filteredArticles.slice(displayedArticles.length, currentPage * articlesPerPage);
  
  // If we're in Arabic mode, translate the new articles
  if (currentLanguage === 'ar' && newArticles.length > 0) {
    const articlesToTranslate = newArticles.filter(a => !a.title_ar || !a.excerpt_ar);
    
    if (articlesToTranslate.length > 0) {
      console.log(`Translating ${articlesToTranslate.length} new articles...`);
      
      // Show loading banner for new articles translation
      const loadingBanner = document.getElementById('loadingBanner');
      const loadingText = loadingBanner?.querySelector('span');
      
      if (loadingText) {
        const articleWord = articlesToTranslate.length === 1 ? 'مقالة' : articlesToTranslate.length === 2 ? 'مقالتان' : 'مقالة';
        loadingText.textContent = `جاري ترجمة ${articlesToTranslate.length} ${articleWord} جديدة...`;
      }
      loadingBanner?.classList.remove('hidden');
      
      // Translate new articles one by one with rate limiting
      for (let i = 0; i < articlesToTranslate.length; i++) {
        const article = articlesToTranslate[i];
        
        // Translate article
        await translateArticle(article);
        console.log(`✅ Translated new article: ${article.title.substring(0, 50)}...`);
        
        // Update progress
        if (loadingText) {
          const remaining = articlesToTranslate.length - (i + 1);
          if (remaining > 0) {
            loadingText.textContent = `جاري ترجمة المقالات الجديدة... (${remaining} متبقية)`;
          } else {
            loadingText.textContent = 'اكتملت ترجمة المقالات الجديدة...';
          }
        }
        
        // Add delay between translations (avoid rate limiting)
        if (i < articlesToTranslate.length - 1) {
          console.log(`⏳ Waiting 1.5s before next translation...`);
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }
      
      loadingBanner?.classList.add('hidden');
      
      console.log(`🎉 Translation complete! Translated ${articlesToTranslate.length} new articles.`);
      
      // Save updated cache with translations
      if (feedManager) {
        feedManager.saveToCache();
      }
    }
  }
  
  renderNewsGrid();
}

// Open Article with URL validation
function openArticle(articleId) {
  const article = filteredArticles.find(a => a.id === articleId);
  if (!article) return;
  
  // Validate and sanitize URL before opening
  const validatedURL = validateURL(article.source_url);
  if (validatedURL && validatedURL !== '#') {
    window.open(validatedURL, '_blank', 'noopener,noreferrer');
  } else {
    console.warn('Invalid or unsafe URL blocked:', article.source_url);
    // Show user-friendly message
    const message = currentLanguage === 'ar' ? 
      'رابط غير صالح أو غير آمن' : 
      'Invalid or unsafe link';
    alert(message);
  }
}

// Update Results Count
function updateResultsCount() {
  if (resultsCount) {
    const count = filteredArticles.length;
    console.log('🔄 Updating results count:', count);
    if (currentLanguage === 'ar') {
      const articlesText = count === 1 ? 'مقالة' : count === 2 ? 'مقالتان' : count <= 10 ? 'مقالات' : 'مقالة';
      resultsCount.textContent = `تم العثور على ${count} ${articlesText}`;
    } else {
      const articlesText = count === 1 ? 'article' : 'articles';
      resultsCount.textContent = `${count} ${articlesText} found`;
    }
    console.log('✅ Results count updated:', resultsCount.textContent);
  } else {
    console.error('❌ resultsCount element not found');
  }
}

// Update UI Elements
function updateUI() {
  console.log('🔄 Updating UI elements...');
  
  // Update last updated timestamp
  if (lastUpdated && feedManager && feedManager.lastUpdate) {
    const lastUpdateText = currentLanguage === 'ar' ? 'آخر تحديث: ' : 'Last updated: ';
    const formatted = currentLanguage === 'ar' ? 
      formatDateArabic(feedManager.lastUpdate) : 
      formatDateEnglish(feedManager.lastUpdate);
    lastUpdated.textContent = lastUpdateText + formatted;
    console.log('✅ Last updated timestamp updated:', lastUpdated.textContent);
  } else {
    console.log('⚠️ Last updated not updated - missing elements or data');
  }
  
  // Update results count
  updateResultsCount();
  
  updateTextContent();
  updatePlaceholders();
  
  console.log('✅ UI elements updated');
}

// Get Localized Text
function getLocalizedText(item, field) {
  if (!item) return '';
  const arabicField = field + '_ar';
  return currentLanguage === 'ar' && item[arabicField] ? item[arabicField] : (item[field] || '');
}

// Format Date
function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  return currentLanguage === 'ar' ? formatDateArabic(date) : formatDateEnglish(date);
}

// Format Date in English
function formatDateEnglish(date) {
  const options = { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  return date.toLocaleDateString('en-US', options);
}

// Format Date in Arabic
function formatDateArabic(date) {
  const options = { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  return date.toLocaleDateString('ar-SA', options);
}

// Debounce Function (optimized)
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Throttle function for scroll/resize events
function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// Error Handling
window.addEventListener('error', (e) => {
  console.error('Application error:', e.error);
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled promise rejection:', e.reason);
});

// Cleanup on page unload to prevent memory leaks
window.addEventListener('beforeunload', () => {
  if (feedManager) {
    feedManager.stopBackgroundUpdates();
  }
  if (lazyLoader) {
    lazyLoader.destroy();
  }
});

// Initialize app when loaded
window.addEventListener('load', () => {
  console.log('PharmaCentral News Aggregator loaded successfully');
  
  // Check if elements exist before updating
  const latestNewsTitle = document.querySelector('h2[data-en="Latest News"]');
  console.log('Latest News title element found:', !!latestNewsTitle);
  
  if (latestNewsTitle) {
    console.log('Current text content:', latestNewsTitle.textContent);
    console.log('Data attributes:', {
      'data-en': latestNewsTitle.getAttribute('data-en'),
      'data-ar': latestNewsTitle.getAttribute('data-ar')
    });
  }
  
  // Initialize text content based on current language
  updateTextContent();
  updatePlaceholders();
  
  // Force a re-render to ensure all elements are updated
  setTimeout(() => {
    updateTextContent();
    console.log('🔄 Re-updated text content after page load');
  }, 100);
});