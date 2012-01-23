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

let CommandLineHandler =
{
  classDescription: "d-jsdeobfuscator",
  contractID: "@adblockplus.org/jsdeobfuscator/cmdline;1",
  classID: Components.ID("{b3d54270-b335-11de-8a39-0800200c9a66}"),
  xpcom_categories: ["command-line-handler"],

  init: function()
  {
    let registrar = Components.manager.QueryInterface(Ci.nsIComponentRegistrar);
    registrar.registerFactory(this.classID, this.classDescription, this.contractID, this);

    let catMan = Cc["@mozilla.org/categorymanager;1"].getService(Ci.nsICategoryManager);
    for each (let category in this.xpcom_categories)
      catMan.addCategoryEntry(category, this.classDescription, this.contractID, false, true);

    onShutdown.add((function()
    {
      registrar.unregisterFactory(this.classID, this);

      for each (let category in this.xpcom_categories)
        catMan.deleteCategoryEntry(category, this.classDescription, false);
    }).bind(this));
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

CommandLineHandler.init();
