const http = require("http");
const fs = require("fs");
const path = require("path");
const root = process.cwd();
const types = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8",
  ".css":"text/css; charset=utf-8", ".png":"image/png", ".svg":"image/svg+xml",
  ".json":"application/json; charset=utf-8" };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/") p = "/index.html";
  const file = path.join(root, p);
  if (!file.startsWith(root)) { res.writeHead(403); return res.end("403"); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end("404 " + p); }
    res.writeHead(200, { "Content-Type": types[path.extname(file).toLowerCase()] || "application/octet-stream" });
    res.end(data);
  });
}).listen(8777, "127.0.0.1", () => console.log("listening 8777"));
