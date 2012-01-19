/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

function install(params, reason) {}
function uninstall(params, reason) {}

function startup(params, reason)
{
  if (Services.vc.compare(Services.appinfo.platformVersion, "10.0") < 0)
    Components.manager.addBootstrappedManifestLocation(params.installPath);

  let scope = {};
  Services.scriptloader.loadSubScript("chrome://jsdeobfuscator/content/prefLoader.js", scope);
  scope.loadDefaultPrefs(params.installPath);

  WindowObserver.init();
  CommandLineHandler.init();
}

function shutdown(params, reason)
{
  if (Services.vc.compare(Services.appinfo.platformVersion, "10.0") < 0)
    Components.manager.removeBootstrappedManifestLocation(params.installPath);

  CommandLineHandler.shutdown();
  WindowObserver.shutdown();

  let editWnd = Services.wm.getMostRecentWindow("jsdeobfuscator:editfilters");
  if (editWnd)
    editWnd.close();
  let deobfuscatorWnd = Services.wm.getMostRecentWindow("jsdeobfuscator:main");
  if (deobfuscatorWnd)
  {
    // Closing immediately won't work if modal edit dialog was open
    deobfuscatorWnd.setTimeout("window.close();", 0);

    deobfuscatorWnd.close();
  }
}

var WindowObserver =
{
  initialized: false,

  init: function()
  {
    if (this.initialized)
      return;
    this.initialized = true;

    let e = Services.ww.getWindowEnumerator();
    while (e.hasMoreElements())
      this.applyToWindow(e.getNext().QueryInterface(Ci.nsIDOMWindow));

    Services.ww.registerNotification(this);
  },

  shutdown: function()
  {
    if (!this.initialized)
      return;
    this.initialized = false;

    let e = Services.ww.getWindowEnumerator();
    while (e.hasMoreElements())
      this.removeFromWindow(e.getNext().QueryInterface(Ci.nsIDOMWindow));

    Services.ww.unregisterNotification(this);
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

  observe: function(subject, topic, data)
  {
    if (topic == "domwindowopened")
    {
      let window = subject.QueryInterface(Ci.nsIDOMWindow);
      window.addEventListener("DOMContentLoaded", function()
      {
        if (this.initialized)
          this.applyToWindow(window);
      }.bind(this), false);
    }
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
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsISupportsWeakReference, Ci.nsIObserver])
};

WindowObserver.popupShowingHandler = WindowObserver.popupShowingHandler.bind(WindowObserver);
WindowObserver.popupHidingHandler = WindowObserver.popupHidingHandler.bind(WindowObserver);
WindowObserver.popupCommandHandler = WindowObserver.popupCommandHandler.bind(WindowObserver);

var CommandLineHandler =
{
  initialized: false,

  classDescription: "d-jsdeobfuscator",
  contractID: "@adblockplus.org/jsdeobfuscator/cmdline;1",
  classID: Components.ID("{b3d54270-b335-11de-8a39-0800200c9a66}"),
  xpcom_categories: ["command-line-handler"],

  init: function()
  {
    if (this.initialized)
      return;
    this.initialized = true;

    let registrar = Components.manager.QueryInterface(Ci.nsIComponentRegistrar);
    registrar.registerFactory(this.classID, this.classDescription, this.contractID, this);

    let catMan = Cc["@mozilla.org/categorymanager;1"].getService(Ci.nsICategoryManager);
    for each (let category in this.xpcom_categories)
      catMan.addCategoryEntry(category, this.classDescription, this.contractID, false, true);
  },

  shutdown: function()
  {
    if (!this.initialized)
      return;
    this.initialized = false;

    let registrar = Components.manager.QueryInterface(Ci.nsIComponentRegistrar);
    registrar.unregisterFactory(this.classID, this);

    let catMan = Cc["@mozilla.org/categorymanager;1"].getService(Ci.nsICategoryManager);
    for each (let category in this.xpcom_categories)
      catMan.deleteCategoryEntry(category, this.classDescription, false);
  },

  createInstance: function(outer, iid)
  {
    if (outer)
      throw Cr.NS_ERROR_NO_AGGREGATION;
    return this.QueryInterface(iid);
  },

  helpInfo: "  -jsdeobfuscator      Open JavaScript Deobfuscator window\n",

  handle: function(cmdline)
  {
    if (cmdline.handleFlag("jsdeobfuscator", false))
      Services.ww.openWindow(null, "chrome://jsdeobfuscator/content/jsdeobfuscator.xul", "_blank", "chrome,resizable,centerscreen,dialog=no", null);
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsICommandLineHandler, Ci.nsIFactory])
};
