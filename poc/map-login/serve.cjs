'use strict'

const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')

const host = '127.0.0.1'
const port = 4173
const publicDir = path.resolve(__dirname, 'public')
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png'
}

const server = http.createServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' })
    response.end('Method not allowed')
    return
  }

  let pathname
  try {
    pathname = decodeURIComponent(new URL(request.url, `http://${host}:${port}`).pathname)
  } catch {
    response.writeHead(400)
    response.end('Bad request')
    return
  }

  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')
  const filePath = path.resolve(publicDir, relative)
  if (filePath !== publicDir && !filePath.startsWith(`${publicDir}${path.sep}`)) {
    response.writeHead(403)
    response.end('Forbidden')
    return
  }

  fs.stat(filePath, (statError, stat) => {
    if (statError || !stat.isFile()) {
      response.writeHead(404)
      response.end('Not found')
      return
    }

    response.writeHead(200, {
      'Content-Type': mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': pathname.startsWith('/generated/') ? 'no-cache' : 'no-store',
      'X-Content-Type-Options': 'nosniff'
    })
    if (request.method === 'HEAD') {
      response.end()
      return
    }
    fs.createReadStream(filePath).pipe(response)
  })
})

server.listen(port, host, () => {
  console.log(`MapLogin PoC: http://${host}:${port}/`)
})
