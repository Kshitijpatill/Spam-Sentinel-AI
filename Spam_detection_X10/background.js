// background.js

// 1. Listen for the extension icon click
chrome.action.onClicked.addListener((tab) => {
    // Prevent the extension from crashing on restricted Chrome pages
    if (tab.url.startsWith("chrome://") || tab.url.startsWith("edge://") || tab.url.startsWith("about:")) {
        console.warn("Spam Sentinel cannot run on browser settings pages.");
        return;
    }

    // Send a signal to content.js to trigger the scan
    chrome.tabs.sendMessage(tab.id, { action: "manualScan" }, () => {
        if (chrome.runtime.lastError) { 
            console.warn("Could not reach content script. Refresh the webpage and try again."); 
        }
    });
});

// 2. Handle the API relay to bypass Gmail's security blocks
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "scanText") {
        
        fetch("http://localhost:8000/predict", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: request.text })
        })
        .then(response => response.json())
        .then(data => sendResponse({ success: true, data: data }))
        .catch(error => sendResponse({ success: false, error: error.message }));
        
        return true; 
    }
});