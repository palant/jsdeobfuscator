/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");

let {Prefs} = require("prefs");
let {WindowObserver} = require("windowObserver");

// Start command line handler
require("commandLineHandler");

// Make sure to add our menu to browser windows
new WindowObserver({
  applyToWindow: function(window)
  {
    let type = window.document.documentElement.getAttribute("windowtype");
    if (type != "navigator:browser")
      return;

    window.addEventListener("popupshowing", popupShowingHandler, false);
    window.addEventListener("popuphiding", popupHidingHandler, false);
  },

  removeFromWindow: function(window)
  {
    let type = window.document.documentElement.getAttribute("windowtype");
    if (type != "navigator:browser")
      return;

    window.removeEventListener("popupshowing", popupShowingHandler, false);
    window.removeEventListener("popuphiding", popupHidingHandler, false);
  }
});

function getMenuItem()
{
  // Randomize URI to work around bug 719376
  let stringBundle = Services.strings.createBundle("chrome://jsdeobfuscator/locale/global.properties?" + Math.random());
  let result = stringBundle.GetStringFromName("menuitem.label");

  getMenuItem = function() result;
  return getMenuItem();
}

function popupShowingHandler(event)
{
  let popup = event.target;
  if (popup.id != "menuWebDeveloperPopup" && popup.id != "toolsPopup" && popup.id != "appmenu_webDeveloper_popup")
    return;

  let label = getMenuItem();
  let item = popup.ownerDocument.createElement("menuitem");
  item.setAttribute("label", label);
  item.setAttribute("class", "jsdeobfuscator-item");

  item.addEventListener("command", popupCommandHandler, false);

  let insertAfter = null;
  for each (let id in ["javascriptConsole", "appmenu_errorConsole"])
  {
    let item = popup.ownerDocument.getElementById(id);
    if (item && item.parentNode == popup)
      insertAfter = item;
  }
  popup.insertBefore(item, insertAfter ? insertAfter.nextSibling: null);
}

function popupHidingHandler(event)
{
  let popup = event.target;
  if (popup.id != "menu_ToolsPopup" && popup.id != "toolsPopup" && popup.id != "appmenu_webDeveloper_popup")
    return;

  let items = popup.getElementsByClassName("jsdeobfuscator-item");
  if (items.length)
    items[0].parentNode.removeChild(items[0]);
}

function popupCommandHandler(event)
{
  let deobfuscatorWnd = Services.wm.getMostRecentWindow("jsdeobfuscator:main");
  if (deobfuscatorWnd)
    deobfuscatorWnd.focus();
  else
    event.target.ownerDocument.defaultView.openDialog("chrome://jsdeobfuscator/content/jsdeobfuscator.xul", "_blank", "chrome,resizable,centerscreen,dialog=no");
}
