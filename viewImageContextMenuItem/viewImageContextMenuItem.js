browser.menus.create({
  id: "view-image-context-menu-item",
  contexts: ["image"],
  title: "View I&mage"
});

browser.menus.onClicked.addListener(function(info, tab) {
  if (info.menuItemId != "view-image-context-menu-item") {
    return;
  }

  if (info.button === 1) { // middle click
    browser.tabs.create({ url: info.srcUrl, openerTabId: tab.id });
  } else {
    browser.tabs.update(tab.id, { url: info.srcUrl });
  }
});
