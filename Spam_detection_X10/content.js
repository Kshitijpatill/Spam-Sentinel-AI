// content.js

// Listen for the manual click from background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "manualScan") {
        console.log("Spam Sentinel: Manual scan triggered");
        
        // 1. Target highlighted text first 
        let textToScan = window.getSelection().toString();
        
        // 2. If no text is highlighted by the user, fallback to scraping the whole email body
        if (!textToScan || textToScan.trim().length < 10) {
            const gmailBody = document.querySelector('.a3s') || document.querySelector('.ii.gt');
            textToScan = gmailBody ? gmailBody.innerText : document.body.innerText;
        }

        textToScan = textToScan.substring(0, 3000);

        if (!textToScan || textToScan.trim().length === 0) {
            showToast("No text found to scan! Try highlighting the text first.", "warning");
            return;
        }

        // Show a "Scanning" toast so the user knows it's thinking
        showToast("Scanning content...", "info");

        // Send the extracted text to background.js
        chrome.runtime.sendMessage({ action: "scanText", text: textToScan }, (response) => {
            if (response && response.success) {
                if (response.data.is_spam) {
                    showSpamWarning(response.data.confidence);
                } else {
                    // Success Toast
                    showToast("Scan complete. This content looks Safe.", "success");
                    const existingBanner = document.getElementById("spam-sentinel-banner");
                    if (existingBanner) existingBanner.remove();
                }
            } else {
                // Error Toast
                showToast("Error: Cannot connect to FastAPI backend!", "error");
            }
        });
    }
});

// --- NEW TOAST NOTIFICATION SYSTEM ---
function showToast(message, type = "success") {
    // Remove existing toast if there is one
    const existingToast = document.getElementById("spam-sentinel-toast");
    if (existingToast) existingToast.remove();

    const toast = document.createElement("div");
    toast.id = "spam-sentinel-toast";

    // Define colors and icons based on the type of message
    let bgColor = "#10B981"; // Default Success (Green)
    let icon = "✅";
    
    if (type === "error") {
        bgColor = "#EF4444"; // Red
        icon = "🚨";
    } else if (type === "warning") {
        bgColor = "#F59E0B"; // Orange
        icon = "⚠️";
    } else if (type === "info") {
        bgColor = "#4F46E5"; // Blue
        icon = "🔍";
    }

    toast.style.cssText = `
        position: fixed !important;
        bottom: 30px !important;
        right: 30px !important;
        background-color: ${bgColor} !important;
        color: #ffffff !important;
        padding: 14px 24px !important;
        border-radius: 8px !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif !important;
        font-size: 14px !important;
        font-weight: 600 !important;
        box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05) !important;
        z-index: 2147483647 !important;
        display: flex !important;
        align-items: center !important;
        gap: 12px !important;
        animation: slideUpFade 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards !important;
    `;

    toast.innerHTML = `<span style="font-size: 18px;">${icon}</span> <span>${message}</span>`;

    // Add animation styles if they don't exist yet
    if (!document.getElementById("spam-toast-styles")) {
        const style = document.createElement("style");
        style.id = "spam-toast-styles";
        style.innerHTML = `
            @keyframes slideUpFade { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
            @keyframes slideDownFade { from { transform: translateY(0); opacity: 1; } to { transform: translateY(20px); opacity: 0; } }
        `;
        document.head.appendChild(style);
    }

    document.documentElement.appendChild(toast);

    // Auto-remove the toast after 3 seconds (unless it's the "Scanning" info toast)
    if (type !== "info") {
        setTimeout(() => {
            toast.style.animation = "slideDownFade 0.3s forwards !important";
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// --- ORIGINAL MALICIOUS WARNING BANNER ---
function showSpamWarning(confidence) {
    if (document.getElementById("spam-sentinel-banner")) return;

    // Hide the "Scanning..." toast if it's there
    const existingToast = document.getElementById("spam-sentinel-toast");
    if (existingToast) existingToast.remove();

    if (!document.getElementById("spam-sentinel-styles")) {
        const style = document.createElement("style");
        style.id = "spam-sentinel-styles";
        style.innerHTML = `
            @keyframes slideInRight { from { transform: translateX(120%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
            @keyframes fadeOutRight { from { transform: translateX(0); opacity: 1; } to { transform: translateX(120%); opacity: 0; } }
            .ss-close-btn:hover { background-color: #F3F4F6 !important; color: #111827 !important; }
        `;
        document.head.appendChild(style);
    }

    const banner = document.createElement("div");
    banner.id = "spam-sentinel-banner";
    banner.style.cssText = `
        position: fixed !important; top: 24px !important; right: 24px !important; width: 380px !important;
        background-color: #ffffff !important; border-left: 6px solid #EF4444 !important; border-radius: 8px !important;
        padding: 16px 20px !important; z-index: 2147483647 !important; 
        box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04) !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif !important;
        display: flex !important; align-items: flex-start !important; gap: 14px !important;
        animation: slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards !important; box-sizing: border-box !important;
    `;

    banner.innerHTML = `
        <div style="flex-shrink: 0; padding-top: 2px;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
        </div>
        <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 4px;">
            <strong style="font-size: 16px !important; font-weight: 600 !important; color: #111827 !important; margin: 0 !important; line-height: 1.2 !important;">Spam Detected</strong>
            <span style="font-size: 14px !important; color: #4B5563 !important; margin: 0 !important; line-height: 1.4 !important;">
                High probability of malicious content.<br><span style="color: #EF4444 !important; font-weight: 500 !important;">Confidence: ${confidence}%</span>
            </span>
        </div>
        <button class="ss-close-btn" style="background: none !important; border: none !important; cursor: pointer !important; padding: 6px !important; border-radius: 6px !important; display: flex !important; color: #9CA3AF !important; transition: all 0.2s !important;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
    `;

    const closeBtn = banner.querySelector('.ss-close-btn');
    closeBtn.onclick = () => {
        banner.style.animation = "fadeOutRight 0.3s forwards !important";
        setTimeout(() => banner.remove(), 300);
    };

    document.documentElement.appendChild(banner);
}