chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "updateBadge") {
    chrome.action.setBadgeText({
      text: request.text,
      tabId: sender.tab.id 
    });
    
    chrome.action.setBadgeBackgroundColor({ 
      color: "#007bff", 
      tabId: sender.tab.id 
    });
  }
});