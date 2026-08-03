'use strict'

const viewport = document.querySelector('#viewport')
const scrollSpace = document.querySelector('#scroll-space')
const canvas = document.querySelector('#scene')
const status = document.querySelector('#status')
const fatal = document.querySelector('#fatal')
const context = canvas.getContext('2d', { alpha: false })
const { frameAtTime, getTileMode, getBackgroundPosition } = window.MapLoginScene

let scene
let images
let scale = 1
let logicalViewHeight = 600
let deviceScale = 1
let startedAt = performance.now()

function loadImage (src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`PNG를 불러오지 못했습니다: ${src}`))
    image.src = src
  })
}

function alphaForFrame (selection, placementAlpha) {
  const { frame, progress } = selection
  const frameAlpha = frame.a0 + (frame.a1 - frame.a0) * progress
  return (placementAlpha / 255) * (frameAlpha / 255)
}

function drawFrame (image, anchorX, anchorY, frame, flip, alpha) {
  if (alpha <= 0) return
  context.save()
  context.globalAlpha = Math.max(0, Math.min(1, alpha))
  context.translate(Math.floor(anchorX), Math.floor(anchorY))
  if (flip) context.scale(-1, 1)
  context.drawImage(image, -frame.origin.x, -frame.origin.y)
  context.restore()
}

function drawBackground (background, camera, elapsedMs) {
  const selection = frameAtTime(background, elapsedMs)
  const frame = selection.frame
  const image = images.get(frame.asset)
  const mode = getTileMode(background.type)
  const anchor = getBackgroundPosition(background, camera, elapsedMs, image)
  const cellWidth = background.cx || image.width
  const cellHeight = background.cy || image.height
  const left = anchor.x - frame.origin.x
  const top = anchor.y - frame.origin.y
  const firstColumn = mode.horizontal ? Math.floor((0 - left) / cellWidth) - 1 : 0
  const lastColumn = mode.horizontal ? Math.ceil((scene.map.width - left) / cellWidth) + 1 : 1
  const firstRow = mode.vertical ? Math.floor((0 - top) / cellHeight) - 1 : 0
  const lastRow = mode.vertical ? Math.ceil((logicalViewHeight - top) / cellHeight) + 1 : 1
  const alpha = alphaForFrame(selection, background.a)

  for (let row = firstRow; row < lastRow; row++) {
    for (let column = firstColumn; column < lastColumn; column++) {
      drawFrame(
        image,
        anchor.x + column * cellWidth,
        anchor.y + row * cellHeight,
        frame,
        background.f,
        alpha
      )
    }
  }
}

function drawObject (object, camera, elapsedMs) {
  const selection = frameAtTime(object, elapsedMs)
  const frame = selection.frame
  drawFrame(
    images.get(frame.asset),
    object.x - camera.left,
    object.y - camera.top,
    frame,
    object.f,
    alphaForFrame(selection, object.a)
  )
}

function resize () {
  if (!scene) return
  scale = viewport.clientWidth / scene.map.width
  logicalViewHeight = Math.min(scene.map.height, Math.ceil(viewport.clientHeight / scale))
  deviceScale = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.ceil(scene.map.width * deviceScale)
  canvas.height = Math.ceil(logicalViewHeight * deviceScale)
  canvas.style.height = `${logicalViewHeight * scale}px`
  scrollSpace.style.height = `${scene.map.height * scale}px`
  context.imageSmoothingEnabled = false
}

function render (now) {
  if (!scene || !images) return
  const elapsedMs = now - startedAt
  const sceneTop = viewport.scrollTop / scale
  const camera = {
    left: -scene.map.centerX,
    top: sceneTop - scene.map.centerY,
    centerX: -scene.map.centerX + scene.map.width / 2,
    centerY: sceneTop - scene.map.centerY + logicalViewHeight / 2
  }

  context.setTransform(deviceScale, 0, 0, deviceScale, 0, 0)
  context.globalAlpha = 1
  context.fillStyle = '#050a11'
  context.fillRect(0, 0, scene.map.width, logicalViewHeight)

  for (const background of scene.backgrounds) {
    if (!background.front) drawBackground(background, camera, elapsedMs)
  }
  for (const object of scene.objects) drawObject(object, camera, elapsedMs)
  for (const background of scene.backgrounds) {
    if (background.front) drawBackground(background, camera, elapsedMs)
  }

  requestAnimationFrame(render)
}

async function start () {
  const response = await fetch('generated/scene.json', { cache: 'no-store' })
  if (!response.ok) throw new Error(`scene.json HTTP ${response.status}`)
  scene = await response.json()

  const sources = new Set(
    [...scene.backgrounds, ...scene.objects]
      .flatMap(item => item.frames)
      .map(frame => frame.asset)
  )
  const loaded = await Promise.all(
    [...sources].map(async src => [src, await loadImage(src)])
  )
  images = new Map(loaded)
  resize()
  window.addEventListener('resize', resize)
  status.textContent = `${scene.map.width}×${scene.map.height} · 배경 ${scene.stats.backgrounds} · 오브젝트 ${scene.stats.objects}`
  startedAt = performance.now()
  requestAnimationFrame(render)
}

start().catch(error => {
  console.error(error)
  canvas.style.display = 'none'
  fatal.style.display = 'block'
  fatal.textContent = error.stack || String(error)
  status.textContent = '장면 로드 실패'
})
