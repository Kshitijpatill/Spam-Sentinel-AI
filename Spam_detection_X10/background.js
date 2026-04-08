// 1. Listen for the extension icon click
chrome.action.onClicked.addListener((tab) => {
    if (tab.url.startsWith("chrome://") || tab.url.startsWith("edge://") || tab.url.startsWith("about:")) return;
    
    chrome.tabs.sendMessage(tab.id, { action: "manualScan" }, () => {
        if (chrome.runtime.lastError) console.warn("Refresh the page to use the extension.");
    });
});

// 2. Handle the API relay to bypass Gmail's CSP security blocks
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "scanTextAndLinks") {
        
        Promise.all([
            fetch("http://localhost:8000/predict", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: request.text })
            }).then(r => r.json()),
            
            request.urls.length > 0 
                ? fetch("http://localhost:8000/scan-links", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ urls: request.urls })
                  }).then(r => r.json())
                : Promise.resolve({ is_safe: true, dangerous_links: [] })
        ])
        .then(([textData, urlData]) => {
            sendResponse({ success: true, textData: textData, urlData: urlData });
        })
        .catch(error => {
            sendResponse({ success: false, error: error.message });
        });

        return true; 
    }
});