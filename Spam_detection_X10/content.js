// content.js — Spam Sentinel Chrome Extension

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action !== "manualScan") return;

    console.log("[Spam Sentinel] Manual scan triggered.");

    // 1. Detect Gmail email body vs general page
    const gmailSelectors = ['.a3s.aiL', '.a3s', '.ii.gt', '[data-message-id]'];
    let gmailBody = null;
    for (const sel of gmailSelectors) {
        gmailBody = document.querySelector(sel);
        if (gmailBody) break;
    }

    // 2. Grab text — prefer user selection → Gmail body → full page
    let textToScan = window.getSelection().toString().trim();
    if (textToScan.length < 10) {
        textToScan = gmailBody ? gmailBody.innerText : document.body.innerText;
    }
    textToScan = textToScan.substring(0, 4000).trim();

    if (!textToScan) {
        showToast("No text found. Try highlighting the email text first.", "warning");
        return;
    }

    // 3. Extract URLs
    const extractedUrls = [];
    const linkSource = gmailBody || document.body;
    linkSource.querySelectorAll("a[href]").forEach(a => {
        if (a.href && a.href.startsWith("http")) extractedUrls.push(a.href);
    });

    showToast("Scanning content and checking links...", "info");

    // 4. Relay to background.js to bypass Gmail CSP
    chrome.runtime.sendMessage(
        { action: "scanTextAndLinks", text: textToScan, urls: [...new Set(extractedUrls)] },
        (response) => {
            if (!response || !response.success) {
                showToast("Cannot reach FastAPI backend. Is it running on port 8000?", "error");
                console.error("[Spam Sentinel] Backend error:", response?.error);
                return;
            }

            const { textData, urlData } = response;
            const isSpam = textData.is_spam || !urlData.is_safe;

            if (isSpam) {
                const wordsToHighlight = textData.original_suspicious_words || [];
                if (gmailBody && wordsToHighlight.length > 0) {
                    highlightWords(gmailBody, wordsToHighlight);
                }

                let warningMessage = "High probability of malicious content.";
                let confidence = textData.confidence;

                if (!urlData.is_safe) {
                    confidence = 100;
                    const count = urlData.dangerous_links?.length || 0;
                    warningMessage = `🔗 PHISHING DETECTED: ${count} dangerous link(s) found!`;
                } else if (wordsToHighlight.length > 0) {
                    warningMessage = `Flagged ${wordsToHighlight.length} suspicious keyword(s): ${wordsToHighlight.slice(0, 3).join(", ")}${wordsToHighlight.length > 3 ? "..." : ""}`;
                }

                showSpamWarning(confidence, warningMessage);

            } else {
                clearHighlights(gmailBody);
                removeExistingBanner();
                const linkCount = extractedUrls.length;
                showToast(`✅ Safe! Confidence: ${textData.confidence}%${linkCount > 0 ? ` | ${linkCount} link(s) scanned` : ""}`, "success");
            }
        }
    );
});

// ─────────────────────────────────────────────────────────────────────────────
// DOM UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

function highlightWords(container, words) {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            const tag = node.parentElement?.tagName?.toUpperCase();
            if (tag === "SCRIPT" || tag === "STYLE") return NodeFilter.FILTER_REJECT;
            if (node.parentElement?.id === "ss-highlight") return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
        }
    });

    const pattern = new RegExp(`\\b(${words.map(escapeRegex).join("|")})\\b`, "gi");
    const nodesToReplace = [];

    while (walker.nextNode()) {
        const node = walker.currentNode;
        if (pattern.test(node.textContent)) nodesToReplace.push(node);
        pattern.lastIndex = 0;
    }

    nodesToReplace.forEach(textNode => {
        const fragment = document.createDocumentFragment();
        const parts = textNode.textContent.split(pattern);

        parts.forEach((part, i) => {
            if (i % 2 === 1) {
                const mark = document.createElement("mark");
                mark.id = "ss-highlight";
                mark.style.cssText = [
                    "background-color: #FECACA",
                    "color: #991B1B",
                    "padding: 0 3px",
                    "border-radius: 3px",
                    "font-weight: 700",
                    "border-bottom: 2px solid #EF4444",
                    "cursor: default"
                ].join(" !important; ") + " !important";
                mark.textContent = part;
                fragment.appendChild(mark);
            } else {
                fragment.appendChild(document.createTextNode(part));
            }
        });

        textNode.parentNode.replaceChild(fragment, textNode);
    });
}

function clearHighlights(container) {
    if (!container) return;
    container.querySelectorAll("mark#ss-highlight").forEach(mark => {
        mark.parentNode.replaceChild(document.createTextNode(mark.textContent), mark);
    });
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function removeExistingBanner() {
    document.getElementById("spam-sentinel-banner")?.remove();
}

// ─────────────────────────────────────────────────────────────────────────────
// TOAST NOTIFICATION
// ─────────────────────────────────────────────────────────────────────────────
function showToast(message, type = "success") {
    document.getElementById("spam-sentinel-toast")?.remove();
    injectStyles();

    const COLORS = {
        success: { bg: "#10B981", icon: "✅" },
        error: { bg: "#EF4444", icon: "🚨" },
        warning: { bg: "#F59E0B", icon: "⚠️" },
        info: { bg: "#4F46E5", icon: "🔍" },
    };
    const { bg, icon } = COLORS[type] || COLORS.success;

    const toast = document.createElement("div");
    toast.id = "spam-sentinel-toast";
    toast.style.cssText = [
        "position: fixed", "bottom: 28px", "right: 28px", `background-color: ${bg}`,
        "color: #fff", "padding: 13px 22px", "border-radius: 10px",
        "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        "font-size: 14px", "font-weight: 600", "box-shadow: 0 10px 25px rgba(0,0,0,0.15)",
        "z-index: 2147483647", "display: flex", "align-items: center", "gap: 10px",
        "max-width: 380px", "line-height: 1.4",
        "animation: ssSlideUp 0.35s cubic-bezier(0.16,1,0.3,1) forwards"
    ].join(" !important; ") + " !important";

    toast.innerHTML = `<span style="font-size:18px">${icon}</span><span>${message}</span>`;
    document.documentElement.appendChild(toast);

    if (type !== "info") {
        setTimeout(() => {
            toast.style.animation = "ssSlideDown 0.3s forwards !important";
            setTimeout(() => toast.remove(), 300);
        }, 4500);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SPAM WARNING BANNER
// ─────────────────────────────────────────────────────────────────────────────
function showSpamWarning(confidence, message) {
    removeExistingBanner();
    document.getElementById("spam-sentinel-toast")?.remove();
    injectStyles();

    const banner = document.createElement("div");
    banner.id = "spam-sentinel-banner";
    banner.style.cssText = [
        "position: fixed", "top: 20px", "right: 20px", "width: 360px",
        "background: #FFFFFF", "border-left: 5px solid #EF4444", "border-radius: 10px",
        "padding: 18px 20px", "z-index: 2147483647", "box-shadow: 0 20px 40px rgba(0,0,0,0.12)",
        "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        "animation: ssSlideIn 0.35s cubic-bezier(0.16,1,0.3,1) forwards", "box-sizing: border-box"
    ].join(" !important; ") + " !important";

    banner.innerHTML = `
        <div style="display:flex !important; align-items:flex-start !important; gap:14px !important;">
            <div style="flex-shrink:0 !important; padding-top:2px !important;">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                     stroke="#EF4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
            </div>
            <div style="flex:1 !important;">
                <div style="font-size:15px !important; font-weight:700 !important; color:#111827 !important; margin-bottom:4px !important;">
                    Threat Detected
                </div>
                <div style="font-size:13px !important; color:#4B5563 !important; line-height:1.5 !important;">
                    ${message}
                </div>
                <div style="margin-top:8px !important;">
                    <span style="background:#FEE2E2 !important; color:#991B1B !important; font-size:12px !important; font-weight:700 !important; padding:3px 10px !important; border-radius:99px !important;">
                        ${confidence}% confidence
                    </span>
                </div>
            </div>
            <button id="ss-close-btn" style="
                background:none !important; border:none !important; cursor:pointer !important;
                padding:4px !important; border-radius:6px !important; color:#9CA3AF !important;
                flex-shrink:0 !important; line-height:1 !important;
            ">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        </div>
    `;

    banner.querySelector("#ss-close-btn").onclick = () => {
        banner.style.animation = "ssSlideOut 0.3s forwards !important";
        setTimeout(() => banner.remove(), 300);
    };

    document.documentElement.appendChild(banner);
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLE INJECTION (runs once)
// ─────────────────────────────────────────────────────────────────────────────
function injectStyles() {
    if (document.getElementById("ss-global-styles")) return;
    const style = document.createElement("style");
    style.id = "ss-global-styles";
    style.textContent = `
        @keyframes ssSlideUp   { from { transform: translateY(16px); opacity:0; } to { transform: translateY(0); opacity:1; } }
        @keyframes ssSlideDown { from { transform: translateY(0); opacity:1;  } to { transform: translateY(16px); opacity:0; } }
        @keyframes ssSlideIn   { from { transform: translateX(110%); opacity:0; } to { transform: translateX(0); opacity:1; } }
        @keyframes ssSlideOut  { from { transform: translateX(0); opacity:1;   } to { transform: translateX(110%); opacity:0; } }
        #ss-close-btn:hover { background-color: #F3F4F6 !important; color: #374151 !important; }
    `;
    document.head.appendChild(style);
}