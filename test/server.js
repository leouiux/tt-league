const http = require("http");

const server = http.createServer((req, res) => {
  res.write("Hello Server!");
  res.end();
});

server.listen(3000, () => {
  console.log("서버 실행중: http://localhost:3000");
});