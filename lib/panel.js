/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

let {gDevTools} = Cu.import("resource:///modules/devtools/gDevTools.jsm", {});
let {Services} = Cu.import("resource://gre/modules/Services.jsm", {});

// Randomize URI to work around bug 719376
let stringBundle = Services.strings.createBundle("chrome://jsdeobfuscator/locale/global.properties?" + Math.random());

let tool = {
  id: "jsdeobfuscator-panel",
  url: "chrome://jsdeobfuscator/content/panel.xul",
  label: stringBundle.GetStringFromName("panel.label"),
  tooltip: stringBundle.GetStringFromName("panel.tooltip"),
  icon: "chrome://jsdeobfuscator/skin/devtools-icon.svg",
  inMenu: true,
  menuLabel: stringBundle.GetStringFromName("menuitem.label"),
  invertIconForLightTheme: true,
  isTargetSupported: target => target.isLocalTab,
  build: (window, toolbox) => {
    return new Panel(window, toolbox).ready;
  }
};

// Frame script URL has to be randomized due to caching
// (see https://bugzilla.mozilla.org/show_bug.cgi?id=1051238)
let frameScript = require("info").addonRoot + "lib/content.js?" + Math.random();

gDevTools.registerTool(tool);
onShutdown.add(() => gDevTools.unregisterTool(tool.id));

function initTarget(messageManager)
{
  return new Promise((resolve, reject) => {
    let listener = () =>
    {
      messageManager.removeMessageListener("jsdeobfuscator@palant.de:ready", listener);
      resolve();
    };

    messageManager.loadFrameScript(frameScript, false);
    messageManager.addMessageListener("jsdeobfuscator@palant.de:ready", listener);
  });
}

function waitForLoad(window)
{
  return new Promise((resolve, reject) => {
    if (window.document.readyState == "complete")
      resolve();
    else
    {
      let listener = () => {
        window.removeEventListener("load", listener, false);
        resolve();
      };
      window.addEventListener("load", listener, false);
    }
  });
}

function Panel(window, toolbox)
{
  let target = this._target = toolbox.target;

  this._window = window;
  this.ready = new Promise((resolve, reject) => {
    Promise.all([
      waitForLoad(window),
      initTarget(this._messageManager)
    ]).then(() => (window.setTarget(target), resolve(this)), reject);
  });

  this.onNewScript = this.onNewScript.bind(this);
  this.onScriptExecuted = this.onScriptExecuted.bind(this);
  this.onNavigate = this.onNavigate.bind(this);

  this._messageManager.addMessageListener("jsdeobfuscator@palant.de:newscript", this.onNewScript);
  this._messageManager.addMessageListener("jsdeobfuscator@palant.de:updatescript", this.onScriptExecuted);
  this._messageManager.addMessageListener("jsdeobfuscator@palant.de:navigate", this.onNavigate);
}
Panel.prototype = {
  get _messageManager()
  {
    return this._target.tab.linkedBrowser.messageManager;
  },

  destroy: function()
  {
    this._messageManager.removeMessageListener("jsdeobfuscator@palant.de:newscript", this.onNewScript);
    this._messageManager.removeMessageListener("jsdeobfuscator@palant.de:updatescript", this.onScriptExecuted);
    this._messageManager.removeMessageListener("jsdeobfuscator@palant.de:navigate", this.onNavigate);
    this._messageManager.sendAsyncMessage("jsdeobfuscator@palant.de:shutdown");
  },

  onNewScript: function(message)
  {
    this._window.addScript(message.data);
  },

  onScriptExecuted: function(message)
  {
    this._window.updateScriptExecTime(message.data.id, message.data.execTime);
  },

  onNavigate: function()
  {
    try
    {
      if (Services.prefs.getBoolPref("devtools.webconsole.persistlog"))
        return;
    }
    catch (e)
    {
    }

    this._window.clearList();
  }
};
