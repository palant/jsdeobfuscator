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
let {CommandLineHandler} = require("commandLineHandler");

let Main = exports.Main =
{
  initialized: false,

  init: function()
  {
    if (this.initialized)
      return;
    this.initialized = true;

    Prefs.init("extensions.jsdeobfuscator.");
    WindowObserver.init(this);
    CommandLineHandler.init();
  },

  shutdown: function()
  {
    if (!this.initialized)
      return;
    this.initialized = false;

    Prefs.shutdown();
    WindowObserver.shutdown();
    CommandLineHandler.shutdown();
  },

  applyToWindow: function(window)
  {
    let type = window.document.documentElement.getAttribute("windowtype");
    if (type != "navigator:browser")
      return;

    window.addEventListener("popupshowing", this.popupShowingHandler, false);
    window.addEventListener("popuphiding", this.popupHidingHandler, false);
  },

  removeFromWindow: function(window)
  {
    let type = window.document.documentElement.getAttribute("windowtype");
    if (type != "navigator:browser")
      return;

    window.removeEventListener("popupshowing", this.popupShowingHandler, false);
    window.removeEventListener("popuphiding", this.popupHidingHandler, false);
  },

  get menuItem()
  {
    // Randomize URI to work around bug 719376
    let stringBundle = Services.strings.createBundle("chrome://jsdeobfuscator/locale/global.properties?" + Math.random());
    let result = stringBundle.GetStringFromName("menuitem.label");

    delete this.menuItem;
    this.__defineGetter__("menuItem", function() result);
    return this.menuItem;
  },

  popupShowingHandler: function(event)
  {
    let popup = event.target;
    if (popup.id != "menuWebDeveloperPopup" && popup.id != "toolsPopup" && popup.id != "appmenu_webDeveloper_popup")
      return;

    let label = this.menuItem;
    let item = popup.ownerDocument.createElement("menuitem");
    item.setAttribute("label", label);
    item.setAttribute("class", "jsdeobfuscator-item");

    item.addEventListener("command", this.popupCommandHandler, false);

    let insertAfter = null;
    for each (let id in ["javascriptConsole", "appmenu_errorConsole"])
    {
      let item = popup.ownerDocument.getElementById(id);
      if (item && item.parentNode == popup)
        insertAfter = item;
    }
    popup.insertBefore(item, insertAfter ? insertAfter.nextSibling: null);
  },

  popupHidingHandler: function(event)
  {
    let popup = event.target;
    if (popup.id != "menu_ToolsPopup" && popup.id != "toolsPopup" && popup.id != "appmenu_webDeveloper_popup")
      return;

    let items = popup.getElementsByClassName("jsdeobfuscator-item");
    if (items.length)
      items[0].parentNode.removeChild(items[0]);
  },

  popupCommandHandler: function(event)
  {
    let deobfuscatorWnd = Services.wm.getMostRecentWindow("jsdeobfuscator:main");
    if (deobfuscatorWnd)
      deobfuscatorWnd.focus();
    else
      event.target.ownerDocument.defaultView.openDialog("chrome://jsdeobfuscator/content/jsdeobfuscator.xul", "_blank", "chrome,resizable,centerscreen,dialog=no");
  }
};

Main.popupShowingHandler = Main.popupShowingHandler.bind(Main);
Main.popupHidingHandler = Main.popupHidingHandler.bind(Main);
Main.popupCommandHandler = Main.popupCommandHandler.bind(Main);
