// Renders the tool links and opens them at docuscan.app in a new tab.
const BASE = "https://docuscan.app";

const TOOLS = [
  ["Scan / Image → PDF", "/image-to-pdf"],
  ["Merge PDF", "/merge-pdf"],
  ["Compress PDF", "/compress-pdf"],
  ["Split PDF", "/split-pdf"],
  ["OCR PDF", "/ocr-pdf"],
  ["Sign PDF", "/sign-pdf"],
  ["Protect PDF", "/protect-pdf"],
  ["AI assistant", "/smart"],
];

const nav = document.getElementById("tools");
for (const [label, path] of TOOLS) {
  const a = document.createElement("a");
  a.textContent = label;
  a.href = BASE + path;
  a.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: BASE + path });
  });
  nav.appendChild(a);
}
