// Adds a right-click context-menu item to open a linked PDF in DocuScan.
const BASE = "https://docuscan.app";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "open-in-docuscan",
    title: "Open this PDF in DocuScan",
    contexts: ["link"],
    targetUrlPatterns: ["*://*/*.pdf*"],
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === "open-in-docuscan") {
    // The destination tools are client-side; we open the relevant tool and let
    // the user drop/select the file. (A future build can pass the URL through.)
    chrome.tabs.create({ url: `${BASE}/compress-pdf` });
  }
});
