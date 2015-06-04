/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

let scripts = new WeakMap();
let maxId = 0;
let dbg = Debugger(global);
dbg.onNewScript = onScript;
dbg.onEnterFrame = onEnterFrame;

onmessage = function({data: message})
{
  if (message == "shutdown")
    shutdown();
  else if (message == "pause")
    pause();
  else if (message == "resume")
    resume();
  else if (message == "clear")
    clear();
}

function shutdown()
{
  onmessage = null;
  dbg.onNewScript = undefined;
  dbg.onEnterFrame = undefined;
  dbg = null;
}

function pause()
{
  dbg.onNewScript = undefined;
  dbg.onEnterFrame = undefined;
}

function resume()
{
  dbg.onNewScript = onScript;
  dbg.onEnterFrame = onEnterFrame;
}

function clear()
{
  scripts.clear();
}

function notifyNewScript(script, executed)
{
  let id = ++maxId;
  scripts.set(script, id);

  let message = {
    type: "newscript",
    id: id,
    displayName: script.displayName || "",
    url: script.url,
    line: script.startLine,
    source: script.source.text.substr(script.sourceStart, script.sourceLength),
    staticLevel: script.staticLevel
  };
  message[executed ? "execTime" : "compileTime"] = Date.now();

  postMessage(JSON.stringify(message));
}

function onScript(script, executed)
{
  notifyNewScript(script, false);
}

function onEnterFrame(frame)
{
  let script = frame.script;
  if (!script)
    return;

  let id = scripts.get(script);
  if (id)
  {
    postMessage(JSON.stringify({
      type: "updatescript",
      id: id,
      execTime: Date.now()
    }));
  }
  else
    notifyNewScript(script, true);
}
