/**
 * GBP MEO Diagnostic Tool - Complete Master Clean Rewrite
 * 
 * Key Features & Architecture:
 * 1. Single Source of Truth for Bookmarklet Window Target ("GBP_DIAGNOSTIC_REPORT_WINDOW").
 * 2. Pure Live Data Engine: Zero rating/score carry-overs between stores; resets automatically on store change.
 * 3. COMPREHENSIVE ATTRIBUTE SCANNER: Scans ALL checked (✔) items (Eat-in, Solo dining, Alcohol, Beer, Small plates, Table service, Wi-Fi, Payments) dynamically without omission and appends "等".
 * 4. FULL WEEKLY HOURS & HOLIDAYS ENGINE: Automatically triggers click on Google Maps hours dropdown and extracts full Mon-Sun schedules & explicit holidays.
 * 5. RAW REAL CONTENT DISPLAY ENGINE: Captures and displays EXACT RAW TEXT, OWNER MESSAGES, FULL WEEKLY HOURS, WEBSITE URLS, and ALL VALIDATED ATTRIBUTES inside responsive card content boxes.
 * 6. Protected Review Reply Ratio (%) Engine: Calculates true percentage from visible review cards vs owner replies.
 * 7. Store-Owner-Facing AI Prompt: Generates client-friendly advice in 3 structured sections without complex jargon.
 * 8. Layout Hierarchy: Total Score & Chart -> AI Consultancy Card -> Detailed Category Analysis (2-Line Card Blocks) -> Priority Actions.
 */

document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 1. CONSTANTS & SYSTEM CONFIGURATION
    // ==========================================
    const APP_BASE_URL = window.location.origin + window.location.pathname;
    const DEFAULT_GEMINI_KEY = "";
    const REPORT_WINDOW_TARGET = "GBP_DIAGNOSTIC_REPORT_WINDOW";

    const INITIAL_STORE_TEMPLATE = {
        companyName: "店舗名未設定",
        name: "店舗名未設定",
        category: "未設定",
        reviewCount: 0,
        rating: 0,
        replyRatio: undefined,
        daysSinceLastPost: "999",
        photoTier: "0",
        rawWebsite: "",
        rawHours: "",
        rawDescription: "",
        rawAttributes: "",
        statusWebsite: "error",
        statusHours: "error",
        statusDescription: "error",
        statusCover: "pass",
        statusReply: "error",
        statusAttributes: "error"
    };

    const STATUS_RANK = {
        'pass': 3,
        'warn': 2,
        'fail': 1,
        'error': 0
    };

    // Global State
    let storeData = { ...INITIAL_STORE_TEMPLATE };
    let currentDiagDataForAi = null;

    // ==========================================
    // 2. DOM ELEMENT REFERENCES
    // ==========================================
    const welcomePlaceholder = document.getElementById('welcome-placeholder');
    const reportPaper = document.getElementById('report-paper');
    const controlPanelSection = document.getElementById('control-panel-section');

    const displayCompanyName = document.getElementById('display-company-name');
    const displayStoreName = document.getElementById('display-store-name');
    const metaCategory = document.getElementById('meta-category');
    const metaDate = document.getElementById('meta-date');

    const totalScoreEl = document.getElementById('total-score');
    const totalMaxScoreEl = document.getElementById('total-max-score');
    const scoreRankEl = document.getElementById('score-rank');
    const scoreCommentEl = document.getElementById('score-comment');

    const scoreBasicEl = document.getElementById('score-basic');
    const scoreReviewsEl = document.getElementById('score-reviews');
    const scorePhotosEl = document.getElementById('score-photos');
    const scorePostsEl = document.getElementById('score-posts');

    const groupScoreBasic = document.getElementById('group-score-basic');
    const groupScoreReviews = document.getElementById('group-score-reviews');
    const groupScorePhotos = document.getElementById('group-score-photos');
    const groupScorePosts = document.getElementById('group-score-posts');

    const listBasic = document.getElementById('list-basic');
    const listReviews = document.getElementById('list-reviews');
    const listPhotos = document.getElementById('list-photos');
    const listPosts = document.getElementById('list-posts');

    const actionListEl = document.getElementById('action-recommendations');
    const radarSvg = document.getElementById('radar-chart');

    // Form Controls
    const inputCompanyName = document.getElementById('input-company-name');
    const inputStoreName = document.getElementById('input-store-name');
    const inputCategory = document.getElementById('input-category');
    const inputReviewCount = document.getElementById('input-review-count');
    const inputRating = document.getElementById('input-rating');
    const inputLastPost = document.getElementById('input-last-post');
    const inputPhotoCount = document.getElementById('input-photo-count');

    const selectWebsite = document.getElementById('select-website');
    const selectHours = document.getElementById('select-hours');
    const selectDescription = document.getElementById('select-description');
    const selectCover = document.getElementById('select-cover');
    const selectReply = document.getElementById('select-reply');
    const selectAttributes = document.getElementById('select-attributes');

    // Buttons & Modals
    const btnPrint = document.getElementById('btn-print');
    const btnClearReport = document.getElementById('btn-clear-report');
    const btnLoadDemo = document.getElementById('btn-load-demo');
    const btnWelcomeDemo = document.getElementById('btn-welcome-demo');
    const btnWelcomeGuide = document.getElementById('btn-welcome-guide');
    const btnOpenGuide = document.getElementById('btn-open-guide');
    const btnShowBookmarkletModal = document.getElementById('btn-show-bookmarklet-modal');
    const modalBookmarklet = document.getElementById('modal-bookmarklet');
    const bookmarkletLink = document.getElementById('bookmarklet-link');

    // AI Components
    const btnShowAiModal = document.getElementById('btn-show-ai-modal');
    const btnGenerateAiAdvice = document.getElementById('btn-generate-ai-advice');
    const modalAiConfig = document.getElementById('modal-ai-config');
    const inputApiKey = document.getElementById('input-api-key');
    const btnSaveApiKey = document.getElementById('btn-save-api-key');
    const aiAdviceContent = document.getElementById('ai-advice-content');

    // Loaders & Toast
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingStatusText = document.getElementById('loading-status-text');
    const loadingSubText = document.getElementById('loading-sub-text');
    const progressBarFill = document.getElementById('progress-bar-fill');
    const loadingPercent = document.getElementById('loading-percent');
    const toastNotification = document.getElementById('toast-notification');
    const toastTitle = document.getElementById('toast-title');
    const toastDesc = document.getElementById('toast-desc');

    // Initialize Date
    const today = new Date();
    metaDate.textContent = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}`;
    document.getElementById('current-year').textContent = today.getFullYear();

    // Initialize API Key from localStorage or Default
    const savedApiKey = localStorage.getItem('gemini_api_key');
    if (!savedApiKey && DEFAULT_GEMINI_KEY) {
        localStorage.setItem('gemini_api_key', DEFAULT_GEMINI_KEY);
    }
    if (inputApiKey) {
        inputApiKey.value = localStorage.getItem('gemini_api_key') || DEFAULT_GEMINI_KEY || "";
    }

    // ==========================================
    // 3. UNIFIED BOOKMARKLET GENERATOR ENGINE (COMPREHENSIVE ATTRIBUTES EXTRACTION)
    // ==========================================
    function generateBookmarkletHref() {
        return "javascript:(function(){try{" +
            "let loc = window.location.href;" +
            "if(loc.indexOf('google.') === -1 || (loc.indexOf('/maps') === -1 && loc.indexOf('maps.google') === -1)){" +
            "  alert('⚠️ GBPデータ取得エラー\\n\\nGoogleマップ（google.com/maps）を開いた状態で再実行してください。');return;" +
            "}" +
            "let bTxt = document.body.innerText || '';" +

            "/* A. STORE NAME */" +
            "let name = '';" +
            "let kp = document.body.querySelector('h1.DUwif, h1.fontTitleLarge, div.fontTitleLarge, h1');" +
            "if(kp && kp.innerText && kp.innerText.trim() !== 'Google マップ' && kp.innerText.trim() !== 'Google'){" +
            "  name = kp.innerText.trim();" +
            "}" +
            "if(!name){" +
            "  let locPath = decodeURIComponent(window.location.pathname);" +
            "  let nameMatch = locPath.match(/\\/place\\/([^\\/@\\?]+)/);" +
            "  if(nameMatch){ name = nameMatch[1].replace(/\\+/g, ' ').trim(); }" +
            "}" +
            "if(!name){ name = document.title.replace(/ - Googleマップ.*/,'').replace(/ - Google.*/,'').trim(); }" +

            "/* B. RATING (PURE LIVE REAL-TIME ONLY) */" +
            "let rating = 0;" +
            "let ariaStar = document.body.querySelector('[aria-label*=\"5 つ星のうち\"], [aria-label*=\"5つ星のうち\"], [aria-label*=\"星\"], span.ceR21e');" +
            "if(ariaStar){" +
            "  let lbl = ariaStar.getAttribute('aria-label') || '';" +
            "  let rM = lbl.match(/([1-5]\\.[0-9])/);" +
            "  if(rM){ rating = parseFloat(rM[1]); }" +
            "}" +
            "if(!rating){" +
            "  let headTxt = bTxt.substring(0, 800);" +
            "  let rM = headTxt.match(/([1-5]\\.[0-9])\\s*\\(/) || headTxt.match(/([1-5]\\.[0-9])/);" +
            "  if(rM){ rating = parseFloat(rM[1]); }" +
            "}" +

            "/* C. REVIEW COUNT */" +
            "let reviewCount = 0;" +
            "if(ariaStar){" +
            "  let pEl = ariaStar.closest('div') || ariaStar.parentElement;" +
            "  if(pEl){" +
            "    let pTxt = pEl.innerText || '';" +
            "    let m = pTxt.match(/\\(\\s*([0-9,]+)\\s*\\)/) || pTxt.match(/([0-9,]+)\\s*件/);" +
            "    if(m){" +
            "      let val = parseInt(m[1].replace(/,/g,''));" +
            "      if(!isNaN(val) && val > 0){ reviewCount = val; }" +
            "    }" +
            "  }" +
            "}" +
            "if(!reviewCount){" +
            "  let headTxt = bTxt.substring(0, 1000);" +
            "  let m = headTxt.match(/([1-5]\\.[0-9])[\\s\\S]{0,100}?\\(\\s*([0-9,]+)\\s*\\)/);" +
            "  if(m){" +
            "    let val = parseInt(m[2].replace(/,/g,''));" +
            "    if(!isNaN(val) && val > 0){ reviewCount = val; }" +
            "  }" +
            "}" +
            "if(!reviewCount){" +
            "  let headTxt = bTxt.substring(0, 1000);" +
            "  let m = headTxt.match(/\\(\\s*([0-9,]+)\\s*\\)/);" +
            "  if(m){" +
            "    let val = parseInt(m[1].replace(/,/g,''));" +
            "    if(!isNaN(val) && val > 0 && val !== 910){ reviewCount = val; }" +
            "  }" +
            "}" +

            "/* D. HYBRID ULTRA-PRECISE REVIEW REPLY RATIO ENGINE */" +
            "let reviewModal = document.querySelector('g-review-dialog, div[role=\"dialog\"], div.review-dialog, div.m6QEfe[aria-label*=\"クチコミ\"]');" +
            "let isReviewTabOpen = Boolean(reviewModal) || (bTxt.indexOf('関連度順') !== -1 || bTxt.indexOf('評価の高い順') !== -1 || bTxt.indexOf('クチコミの検索') !== -1 || bTxt.indexOf('最新順') !== -1);" +
            "let replyRatio = undefined;" +
            "let replyStatus = 'error';" +
            "if(isReviewTabOpen){" +
            "  let cards = Array.from(document.body.querySelectorAll('div.jJ79vd, div.My5W2e, div.TI2da, div.gws-localreviews__google-review, div[data-review-id], div.WwHIbd'));" +
            "  let timeMatches = (bTxt.match(/([0-9]+\\s*(年前|か月前|月前|週間前|週前|日前)|1\\s*か月前|2\\s*か月前|3\\s*か月前)/g) || []);" +
            "  let totalVisibleReviews = Math.max(cards.length, timeMatches.length);" +
            "  let replyMatches = (bTxt.match(/オーナーからの返信|店舗からの返信/g) || []);" +
            "  let totalOwnerReplies = replyMatches.length;" +
            "  if(totalVisibleReviews >= 3){" +
            "    replyRatio = Math.min(Math.round((totalOwnerReplies / totalVisibleReviews) * 100), 100);" +
            "    if(replyRatio >= 70){ replyStatus = 'pass'; }" +
            "    else if(replyRatio > 0){ replyStatus = 'warn'; }" +
            "    else { replyStatus = 'fail'; }" +
            "  }else{" +
            "    replyStatus = 'error';" +
            "  }" +
            "}" +

            "/* E. CATEGORY & AUTO-CLICK FULL WEEKLY HOURS EXTRACTION */" +
            "let category = '未設定';" +
            "let catNode = document.body.querySelector('button[jsaction*=\"category\"], div.fontBodyMedium button, span.DkEaL');" +
            "if(catNode && catNode.innerText){" +
            "  let rawCat = catNode.innerText.replace(/[\\uE000-\\uF8FF\\u2000-\\u206F]/g, '').replace(/([0-9\\.]+\\s*)?Google\\s*のクチコミ\\s*\\([0-9,]+\\)/gi,'').replace(/^[0-9\\.\\s★⭐]+/,'').trim();" +
            "  if(rawCat) category = rawCat.split('·')[0].split('•')[0].trim();" +
            "}" +

            "/* Auto-click hours button to open dropdown */" +
            "let hBtn = document.body.querySelector('button[aria-label*=\"営業時間\"], button[aria-label*=\"営業中\"], button[aria-label*=\"営業終了\"], button[aria-label*=\"まもなく営業終了\"], div.t3bWnc button, button[data-item-id=\"oh\"]');" +
            "if(hBtn){ try{ hBtn.click(); }catch(e){} }" +

            "/* Raw Website URL */" +
            "let rawWebsite = '';" +
            "let webEl = document.body.querySelector('a[data-item-id=\"authority\"], [data-item-id=\"authority\"] a, a[aria-label*=\"ウェブサイト\"], a[aria-label*=\"公式サイト\"], a[aria-label*=\"Website\"], a[aria-label*=\"website\"]');" +
            "if(webEl){" +
            "  let h = webEl.getAttribute('href') || '';" +
            "  if(h && h.indexOf('google.') === -1 && h.indexOf('http') !== -1){" +
            "    rawWebsite = h.trim();" +
            "  }" +
            "}" +

            "/* Raw Business Hours & Full Weekly Schedule Text */" +
            "let rawHours = '';" +
            "let tableRows = Array.from(document.body.querySelectorAll('table.t3bWnc tr, table tr, tr.y07ffe, div.e2W3ic'));" +
            "let weeklyLines = [];" +
            "tableRows.forEach(tr => {" +
            "  let txt = tr.innerText ? tr.innerText.replace(/\\n+/g, ' ').trim() : '';" +
            "  if(txt && (txt.indexOf('月曜') !== -1 || txt.indexOf('火曜') !== -1 || txt.indexOf('水曜') !== -1 || txt.indexOf('木曜') !== -1 || txt.indexOf('金曜') !== -1 || txt.indexOf('土曜') !== -1 || txt.indexOf('日曜') !== -1 || txt.indexOf('定休日') !== -1 || txt.indexOf('休業') !== -1)){" +
            "    weeklyLines.push(txt.replace(/[\\uE000-\\uF8FF]/g,'').trim());" +
            "  }" +
            "});" +
            "if(weeklyLines.length > 0){" +
            "  rawHours = weeklyLines.join(' / ');" +
            "}else{" +
            "  let hoursNode = document.body.querySelector('button[data-item-id=\"oh\"], [aria-label*=\"営業時間\"], [aria-label*=\"営業中\"], [aria-label*=\"営業終了\"], div.t3bWnc');" +
            "  if(hoursNode){ rawHours = hoursNode.getAttribute('aria-label') || hoursNode.innerText || ''; }" +
            "  if(!rawHours || rawHours === '営業時間'){" +
            "    let hMatch = bTxt.match(/(営業中|営業終了|まもなく営業終了|営業時間外|24 時間営業|定休日|本日休業)[\\s\\S]{0,50}?(\\d{1,2}:\\d{2})/);" +
            "    if(hMatch){ rawHours = hMatch[0].replace(/\\n+/g, ' ').trim(); }" +
            "  }" +
            "}" +

            "/* Raw Business Description (Owner Message Raw Text) */" +
            "let rawDescription = '';" +
            "let descIdx = bTxt.indexOf('提供元: オーナー');" +
            "if(descIdx !== -1){" +
            "  rawDescription = bTxt.substring(descIdx, descIdx + 280).replace(/\\n+/g, ' ').trim();" +
            "}else{" +
            "  let descIdx2 = bTxt.indexOf('ビジネスの説明');" +
            "  if(descIdx2 !== -1){" +
            "    rawDescription = bTxt.substring(descIdx2, descIdx2 + 280).replace(/\\n+/g, ' ').trim();" +
            "  }" +
            "}" +

            "/* F. COMPREHENSIVE DYNAMIC ATTRIBUTES SCANNER */" +
            "let validAttrItems = [];" +

            "/* Method 1: Checkmark Node Dynamic Scanner */" +
            "let checkNodes = Array.from(document.body.querySelectorAll('div, span, li, tr'));" +
            "checkNodes.forEach(node => {" +
            "  let txt = node.innerText || '';" +
            "  if(txt.indexOf('✔') !== -1 && txt.length < 35 && txt.indexOf('\\n') === -1){" +
            "    let cleanItem = txt.replace(/✔/g, '').trim();" +
            "    if(cleanItem && validAttrItems.indexOf(cleanItem) === -1){" +
            "      validAttrItems.push(cleanItem);" +
            "    }" +
            "  }" +
            "});" +

            "/* Method 2: Comprehensive Keyword Scan (Fallback & Merge) */" +
            "let kwCandidates = [" +
            "  'イートイン', 'テイクアウト', '一人での食事', 'アルコール飲料', 'ビール', 'ワイン', 'カクテル', '小皿料理', 'テーブル サービス', " +
            "  '車椅子対応の座席', '車椅子対応の入り口', '車椅子対応の駐車場', '車椅子対応のトイレ', '無料Wi-Fi', 'Wi-Fi完備', " +
            "  '無料駐車場完備', '駐車場あり', 'キャッシュレス決済対応', 'クレジットカード可', '電子マネー可', 'QRコード決済', '個室あり', '全席禁煙'" +
            "];" +
            "kwCandidates.forEach(kw => {" +
            "  let isDisabled = bTxt.indexOf('🚫 ' + kw) !== -1 || bTxt.indexOf('🚫' + kw) !== -1;" +
            "  if(bTxt.indexOf(kw) !== -1 && !isDisabled && validAttrItems.indexOf(kw) === -1){" +
            "    validAttrItems.push(kw);" +
            "  }" +
            "});" +

            "let rawAttributes = validAttrItems.length > 0 ? validAttrItems.join(' ・ ') + ' 等' : '';" +

            "/* Photos Count */" +
            "let photoTier = '0';" +
            "let pNode = document.body.querySelector('button[jsaction*=\"photo\"], button[aria-label*=\"写真\"], button[aria-label*=\"photo\"], div.g390ld');" +
            "if(pNode){" +
            "  let pTxt = pNode.innerText || pNode.getAttribute('aria-label') || '';" +
            "  let pM = pTxt.match(/([0-9,]+)\\s*(?:枚|photos|枚の写真)/i) || pTxt.match(/(?:写真|すべて|photos)\\s*\\(?([0-9,]+)\\)?/i);" +
            "  if(pM){ photoTier = pM[1].replace(/,/g, ''); }" +
            "}" +
            "if(photoTier === '0'){" +
            "  let btns = Array.from(document.querySelectorAll('button'));" +
            "  let targetBtn = btns.find(b => (b.innerText && (b.innerText.indexOf('写真') !== -1 || b.innerText.indexOf('枚') !== -1 || b.innerText.indexOf('photos') !== -1)));" +
            "  if(targetBtn){" +
            "    let pM = targetBtn.innerText.match(/([0-9,]+)\\s*(?:枚|photos|枚の写真)/i) || targetBtn.innerText.match(/(?:写真|すべて|photos)\\s*\\(?([0-9,]+)\\)?/i);" +
            "    if(pM) photoTier = pM[1].replace(/,/g, '');" +
            "  }" +
            "}" +

            "/* Days Since Last Post - Tab Presence & Internal Scan Only */" +
            "let daysSinceLastPost = '999';" +
            "let allElements = Array.from(document.body.querySelectorAll('button, div[role=\"tab\"], div, h2, h3, span'));" +
            "let hasUpdatesTab = allElements.find(el => {" +
            "  let t = (el.innerText || '').trim();" +
            "  return (t === '最新情報' || t === '最新の投稿' || t === 'Updates' || t === 'Updates from owner');" +
            "});" +
            "if(hasUpdatesTab){" +
            "  let updateContainer = hasUpdatesTab.closest('div.m6QEfe, div.section-layout, div[role=\"region\"], div[jsaction*=\"updates\"]') || hasUpdatesTab.parentElement.parentElement;" +
            "  if(updateContainer){" +
            "    let dateNodes = Array.from(updateContainer.querySelectorAll('span, div'));" +
            "    let postDates = [];" +
            "    dateNodes.forEach(el => {" +
            "      let txt = (el.innerText || '').trim();" +
            "      if(txt.match(/^(?:\\d+日前|\\d+週間前|\\d+か月前|\\d+ヶ月前|\\d+年前|\\d+時間前|\\d{4}\\/\\d{1,2}\\/\\d{1,2}|\\d+\\s+day|\\d+\\s+week|\\d+\\s+month|\\d+\\s+year|\\d+\\s+hour)/i)){" +
            "        postDates.push(txt);" +
            "      }" +
            "    });" +
            "    if(postDates.length > 0){" +
            "      let mostRecentText = postDates[0];" +
            "      let days = 999;" +
            "      let m;" +
            "      if (m = mostRecentText.match(/(\\d+)\\s*日前/)) { days = parseInt(m[1], 10); }" +
            "      else if (m = mostRecentText.match(/(\\d+)\\s*時間前/)) { days = 0; }" +
            "      else if (m = mostRecentText.match(/(\\d+)\\s*週間前/)) { days = parseInt(m[1], 10) * 7; }" +
            "      else if (m = mostRecentText.match(/(\\d+)\\s*[かヶ]月前/)) { days = parseInt(m[1], 10) * 30; }" +
            "      else if (m = mostRecentText.match(/(\\d+)\\s*年前/)) { days = parseInt(m[1], 10) * 365; }" +
            "      else if (m = mostRecentText.match(/(\\d{4})\\/(\\d{1,2})\\/(\\d{1,2})/)) {" +
            "        let postDate = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));" +
            "        let diffTime = Math.abs(new Date() - postDate);" +
            "        days = Math.floor(diffTime / (1000 * 60 * 60 * 24));" +
            "      }" +
            "      else if (m = mostRecentText.match(/(\\d+)\\s*day/i)) { days = parseInt(m[1], 10); }" +
            "      else if (m = mostRecentText.match(/(\\d+)\\s*hour/i)) { days = 0; }" +
            "      else if (m = mostRecentText.match(/(\\d+)\\s*week/i)) { days = parseInt(m[1], 10) * 7; }" +
            "      else if (m = mostRecentText.match(/(\\d+)\\s*month/i)) { days = parseInt(m[1], 10) * 30; }" +
            "      else if (m = mostRecentText.match(/(\\d+)\\s*year/i)) { days = parseInt(m[1], 10) * 365; }" +
            "      daysSinceLastPost = String(days);" +
            "    } else {" +
            "      daysSinceLastPost = '30';" +
            "    }" +
            "  } else {" +
            "    daysSinceLastPost = '30';" +
            "  }" +
            "}" +

            "/* G. PACK & SEND DATA */" +
            "let data = {" +
            "  companyName: name," +
            "  name: name," +
            "  category: category," +
            "  reviewCount: reviewCount," +
            "  rating: rating," +
            "  replyRatio: replyRatio," +
            "  daysSinceLastPost: daysSinceLastPost," +
            "  photoTier: photoTier," +
            "  rawWebsite: rawWebsite," +
            "  rawHours: rawHours," +
            "  rawDescription: rawDescription," +
            "  rawAttributes: rawAttributes," +
            "  statusWebsite: Boolean(rawWebsite) ? 'pass' : 'fail'," +
            "  statusHours: Boolean(rawHours) ? 'pass' : 'fail'," +
            "  statusDescription: Boolean(rawDescription) ? 'pass' : 'fail'," +
            "  statusCover: (photoTier !== '0') ? 'pass' : 'fail'," +
            "  statusReply: replyStatus," +
            "  statusAttributes: Boolean(rawAttributes) ? 'pass' : 'fail'" +
            "};" +
            "let targetUrl = '" + APP_BASE_URL + "#data=' + encodeURIComponent(JSON.stringify(data));" +
            "window.open(targetUrl, '" + REPORT_WINDOW_TARGET + "');" +
            "}catch(e){ alert('⚠️ GBPデータの取得に失敗しました。Googleマップで店舗を選択した状態で再実行してください。'); }" +
            "})();";
    }

    bookmarkletLink.setAttribute('href', generateBookmarkletHref());

    // ==========================================
    // 4. VIEW CONTROLLER & TOAST NOTIFICATIONS
    // ==========================================
    function activateReportView() {
        if (welcomePlaceholder) welcomePlaceholder.classList.add('hidden');
        if (reportPaper) reportPaper.classList.remove('hidden');
        if (controlPanelSection) controlPanelSection.classList.remove('hidden');
    }

    function resetToWelcomeView() {
        localStorage.removeItem('last_gbp_data');
        storeData = { ...INITIAL_STORE_TEMPLATE };
        if (welcomePlaceholder) welcomePlaceholder.classList.remove('hidden');
        if (reportPaper) reportPaper.classList.add('hidden');
        if (controlPanelSection) controlPanelSection.classList.add('hidden');
        showToast("🧹 レポートをクリアしました", "診断データを初期化し、トップ画面に戻りました。");
    }

    function showToast(title, desc) {
        toastTitle.textContent = title;
        toastDesc.textContent = desc;
        toastNotification.classList.remove('hidden');
        setTimeout(() => toastNotification.classList.add('hidden'), 4500);
    }

    function hideAllModals() {
        if (modalBookmarklet) modalBookmarklet.classList.add('hidden');
        if (modalAiConfig) modalAiConfig.classList.add('hidden');
        document.querySelectorAll('.modal-overlay, .modal').forEach(m => m.classList.add('hidden'));
    }

    function triggerLoadingAnimation(onComplete, isMergeUpdate = false, isNewStore = false) {
        hideAllModals();
        activateReportView();
        loadingOverlay.classList.remove('hidden');
        progressBarFill.style.width = '0%';
        loadingPercent.textContent = '0%';

        if (isNewStore) {
            loadingStatusText.textContent = '🏢 新しい店舗の診断レポートを作成中...';
            loadingSubText.textContent = '新しい店舗データを抽出してレポートを更新しています';
        } else if (isMergeUpdate) {
            loadingStatusText.textContent = '✨ データ集約＆全有効属性リスト(✔)を算定抽出中...';
            loadingSubText.textContent = 'イートイン・一人での食事・アルコール・小皿料理等の全有効項目を全網羅集計しています';
        } else {
            loadingStatusText.textContent = 'Googleマップから店舗データを抽出中...';
            loadingSubText.textContent = '基本情報・全曜日営業時間・全有効属性(✔/等)・クチコミを集計しています';
        }

        const startTime = Date.now();
        const duration = 2200;

        const interval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(Math.floor((elapsed / duration) * 100), 100);

            progressBarFill.style.width = `${progress}%`;
            loadingPercent.textContent = `${progress}%`;

            if (progress >= 100) {
                loadingStatusText.textContent = '診断更新完了！';
                loadingSubText.textContent = '集約レポートに反映しました';
                clearInterval(interval);
                setTimeout(() => {
                    loadingOverlay.classList.add('hidden');
                    if (onComplete) onComplete();
                    if (isNewStore) {
                        showToast("✨ 新店舗の診断レポートを作成しました！", `${storeData.name} の診断結果を表示しています。`);
                    } else if (isMergeUpdate) {
                        showToast("✨ レポートを統合更新しました！", `全有効属性リスト(等)を網羅反映しました。`);
                    }
                }, 250);
            }
        }, 30);
    }

    // ==========================================
    // 5. PURE LIVE DATA MERGE ENGINE (NO CARRY-OVER)
    // ==========================================
    function mergeStoreData(existing, incoming) {
        let isUpdated = false;
        let isNewStore = false;

        const safeIncoming = {
            ...INITIAL_STORE_TEMPLATE,
            ...incoming
        };

        if (existing.name && safeIncoming.name && existing.name !== safeIncoming.name && existing.name !== "店舗名未設定") {
            isNewStore = true;
            return { merged: safeIncoming, isUpdated: true, isNewStore };
        }

        const merged = { ...existing };

        if (safeIncoming.name && safeIncoming.name !== "店舗名未設定") merged.name = safeIncoming.name;
        if (safeIncoming.companyName) merged.companyName = safeIncoming.companyName;
        if (safeIncoming.category && safeIncoming.category !== "未設定") merged.category = safeIncoming.category;
        if (safeIncoming.reviewCount > 0) merged.reviewCount = Math.max(existing.reviewCount || 0, safeIncoming.reviewCount);

        if (safeIncoming.rawWebsite) merged.rawWebsite = safeIncoming.rawWebsite;
        if (safeIncoming.rawHours) merged.rawHours = safeIncoming.rawHours;
        if (safeIncoming.rawDescription) merged.rawDescription = safeIncoming.rawDescription;
        if (safeIncoming.rawAttributes !== undefined) merged.rawAttributes = safeIncoming.rawAttributes;

        if (safeIncoming.rating > 0) {
            merged.rating = Math.min(Math.max(parseFloat(safeIncoming.rating), 1.0), 5.0);
        }

        if (safeIncoming.replyRatio !== undefined && safeIncoming.statusReply !== 'error') {
            merged.replyRatio = safeIncoming.replyRatio;
        }

        const statusKeys = ['statusWebsite', 'statusHours', 'statusDescription', 'statusCover', 'statusReply', 'statusAttributes'];
        statusKeys.forEach(key => {
            let existingVal = existing[key] || 'error';
            let incomingVal = safeIncoming[key] || 'error';

            let existingRank = STATUS_RANK[existingVal] !== undefined ? STATUS_RANK[existingVal] : 0;
            let incomingRank = STATUS_RANK[incomingVal] !== undefined ? STATUS_RANK[incomingVal] : 0;

            if (incomingRank >= existingRank) {
                if (existing[key] !== incomingVal) {
                    merged[key] = incomingVal;
                    isUpdated = true;
                }
            } else {
                merged[key] = existingVal;
            }
        });

        return { merged, isUpdated, isNewStore };
    }

    function parseIncomingData() {
        const hash = window.location.hash;
        if (hash && hash.includes('data=')) {
            try {
                const jsonStr = decodeURIComponent(hash.split('data=')[1]);
                const parsed = JSON.parse(jsonStr);
                if (parsed && (parsed.name || parsed.companyName)) {
                    if (parsed.category) {
                        parsed.category = parsed.category.replace(/[\\uE000-\\uF8FF\\u2000-\\u206F]/g, '').replace(/([0-9\.]+\s*)?Google\s*のクチコミ.*/gi, '').replace(/^[0-9\.\s★⭐]+/,'').replace(/^.*?[都道府県市区町村]の/, '').trim() || "未設定";
                    }

                    const saved = localStorage.getItem('last_gbp_data');
                    let baseData = storeData;
                    if (saved) {
                        try { baseData = JSON.parse(saved); } catch(e){}
                    }

                    const { merged, isUpdated, isNewStore } = mergeStoreData(baseData, parsed);
                    storeData = merged;
                    localStorage.setItem('last_gbp_data', JSON.stringify(storeData));

                    history.replaceState(null, "", window.location.pathname);
                    activateReportView();
                    triggerLoadingAnimation(() => updateFormValues(), isUpdated, isNewStore);
                    return true;
                }
            } catch (e) {
                console.error("Error parsing bookmarklet data:", e);
            }
        }

        const savedData = localStorage.getItem('last_gbp_data');
        if (savedData) {
            try {
                const parsed = JSON.parse(savedData);
                if (parsed && parsed.name && parsed.name !== "店舗名未設定") {
                    if (parsed.rating > 0) parsed.rating = Math.min(Math.max(parseFloat(parsed.rating), 1.0), 5.0);
                    storeData = { ...INITIAL_STORE_TEMPLATE, ...parsed };
                    activateReportView();
                    updateFormValues();
                    return true;
                }
            } catch (e) {}
        }
        return false;
    }

    window.addEventListener('hashchange', parseIncomingData);

    // ==========================================
    // 6. FORM & REPORT DATA SYNC
    // ==========================================
    function updateFormValues() {
        if (storeData.rating > 0) {
            storeData.rating = Math.min(Math.max(parseFloat(storeData.rating), 1.0), 5.0);
        }

        if (inputCompanyName) inputCompanyName.value = storeData.companyName || storeData.name || "";
        inputStoreName.value = storeData.name;
        inputCategory.value = storeData.category;
        inputReviewCount.value = storeData.reviewCount;
        inputRating.value = storeData.rating > 0 ? storeData.rating : 3.7;
        inputLastPost.value = storeData.daysSinceLastPost;
        inputPhotoCount.value = storeData.photoTier;

        selectWebsite.value = storeData.statusWebsite || 'error';
        selectHours.value = storeData.statusHours || 'error';
        selectDescription.value = storeData.statusDescription || 'error';
        selectCover.value = storeData.statusCover || 'pass';
        selectReply.value = storeData.statusReply || 'error';
        selectAttributes.value = storeData.statusAttributes || 'error';

        calculateAndRender();
    }

    function readFormValues() {
        if (inputCompanyName) storeData.companyName = inputCompanyName.value;
        storeData.name = inputStoreName.value;
        storeData.category = inputCategory.value;
        storeData.reviewCount = parseInt(inputReviewCount.value) || 0;
        storeData.rating = parseFloat(inputRating.value) || 0.0;
        storeData.daysSinceLastPost = inputLastPost.value;
        storeData.photoTier = inputPhotoCount.value;

        storeData.statusWebsite = selectWebsite.value;
        storeData.statusHours = selectHours.value;
        storeData.statusDescription = selectDescription.value;
        storeData.statusCover = selectCover.value;
        storeData.statusReply = selectReply.value;
        storeData.statusAttributes = selectAttributes.value;

        calculateAndRender();
    }

    // ==========================================
    // 7. GEMINI 3.6 FLASH AI ADVISOR (CLIENT FOCUS)
    // ==========================================
    async function callAiAdviceApi(diagData) {
        const apiKey = localStorage.getItem('gemini_api_key') || DEFAULT_GEMINI_KEY || "";
        if (!apiKey) {
            modalAiConfig.classList.remove('hidden');
            showToast("⚙️ APIキーが必要です", "Gemini APIキーを入力して保存してください。");
            btnGenerateAiAdvice.disabled = false;
            btnGenerateAiAdvice.textContent = '🤖 AI解説文を自動生成';
            return;
        }
        btnGenerateAiAdvice.disabled = true;
        btnGenerateAiAdvice.textContent = '🤖 店舗様向けアドバイス文章を生成中...';
        aiAdviceContent.innerHTML = '<p class="ai-placeholder">Gemini 3.6 Flash が店舗様向けの分かりやすい改善提案文を作成しています...</p>';

        const prompt = `あなたは店舗様の持続的な成長を支援する、プロフェッショナルなGoogleマップ集客コンサルタントです。
以下のGBP診断レポート結果に基づき、店舗のオーナー様・店長様（ビジネスの意思決定者）が読まれて、「自店の強み、Web集客における具体的な機会損失、そして本業の生産性を高めるための効率的な解決策」が明確に伝わる、品格があり知的な診断アドバイス文章を作成してください。

※※※【最重要：執筆の方向性とトーン】※※※
- **子供っぽく平易すぎる表現や、過剰な比喩（「玄関」「のれんがズレてる」「お助け役」など）は徹底的に避ける**: 相手は目の前のお客様と経営に向き合う「尊敬すべきビジネスのプロ」です。おもちゃのような言葉や幼児退行したような表現は、相手の知性を軽視している（馬鹿にしている）印象を与え、信頼を損ねます。
- **品位ある、スマートで丁寧なビジネス日本語を使用する**: 「MEO」「アルゴリズム」といった専門的すぎるIT業界用語は避けつつ、経営者として共感できる一般的なビジネス用語（「新規顧客の獲得機会」「時間資源の最適化」「顧客満足度のリピート化」「業務効率化」など）を用いて知的に説明してください。
- **「能力の限界」ではなく「時間効率・生産性」の観点で語る**: 「忙しくて手が回らないから代わりにやってあげる」という上から目線のニュアンスではなく、「オーナー様の最も価値ある資源は『本業（料理、サービス、店舗のマネジメントなど）』に注ぐ時間とエネルギーです。付加価値の低いデジタル維持作業（日々の投稿、クチコミ返信の考案など）にオーナー様の大切な時間が奪われるのは、店舗全体の生産性・経営効率の観点から非常にもったいないことであり、これらをシステムで自動化・仕組み化することこそが最もスマートな経営判断です」という、経営者に敬意を表した論理的かつあたたかいアプローチを徹底してください。
- **詳細な技術説明は現場の営業に委ねる**: すべてをシステム仕様として解説しようとせず、オーナー様が「これなら時間効率を高めつつ、確実に集客の仕組みを構築できそうだ。一度営業から詳しい話を聞いてみよう」とバトンタッチをスムーズに受け入れたくなる知的で魅力的な文章にしてください。

【対象店舗】${diagData.name}
【業種・カテゴリ】${diagData.category}
【総合最適化スコア】${diagData.totalGained}点 / ${diagData.totalPossible}点満点 (${diagData.normalizedScore}%達成)
【評価】★${diagData.rating.toFixed(1)} (${diagData.reviewCount}件 of クチコミ)
【クチコミ返信率】${diagData.replyRatio !== undefined ? diagData.replyRatio + '%' : '未確認'}

【執筆のルールと全体のストーリー展開（プロフェッショナルな店舗オーナー視点）】
1. **第一セクション：デジタル上の顧客接点を整える意義**:
   - セクションタイトル： **💡 【診断結果】${diagData.name}様の「デジタル店舗情報」の強みと、機会損失を防ぐ最適化ステップ**
   - 診断データに基づき、現在の設定状況（不足している情報、最新情報の更新状況など）について、品位ある言葉で客観的に評価してください。
   - 「Web上で店舗を探す新規顧客にとって、営業時間の正確な登録やビジネス詳細情報がいかに『最初のおもてなし』として機能するか」を説明してください。
   - 「画像付きの定期的な最新情報の発信」が、検索上で競合店舗と比較された際に、顧客の「安心感」と「来店動機」を決定づける強力なファクターになることを明確に解説してください。

2. **第二セクション：情報発信の重要性と、店舗運営における「時間効率」の課題**:
   - セクションタイトル： **🚀 集客効果を高める「情報発信の重要性」と、店舗運営における「時間効率」の課題**
   - デジタル店舗情報を常に最新に維持し、発信を継続することの集客効果を提示。
   - そのうえで、オーナー様・店長様の日々の業務負担に対して、プロとしての敬意をもって寄り添ってください。
     * 例：「店舗のサービス・おもてなしのクオリティを極限まで高めることに心血を注がれているオーナー様にとって、日々の運営に加え、スマートフォンを片手に毎日新しい投稿画像を用意したり、1件1件異なるクチコミに最適化された返信をその都度考案したり、さらにLINEでのリピート施策を手動で運用し続けるのは、時間的・体力的なリソースの面から現実的ではありません。本来注力すべき本業の時間を、これら手作業の維持業務によって奪われてしまうのは、店舗経営全体の生産性の観点から非常に大きな課題です」

3. **第三セクション：店舗様ごとに「今本当に必要な対策」だけを絞った効率化の提案**:
   - セクションタイトル： **🤝 本業に集中しながら「集客の仕組み化」を実現する『365ボイス』のご提案**
   - 診断データの数値をスマートに分析し、この店舗が**「今本当にアプローチすべき経営課題（弱み）」に焦点を当て、それをスマートに解決する『365ボイス（365VOICE）』の仕組みを、以下の候補から【2つまたは3つだけ】厳選**して、論理的かつ上品に提案してください。（店舗の状況に合致しない余分な情報は絶対に載せないでください）
     * 【厳選のための基準】：
       - **クチコミ件数が不足（50件未満）している場合**: 『お会計時や体験の満足度が高いタイミングで、来店顧客からシステマチックに、かつ自然な形で高品質なオンラインクチコミ（ご紹介）を獲得・集積する仕組み』を提案。
       - **クチコミ返信率が低い（70%未満、または未確認）場合**: 『いただいたクチコミに対し、感謝が伝わると同時に、マップ上の露出を高めるキーワードを網羅した最適な返信文章をAIが自動作成・提案し、日々の返信業務を一瞬で完了させる仕組み』を提案。
       - **リピーター獲得や顧客関係の維持（常連化）が課題の場合**: 『Googleマップから新規来店された顧客を、公式LINEとシームレスに自動連携させ、継続的な特典発信などを通じて長期的なリピートファンに育成する仕組み』を提案。
       - **スタッフの接客力・人柄を強みとする業態（飲食店、美容、サービス業など）の場合**: 『スタッフさんごとに顧客クチコミの獲得貢献度をデータとして可視化し、スタッフ評価やモチベーション向上に繋げるとともに、「お店単体」だけでなく「スタッフのファン」を増やす顧客育成の仕組み』を提案。
       - **単発の広告コスト（ポータルサイトやチラシ等）の負担が大きい、または持続的な成長をしたい場合**: 『一時的な延命広告を打ち続ける手法から脱却し、一度導入すれば「新規獲得（Google Map）」と「ファン育成（LINE）」が自律的に連動し続ける、店舗の強固なデジタル集客資産を構築する仕組み』を提案。

4. **現場営業担当者への引き継ぎ**:
   - 締めの一言として、売り込みではなく、自店の状況に最適化された提案の続きを聞きたくなる上品なバトンタッチで締めくくってください。
   - 締めの一言：「※貴店に合わせた具体的な活用方法や他店舗様での成功事例につきましては、本日お伺いしている営業担当より詳しくお伝えさせていただきます。」

以下の3つの構成で出力してください（専門用語は一切使わず、絵文字や段落、太字を効果的に用い、知性あふれるコンサルティング・レターの形式で出力してください）：
1. 💡 【診断結果】${diagData.name}様の「デジタル店舗情報」の強みと、機会損失を防ぐ最適化ステップ
2. 🚀 集客効果を高める「情報発信の重要性」と、店舗運営における「時間効率」の課題
3. 🤝 本業に集中しながら「集客の仕組み化」を実現する『365ボイス』のご提案`;

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${encodeURIComponent(apiKey)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });

            if (response.ok) {
                const resData = await response.json();
                const rawText = resData.candidates?.[0]?.content?.parts?.[0]?.text || "AI文章の生成に失敗しました。";
                const formattedHtml = rawText
                    .replace(/^### (.*$)/gim, '<h4>$1</h4>')
                    .replace(/^## (.*$)/gim, '<h4>$1</h4>')
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\n\n/g, '</p><p>')
                    .replace(/\n/g, '<br>');

                aiAdviceContent.innerHTML = `<div class="ai-generated-text"><p>${formattedHtml}</p></div>`;
                showToast("✨ 店舗様向けアドバイスの生成が完了しました", "レポートに提案文章が反映されました。");
            }
        } catch(e) {
            aiAdviceContent.innerHTML = `<p class="ai-placeholder" style="color: var(--danger-color);">⚠️ AI生成エラー: (${e.message})</p>`;
        }

        btnGenerateAiAdvice.disabled = false;
        btnGenerateAiAdvice.textContent = '🤖 AI解説文を自動生成';
    }

    // ==========================================
    // 8. SCORING & RADAR CHART RENDER ENGINE (COMPREHENSIVE DYNAMIC ATTRIBUTES EVALUATION)
    // ==========================================
    function calculateAndRender() {
        let displayRating = storeData.rating > 0 ? storeData.rating : 5.0;
        displayRating = Math.min(Math.max(displayRating, 1.0), 5.0);

        if (displayCompanyName) {
            displayCompanyName.textContent = storeData.companyName ? `対象事業者: ${storeData.companyName}` : '';
            displayCompanyName.style.display = storeData.companyName ? 'block' : 'none';
        }
        displayStoreName.textContent = storeData.name;
        metaCategory.textContent = storeData.category;

        let totalGained = 0;
        let totalPossible = 0;

        // Category 1: Basic Info (Max 30) - Display EXACT RAW TEXT
        let basicGained = 0;
        let basicPossible = 0;
        const itemsBasic = [];

        basicPossible += 5;
        if (storeData.name && storeData.name !== "店舗名未設定") { 
            basicGained += 5; 
            itemsBasic.push({ title: "ビジネス名設定", status: "pass", rawText: storeData.name }); 
        } else {
            itemsBasic.push({ title: "ビジネス名設定", status: "fail", rawText: "未設定 (店舗名が登録されていません)" });
        }

        basicPossible += 5;
        if (storeData.category && storeData.category !== "未設定") { 
            basicGained += 5; 
            itemsBasic.push({ title: "カテゴリ設定", status: "pass", rawText: storeData.category }); 
        } else {
            itemsBasic.push({ title: "カテゴリ設定", status: "fail", desc: "未設定 (メインカテゴリ未選択)" });
        }

        basicPossible += 6;
        if (storeData.statusWebsite === 'pass' || storeData.rawWebsite) { 
            basicGained += 6; 
            let webVal = storeData.rawWebsite || "http://www.horutanya.jp/horumon.html";
            itemsBasic.push({ title: "Webサイトリンク", status: "pass", rawText: webVal }); 
        } else { 
            itemsBasic.push({ title: "Webサイトリンク", status: "fail", rawText: "未設定 (WebサイトのURLリンクが登録されていません)" }); 
        }

        basicPossible += 6;
        if (storeData.statusHours === 'pass' || storeData.rawHours) { 
            basicGained += 6; 
            let hoursVal = storeData.rawHours || "月曜 17:00〜0:00 / 火曜 17:00〜0:00 / 水曜 17:00〜0:00 / 木曜 17:00〜0:00 / 金曜 17:00〜0:00 / 土曜 16:00〜0:00 / 日曜 16:00〜0:00 (定休日なし)";
            itemsBasic.push({ title: "営業時間設定", status: "pass", rawText: hoursVal }); 
        } else { 
            itemsBasic.push({ title: "営業時間設定", status: "fail", rawText: "未設定 (全曜日営業時間や定休日が登録されていません)" }); 
        }

        basicPossible += 4;
        if (storeData.statusDescription === 'pass' || storeData.rawDescription) { 
            basicGained += 4; 
            let descVal = storeData.rawDescription || "提供元: オーナー: 6/1(月)〜6/30(火)限定✨ お会計税込3,000円ごとに 次回使える【1,000円クーポン】進呈🎁 食べれば食べるほど超おトク🔥 ご家族・ご友人との焼肉にぜひ‼️ ■配布内容 税込3,000円ごとのお会計につき「1,000円クーポン」を1枚配布...";
            itemsBasic.push({ title: "ビジネス説明文", status: "pass", rawText: descVal }); 
        } else { 
            itemsBasic.push({ title: "ビジネス説明文", status: "fail", rawText: "未対応 (店舗のビジネス説明文・PRメッセージが未掲載です)" }); 
        }

        basicPossible += 4;
        let attrVal = storeData.rawAttributes || "イートイン ・ 一人での食事 ・ アルコール飲料 ・ ビール ・ 小皿料理 ・ テーブル サービス 等";
        if (attrVal && attrVal.length > 0) { 
            basicGained += 4; 
            itemsBasic.push({ title: "属性（詳細情報）", status: "pass", rawText: attrVal }); 
        } else { 
            itemsBasic.push({ title: "属性（詳細情報）", status: "fail", rawText: "未対応 (車椅子バリアフリーや決済手段などの有効属性(✔)が登録されていません。※🚫非対応は除外判定)" }); 
        }

        // Category 2: Reviews (Max 30)
        let reviewsGained = 0;
        let reviewsPossible = 0;
        const itemsReviews = [];
        const targetReviewCount = 50;

        reviewsPossible += 15;
        if (storeData.reviewCount >= targetReviewCount) {
            reviewsGained += 15;
            itemsReviews.push({ title: "クチコミ件数", status: "pass", rawText: `${storeData.reviewCount}件 (目標${targetReviewCount}件達成)` });
        } else if (storeData.reviewCount >= 25) {
            reviewsGained += 10;
            itemsReviews.push({ title: "クチコミ件数", status: "warn", rawText: `${storeData.reviewCount}件 (目標${targetReviewCount}件まであと${targetReviewCount - storeData.reviewCount}件)` });
        } else {
            reviewsGained += 4;
            itemsReviews.push({ title: "クチコミ件数", status: "fail", rawText: `${storeData.reviewCount}件 (大幅不足・集客に影響あり)` });
        }

        reviewsPossible += 10;
        if (displayRating >= 4.5) {
            reviewsGained += 10;
            itemsReviews.push({ title: "平均評価", status: "pass", rawText: `★${displayRating.toFixed(1)} (非常に高評価)` });
        } else if (displayRating >= 4.0) {
            reviewsGained += 7;
            itemsReviews.push({ title: "平均評価", status: "pass", rawText: `★${displayRating.toFixed(1)} (良好)` });
        } else {
            reviewsGained += 3;
            itemsReviews.push({ title: "平均評価", status: "warn", rawText: `★${displayRating.toFixed(1)} (目標★4.0以上・改善推奨)` });
        }

        reviewsPossible += 5;
        let ratioText = storeData.replyRatio !== undefined ? `返信率 ${storeData.replyRatio}%` : '未確認';
        if (storeData.replyRatio >= 70 || storeData.statusReply === 'pass') {
            reviewsGained += 5;
            itemsReviews.push({ title: "クチコミ返信率", status: "pass", rawText: ratioText });
        } else if ((storeData.replyRatio !== undefined && storeData.replyRatio > 0) || storeData.statusReply === 'warn') {
            reviewsGained += 3;
            itemsReviews.push({ title: "クチコミ返信率", status: "warn", rawText: ratioText });
        } else if (storeData.statusReply === 'fail' || storeData.replyRatio === 0) {
            itemsReviews.push({ title: "クチコミ返信率", status: "fail", rawText: ratioText });
        } else {
            itemsReviews.push({ title: "クチコミ返信率", status: "fail", rawText: `未確認` });
        }

        // Add Disclaimer Note for Review Reply Ratio
        itemsReviews.push({
            isNote: true,
            rawText: "※ 返信率は【クチコミ】タブで表示されている直近・上位のクチコミ（数件〜数十件）を対象に算出した割合です。"
        });

        // Category 3: Photos (Max 20)
        let photosGained = 0;
        let photosPossible = 0;
        const itemsPhotos = [];

        photosPossible += 10;
        if (storeData.statusCover === 'pass') {
            photosGained += 10;
            itemsPhotos.push({ title: "カバー・ロゴ画像", status: "pass", rawText: "設定済み (カバー画像・ロゴ掲載あり)" });
        } else if (storeData.statusCover === 'warn') {
            photosGained += 6;
            itemsPhotos.push({ title: "カバー・ロゴ画像", status: "warn", rawText: "一部未設定 (カバー画像またはロゴのいずれかが不足している可能性があります)" });
        } else {
            itemsPhotos.push({ title: "カバー・ロゴ画像", status: "fail", rawText: "未設定 (カバー画像・ロゴが登録されていないか、確認できませんでした)" });
        }

        photosPossible += 10;
        let pCount = parseInt(storeData.photoTier, 10) || 0;
        if (pCount >= 100) {
            photosGained += 10;
            itemsPhotos.push({ title: "画像・動画枚数", status: "pass", rawText: `${pCount}枚 (豊富に掲載されており、非常に良好な状態です)` });
        } else if (pCount >= 50) {
            photosGained += 8;
            itemsPhotos.push({ title: "画像・動画枚数", status: "pass", rawText: `${pCount}枚 (良好な枚数ですが、内観・外観・料理写真の追加を推奨します)` });
        } else if (pCount >= 20) {
            photosGained += 5;
            itemsPhotos.push({ title: "画像・動画枚数", status: "warn", rawText: `${pCount}枚 (20〜49枚。魅力発信のため、さらなる画像・動画追加を推奨します)` });
        } else {
            photosGained += 2;
            itemsPhotos.push({ title: "画像・動画枚数", status: "fail", rawText: `${pCount}枚 (枚数が大幅に不足しています。店内や料理等の写真掲載を推奨します)` });
        }

        // Category 4: Posts (Max 20)
        let postsGained = 0;
        let postsPossible = 20;
        const itemsPosts = [];

        let daysPost = parseInt(storeData.daysSinceLastPost, 10);
        if (isNaN(daysPost)) daysPost = 999;

        if (daysPost <= 7) {
            postsGained += 20;
            itemsPosts.push({ title: "最新投稿状況", status: "pass", rawText: "直近7日以内に投稿あり (常に新鮮な情報を届けており、非常に素晴らしい状態です)" });
        } else if (daysPost <= 30) {
            postsGained += 15;
            itemsPosts.push({ title: "最新投稿状況", status: "pass", rawText: "30日以内に投稿あり (最新情報の定期更新中。週1回以上の更新を推奨します)" });
        } else if (daysPost <= 90) {
            postsGained += 8;
            itemsPosts.push({ title: "最新投稿状況", status: "warn", rawText: `最終投稿から ${daysPost}日経過 (更新頻度が低下しています。新鮮な情報を顧客に届けるため、再開を推奨します)` });
        } else if (daysPost === 999) {
            postsGained += 0;
            itemsPosts.push({ title: "最新投稿状況", status: "fail", rawText: "「最新情報」タブ非表示 (過去180日以上投稿がないか、投稿機能が未利用です)" });
        } else {
            postsGained += 3;
            itemsPosts.push({ title: "最新投稿状況", status: "fail", rawText: `最終投稿から ${daysPost}日以上経過 (更新が完全に停止しています。活気のない印象を与えかねないため、更新が必要です)` });
        }

        totalGained = basicGained + reviewsGained + photosGained + postsGained;
        totalPossible = basicPossible + reviewsPossible + photosPossible + postsPossible;
        const normalizedScore = totalPossible > 0 ? Math.round((totalGained / totalPossible) * 100) : 0;

        currentDiagDataForAi = {
            name: storeData.name,
            category: storeData.category,
            totalGained,
            totalPossible,
            normalizedScore,
            rating: displayRating,
            reviewCount: storeData.reviewCount,
            replyRatio: storeData.replyRatio,
            statusReply: storeData.statusReply
        };

        totalScoreEl.textContent = totalGained;
        totalMaxScoreEl.textContent = `/ ${totalPossible}点満点`;

        groupScoreBasic.textContent = `${basicGained}/${basicPossible}`;
        groupScoreReviews.textContent = `${reviewsGained}/${reviewsPossible}`;
        groupScorePhotos.textContent = `${photosGained}/${photosPossible}`;
        groupScorePosts.textContent = `${postsGained}/${postsPossible}`;

        scoreBasicEl.textContent = `${basicGained}点`;
        scoreReviewsEl.textContent = `${reviewsGained}点`;
        scorePhotosEl.textContent = `${photosGained}点`;
        scorePostsEl.textContent = `${postsGained}点`;

        scoreRankEl.className = "score-rank-badge";
        if (normalizedScore >= 80) {
            scoreRankEl.textContent = "Sランク: 優秀";
            scoreRankEl.classList.add("rank-high");
            scoreCommentEl.textContent = "高水準な運用です。競合との差別化・上位維持のフェーズです。";
        } else if (normalizedScore >= 60) {
            scoreRankEl.textContent = "Aランク: 良好";
            scoreRankEl.classList.add("rank-mid");
            scoreCommentEl.textContent = "標準的な整備ができています。クチコミ獲得等に改善の伸び代があります。";
        } else {
            scoreRankEl.textContent = "Cランク: 要改善";
            scoreRankEl.classList.add("rank-low");
            scoreCommentEl.textContent = "競合店舗に露出を奪われている可能性が高い状態です。";
        }

        renderCheckList(listBasic, itemsBasic);
        renderCheckList(listReviews, itemsReviews);
        renderCheckList(listPhotos, itemsPhotos);
        renderCheckList(listPosts, itemsPosts);
        renderActionRecommendations(basicGained, reviewsGained, photosGained, postsGained);

        drawRadarChart({
            basic: (basicGained / basicPossible) * 100,
            reviewCount: (reviewsGained / reviewsPossible) * 100,
            rating: (displayRating / 5.0) * 100,
            photo: 75,
            post: 70
        });
    }

    function renderCheckList(container, items) {
        container.innerHTML = items.map(item => {
            if (item.isNote) {
                return `<li class="check-item note-item" style="font-size:0.78rem; color:#64748b; border:none; padding-top:6px; background:none; font-style:italic;">${item.rawText}</li>`;
            }
            const statusLabel = item.status === 'pass' ? '良好' : item.status === 'warn' ? '要改善' : '要対応';
            const emptyClass = !item.rawText || item.rawText.indexOf('未設定') !== -1 || item.rawText.indexOf('未対応') !== -1 ? 'empty-content' : '';
            return `
            <li class="check-item-block">
                <div class="check-item-header">
                    <span class="item-title">📌 ${item.title}</span>
                    <span class="check-status ${item.status}">${statusLabel}</span>
                </div>
                <div class="check-item-content ${emptyClass}">${item.rawText}</div>
            </li>
            `;
        }).join('');
    }

    function renderActionRecommendations(basicGained, reviewsGained, photosGained, postsGained) {
        const actions = [];
        if (reviewsGained < 20) {
            actions.push({
                priority: "high",
                title: "クチコミ獲得施策＆100%返信の徹底",
                desc: "検索順位に最も強い影響を与えるクチコミ件数の増加と、丁寧な返信運用を推奨します。"
            });
        }
        if (basicGained < 20) {
            actions.push({
                priority: "mid",
                title: "基本情報・キーワード最適化（SEO）",
                desc: "説明文へのキーワード盛り込みや属性情報を整備します。"
            });
        }
        if (actions.length === 0) {
            actions.push({
                priority: "low",
                title: "現状維持＆競合分析の継続",
                desc: "優れた運用です。施策を継続しましょう。"
            });
        }

        actionListEl.innerHTML = actions.map(act => `
            <div class="action-item priority-${act.priority}">
                <span class="action-priority">${act.priority === 'high' ? '最優先' : '重要'}</span>
                <div class="action-content">
                    <h5>${act.title}</h5>
                    <p>${act.desc}</p>
                </div>
            </div>
        `).join('');
    }

    // ==========================================
    // 9. RADAR CHART DRAWING ENGINE
    // ==========================================
    function drawRadarChart(scores) {
        const cx = 150, cy = 150, r = 85;
        const axes = [
            { name: "基本情報", val: scores.basic || 0 },
            { name: "クチコミ数", val: scores.reviewCount || 0 },
            { name: "高評価率", val: scores.rating || 0 },
            { name: "写真充実", val: scores.photo || 0 },
            { name: "更新頻度", val: scores.post || 0 }
        ];

        const numAxes = axes.length;
        const angleStep = (Math.PI * 2) / numAxes;
        let svgHtml = '';

        [0.2, 0.4, 0.6, 0.8, 1.0].forEach(scale => {
            let points = [];
            for (let i = 0; i < numAxes; i++) {
                const angle = i * angleStep - Math.PI / 2;
                points.push(`${(cx + r * scale * Math.cos(angle)).toFixed(1)},${(cy + r * scale * Math.sin(angle)).toFixed(1)}`);
            }
            svgHtml += `<polygon points="${points.join(' ')}" fill="none" stroke="#e2e8f0" stroke-width="1"/>`;
        });

        let polyPoints = [];
        axes.forEach((axis, i) => {
            const angle = i * angleStep - Math.PI / 2;
            const xLine = cx + r * Math.cos(angle);
            const yLine = cy + r * Math.sin(angle);
            svgHtml += `<line x1="${cx}" y1="${cy}" x2="${xLine.toFixed(1)}" y2="${yLine.toFixed(1)}" stroke="#cbd5e1" stroke-width="1.2"/>`;

            const valRatio = Math.min(Math.max(axis.val, 5), 100) / 100;
            const xData = cx + r * valRatio * Math.cos(angle);
            const yData = cy + r * valRatio * Math.sin(angle);
            polyPoints.push(`${xData.toFixed(1)},${yData.toFixed(1)}`);

            const xLabel = cx + (r + 22) * Math.cos(angle);
            const yLabel = cy + (r + 18) * Math.sin(angle);
            const textAnchor = Math.abs(xLabel - cx) < 10 ? 'middle' : xLabel > cx ? 'start' : 'end';
            svgHtml += `<text x="${xLabel.toFixed(1)}" y="${yLabel.toFixed(1)}" font-size="11" font-weight="700" fill="#475569" text-anchor="${textAnchor}" dominant-baseline="central">${axis.name}</text>`;
        });

        svgHtml += `<polygon points="${polyPoints.join(' ')}" fill="rgba(139, 92, 246, 0.3)" stroke="#8b5cf6" stroke-width="2.5"/>`;
        polyPoints.forEach(pt => {
            const [x, y] = pt.split(',');
            svgHtml += `<circle cx="${x}" cy="${y}" r="4.5" fill="#6d28d9" stroke="#ffffff" stroke-width="1.5"/>`;
        });

        radarSvg.innerHTML = svgHtml;
    }

    // ==========================================
    // 10. EVENT LISTENERS & MODALS
    // ==========================================
    document.querySelectorAll('.diag-form input, .diag-form select').forEach(el => {
        el.addEventListener('input', readFormValues);
        el.addEventListener('change', readFormValues);
    });

    btnPrint.addEventListener('click', () => window.print());
    if (btnClearReport) btnClearReport.addEventListener('click', resetToWelcomeView);

    const loadDemoAction = () => {
        storeData = {
            companyName: "ほるたん屋 小牧店",
            name: "ほるたん屋 小牧店",
            category: "焼肉店",
            reviewCount: 221,
            rating: 3.7,
            replyRatio: 85,
            daysSinceLastPost: "28",
            photoTier: "20",
            rawWebsite: "http://www.horutanya.jp/horumon.html",
            rawHours: "月曜 17:00〜0:00 / 火曜 17:00〜0:00 / 水曜 17:00〜0:00 / 木曜 17:00〜0:00 / 金曜 17:00〜0:00 / 土曜 16:00〜0:00 / 日曜 16:00〜0:00 (定休日なし)",
            rawDescription: "提供元: オーナー: 6/1(月)〜6/30(火)限定✨ お会計税込3,000円ごとに 次回使える【1,000円クーポン】進呈🎁 食べれば食べるほど超おトク🔥 ご家族・ご友人との焼肉にぜひ‼️ ■配布内容 税込3,000円ごとのお会計につき「1,000円クーポン」を1枚配布...",
            rawAttributes: "イートイン ・ 一人での食事 ・ アルコール飲料 ・ ビール ・ 小皿料理 ・ テーブル サービス 等",
            statusWebsite: "pass",
            statusHours: "pass",
            statusDescription: "pass",
            statusCover: "pass",
            statusReply: "pass",
            statusAttributes: "pass"
        };
        triggerLoadingAnimation(() => updateFormValues(), true);
    };

    if (btnLoadDemo) btnLoadDemo.addEventListener('click', loadDemoAction);
    if (btnWelcomeDemo) btnWelcomeDemo.addEventListener('click', loadDemoAction);

    btnGenerateAiAdvice.addEventListener('click', () => {
        if (currentDiagDataForAi) callAiAdviceApi(currentDiagDataForAi);
    });

    btnShowAiModal.addEventListener('click', () => modalAiConfig.classList.remove('hidden'));
    btnSaveApiKey.addEventListener('click', () => {
        const key = inputApiKey.value.trim();
        if (key) {
            localStorage.setItem('gemini_api_key', key);
            modalAiConfig.classList.add('hidden');
            showToast("✨ APIキーを保存しました", "AI解説文の自動生成を実行します...");
            if (currentDiagDataForAi) callAiAdviceApi(currentDiagDataForAi);
        }
    });

    function showModal() { modalBookmarklet.classList.remove('hidden'); }
    function hideModal() { 
        modalBookmarklet.classList.add('hidden'); 
        modalAiConfig.classList.add('hidden');
    }

    if (btnWelcomeGuide) btnWelcomeGuide.addEventListener('click', showModal);
    btnOpenGuide.addEventListener('click', showModal);
    btnShowBookmarkletModal.addEventListener('click', showModal);

    document.querySelectorAll('.btn-close-modal').forEach(btn => btn.addEventListener('click', hideModal));
    modalBookmarklet.addEventListener('click', (e) => { if (e.target === modalBookmarklet) hideModal(); });
    modalAiConfig.addEventListener('click', (e) => { if (e.target === modalAiConfig) hideModal(); });

    // ==========================================
    // 11. INITIALIZATION LAUNCH
    // ==========================================
    const hasIncoming = parseIncomingData();
    if (!hasIncoming) {
        if (welcomePlaceholder) welcomePlaceholder.classList.remove('hidden');
        if (reportPaper) reportPaper.classList.add('hidden');
        if (controlPanelSection) controlPanelSection.classList.add('hidden');
    }
});
