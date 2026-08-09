'use strict'

const viewport = document.querySelector('#viewport')
const scrollSpace = document.querySelector('#scroll-space')
const canvas = document.querySelector('#scene')
const status = document.querySelector('#status')
const fatal = document.querySelector('#fatal')
const loginDemo = document.querySelector('#login-demo')
const nicknameInput = document.querySelector('#nickname')
const nicknameError = document.querySelector('#nickname-error')
const lookupSubmit = document.querySelector('#lookup-submit')
const lookupState = document.querySelector('#lookup-state')
const noticeDialog = document.querySelector('#notice-dialog')
const noticeFrame = document.querySelector('#notice-frame')
const noticeMessage = document.querySelector('#notice-message')
const noticeConfirm = document.querySelector('#notice-confirm')
const context = canvas.getContext('2d', { alpha: false })
const { frameAtTime, getTileMode, getBackgroundPosition } = window.MapLoginScene

let scene
let images
let notice
let noticeReturnFocus
let selectOnNoticeClose = false
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

function validateNotice (candidate) {
  const button = candidate && candidate.confirm
  const frame = candidate && candidate.frame
  const assets = [
    frame && frame.background,
    button && button.normal,
    button && button.mouseOver,
    button && button.pressed
  ]
  if (candidate?.formatVersion !== 1 || frame?.width !== 362 || frame?.height !== 219 ||
      assets.some(asset => !asset || typeof asset.asset !== 'string' ||
        !Number.isFinite(asset.width) || !Number.isFinite(asset.height))) {
    throw new Error('notice.json 계약이 올바르지 않습니다.')
  }
  return candidate
}

function cssUrl (src) {
  return `url("${src.replaceAll('"', '\\"')}")`
}

function applyNoticeAssets () {
  noticeFrame.style.backgroundImage = cssUrl(notice.frame.background.asset)
  noticeConfirm.style.setProperty('--confirm-normal', cssUrl(notice.confirm.normal.asset))
  noticeConfirm.style.setProperty('--confirm-over', cssUrl(notice.confirm.mouseOver.asset))
  noticeConfirm.style.setProperty('--confirm-pressed', cssUrl(notice.confirm.pressed.asset))
}

function updateNoticePosition () {
  const bounds = viewport.getBoundingClientRect()
  noticeDialog.style.setProperty('--notice-left', `${bounds.left + bounds.width / 2}px`)
  noticeDialog.style.setProperty('--notice-top', `${bounds.top + bounds.height / 2}px`)
  noticeDialog.style.setProperty('--notice-scale', String(scale))
}

function showFatal (message) {
  canvas.style.display = 'none'
  loginDemo.hidden = true
  fatal.style.display = 'block'
  fatal.textContent = message
}

function showNotice (message, returnFocus, selectOnClose = false) {
  if (!notice || !images) {
    showFatal('알림 화면을 불러오지 못했습니다. 페이지를 새로고침해 주세요.')
    return
  }
  noticeMessage.textContent = message
  noticeReturnFocus = returnFocus
  selectOnNoticeClose = selectOnClose
  updateNoticePosition()
  noticeDialog.showModal()
  requestAnimationFrame(() => noticeConfirm.focus())
}

function closeNotice () {
  if (!noticeDialog.open) return
  noticeDialog.close()
  const target = noticeReturnFocus
  const shouldSelect = selectOnNoticeClose
  noticeReturnFocus = null
  selectOnNoticeClose = false
  requestAnimationFrame(() => {
    if (!target || !target.isConnected) return
    target.focus()
    if (shouldSelect && typeof target.select === 'function') target.select()
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
  updateNoticePosition()
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

function setLookupPending (pending) {
  loginDemo.setAttribute('aria-busy', String(pending))
  nicknameInput.disabled = pending
  lookupSubmit.disabled = pending
  lookupState.textContent = pending ? '캐릭터 조회 중…' : ''
}

function waitForMockLookup () {
  return new Promise(resolve => window.setTimeout(resolve, 700))
}

async function handleLookup (event) {
  event.preventDefault()
  const nickname = nicknameInput.value.trim()
  nicknameError.textContent = ''
  nicknameInput.removeAttribute('aria-invalid')
  if (!nickname) {
    nicknameError.textContent = '닉네임을 입력해 주세요.'
    nicknameInput.setAttribute('aria-invalid', 'true')
    nicknameInput.focus()
    return
  }

  setLookupPending(true)
  await waitForMockLookup()
  setLookupPending(false)

  if (nickname === '없는캐릭터') {
    showNotice(
      '캐릭터를 찾을 수 없습니다.\n닉네임과 조회 가능 시점을 확인해 주세요.',
      nicknameInput,
      true
    )
    return
  }
  if (nickname === '서버오류') {
    showNotice(
      '캐릭터 정보를 불러오지 못했습니다.\n잠시 후 다시 시도해 주세요.',
      lookupSubmit
    )
    return
  }
  lookupState.textContent = '캐릭터를 찾았습니다.'
}

async function start () {
  const [sceneResponse, noticeResponse] = await Promise.all([
    fetch('generated/scene.json', { cache: 'no-store' }),
    fetch('generated/notice.json', { cache: 'no-store' })
  ])
  if (!sceneResponse.ok) throw new Error(`scene.json HTTP ${sceneResponse.status}`)
  if (!noticeResponse.ok) throw new Error(`notice.json HTTP ${noticeResponse.status}`)
  scene = await sceneResponse.json()
  notice = validateNotice(await noticeResponse.json())

  const sources = new Set(
    [...scene.backgrounds, ...scene.objects]
      .flatMap(item => item.frames)
      .map(frame => frame.asset)
  )
  sources.add(notice.frame.background.asset)
  for (const button of Object.values(notice.confirm)) sources.add(button.asset)

  const loaded = await Promise.all(
    [...sources].map(async src => [src, await loadImage(src)])
  )
  images = new Map(loaded)
  applyNoticeAssets()
  resize()
  window.addEventListener('resize', resize)
  loginDemo.hidden = false
  status.textContent = `${scene.map.width}×${scene.map.height} · 배경 ${scene.stats.backgrounds} · 오브젝트 ${scene.stats.objects}`
  startedAt = performance.now()
  requestAnimationFrame(render)
}

loginDemo.addEventListener('submit', handleLookup)
noticeConfirm.addEventListener('click', closeNotice)
noticeDialog.addEventListener('cancel', event => {
  event.preventDefault()
  closeNotice()
})
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || !noticeDialog.open) return
  event.preventDefault()
  closeNotice()
})

start().catch(error => {
  console.error(error)
  status.textContent = '장면 로드 실패'
  showFatal('화면을 불러오지 못했습니다. 페이지를 새로고침해 주세요.')
})
