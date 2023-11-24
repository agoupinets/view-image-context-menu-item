window.DEFAULT_OPTIONS = Object.freeze({
    "show-view-audio": true,
    "show-view-image": true,
    "show-view-video": true,
    "override-referer": true,
    "override-accept": true,
    "left-click-action": "same-tab",
    "ctrl-left-click-action": "new-foreground-tab",
    "shift-left-click-action": "new-foreground-window",
    "ctrl-shift-left-click-action": "new-background-tab",
    "middle-click-action": "new-background-tab",
    "action-key-view-audio": null,
    "action-key-view-image": null,
    "action-key-view-video": null
  });

function loadOptionsFromStorage() {
  return browser.storage.local.get("options")
    .then((resolve, reject) => {
      const options = resolve.options || {};
      return new Promise((resolve, reject) => {
        Object.keys(window.DEFAULT_OPTIONS).forEach((key) => {
          if(!options.hasOwnProperty(key)) {
            options[key] = window.DEFAULT_OPTIONS[key];
          }
        });
        resolve(options);
      });
    });
}

function createMenuItems() {
  browser.menus.create({
    id: "view-audio-context-menu-item",
    contexts: ["audio"],
    title: browser.i18n.getMessage("menuItemViewAudio")
  });

  browser.menus.create({
    id: "view-image-context-menu-item",
    contexts: ["image"],
    title: browser.i18n.getMessage("menuItemViewImage")
  });

  browser.menus.create({
    id: "view-video-context-menu-item",
    contexts: ["video"],
    title: browser.i18n.getMessage("menuItemViewVideo")
  });
}

function applyActionKeyToMenuItemTitle(defaultMenuItemTitle, actionKey){
  if (!actionKey) return defaultMenuItemTitle;
  let menuItemTitle = defaultMenuItemTitle.replace(/ ?\(\&.\)&/g, "").replace(/\&/g, "");
  const actionKeyIndex = menuItemTitle.toLowerCase().indexOf(actionKey.toLowerCase());
  if (actionKeyIndex === -1) {
    menuItemTitle += " (&" + actionKey + ")";
  } else {
    menuItemTitle = menuItemTitle.slice(0, actionKeyIndex) + "&" + menuItemTitle.slice(actionKeyIndex);
  }
  return menuItemTitle;
}

function handleContextMenuShow(info, tab) {
  const isMenuItemRedundant = info.pageUrl === info.srcUrl;
  browser.menus.update(
    "view-audio-context-menu-item",
    {
      visible: !isMenuItemRedundant && window.options["show-view-audio"],
      title: applyActionKeyToMenuItemTitle(browser.i18n.getMessage("menuItemViewAudio"), window.options["action-key-view-audio"])
    }
  );
  browser.menus.update(
    "view-image-context-menu-item",
    {
      visible: !isMenuItemRedundant && window.options["show-view-image"],
      title: applyActionKeyToMenuItemTitle(browser.i18n.getMessage("menuItemViewImage"), window.options["action-key-view-image"])
    }
  );
  browser.menus.update(
    "view-video-context-menu-item",
    {
      visible: !isMenuItemRedundant && window.options["show-view-video"],
      title: applyActionKeyToMenuItemTitle(browser.i18n.getMessage("menuItemViewVideo"), window.options["action-key-view-video"])
    }
  );
  browser.menus.refresh();
}

function handleContextMenuItemClick(info, tab) {
  if (info.menuItemId != "view-audio-context-menu-item" &&
      info.menuItemId != "view-image-context-menu-item" &&
      info.menuItemId != "view-video-context-menu-item") {
    return;
  }

  function getMediaType(info) {
    switch(info.menuItemId) {
      case "view-audio-context-menu-item":
        return "audio";
      case "view-image-context-menu-item":
        return "image";
      case "view-video-context-menu-item":
        return "video";
      default:
        return null;
    }
  }

  function getActionOptionType(info) {
    const isMiddleClick = info.button === 1;
    const isShiftModifier = info.modifiers.indexOf("Shift") > -1;
    const isCtrlModifier = info.modifiers.indexOf("Ctrl") > -1;
    if (isMiddleClick) {
      return "middle-click-action";
    } else if(isShiftModifier && isCtrlModifier) {
      return "ctrl-shift-left-click-action";
    } else if(isShiftModifier) {
      return "shift-left-click-action";
    } else if(isCtrlModifier) {
      return "ctrl-left-click-action";
    } else {
      return "left-click-action";
    }
  }

  function isFileScheme(url) {
    return url.match(/^file:\/\//gi) !== null;
  }

  const mediaType = getMediaType(info);
  const actionType = window.options[getActionOptionType(info)];
  const isLocalFileLink = isFileScheme(info.pageUrl) && isFileScheme(tab.url);

  if(isLocalFileLink) {
    processViewActionLocalFile(info, tab, actionType);
  } else {
    processViewAction(info, tab, actionType, mediaType);
  }
}

function processViewAction(info, tab, actionType, mediaType) {
  function getRefererFromInfo(info) {
    return (info.pageUrl.match(/^[^\/]+:\/\/[^\/]+\//g) || [null])[0];
  }

  function getAcceptValue(mediaType) {
    switch(mediaType) {
      case "audio":
        return "audio/webm,audio/ogg,audio/wav,audio/*;q=0.9,application/ogg;q=0.7,video/*;q=0.6,*/*;q=0.5";
      case "image":
        return "image/avif,image/webp,*/*";
      case "video":
        return "video/webm,video/ogg,video/*;q=0.9,application/ogg;q=0.7,audio/*;q=0.6,*/*;q=0.5";
      default:
        return null;
    }
  }

  function setHeader(headers, headerName, value) {
    for (let header of headers) {
      if (header.name.toLowerCase() === headerName.toLowerCase()) {
        header.value = value;
        return;
      }
    }
    headers.push({ name: headerName, value: value });
  }

  function interceptRequestAndSetHeaders(destinationUrl, info, mediaType) {
    const setReferer = window.options["override-referer"] === true;
    const setAccept = window.options["override-accept"] === true;

    const listener = function(event) {
      browser.webRequest.onBeforeSendHeaders.removeListener(listener);
      return new Promise((resolve, reject) => {
        if (setReferer) {
          const refererUrl = getRefererFromInfo(info);
          setHeader(event.requestHeaders, "Referer", refererUrl);
        }
        if (setAccept) {
          const acceptValue = getAcceptValue(mediaType);
          if (acceptValue !== null) {
            setHeader(event.requestHeaders, "Accept", acceptValue);
          }
        }

        resolve({ requestHeaders: event.requestHeaders });
      });
    };

    browser.webRequest.onBeforeSendHeaders.addListener(
      listener,
      { urls: [destinationUrl] },
      ["blocking", "requestHeaders"]
    );
  }

  function prepareForRequest(info, mediaType) {
    const destinationUrl = info.srcUrl;
    if (window.options["override-referer"] === true || window.options["override-accept"] === true) {
      interceptRequestAndSetHeaders(destinationUrl, info, mediaType);
    }
    return destinationUrl;
  }

  function doAction(info, tab, actionType, mediaType){
    const destinationUrl = prepareForRequest(info, mediaType);
    switch(actionType) {
      case "same-tab":
        browser.tabs.update(tab.id, { url: destinationUrl });
        break;
      case "new-foreground-tab":
        browser.tabs.create({ url: destinationUrl, openerTabId: tab.id, active: true });
        break;
      case "new-background-tab":
        browser.tabs.create({ url: destinationUrl, openerTabId: tab.id, active: false });
        break;
      case "new-foreground-window":
        browser.windows.create({ url: destinationUrl, focused: true, incognito: tab.incognito });
        break;
    }
  }

  doAction(info, tab, actionType, mediaType);
}

// Firefox security policy blocks most file:// actions, so this code
// jumps through a lot of hoops to get around it
function processViewActionLocalFile(info, tab, actionType) {
  function redirectTabToUrl(tabId, url) {
    browser.tabs.executeScript(
      tabId,
      {
        code: "(function () {"
          + "let _nav = document.createElement('a');"
          + "_nav.setAttribute('href', '" + url + "');"
          + "_nav.click();"
          + "}).call();"
      }
    );
  }

  function createListenerToRedirectTabToUrl(tabId, url){
    const listener = function (listenerTabId, changeInfo, tabInfo) {
      if(listenerTabId !== tabId || changeInfo.status !== "complete") {
        return;
      }
      browser.tabs.onUpdated.removeListener(listener);
      redirectTabToUrl(tabId, url);
    };
    browser.tabs.onUpdated.addListener(listener);
  }

  function doAction(info, tab, actionType){
    const destinationUrl = info.srcUrl;
    switch(actionType) {
      case "same-tab":
        redirectTabToUrl(tab.id, destinationUrl);
        break;
      case "new-foreground-tab":
        browser.tabs.duplicate(tab.id, { active: true })
          .then(function (newTab) { createListenerToRedirectTabToUrl(newTab.id, destinationUrl); });
        break;
      case "new-background-tab":
        browser.tabs.duplicate(tab.id, { active: false })
          .then(function (newTab) { createListenerToRedirectTabToUrl(newTab.id, destinationUrl); });
        break;
      case "new-foreground-window":
        browser.tabs.duplicate(tab.id, { active: false })
          .then(function (newTab) { 
            browser.windows.create({ tabId: newTab.id, focused: true, incognito: newTab.incognito });
            createListenerToRedirectTabToUrl(newTab.id, destinationUrl);
          });
        break;
    }
  }

  doAction(info, tab, actionType);
}

function handleStorageChange(changes, areaName){
  if(areaName !== "local" || !changes.options) {
    return;
  }
  processOptions(changes.options.newValue);
}

function processOptions(options) {
  window.options = options;
}

function loadOptionsFromStorageMessageListener(request, sender, sendResponse) {
  if(request && request.getOptions === true) {
    sendResponse(loadOptionsFromStorage());
  }
}

createMenuItems();
processOptions(window.DEFAULT_OPTIONS);
loadOptionsFromStorage().then((options) => { processOptions(options); });
browser.menus.onShown.addListener(handleContextMenuShow);
browser.menus.onClicked.addListener(handleContextMenuItemClick);
browser.storage.onChanged.addListener(handleStorageChange);
browser.runtime.onMessage.addListener(loadOptionsFromStorageMessageListener);
