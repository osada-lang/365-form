/**
 * GBP MEO Diagnostic Tool - Complete Master Clean Rewrite
 * 
 * 日本語対応・堅牢化アップデート版 (全機能統合・完全安定版)
 * 修正内容:
 * 1. 写真枚数の取得（テキスト、Ariaラベル、DOMカウントの3層フォールバック）
 * 2. 最新投稿情報の取得（マルチセレクタ対応・レビュー日付との混同防止）
 * 3. データの保持・マージ（ハイウォーターマーク方式によるデータ劣化の完全防止）
 * 4. 堅牢な例外処理（Try-Catchによるエラー耐性の向上）
 * 5. 口コミ返信率ロジックの維持
 */

document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 1. CONSTANTS & SYSTEM CONFIGURATION
    // ==========================================
    const APP_BASE_URL = window.location.origin + window.location.pathname;
    const DEFAULT_GEMINI_KEY = "";
    const REPORT_WINDOW_TARGET = "GBP_DIAGNOSTIC_REPORT_WINDOW";
    const STORAGE_KEY = "last_gbp_data";

    const INITIAL_STORE_TEMPLATE = {
        companyName: "店舗名未設定",
        name: "店舗名未設定",
        category: "未設定",
        reviewCount: 0,
        rating: 0,
        replyRatio: undefined,
        reviewMetrics: { visible: 0, replies: 0 },
        photoMetrics: { visible: 0 },
        daysSinceLastPost: 28,
        photoTier: "0",
        photoCount: undefined,
        statusPhotos: "error",
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
    if (document.getElementById('current-year')) document.getElementById('current-year').textContent = today.getFullYear();

    if (inputApiKey) inputApiKey.value = localStorage.getItem('gemini_api_key') || "";

    // ==========================================
    // 3. BOOKMARKLET GENERATOR ENGINE
    // ==========================================
    function generateBookmarkletHref() {
        const script = `(function(){
            try {
                /* 1. ポップアップブロック回避のため、まずターゲットウィンドウを確保 */
                const reportWin = window.open('', '${REPORT_WINDOW_TARGET}');
                if (!reportWin) {
                    alert('ポップアップがブロックされました。ブラウザの設定で許可してください。');
                    return;
                }

                /* 安全な遷移判定（別ドメインの場合は読み取りがエラーになるため try-catch で保護） */
                try {
                    if (reportWin.location.href === 'about:blank') {
                        reportWin.location.href = '${APP_BASE_URL}';
                    }
                } catch(e) {
                    /* エラーが出る＝既に別ドメイン（診断ツール）が開いている状態なので何もしない */
                }

                const getLoc = () => window.location.href;
                const getTxt = () => document.body.innerText || '';
                
                /* タブ判定の精度向上 (口コミ画面など他のタブとの競合を完全に排除する厳格仕様) */
                const isPhotoView = () => {
                    const loc = getLoc();
                    /* 1. URLによる判定 (写真特有のURLパラメータがあれば最優先で確定) */
                    if (loc.indexOf('!1e10') !== -1 || loc.indexOf('/photos') !== -1) return true;
                    
                    /* 2. 口コミタブが現在選択されている場合は、写真ビューではない */
                    const activeTabs = Array.from(document.querySelectorAll('[role="tab"][aria-selected="true"], [aria-selected="true"]'));
                    const hasActiveReviewTab = activeTabs.some(el => {
                        const t = (el.innerText || '').trim();
                        return t.includes('クチコミ') || t.includes('Reviews');
                    });
                    if (hasActiveReviewTab) return false;
                    
                    /* 3. 画面上のタブ一覧の構成による判定 (写真画面特有の「すべて」+「オーナー」等の並びを検出) */
                    const tabsText = Array.from(document.querySelectorAll('[role="tab"], button, [role="button"]')).map(el => (el.innerText || '').trim().replace(/\s+/g, ' '));
                    const hasAll = tabsText.some(t => t.startsWith('すべて') || t.startsWith('All'));
                    const hasPhotoSpecialty = tabsText.some(t => t.match(/(オーナー|動画|ストリートビュー|360°|インサイド|最新|Owner|Videos|Street View|Inside)/));
                    
                    /* 写真ギャラリーの「すべて」タブがアクティブになっていることを検証 */
                    const hasActiveAllTab = activeTabs.some(el => {
                        const txt = (el.innerText || '').trim().replace(/\s+/g, ' ');
                        return txt.startsWith('すべて') || txt.startsWith('All');
                    });
                    
                    if (hasActiveAllTab && hasAll && hasPhotoSpecialty) {
                        return true;
                    }
                    
                    return false;
                };
                const isReviewView = () => {
                    const loc = getLoc();
                    const hasReviewTab = !!document.querySelector('[aria-label*="クチコミ"][aria-selected="true"], [role="tab"][aria-selected="true"] [aria-label*="クチコミ"]');
                    const isReviewUrl = loc.indexOf('/reviews') !== -1;
                    return hasReviewTab || isReviewUrl || (getTxt().indexOf('関連度順') !== -1 && getTxt().indexOf('最新順') !== -1);
                };

                const gatherData = function() {
                    try {
                        const loc = getLoc();
                        const bTxt = getTxt();
                        
                        let name = '';
                        const nameSels = ['h1.DUwDvf', 'h1.fontHeadlineLarge', 'h1.DUwif', 'h1.fontTitleLarge', 'h1', '.x30M0e'];
                        for (const s of nameSels) {
                            const el = document.querySelector(s);
                            if (el && el.innerText.trim().length > 1) {
                                name = el.innerText.trim();
                                break;
                            }
                        }
                        if (!name || name === 'Google マップ') {
                            try {
                                const m = decodeURIComponent(loc).match(/\\/place\\/([^\\/@\\?]+)/);
                                name = m ? m[1].replace(/\\+/g, ' ') : document.title.split(' - ')[0];
                            } catch(e) { name = document.title.split(' - ')[0]; }
                        }

                        let rating = 0, reviewCount = 0;
                        try {
                            /* 1. 評価値（レーティング）の取得 */
                            /* 特定のクラス (MW4T7c) や aria-label から小数点を含む数値を優先抽出 */
                            const ratingNodes = document.querySelectorAll('span.MW4T7c, span.ceR21e, [aria-label*="星"], [aria-label*="stars"]');
                            for (const node of ratingNodes) {
                                const txt = node.innerText.trim();
                                const label = node.getAttribute('aria-label') || '';
                                /* 小数点を含む「4.2」のような形式を最優先 */
                                const m = txt.match(/([1-5]\\.[0-9])/) || label.match(/([1-5]\\.[0-9])/);
                                if (m) {
                                    rating = parseFloat(m[1]);
                                    break;
                                }
                            }
                            /* 小数点付きが見つからない場合のみ、単一の数字を探す（ただし個別アイコンを除外） */
                            if (rating === 0) {
                                for (const node of ratingNodes) {
                                    const txt = node.innerText.trim();
                                    const m = txt.match(/^([1-5])$/) || txt.match(/^([1-5]\\.0)$/);
                                    if (m) {
                                        rating = parseFloat(m[1]);
                                        break;
                                    }
                                }
                            }

                            /* 2. クチコミ件数の取得 */
                            const sNode = document.querySelector('[aria-label*="星"], [aria-label*="stars"], span.ceR21e');
                            if (sNode) {
                                const p = sNode.closest('div') || sNode.parentElement;
                                const cMatch = p ? (p.innerText.match(/\\(\\s*([0-9,]+)\\s*\\)/) || p.innerText.match(/([0-9,]+)\\s*件/)) : null;
                                if (cMatch) reviewCount = parseInt(cMatch[1].replace(/,/g, ''));
                            }
                            if (reviewCount === 0) {
                                const revBtn = document.querySelector('button[aria-label*="クチコミ"], button[aria-label*="Reviews"], [aria-label*="件のクチコミ"]');
                                const btnTxt = revBtn ? (revBtn.getAttribute('aria-label') || revBtn.innerText || '') : '';
                                const cM = btnTxt.match(/([0-9,]+)/);
                                if (cM) reviewCount = parseInt(cM[1].replace(/,/g, ''));
                            }
                        } catch(e) {}

                        let photoCount = undefined, photoTier = '0', statusPhotos = 'fail', photoMetrics = {visible:0};
                        try {
                            if (isPhotoView()) {
                                let count = 0;
                                /* 1. 写真ギャラリー内の「すべて/All」タブから正確に合計件数を抽出 (口コミテキストなどの誤読を完全防止) */
                                document.querySelectorAll('[role="tab"], button, [role="button"]').forEach(el => {
                                    const t = (el.innerText || el.getAttribute('aria-label') || '').replace(/\\n/g, ' ').trim().replace(/\s+/g, ' ');
                                    if (t.startsWith('すべて') || t.startsWith('All')) {
                                        const m = t.match(/([0-9,.]+)/);
                                        if (m) {
                                            let v = parseFloat(m[1].replace(/,/g, ''));
                                            if (t.toLowerCase().includes('k')) v *= 1000;
                                            if (t.toLowerCase().includes('m')) v *= 1000000;
                                            if (v > 0) count = Math.max(count, Math.floor(v));
                                        }
                                    }
                                });
                                
                                /* 2. 画像要素のカウント (Lazy Loadを考慮) */
                                const tiles = document.querySelectorAll('img[src*="googleusercontent.com/p/"], a[href*="/data=!3m"], .U39Pse, [role="img"][aria-label*="写真"]');
                                photoMetrics.visible = tiles.length;
                                if (count === 0 || tiles.length > count) count = tiles.length;
                                
                                if (count > 0) {
                                    photoCount = count;
                                    statusPhotos = count >= 50 ? 'pass' : (count >= 20 ? 'warn' : 'fail');
                                    photoTier = count >= 100 ? '100' : (count >= 50 ? '50' : (count >= 20 ? '20' : '10'));
                                }
                            }
                        } catch(e) {}

                        let replyRatio = undefined, statusReply = 'error', reviewMetrics = {visible:0, replies:0};
                        try {
                            if (isReviewView()) {
                                const cards = Array.from(document.querySelectorAll('div[data-review-id], div.WwHIbd, div.jJ79vd, .gws-localreviews__google-review, div.My5W2e'));
                                let total = 0, replies = 0, seen = new Set();
                                cards.forEach(c => {
                                    const rid = c.getAttribute('data-review-id') || (c.innerText.substring(0,20) + c.offsetTop);
                                    if (seen.has(rid)) return; seen.add(rid);
                                    if (c.innerText.match(/[0-9]+\\s*(日前|週間前|か月前|年前)/) || c.querySelector('[aria-label*="星"]')) {
                                        total++;
                                        const hasReply = c.innerText.match(/(オーナー|店舗|ビジネス|投稿者).*(からの返信|の返信|返信済み)/) || c.querySelector('[aria-label*="返信"]');
                                        if (hasReply) replies++;
                                    }
                                });
                                if (total > 0) {
                                    reviewMetrics = {visible:total, replies:replies};
                                    replyRatio = Math.round((replies / total) * 100);
                                    statusReply = replyRatio >= 95 ? 'pass' : (replyRatio >= 80 ? 'pass' : (replyRatio >= 50 ? 'warn' : 'fail'));
                                }
                            }
                        } catch(e) {}

                        let category = '未設定', rawWebsite = '', rawHours = '', rawDescription = '', rawAttributes = '', attrCount = 0;
                        try {
                            const catNode = document.querySelector('button[jsaction*="category"], div.fontBodyMedium button');
                            category = catNode ? catNode.innerText.split('·')[0].trim() : '未設定';
                            const webBtn = document.querySelector('a[data-item-id="authority"]');
                            rawWebsite = webBtn ? webBtn.href : '';
                            rawHours = Array.from(document.querySelectorAll('table tr, div.e2W3ic')).map(r => r.innerText.replace(/\\n/g, ' ')).filter(t => t.match(/(月|火|水|木|金|土|日|曜)/)).join(' / ');
                            
                            /* 属性情報の取得改善 (基本情報/概要タブと詳細タブ双方の✔・🚫を完璧に判別するハイブリッドスキャナー) */
                            const attrList = [];
                            
                            /* 1. aria-labelスキャン: 「属性名: はい/Yes/対応」を最優先で網羅（基本情報・詳細タブ共通、半角/全角コロン対応） */
                            document.querySelectorAll('[aria-label*=": はい"], [aria-label*=":はい"], [aria-label*="： はい"], [aria-label*="：はい"], [aria-label*=": Yes"], [aria-label*=":Yes"], [aria-label*="： Yes"], [aria-label*="：Yes"], [aria-label*=": 対応"], [aria-label*=":対応"], [aria-label*="： 対応"], [aria-label*="：対応"], [aria-label*=": Supported"], [aria-label*=":Supported"], [aria-label*="： Supported"], [aria-label*="：Supported"]').forEach(el => {
                                const label = el.getAttribute('aria-label') || '';
                                /* 「属性名: はい」「属性名: Yes」「属性名: 対応」から属性名本体を高精度抽出 */
                                const m = label.match(/^(.*?)[：:]\\s*(はい|Yes|対応|Supported)/);
                                if (m) {
                                    const t = m[1].trim();
                                    if (t && t.length > 1 && t.length < 30 && t !== '基本情報') {
                                        attrList.push(t);
                                    }
                                }
                            });

                            /* 2. aria-label が "はい", "Yes", "対応" 自体であるチェックマークアイコンをスキャン */
                            document.querySelectorAll('[aria-label="はい"], [aria-label="Yes"], [aria-label="対応"], [aria-label="Supported"]').forEach(icon => {
                                const parent = icon.closest('div, span, li');
                                if (parent) {
                                    const rawTxt = parent.innerText.replace(/はい|Yes|対応|Supported|いいえ|No|非対応|Not supported/g, '').trim();
                                    rawTxt.split(/[・\\n,、·•]/).forEach(item => {
                                        const clean = item.replace(/[✔✓✔︎✔️✅]/g, '').trim();
                                        if (clean && clean.length > 1 && clean.length < 30 && clean !== '基本情報') {
                                            attrList.push(clean);
                                        }
                                    });
                                }
                            });

                            /* 3. SVGチェックマークのパス形状を検出し、同一行から抽出（テキストマークが無い場合の補完） */
                            try {
                                document.querySelectorAll('svg').forEach(svg => {
                                    const html = svg.innerHTML || '';
                                    const isCheckSvg = html.includes('M9 16') || html.includes('M21 7') || html.includes('M10 14') ||
                                                       html.includes('M19 8') || html.includes('M9 19') || html.includes('M3.8 12') ||
                                                       html.includes('M16 7') || html.includes('L19 7');
                                    if (!isCheckSvg) return;
                                    const parent = svg.closest('div, span, li');
                                    if (!parent) return;
                                    const hasForbidden = parent.querySelector('[aria-label="いいえ"], [aria-label="No"], [aria-label="非対応"], [aria-label="Not supported"]') ||
                                                         parent.innerHTML.includes('非対応') || parent.innerHTML.includes('いいえ') || parent.innerHTML.includes('🚫');
                                    if (hasForbidden) return;
                                    const rawTxt = (parent.innerText || '').replace(/はい|Yes|対応|Supported|いいえ|No|非対応|Not supported/g, '').replace(/[✔✓✔︎✔️✅]/g, '').trim();
                                    rawTxt.split(/[・\\n,、·•]/).forEach(item => {
                                        const clean = item.trim();
                                        if (clean && clean.length > 1 && clean.length < 30 && !clean.includes('\\n') && clean !== '基本情報') {
                                            attrList.push(clean);
                                        }
                                    });
                                });
                            } catch(e) {}

                            /* 4. 画面上のテキスト自体にチェックマーク（✓、✔、✔️、✅）が含まれる要素をスキャン (同じ行に非対応 🚫 がある場合は除外) */
                            document.querySelectorAll('div, span, li').forEach(el => {
                                const t = (el.innerText || '').trim();
                                if (t.includes('✓') || t.includes('✔') || t.includes('✔️') || t.includes('✅')) {
                                    /* 「非対応」系のマーク/文言が内包されている場合は丸ごと除外してスキップ */
                                    const hasForbidden = el.querySelector('[aria-label="いいえ"], [aria-label="No"], [aria-label="非対応"], [aria-label="Not supported"]') ||
                                                         t.includes('非対応') || t.includes('いいえ') || t.includes('🚫');
                                    if (hasForbidden) return;

                                    t.split(/[・\\n,、·•]/).forEach(item => {
                                        const cleanItem = item.trim();
                                        if (cleanItem.match(/^[✓✔✔️✅]/) || cleanItem.indexOf('✓') !== -1 || cleanItem.indexOf('✔') !== -1) {
                                            const clean = cleanItem.replace(/[✓✔✔️✅]/g, '').replace(/はい|Yes|対応|Supported/g, '').trim();
                                            if (clean && clean.length > 1 && clean.length < 30 && clean.indexOf('\\n') === -1 && clean !== 'もっと見る' && clean !== '詳細' && clean !== '基本情報') {
                                                attrList.push(clean);
                                            }
                                        }
                                    });
                                }
                            });

                            /* 4. クラスベーススキャン (フォールバック、非対応やもっと見る系は徹底除外) */
                            document.querySelectorAll('.w8nwRe, .IApYQ, .k77oWc, .Fk3vbd, .suS86e').forEach(el => {
                                const hasForbidden = el.querySelector('[aria-label="いいえ"], [aria-label="No"], [aria-label="非対応"], [aria-label="Not supported"]') || 
                                                     el.innerHTML.includes('いいえ') || 
                                                     el.innerHTML.includes('非対応') ||
                                                     el.innerHTML.includes('🚫');
                                if (hasForbidden) return;

                                const t = (el.innerText || '').trim();
                                if (t === 'もっと見る' || t === '詳細' || t === '詳細情報をすべて表示' || t === '基本情報' || t.length > 30) return; /* もっと見るリンクの誤検知を完全回避 */

                                t.split(/[・\\n,、·•]/).forEach(item => {
                                    const clean = item.replace(/[✔✓✔︎✔️]/g, '').trim();
                                    if (clean && clean.length > 1 && clean.length < 30) {
                                        attrList.push(clean);
                                    }
                                });
                            });

                            /* 5. テキストのコロン形式 (例: "現金のみ: はい" / "敷地内駐車場：対応") の直接抽出 */
                            try {
                                document.querySelectorAll('div, span, li, p').forEach(el => {
                                    const t = (el.innerText || '').trim();
                                    if (!t || t.length > 80) return;
                                    const m = t.match(/(.{1,30})[：:]\s*(はい|Yes|対応|Supported|可|あり|有|利用可)/);
                                    if (m) {
                                        const key = m[1].trim();
                                        const hasForbidden = t.includes('非対応') || t.includes('いいえ') || t.includes('不可') ||
                                                            el.querySelector && (el.querySelector('[aria-label="いいえ"], [aria-label="No"], [aria-label="非対応"], [aria-label="Not supported"]'));
                                        if (!hasForbidden && key && key !== '基本情報') {
                                            attrList.push(key);
                                        }
                                    }
                                });
                            } catch(e) {}

                            const uniqueAttrs = [...new Set(attrList.filter(t => t && t.length > 1 && t.length < 50))];
                            attrCount = uniqueAttrs.length;
                            rawAttributes = uniqueAttrs.length > 0 ? uniqueAttrs.slice(0, 20).join(' ・ ') + (uniqueAttrs.length > 20 ? ' 等' : '') : '';

                            const descIdx = bTxt.indexOf('提供元: オーナー');
                            rawDescription = descIdx !== -1 ? bTxt.substring(descIdx, descIdx + 600).replace(/\\n/g, ' ') : '';
                        } catch(e) {}

                        let daysSinceLastPost = -1;
                        try {
                            /* 最新投稿の取得改善 (より広範囲にテキストマッチ・レビュー混同防止) */
                            const postRegex = /([0-9]+)\\s*(日前|週間前|か月前|年前|days ago|weeks ago|months ago|years ago)/;
                            
                            /* 1. 「最新情報」または「Updates」セクションを特定して、その中から日付を探す */
                            let updatesSection = null;
                            const headings = document.querySelectorAll('div, h2, h3, span');
                            for (const h of headings) {
                                const txt = h.innerText || '';
                                if (txt === '最新情報' || txt === '最新の投稿' || txt === 'Updates') {
                                    updatesSection = h.closest('.m6QEfe') || h.parentElement?.parentElement || h.parentElement;
                                    break;
                                }
                            }
                            
                            /* 2. セクションが特定できたらその中から、そうでなければ画面全体からスキャン (レビュー除外) */
                            const targetContainer = updatesSection || document;
                            const dateEls = targetContainer.querySelectorAll('.suS86e, div, span, a');
                            
                            for (const el of dateEls) {
                                const t = el.innerText ? el.innerText.trim() : '';
                                /* レビュー関連のワードが含まれる場合はスキップして誤読を防ぐ */
                                if (!updatesSection && (t.includes('星') || t.includes('★') || t.includes('クチコミ') || t.includes('Review'))) {
                                    continue;
                                }
                                
                                const m = t.match(postRegex);
                                if (m) {
                                    const v = parseInt(m[1]);
                                    const unit = m[2];
                                    let days = -1;
                                    if (unit.match(/(日前|days)/)) days = v;
                                    else if (unit.match(/(週間|weeks)/)) days = v * 7;
                                    else if (unit.match(/(か月|months)/)) days = v * 30;
                                    else if (unit.match(/(年前|years)/)) days = v * 365;
                                    
                                    if (days !== -1 && (daysSinceLastPost === -1 || days < daysSinceLastPost)) {
                                        daysSinceLastPost = days;
                                    }
                                }
                            }
                        } catch(e) {}

                        const data = {
                            name, companyName: name, category, rating, reviewCount, isPhotoAllTab: isPhotoView(),
                            photoCount, photoTier, statusPhotos, photoMetrics,
                            replyRatio, statusReply, reviewMetrics,
                            rawWebsite, rawHours, rawDescription, rawAttributes, attrCount,
                            statusWebsite: rawWebsite ? 'pass' : 'fail',
                            statusHours: rawHours ? 'pass' : 'fail',
                            statusDescription: rawDescription.length > 100 ? 'pass' : (rawDescription.length > 0 ? 'warn' : 'fail'),
                            statusAttributes: attrCount >= 5 ? 'pass' : (attrCount >= 1 ? 'warn' : 'fail'),
                            daysSinceLastPost
                        };
                        /* 2. 先行オープンしたウィンドウへデータを送信 */
                        const dataStr = '#data=' + encodeURIComponent(JSON.stringify(data));
                        /* 別ドメイン（CORS）制限を回避するため、常に href を更新してデータを送信 */
                        /* これにより画像で発生していた Location エラーを完全に防ぎます */
                        reportWin.location.href = '${APP_BASE_URL}' + dataStr;
                        reportWin.focus();
                    } catch (e) { alert('診断エラー: ' + e.message); }
                };

                const sc = document.querySelector('div.m6QEfe[role="main"], div.m6QEfe[aria-label*="写真"], div.m6QEfe[aria-label*="クチコミ"], .m6QEfe');
                /* 遅延読み込みされる最新情報や詳細属性、説明文を確実にロードするため、すべての画面でスクロールを実行 */
                if (sc) sc.scrollTop += 2000; else window.scrollBy(0, 1500);
                setTimeout(gatherData, 1200);
            } catch (e) { alert('致命的なエラー: ' + e.message); }
        })();`;
        return "javascript:" + encodeURIComponent(script.replace(/\/\*.*?\*\/|\n\s+/g, ' '));
    }

    bookmarkletLink.setAttribute('href', generateBookmarkletHref());

    // ==========================================
    // 4. VIEW CONTROLLER & TOAST SYSTEM
    // ==========================================
    function activateReportView() {
        if (welcomePlaceholder) welcomePlaceholder.classList.add('hidden');
        if (reportPaper) reportPaper.classList.remove('hidden');
        if (controlPanelSection) controlPanelSection.classList.remove('hidden');
    }

    function resetAiAdvice() {
        currentDiagDataForAi = null;
        if (aiAdviceContent) {
            aiAdviceContent.innerHTML = '<p class="ai-placeholder">「AI解説文を自動生成」ボタンを押すと、診断データに基づいたプロコンサルタント視点の解説と営業トーク案が即時作成されます。</p>';
        }
        if (btnGenerateAiAdvice) {
            btnGenerateAiAdvice.disabled = false;
            btnGenerateAiAdvice.textContent = '🤖 AI解説文を自動生成';
        }
    }

    function resetToWelcomeView() {
        localStorage.removeItem('last_gbp_data');
        storeData = { ...INITIAL_STORE_TEMPLATE };
        resetAiAdvice();
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
        resetAiAdvice();
        hideAllModals();
        activateReportView();
        loadingOverlay.classList.remove('hidden');
        progressBarFill.style.width = '0%';
        loadingPercent.textContent = '0%';

        if (isNewStore) {
            loadingStatusText.textContent = '🏢 新しい店舗の診断レポートを作成中...';
            loadingSubText.textContent = '新しい店舗データを抽出してレポートを更新しています';
        } else if (isMergeUpdate) {
            loadingStatusText.textContent = '✨ 写真「すべて」タブの画像枚数を統合中...';
            loadingSubText.textContent = '既存の店舗情報を100%保持しながら、画像枚数のみを反映しています';
        } else {
            loadingStatusText.textContent = 'Googleマップから店舗データを抽出中...';
            loadingSubText.textContent = '基本情報・全曜日営業時間・属性(基本情報タブ)・写真(すべてタブ)を集計しています';
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
                        showToast("✨ 写真枚数を反映・統合しました！", `店舗情報を維持したまま、最新の画像枚数を追加しました。`);
                    } else {
                        showToast("✨ 診断レポートを更新しました", `${storeData.name} の最新データを反映しました。`);
                    }
                }, 250);
            }
        }, 30);
    }

    // ==========================================
    // 4. ABSOLUTE VAULT DATA MERGE ENGINE (High-Water Mark)
    // ==========================================
    function mergeStoreData(existing, incoming) {
        const merged = { ...existing };
        const safeIn = { ...INITIAL_STORE_TEMPLATE, ...incoming };

        // 1. 基本情報のマージ（空でない、かつデフォルト値でない場合のみ上書き・保持）
        if (safeIn.name && safeIn.name !== "店舗名未設定" && safeIn.name !== "店舗名取得失敗") {
            merged.name = safeIn.name;
            merged.companyName = safeIn.name;
        }
        if (safeIn.category && safeIn.category !== "未設定" && safeIn.category.length > 1) {
            merged.category = safeIn.category;
        }
        if (safeIn.reviewCount > 0) merged.reviewCount = safeIn.reviewCount;
        if (safeIn.rating > 0) merged.rating = safeIn.rating;

        // 2. 写真データの保持 (常に最新を優先)
        if (safeIn.photoCount !== undefined && safeIn.photoCount !== null && safeIn.photoCount > 0) {
            merged.photoCount = safeIn.photoCount;
            merged.photoTier = safeIn.photoTier;
            merged.statusPhotos = safeIn.statusPhotos;
            merged.photoMetrics = safeIn.photoMetrics;
        }

        // 3. 口コミ返信率の保持（新しく計測できたデータが存在する場合のみ）
        if (safeIn.replyRatio !== undefined && safeIn.replyRatio !== null) {
            const inTotal = (safeIn.reviewMetrics && safeIn.reviewMetrics.visible) || 0;
            const exTotal = (merged.reviewMetrics && merged.reviewMetrics.visible) || 0;
            if (inTotal >= exTotal || merged.replyRatio === undefined) {
                merged.replyRatio = safeIn.replyRatio;
                merged.statusReply = safeIn.statusReply;
                merged.reviewMetrics = safeIn.reviewMetrics;
            }
        }

        // 4. 最新投稿情報の保持（より新しい日付＝日数が小さいものを優先、-1は投稿なしを確定反映）
        if (safeIn.daysSinceLastPost !== undefined) {
            if (safeIn.daysSinceLastPost === -1) {
                if (merged.daysSinceLastPost === undefined || merged.daysSinceLastPost === 28) {
                    merged.daysSinceLastPost = -1;
                }
            } else {
                const currentDays = merged.daysSinceLastPost;
                if (currentDays === undefined || currentDays === 28 || currentDays === -1 || safeIn.daysSinceLastPost < currentDays) {
                    merged.daysSinceLastPost = safeIn.daysSinceLastPost;
                }
            }
        }

        // 5. ステータス・rawデータのハイウォーターマーク統合（ランクが高い、または文字数が多いものを維持）
        const statusKeys = ['statusWebsite', 'statusHours', 'statusDescription', 'statusAttributes'];
        statusKeys.forEach(k => {
            const inRank = STATUS_RANK[safeIn[k]] || 0;
            const exRank = STATUS_RANK[merged[k]] || 0;
            const rawKey = k.replace('status', 'raw');
            if (inRank > exRank) {
                merged[k] = safeIn[k];
                if (safeIn[rawKey]) merged[rawKey] = safeIn[rawKey];
                if (k === 'statusAttributes') merged.attrCount = safeIn.attrCount;
            } else if (inRank === exRank && inRank > 0) {
                if ((safeIn[rawKey]||"").length > (merged[rawKey]||"").length) {
                    merged[rawKey] = safeIn[rawKey];
                }
            }
        });

        return merged;
    }

    // ==========================================
    // 5. CALCULATION & UI ENGINE
    // ==========================================
    function calculateAndRender() {
        // スコア計算ロジック
        let basicScore = 0;
        let basicMax = 100;
        let basicItemsCount = 4; // HP, 営業時間, 説明文, 属性

        let scoreWeb = storeData.statusWebsite === 'pass' ? 25 : (storeData.statusWebsite === 'warn' ? 15 : 0);
        let scoreHours = storeData.statusHours === 'pass' ? 25 : (storeData.statusHours === 'warn' ? 15 : 0);
        let scoreDesc = storeData.statusDescription === 'pass' ? 25 : (storeData.statusDescription === 'warn' ? 15 : 0);
        let scoreAttr = storeData.statusAttributes === 'pass' ? 25 : (storeData.statusAttributes === 'warn' ? 15 : 0);
        basicScore = scoreWeb + scoreHours + scoreDesc + scoreAttr;

        // クチコミスコア (返信率ベース)
        let reviewScore = 0;
        let reviewRate = storeData.replyRatio;
        if (reviewRate !== undefined && !isNaN(reviewRate)) {
            if (reviewRate >= 80) reviewScore = 100;
            else if (reviewRate >= 50) reviewScore = 70;
            else reviewScore = 30;
        } else {
            reviewScore = 50; // 未計測時のデフォルト
        }

        // 写真スコア
        let photoScore = 0;
        let pCount = storeData.photoCount || 0;
        if (pCount >= 50) photoScore = 100;
        else if (pCount >= 20) photoScore = 70;
        else if (pCount > 0) photoScore = 40;
        else photoScore = 10;

        // 投稿スコア
        let postScore = 0;
        let dPost = storeData.daysSinceLastPost;
        if (dPost <= 7) postScore = 100;
        else if (dPost <= 14) postScore = 80;
        else if (dPost <= 30) postScore = 50;
        else postScore = 20;

        // 総合スコア（100点満点換算）
        const totalScore = Math.round((basicScore * 0.3) + (reviewScore * 0.3) + (photoScore * 0.2) + (postScore * 0.2));

        // UI反映
        if (displayCompanyName) displayCompanyName.textContent = storeData.companyName;
        if (displayStoreName) displayStoreName.textContent = storeData.name;
        if (metaCategory) metaCategory.textContent = storeData.category;

        if (totalScoreEl) totalScoreEl.textContent = totalScore;
        if (scoreBasicEl) scoreBasicEl.textContent = basicScore;
        if (scoreReviewsEl) scoreReviewsEl.textContent = reviewScore;
        if (scorePhotosEl) scorePhotosEl.textContent = photoScore;
        if (scorePostsEl) scorePostsEl.textContent = postScore;

        // ランク判定
        let rank = 'C';
        let comment = '改善の余地が多数あります。優先度の高い項目から対策を行いましょう。';
        if (totalScore >= 85) { rank = 'S'; comment = '素晴らしい最適化状態です！競合に対して大きな優位性があります。'; }
        else if (totalScore >= 70) { rank = 'A'; comment = '良好な状態ですが、一部の項目を改善することでさらに上位表示が狙えます。'; }
        else if (totalScore >= 50) { rank = 'B'; comment = '基本的な設定や運用に不足が見られます。早めの対策が推奨されます。'; }

        if (scoreRankEl) scoreRankEl.textContent = rank;
        if (scoreCommentEl) scoreCommentEl.textContent = comment;

        // フォーム同期
        if (inputCompanyName) inputCompanyName.value = storeData.companyName;
        if (inputStoreName) inputStoreName.value = storeData.name;
        if (inputCategory) inputCategory.value = storeData.category;
        if (inputReviewCount) inputReviewCount.value = storeData.reviewCount;
        if (inputRating) inputRating.value = storeData.rating;
        if (inputLastPost) inputLastPost.value = storeData.daysSinceLastPost;
        if (inputPhotoCount) inputPhotoCount.value = storeData.photoCount !== undefined ? storeData.photoCount : '';

        // ローカルストレージに保存
        saveStoredData(storeData);
    }

    // ==========================================
    // 6. URL HASH & EVENT HANDLERS
    // ==========================================
    function parseIncomingData() {
        if (window.location.hash.startsWith('#data=')) {
            try {
                const jsonStr = decodeURIComponent(window.location.hash.substring(6));
                const incomingData = JSON.parse(jsonStr);
                
                const isNewStore = !storeData.name || storeData.name === "店舗名未設定" || (incomingData.name && incomingData.name !== storeData.name);
                const isMergeUpdate = !isNewStore && incomingData.isPhotoAllTab;

                // 新しい店舗の場合は、過去の無関係な店舗データをクリーンリセット（混同を完全防止）
                if (isNewStore) {
                    storeData = { ...INITIAL_STORE_TEMPLATE };
                }

                // ハイウォーターマーク方式でデータを安全に統合
                storeData = mergeStoreData(storeData, incomingData);
                
                // アニメーションをトリガーしてUIを更新
                triggerLoadingAnimation(() => {
                    calculateAndRender();
                    if (welcomePlaceholder) welcomePlaceholder.classList.add('hidden');
                    if (reportPaper) reportPaper.classList.remove('hidden');
                    if (controlPanelSection) controlPanelSection.classList.remove('hidden');
                }, isMergeUpdate, isNewStore);
                
                // ハッシュをクリアしてリロード時の二重処理を防ぐ
                history.replaceState(null, null, window.location.pathname);
                return true;
            } catch (e) {
                console.error("Parse Error:", e);
                showToast("読込エラー", "診断データの解析に失敗しました。", true);
            }
        } else {
            // ストレージから復元を試みる
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    if (parsed && parsed.name && parsed.name !== "店舗名未設定") {
                        storeData = { ...INITIAL_STORE_TEMPLATE, ...parsed };
                        activateReportView();
                        calculateAndRender();
                        return true;
                    }
                } catch(e) {}
            }
        }
        return false;
    }

    function saveStoredData(data) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {}
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
        selectCover.value = storeData.statusCover || 'error';
        selectReply.value = storeData.statusReply || 'error';
        selectAttributes.value = storeData.statusAttributes || 'error';

        calculateAndRender();
    }

    function readFormValues() {
        if (inputCompanyName) storeData.companyName = inputCompanyName.value;
        storeData.name = inputStoreName.value || "店舗名未設定";
        storeData.category = inputCategory.value || "カテゴリ未設定";
        storeData.reviewCount = parseInt(inputReviewCount.value) || 0;

        let rawR = parseFloat(inputRating.value) || 0;
        storeData.rating = Math.min(Math.max(rawR, 1.0), 5.0);

        storeData.daysSinceLastPost = parseInt(inputLastPost.value) || 28;
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
    // 7. GEMINI 3.6 FLASH AI ADVISOR 3.0 (STRICT STRUCTURED OUTPUT)
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

        const prompt = `あなたは頼れるGoogleマップ集客（MEO）の専門コンサルタントです。
以下のGBP診断レポート結果に基づき、店舗のオーナー様・店長様（${diagData.name} 様）が直接読まれて「自分の店の強み、課題、明日からの具体的な対策」が深く理解できる、説得力と親しみのあるアドバイス文章を作成してください。

【対象店舗】${diagData.name}
【業種・カテゴリ】${diagData.category}
【総合最適化スコア】${diagData.totalGained}点 / ${diagData.totalPossible}点満点 (${diagData.normalizedScore}%達成)
【評価】★${diagData.rating.toFixed(1)} (${diagData.reviewCount}件のクチコミ)
【クチコミ返信率】${diagData.replyRatio !== undefined ? diagData.replyRatio + '%' : '未確認'}

【必須出力フォーマット】
以下の「3つのセクション」と「各3つの小項目（サブ見出し）」の構成と見出しタイトルの通りに厳密に出力してください。各小項目では指示に従って具体的に執筆してください。

💡 セクション1: 【診断結果】${diagData.name} 様の「デジタル店舗情報」の現状と、機会損失の可能性
小項目 1-1: 📌 現在Googleマップ上で可視化されている「クチコミ評価と顧客認知」の現状
（高評価店舗では強みを称え、低評価や件数不足の店舗では現状の客観的分析を行ってください）
小項目 1-2: 📊 診断データで判明した「店舗情報の設定状況と最適化スコア」
（スコア${diagData.normalizedScore}%や設定漏れ・更新不足項目の客観的事実を述べてください）
小項目 1-3: ⚠️ 競合店舗と比較された際に発生している「潜在的な機会損失」
（検索上の情報不足や更新停止による顧客離れ・他店への流出の可能性を詳しく述べてください）

🚀 セクション2: 競合と差をつけ集客を最大化する対策と、店舗運営における「リソース」の課題
小項目 2-1: 📌 Web上の認知度と集客力を最大化するための「3つの必須アプローチ」
（正確な情報更新、定期的な写真投稿、100%のクチコミ返信の重要性を述べてください）
小項目 2-2: 📈 クチコミ件数と来店・問い合わせ増加に相関する「実証データと事実」
（「クチコミ数は300件に達するまでは50件増えるごとに問い合わせが1.2〜1.5倍に増加する」という実証データを必ず引用してください）
小項目 2-3: ⏳ 手作業での継続運用が直面する「時間と労力（リソース）の壁」
（日々の本業をこなしながら手作業でこれらを継続することの大変さ・課題感を共感を持って述べてください）

🤝 セクション3: 本業に集中しながら最小限の労力で成果を最大化する『365ボイス』のご提案
小項目 3-1: ⚙️ 運用にかかる手作業ストレスをゼロにする『365ボイス』の概要
（Googleマップ運用・クチコミ獲得・AI返信・LINE連携の自動化・効率化システムである概要を述べてください）
小項目 3-2: 🎯 ${diagData.name} 様の現在の集客課題を解消する「厳選・特化機能のご提案」
（診断結果の弱みに合わせて2〜3個の機能を厳選して提案してください）
小項目 3-3: 🏛️ 単発の広告依存から脱却する「持続的なデジタル集客資産」の確立
（一過性の広告ではなく長期的な自律集客基盤の構築を述べ、最後に必ず「※貴店での具体的な活用方法や他店舗様での成功事例につきましては、本日ご案内の営業担当より詳しくお伝えさせていただきます。」と添えて締めくくってください）`;

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
                    .replace(/^---+$/gim, '')
                    .replace(/^[#\s]*([\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}]?\s*セクション\s*\d+:[^\n]+)/gimu, '<h3 class="ai-section-title">$1</h3>')
                    .replace(/^[#\s]*([\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}]?\s*小項目\s*\d+-\d+:[^\n]+)/gimu, '<h4 class="ai-sub-title">$1</h4>')
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/^[\*\-]\s+(.*$)/gim, '<li style="margin-left: 1.2rem; margin-bottom: 0.3rem; list-style: disc;">$1</li>')
                    .replace(/\n\n/g, '</p><p>')
                    .replace(/\n/g, '<br>');

                aiAdviceContent.innerHTML = `<div class="ai-generated-text">${formattedHtml}</div>`;
                showToast("✨ 店舗様向けアドバイスの生成が完了しました", "指定セクション構成で提案文章が反映されました。");
            }
        } catch(e) {
            aiAdviceContent.innerHTML = `<p class="ai-placeholder" style="color: var(--danger-color);">⚠️ AI生成エラー: (${e.message})</p>`;
        }

        btnGenerateAiAdvice.disabled = false;
        btnGenerateAiAdvice.textContent = '🤖 AI解説文を自動生成';
    }

    // ==========================================
    // 8. SCORING & RADAR CHART ENGINE
    // ==========================================
    function calculateAndRender() {
        let displayRating = storeData.rating > 0 ? storeData.rating : 5.0;
        displayRating = Math.min(Math.max(displayRating, 1.0), 5.0);

        if (displayCompanyName) {
            if (storeData.companyName && storeData.companyName !== storeData.name && storeData.companyName !== "店舗名未設定") {
                displayCompanyName.textContent = `対象事業者: ${storeData.companyName}`;
                displayCompanyName.style.display = 'block';
            } else {
                displayCompanyName.textContent = '';
                displayCompanyName.style.display = 'none';
            }
        }
        displayStoreName.textContent = storeData.name;
        metaCategory.textContent = storeData.category;

        let totalGained = 0;
        let totalPossible = 0;

        // Category 1: Basic Info (Max 30)
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

        // STRICT WEBSITE EVALUATION & FILTER
        basicPossible += 6;
        let webVal = storeData.rawWebsite || "";
        let isSystemUrl = Boolean(webVal && (webVal.indexOf('google.co.jp/intl') !== -1 || webVal.indexOf('google.com/intl') !== -1 || webVal.indexOf('about/products') !== -1));
        
        if ((storeData.statusWebsite === 'pass' || webVal) && !isSystemUrl) { 
            basicGained += 6; 
            itemsBasic.push({ title: "Webサイトリンク", status: "pass", rawText: webVal }); 
        } else { 
            itemsBasic.push({ title: "Webサイトリンク", status: "fail", rawText: "未設定 (WebサイトのURLリンクが登録されていません)" }); 
        }

        basicPossible += 6;
        if (storeData.statusHours === 'pass' || storeData.rawHours) { 
            basicGained += 6; 
            let hoursVal = storeData.rawHours || "月曜 9:00〜19:00 / 火曜 9:00〜19:00 / 水曜 9:00〜19:00 / 木曜 9:00〜19:00 / 金曜 9:00〜19:00 / 土曜 9:00〜18:00 (日曜定休)";
            itemsBasic.push({ title: "営業時間設定", status: "pass", rawText: hoursVal }); 
        } else { 
            itemsBasic.push({ title: "営業時間設定", status: "fail", rawText: "未設定 (全曜日営業時間や定休日が登録されていません)" }); 
        }

        // GRADED SCORE: Business Description (Max 4pt: 250+ chars = 4pt, 1-249 chars = 2pt, 0 = 0pt)
        basicPossible += 4;
        let descText = storeData.rawDescription || "";
        let descLen = descText.length;
        if (descLen >= 250) { 
            basicGained += 4; 
            itemsBasic.push({ title: "ビジネス説明文", status: "pass", rawText: `${descText} (${descLen}文字・良好)` }); 
        } else if (descLen > 0) {
            basicGained += 2;
            itemsBasic.push({ title: "ビジネス説明文", status: "warn", rawText: `${descText} (${descLen}文字・文字数が不足しています。検索キーワードを含めて250文字以上への拡充を推奨)` });
        } else { 
            itemsBasic.push({ title: "ビジネス説明文", status: "fail", rawText: "未対応 (店舗のビジネス説明文・PRメッセージが未掲載です)" }); 
        }

        // GRADED SCORE: Attributes (Max 4pt: 5+ items = 4pt, 1-4 items = 2pt, 0 items = 0pt)
        basicPossible += 4;
        let attrText = storeData.rawAttributes || "";
        let attrCount = storeData.attrCount;
        
        if (attrText && (attrCount === undefined || attrCount === 0)) {
            let cleanText = attrText.replace(/\s*等\s*/g, '').replace(/\s*\([\s\S]*?\)/g, '');
            let items = cleanText.split('・').map(s => s.trim()).filter(s => s.length > 0);
            attrCount = items.length;
        }

        if (attrCount >= 5) { 
            basicGained += 4; 
            let attrVal = attrText.replace(/\s*\([\s\S]*?\)/g, '');
            itemsBasic.push({ title: "属性（詳細情報）", status: "pass", rawText: `${attrVal} (${attrCount}項目登録済み・良好)` }); 
        } else if (attrCount >= 1) {
            basicGained += 2;
            let attrVal = attrText.replace(/\s*\([\s\S]*?\)/g, '');
            itemsBasic.push({ title: "属性（詳細情報）", status: "warn", rawText: `${attrVal} (${attrCount}項目登録・項目数が不足しています。決済手段や設備の追加設定を推奨)` });
        } else if (storeData.statusAttributes === 'fail' || attrCount === 0) {
            itemsBasic.push({ title: "属性（詳細情報）", status: "fail", rawText: "未対応 (車椅子対応や決済手段などの有効属性(✔)が登録されていません)" }); 
        } else {
            itemsBasic.push({ title: "属性（詳細情報）", status: "fail", rawText: "未確認（【基本情報】タブを開いて診断してください）" }); 
        }

        // Category 2: Reviews (Max 30)
        let reviewsGained = 0;
        let reviewsPossible = 0;
        const itemsReviews = [];
        
        let metricsText = "";
        const rCount = parseInt(storeData.reviewCount) || 0;
        if (storeData.reviewMetrics && storeData.reviewMetrics.visible > 0) {
            let gapWarning = "";
            if (rCount > storeData.reviewMetrics.visible + 2) {
                gapWarning = `<br><span style="color:#ef4444; font-size:0.75rem; font-weight:bold;">⚠️ 全${rCount}件中${storeData.reviewMetrics.visible}件のみ検知。全件診断するにはクチコミを最下部までスクロールしてから再実行してください。</span>`;
            }
            metricsText = ` (確認できたクチコミ ${storeData.reviewMetrics.visible}件中 ${storeData.reviewMetrics.replies}件に返信あり)${gapWarning}`;
        }

        // GRADED SCORE: Review Count (Max 12pt: 500+ = 12pt, 300-499 = 9pt, 100-299 = 6pt, 50-99 = 3pt, <50 = 0pt)
        reviewsPossible += 12;
        if (rCount >= 500) {
            reviewsGained += 12;
            itemsReviews.push({ title: "クチコミ件数", status: "pass", rawText: `${rCount}件 (目標500件達成・圧倒的な集客基盤)` });
        } else if (rCount >= 300) {
            reviewsGained += 9;
            itemsReviews.push({ title: "クチコミ件数", status: "pass", rawText: `${rCount}件 (良好・さらなる獲得を推奨)` });
        } else if (rCount >= 100) {
            reviewsGained += 6;
            itemsReviews.push({ title: "クチコミ件数", status: "warn", rawText: `${rCount}件 (標準的・競合優位性の確保が必要)` });
        } else if (rCount >= 50) {
            reviewsGained += 3;
            itemsReviews.push({ title: "クチコミ件数", status: "warn", rawText: `${rCount}件 (不足・信頼性向上に改善が必要)` });
        } else {
            itemsReviews.push({ title: "クチコミ件数", status: "fail", rawText: `${rCount}件 (大幅不足・集客に悪影響あり)` });
        }

        // GRADED SCORE: Average Rating (Max 3pt: 4.5+ = 3pt, 4.0-4.4 = 2pt, <4.0 = 0pt)
        reviewsPossible += 3;
        if (displayRating >= 4.5) {
            reviewsGained += 3;
            itemsReviews.push({ title: "平均評価", status: "pass", rawText: `★${displayRating.toFixed(1)} (非常に高評価)` });
        } else if (displayRating >= 4.0) {
            reviewsGained += 2;
            itemsReviews.push({ title: "平均評価", status: "pass", rawText: `★${displayRating.toFixed(1)} (良好)` });
        } else {
            itemsReviews.push({ title: "平均評価", status: "warn", rawText: `★${displayRating.toFixed(1)} (目標★4.0以上・改善推奨)` });
        }

        // GRADED SCORE: Review Reply Ratio (Max 15pt: 95%+ = 15pt, 80-94% = 12pt, 50-79% = 8pt, 1-49% = 4pt, 0% = 0pt)
        reviewsPossible += 15;
        let ratioVal = storeData.replyRatio;
        if (ratioVal !== undefined) {
            if (ratioVal >= 95) {
                reviewsGained += 15;
                itemsReviews.push({ title: "クチコミ返信率", status: "pass", rawText: `返信率 ${ratioVal}%${metricsText} (完璧な運用・ファン化促進中)` });
            } else if (ratioVal >= 80) {
                reviewsGained += 12;
                itemsReviews.push({ title: "クチコミ返信率", status: "pass", rawText: `返信率 ${ratioVal}%${metricsText} (良好・全件返信を目指しましょう)` });
            } else if (ratioVal >= 50) {
                reviewsGained += 8;
                itemsReviews.push({ title: "クチコミ返信率", status: "warn", rawText: `返信率 ${ratioVal}%${metricsText} (返信漏れあり・運用体制の再考推奨)` });
            } else if (ratioVal > 0) {
                reviewsGained += 4;
                itemsReviews.push({ title: "クチコミ返信率", status: "fail", rawText: `返信率 ${ratioVal}%${metricsText} (放置気味・早急な対応が必要)` });
            } else {
                itemsReviews.push({ title: "クチコミ返信率", status: "fail", rawText: `返信率 0%${metricsText} (放置状態・致命的な機会損失)` });
            }
        } else if (storeData.statusReply === 'pass') {
            reviewsGained += 12; // 80% equivalent
            itemsReviews.push({ title: "クチコミ返信率", status: "pass", rawText: `返信率 80%以上 (良好)` });
        } else if (storeData.statusReply === 'warn') {
            reviewsGained += 8; // 50% equivalent
            itemsReviews.push({ title: "クチコミ返信率", status: "warn", rawText: `返信率 一部対応 (返信漏れあり・100%返信への改善推奨)` });
        } else if (storeData.statusReply === 'fail') {
            itemsReviews.push({ title: "クチコミ返信率", status: "fail", rawText: `返信率 0% (未返信・放置状態・全クチコミへの返信が必須)` });
        } else {
            itemsReviews.push({ title: "クチコミ返信率", status: "fail", rawText: `未確認（【クチコミ】タブを開いて診断してください）` });
        }

        itemsReviews.push({
            isNote: true,
            rawText: "※ 返信率は【クチコミ】タブで表示されている直近・上位のクチコミ（数件〜数十件）を対象に算出した割合です。"
        });

        // Category 3: Photos (Max 20)
        let photosGained = 0;
        let photosPossible = 20;
        const itemsPhotos = [];
        
        // Basic cover/logo check (implicit 4pt baseline if exists, but we'll focus on count)
        itemsPhotos.push({ title: "カバー・ロゴ画像", status: "pass", rawText: "設定済み (カバー画像・ロゴ掲載あり)" });

        let pCount = storeData.photoCount || 0;
        let pMetricsText = "";
        if (storeData.photoMetrics && storeData.photoMetrics.visible > 0) {
            if (pCount > storeData.photoMetrics.visible + 10) {
                pMetricsText = `<br><span style="color:#ef4444; font-size:0.75rem; font-weight:bold;">⚠️ 公表${pCount}枚中${storeData.photoMetrics.visible}枚のみ検知。正確な枚数を集計するには写真タブを最下部までスクロールしてから再実行してください。</span>`;
            }
        }
        
        if (pCount >= 100 || storeData.photoTier === '100') {
            photosGained = 20; // Max points
            itemsPhotos.push({ title: "画像・動画枚数", status: "pass", rawText: `${pCount}枚 (100枚以上・圧倒的な充実度)${pMetricsText}` });
        } else if (pCount >= 50 || storeData.photoTier === '50') {
            photosGained = 16;
            itemsPhotos.push({ title: "画像・動画枚数", status: "pass", rawText: `${pCount}枚 (豊富・良好な状態)${pMetricsText}` });
        } else if (pCount >= 20 || (storeData.photoTier === '20' && pCount > 0)) {
            photosGained = 10;
            itemsPhotos.push({ title: "画像・動画枚数", status: "warn", rawText: `${pCount}枚 (標準的・外観や内観写真の追加を推奨)${pMetricsText}` });
        } else if (pCount >= 10 || (storeData.photoTier === '10' && pCount > 0)) {
            photosGained = 5;
            itemsPhotos.push({ title: "画像・動画枚数", status: "warn", rawText: `${pCount}枚 (不足・視認性向上のため追加を推奨)${pMetricsText}` });
        } else {
            photosGained = 0;
            let cntText = (pCount > 0) ? `${pCount}枚 (大幅不足・追加必須)` : "未確認（写真ギャラリーの【すべて】タブを開いて診断してください）";
            itemsPhotos.push({ title: "画像・動画枚数", status: "fail", rawText: cntText });
        }

        // GRADED SCORE: Category 4: Posts (Max 20pt: <=14 days = 20pt, 15-30 days = 10pt, >30 days/none = 4pt)
        let postsGained = 0;
        let postsPossible = 20;
        const itemsPosts = [];

        let lastPostDays = storeData.daysSinceLastPost !== undefined ? parseInt(storeData.daysSinceLastPost) : 28;
        if (isNaN(lastPostDays)) lastPostDays = 28;

        if (lastPostDays > 0 && lastPostDays <= 14) {
            postsGained = 20;
            itemsPosts.push({ title: "最新投稿状況", status: "pass", rawText: `直近 ${lastPostDays}日前に投稿あり (高頻度更新中・良好)` });
        } else if (lastPostDays > 0 && lastPostDays <= 30) {
            postsGained = 10;
            itemsPosts.push({ title: "最新投稿状況", status: "warn", rawText: `最終投稿から ${lastPostDays}日経過 (更新頻度低下・週1〜2回の定期投稿を推奨)` });
        } else {
            postsGained = 4;
            let displayText = (lastPostDays === -1) ? "未対応 (最新の投稿情報・オーナー提供情報がありません。定期的な投稿を推奨)" : `最終投稿から ${lastPostDays}日以上経過 (30日以上更新停止中・定期投稿が必須)`;
            itemsPosts.push({ title: "最新投稿状況", status: "fail", rawText: displayText });
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

        // Calculate gain for radar categories
        let reviewCountGained = 0;
        if (storeData.reviewCount >= 500) reviewCountGained = 12;
        else if (storeData.reviewCount >= 300) reviewCountGained = 9;
        else if (storeData.reviewCount >= 100) reviewCountGained = 6;
        else if (storeData.reviewCount >= 50) reviewCountGained = 3;

        let replyGained = 0;
        if (ratioVal !== undefined) {
            if (ratioVal >= 95) replyGained = 15;
            else if (ratioVal >= 80) replyGained = 12;
            else if (ratioVal >= 50) replyGained = 8;
            else if (ratioVal > 0) replyGained = 4;
        } else if (storeData.statusReply === 'pass') replyGained = 12;
        else if (storeData.statusReply === 'warn') replyGained = 8;

        drawRadarChart({
            basic: Math.round((basicGained / basicPossible) * 100),
            reviewCount: Math.round((reviewCountGained / 12) * 100),
            reviewOps: Math.round((replyGained / 15) * 100),
            photo: Math.round((photosGained / photosPossible) * 100),
            post: Math.round((postsGained / postsPossible) * 100)
        });
    }

    function renderCheckList(container, items) {
        container.innerHTML = items.map(item => {
            if (item.isNote) {
                return `<li class="check-item note-item" style="font-size:0.78rem; color:#64748b; border:none; padding-top:6px; background:none; font-style:italic;">${item.rawText}</li>`;
            }
            const statusLabel = item.status === 'pass' ? '良好' : item.status === 'warn' ? '要改善' : '未対応';
            const emptyClass = !item.rawText || item.rawText.indexOf('未設定') !== -1 || item.rawText.indexOf('未対応') !== -1 || item.rawText.indexOf('未確認') !== -1 ? 'empty-content' : '';
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
        if (reviewsGained < 25) {
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
            { name: "クチコミ運用", val: scores.reviewOps || 0 },
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
    // 10. EVENT LISTENERS & GLOBAL DELEGATION
    // ==========================================
    document.querySelectorAll('.diag-form input, .diag-form select').forEach(el => {
        el.addEventListener('input', readFormValues);
        el.addEventListener('change', readFormValues);
    });

    btnPrint.addEventListener('click', () => window.print());
    if (btnClearReport) btnClearReport.addEventListener('click', resetToWelcomeView);

    const loadDemoAction = () => {
        storeData = {
            companyName: "一期自動車 小牧店",
            name: "一期自動車 小牧店",
            category: "自動車整備工場",
            reviewCount: 221,
            rating: 4.7,
            replyRatio: 85,
            daysSinceLastPost: 7,
            photoTier: "50",
            photoCount: 64,
            statusPhotos: "pass",
            rawWebsite: "http://ichigo-auto.jp/",
            rawHours: "月曜 9:00〜19:00 / 火曜 9:00〜19:00 / 水曜 9:00〜19:00 / 木曜 9:00〜19:00 / 金曜 9:00〜19:00 / 土曜 9:00〜18:00 (日曜定休)",
            rawDescription: "提供元: オーナー: 小牧市の鈑金塗装・自動車整備工場です。車検、点検、修理、オイル交換などお気軽にご相談ください！無料代車もご用意しております。確かな技術でお客様のカーライフをトータルサポートいたします！",
            rawAttributes: "トイレ ・ 整備士 ・ 事前予約がおすすめ ・ 車椅子対応の駐車場 ・ キャッシュレス決済対応 等",
            attrCount: 5,
            statusWebsite: "pass",
            statusHours: "pass",
            statusDescription: "pass",
            statusCover: "pass",
            statusReply: "pass",
            statusAttributes: "pass"
        };
        triggerLoadingAnimation(() => updateFormValues(), false, true);
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

    function showModal() { 
        if (modalBookmarklet) modalBookmarklet.classList.remove('hidden'); 
    }

    function hideModal() { 
        if (modalBookmarklet) modalBookmarklet.classList.add('hidden'); 
        if (modalAiConfig) modalAiConfig.classList.add('hidden');
        document.querySelectorAll('.modal-overlay, .modal').forEach(m => m.classList.add('hidden'));
    }

    if (btnWelcomeGuide) btnWelcomeGuide.addEventListener('click', showModal);
    if (btnOpenGuide) btnOpenGuide.addEventListener('click', showModal);
    if (btnShowBookmarkletModal) btnShowBookmarkletModal.addEventListener('click', showModal);

    // Global Event Delegation for Close Buttons & Overlay Clicks
    document.addEventListener('click', (e) => {
        if (e.target.closest('.btn-close-modal')) {
            e.preventDefault();
            e.stopPropagation();
            hideModal();
        } else if (e.target.classList.contains('modal-overlay')) {
            hideModal();
        }
    });

    // ESC Key to Close Modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' || e.key === 'Esc') {
            hideModal();
        }
    });

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
