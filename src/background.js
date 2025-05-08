const ALARM = {
  REFRESH_BADGE: 'refreshBadge',
  REFRESH_FAVORITES: 'refreshFavorites',
};
const MESSAGE = {
  TOKEN: 'token',
  FAVORITES: 'favorites',
};
const holodexUrl = 'https://holodex.net';
const apiUrl = `${holodexUrl}api/v2`;

const cacheFavorites = async (token) => {
  const response = await fetch(`${apiUrl}/users/favorites`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.ok) {
    const json = await response.json();
    const favorites = json.map((f) => f.id);
    await chrome.storage.local.set({ favorites });
    await updateBadge(token);
  }
};

const updateBadge = async (token) => {
  const { favorites } = await new Promise((resolve) => chrome.storage.local.get({ favorites: [] }, resolve));
  const response = await fetch(`${apiUrl}/users/live?channels=${favorites.join(',')}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.ok) {
    const json = await response.json();
    chrome.action.setBadgeText({ text: json.length ? json.length.toString() : '' });
  }
};

chrome.action.onClicked.addListener(async (tab) => {
  const newTab = 'chrome://newtab/';

  if (tab.url.includes(holodexUrl)) {
    return;
  }

  const query = tab.url.split('?')[1];
  const params = new URLSearchParams(query);
  const ytVideoId = params.get('v');

  if (ytVideoId || tab.url === newTab) {
    chrome.tabs.update(tab.id, { url: ytVideoId ? `${holodexUrl}/multiview/AATY${ytVideoId}` : holodexUrl });
  } else {
    chrome.tabs.sendMessage(tab.id, { action: 'getCanonicalLink' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error sending message:', JSON.stringify(chrome.runtime.lastError));
        chrome.tabs.create({ url: holodexUrl });
        return;
      }

      if (response?.canonicalUrl) {
        const url = new URL(response.canonicalUrl);
        const channelId = url.pathname.split('/').at(-1);

        const channelUrl = channelId && channelId.startsWith('UC') ? `${holodexUrl}/channel/${channelId}` : holodexUrl;
        chrome.tabs.update({ url: channelUrl });
      } else {
        chrome.tabs.create({ url: holodexUrl });
      }
    });
  }
});

chrome.runtime.onMessageExternal.addListener((request, sender) => {
  // Only domain name to test on staging too
  if (!sender.url.includes('holodex.net')) {
    return;
  }

  if (request.message === MESSAGE.TOKEN) {
    const token = request.token;
    chrome.storage.local.set({ token }, async () => {
      if (!token) {
        return;
      }
      await cacheFavorites(token);
      await updateBadge(token);
    });
  }

  if (request.message === MESSAGE.FAVORITES) {
    chrome.storage.local.get({ token: null }, ({ token }) => {
      token && cacheFavorites(token);
    });
  }
});

chrome.alarms.create(ALARM.REFRESH_BADGE, { periodInMinutes: 1 });
chrome.alarms.create(ALARM.REFRESH_FAVORITES, { periodInMinutes: 60 });
chrome.alarms.onAlarm.addListener((alarm) => {
  chrome.storage.local.get({ token: null }, ({ token }) => {
    switch (token && alarm.name) {
      case ALARM.REFRESH_BADGE:
        return updateBadge(token);
      case ALARM.REFRESH_FAVORITES:
        return cacheFavorites(token);
      default:
        return;
    }
  });
});
