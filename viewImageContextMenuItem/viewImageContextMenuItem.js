browser.menus.create({
  id: "view-image-context-menu-item",
  contexts: ["image"],
  title: "View I&mage"
});

browser.menus.create({
  id: "view-video-context-menu-item",
  contexts: ["video"],
  title: "View Vid&eo"
});

browser.menus.onClicked.addListener(function(info, tab) {
  if (info.menuItemId != "view-image-context-menu-item" && info.menuItemId != "view-video-context-menu-item") {
    return;
  }

  const isMiddleClick = info.button === 1;
  const isShiftModifier = info.modifiers.indexOf("Shift") > -1;
  const isCtrlModifier = info.modifiers.indexOf("Ctrl") > -1;

  function getRefererFromTab(tab) {
    return (tab.url.match(/^[^\/]+:\/\/[^\/]+\//g) || [null])[0];
  }

  function interceptRequestAndSetReferrer(destinationUrl, refererUrl) {
    const listener = function(event) {
      let asyncRewrite = new Promise((resolve, reject) => {
        let existingRefererHeader = null;
        for (let header of event.requestHeaders) {
          if (header.name.toLowerCase() === "referer") {
            existingRefererHeader = header;
            break;
          }
        }

        if(existingRefererHeader != null) {
          existingRefererHeader.value = refererUrl;
        } else {
          event.requestHeaders.push({ name: "Referer", value: refererUrl });
        }

        resolve({requestHeaders: event.requestHeaders});
      });

      browser.webRequest.onBeforeSendHeaders.removeListener(listener);
      return asyncRewrite;
    };

    browser.webRequest.onBeforeSendHeaders.addListener(
      listener,
      { urls: [destinationUrl] },
      ["blocking", "requestHeaders"]
    );
  }

  function prepareForRequest(info, tab) {
    const sourceTabId = tab.id;
    const destinationUrl = info.srcUrl;
    const referrerUrl = getRefererFromTab(tab);
    interceptRequestAndSetReferrer(destinationUrl, referrerUrl);
    return {
      sourceTabId: sourceTabId,
      destinationUrl: destinationUrl
    };
  }

  function openInSameTab(info, tab) {
    const preparationData = prepareForRequest(info, tab);
    browser.tabs.update(preparationData.sourceTabId, { url: preparationData.destinationUrl });
  }

  function openInNewForegroundTab(info, tab) {
    const preparationData = prepareForRequest(info, tab);
    browser.tabs.create({ url: preparationData.destinationUrl, openerTabId: preparationData.sourceTabId, active: true });
  }

  function openInNewBackgroundTab(info, tab) {
    const preparationData = prepareForRequest(info, tab);
    browser.tabs.create({ url: preparationData.destinationUrl, openerTabId: preparationData.sourceTabId, active: false });
  }

  function openInNewWindow(info, tab) {
    const preparationData = prepareForRequest(info, tab);
    browser.windows.create({ url: preparationData.destinationUrl, focused: true })
  }

  if (isMiddleClick) {
    openInNewForegroundTab(info, tab);
  } else if(isShiftModifier && isCtrlModifier) {
    openInNewBackgroundTab(info, tab);
  } else if(isShiftModifier) {
    openInNewWindow(info, tab);
  } else if(isCtrlModifier) {
    openInNewForegroundTab(info, tab);
  } else {
    openInSameTab(info, tab);
  }
});
