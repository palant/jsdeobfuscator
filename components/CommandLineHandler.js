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
