function loadOptions() {
  function setSelectedOption(selectId, value){
    document.querySelector(selectId + " > option[value='" + value + "']").selected = true;
  }

  browser.extension.getBackgroundPage().loadOptionsFromStorage().then((options) => {
    document.querySelector("#show-view-audio").checked = options["show-view-audio"];
    document.querySelector("#show-view-image").checked = options["show-view-image"];
    document.querySelector("#show-view-video").checked = options["show-view-video"];
    document.querySelector("#override-referer").checked = options["override-referer"];
    setSelectedOption("#middle-click-action", options["middle-click-action"]);
    setSelectedOption("#ctrl-left-click-action", options["ctrl-left-click-action"]);
    setSelectedOption("#shift-left-click-action", options["shift-left-click-action"]);
    setSelectedOption("#ctrl-shift-left-click-action", options["ctrl-shift-left-click-action"]);
    setSelectedOption("#left-click-action", options["left-click-action"]);
    document.querySelector("#action-key-view-audio").value = options["action-key-view-audio"];
    document.querySelector("#action-key-view-image").value = options["action-key-view-image"];
    document.querySelector("#action-key-view-video").value = options["action-key-view-video"];
  }); 
}

function saveOptions(event) {
  function cleanActionKey(rawValue) {
    if(!rawValue || rawValue.trim().length === 0) return null;
    return rawValue.trim().charAt(0);
  }

  const options = {
    "show-view-audio": document.querySelector("#show-view-audio").checked,
    "show-view-image": document.querySelector("#show-view-image").checked,
    "show-view-video": document.querySelector("#show-view-video").checked,
    "override-referer": document.querySelector("#override-referer").checked,
    "left-click-action": document.querySelector("#left-click-action").value,
    "ctrl-left-click-action": document.querySelector("#ctrl-left-click-action").value,
    "shift-left-click-action": document.querySelector("#shift-left-click-action").value,
    "ctrl-shift-left-click-action": document.querySelector("#ctrl-shift-left-click-action").value,
    "middle-click-action": document.querySelector("#middle-click-action").value,
    "action-key-view-audio": cleanActionKey(document.querySelector("#action-key-view-audio").value),
    "action-key-view-image": cleanActionKey(document.querySelector("#action-key-view-image").value),
    "action-key-view-video": cleanActionKey(document.querySelector("#action-key-view-video").value)
  };

  browser.storage.local.set({options: options});
  event.preventDefault();
}

document.addEventListener("DOMContentLoaded", loadOptions);
document.querySelector("#options").addEventListener("submit", saveOptions);
