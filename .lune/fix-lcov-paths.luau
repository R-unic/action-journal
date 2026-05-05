local fs = require("@lune/fs") :: fs
local path = "coverage/lcov.info"
local lcov = fs.readFile(path)
lcov = lcov:gsub("\\", "/")
lcov = lcov:gsub("out/", "./")
fs.writeFile(path, lcov)
