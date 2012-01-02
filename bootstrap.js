/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is JavaScript Deobfuscator.
 *
 * The Initial Developer of the Original Code is
 * Wladimir Palant.
 * Portions created by the Initial Developer are Copyright (C) 2009-2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * ***** END LICENSE BLOCK ***** */

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
}

function shutdown(params, reason)
{
  if (Services.vc.compare(Services.appinfo.platformVersion, "10.0") < 0)
    Components.manager.removeBootstrappedManifestLocation(params.installPath);

  WindowObserver.shutdown();

  let editWnd = Services.wm.getMostRecentWindow("jsdeobfuscator:editfilters");
  if (editWnd)
    editWnd.close();
  let deobfuscatorWnd = Services.wm.getMostRecentWindow("jsdeobfuscator:main");
  if (deobfuscatorWnd)
  {
    deobfuscatorWnd.close();

    // Closing immediately won't work if modal edit dialog was open
    deobfuscatorWnd.setTimeout("window.close();", 0);
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
    let stringBundle = Services.strings.createBundle("chrome://jsdeobfuscator/locale/global.properties");
    let result = stringBundle.GetStringFromName("menuitem.label");

    delete this.menuItem;
    this.__defineGetter__("menuItem", function() result);
    return this.menuItem;
  },

  popupShowingHandler: function(event)
  {
    let popup = event.target;
    if (popup.id != "menu_ToolsPopup" && popup.id != "toolsPopup" && popup.id != "appmenu_webDeveloper_popup")
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
