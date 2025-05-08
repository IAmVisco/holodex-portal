chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getCanonicalLink') {
    const canonicalLink = document.querySelector('head link[rel="canonical"]');
    const canonicalUrl = canonicalLink ? canonicalLink.href : null;
    sendResponse({ canonicalUrl });
  }

  return true;
});
