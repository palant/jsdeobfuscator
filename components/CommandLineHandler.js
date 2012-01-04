/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

function CommandLineHandler() {}
CommandLineHandler.prototype =
{
  classDescription: "d-jsdeobfuscator",
  contractID: "@adblockplus.org/jsdeobfuscator/cmdline;1",
  classID: Components.ID("{b3d54270-b335-11de-8a39-0800200c9a66}"),
  _xpcom_categories: [{ category: "command-line-handler" }],

  QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsICommandLineHandler]),

  helpInfo: "  -jsdeobfuscator      Open JavaScript Deobfuscator window\n",

  handle: function(cmdline)
  {
    if (cmdline.handleFlag("jsdeobfuscator", false))
    {
      Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
                .getService(Components.interfaces.nsIWindowWatcher)
                .openWindow(null, "chrome://jsdeobfuscator/content/jsdeobfuscator.xul", "_blank", "chrome,resizable,centerscreen,dialog=no", null);
    }
  }
}

var NSGetModule = XPCOMUtils.generateNSGetModule([CommandLineHandler]);
