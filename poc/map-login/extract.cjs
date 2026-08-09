'use strict'

const fs = require('node:fs/promises')
const path = require('node:path')
const {
  WzCanvasProperty,
  WzFile,
  WzFileParseStatus,
  WzImage,
  WzMapleVersion,
  WzUOLProperty,
  WzVectorProperty,
  getErrorDescription
} = require('@tybys/wz')

const PATCH_VERSION = 43
const projectDir = __dirname
const generatedDir = path.join(projectDir, 'public', 'generated')
const assetsDir = path.join(generatedDir, 'assets')
const wzDir = process.env.KMS_WZ_DIR

if (!wzDir) {
  console.error('KMS_WZ_DIR is required.')
  process.exit(1)
}

const uiPath = path.join(wzDir, 'UI.wz')
const mapPath = path.join(wzDir, 'Map.wz')
const zlzPath = path.join(wzDir, 'ZLZ.dll')

function valueOf (container, name, fallback = null) {
  const property = container && typeof container.at === 'function'
    ? container.at(name)
    : null
  if (property == null) return fallback
  if (property instanceof WzVectorProperty) {
    return { x: property.x.value, y: property.y.value }
  }
  return property.value ?? property.wzValue ?? fallback
}

function numericChildren (container) {
  if (container instanceof WzCanvasProperty || container instanceof WzUOLProperty) {
    return [container]
  }
  return [...(container.wzProperties || [])]
    .filter(child => /^\d+$/.test(child.name))
    .sort((a, b) => Number(a.name) - Number(b.name))
}

function followUol (property) {
  const seen = new Set()
  let current = property
  while (current instanceof WzUOLProperty) {
    if (seen.has(current)) throw new Error(`Circular UOL at ${current.fullPath}`)
    seen.add(current)
    current = current.linkValue
  }
  return current
}

function enclosingImage (property) {
  let current = property
  while (current != null && !(current instanceof WzImage)) current = current.parent
  return current
}

function resolveInlink (canvas) {
  const inlink = valueOf(canvas, '_inlink')
  if (!inlink) return canvas
  const image = enclosingImage(canvas)
  const linked = image && image.getFromPath(inlink)
  return linked ? followUol(linked) : canvas
}

async function parseWz (filePath) {
  const wz = new WzFile(filePath, WzMapleVersion.GETFROMZLZ, PATCH_VERSION)
  const result = await wz.parseWzFile()
  if (result !== WzFileParseStatus.SUCCESS) {
    wz.dispose()
    throw new Error(`${path.basename(filePath)}: ${getErrorDescription(result)}`)
  }
  return wz
}

async function main () {
  await Promise.all([uiPath, mapPath, zlzPath].map(file => fs.access(file)))

  const uiWz = await parseWz(uiPath)
  const mapWz = await parseWz(mapPath)
  const assetCache = new Map()
  let assetNumber = 0

  try {
    const mapLogin = uiWz.wzDirectory.at('MapLogin.img')
    const loginUi = uiWz.wzDirectory.at('Login.img')
    const backLogin = mapWz.wzDirectory.at('Back').at('login.img')
    const objLogin = mapWz.wzDirectory.at('Obj').at('login.img')
    if (!mapLogin || !loginUi || !backLogin || !objLogin) {
      throw new Error('MapLogin.img, Login.img, Back/login.img, or Obj/login.img was not found.')
    }

    // WzImage instances from the same WzFile share a position-based reader.
    // Parse sequentially so concurrent reads cannot overwrite reader.pos.
    await mapLogin.parseImage()
    await loginUi.parseImage()
    await backLogin.parseImage()
    await objLogin.parseImage()

    const miniMap = mapLogin.at('miniMap')
    const map = {
      width: valueOf(miniMap, 'width'),
      height: valueOf(miniMap, 'height'),
      centerX: valueOf(miniMap, 'centerX'),
      centerY: valueOf(miniMap, 'centerY')
    }
    if (![map.width, map.height, map.centerX, map.centerY].every(Number.isFinite)) {
      throw new Error('MapLogin miniMap coordinates are incomplete.')
    }

    const previousGenerated = path.resolve(generatedDir)
    const publicRoot = path.resolve(projectDir, 'public')
    if (!previousGenerated.startsWith(`${publicRoot}${path.sep}`)) {
      throw new Error('Refusing to clear a generated path outside public/.')
    }
    await fs.rm(previousGenerated, { recursive: true, force: true })
    await fs.mkdir(assetsDir, { recursive: true })

    async function saveAsset (frame) {
      let source = followUol(frame)
      if (!(source instanceof WzCanvasProperty)) {
        throw new Error(`Frame does not resolve to Canvas: ${frame.fullPath}`)
      }
      source = resolveInlink(source)

      const inlink = valueOf(source, '_inlink')
      const outlink = valueOf(source, '_outlink')
      const cacheKey = outlink
        ? `outlink:${outlink}`
        : inlink
          ? `inlink:${enclosingImage(source).fullPath}:${inlink}`
          : source.fullPath
      const cached = assetCache.get(cacheKey)
      if (cached) return cached

      const filename = `asset-${String(assetNumber++).padStart(4, '0')}.png`
      const outputPath = path.join(assetsDir, filename)
      let width
      let height

      if (outlink || inlink || !source.pngProperty) {
        const bitmap = await source.getLinkedWzCanvasBitmap()
        if (!bitmap) throw new Error(`Unable to resolve linked Canvas: ${source.fullPath}`)
        const raw = bitmap.getCanvas()
        width = raw.width ?? raw.bitmap?.width
        height = raw.height ?? raw.bitmap?.height
        await bitmap.writeAsync(outputPath)
        bitmap.dispose()
      } else {
        width = source.pngProperty.width
        height = source.pngProperty.height
        const saved = await source.pngProperty.saveToFile(outputPath)
        if (!saved) throw new Error(`Unable to save Canvas: ${source.fullPath}`)
      }

      const asset = {
        src: `generated/assets/${filename}`,
        width,
        height,
        source: source.fullPath,
        inlink,
        outlink
      }
      assetCache.set(cacheKey, asset)
      return asset
    }

    async function extractFrames (resource) {
      if (!resource) throw new Error('Referenced WZ resource was not found.')
      const frames = []
      for (const frame of numericChildren(resource)) {
        const asset = await saveAsset(frame)
        const a0 = valueOf(frame, 'a0', 255)
        frames.push({
          asset: asset.src,
          width: asset.width,
          height: asset.height,
          delay: Math.max(1, valueOf(frame, 'delay', 100)),
          origin: valueOf(frame, 'origin', { x: 0, y: 0 }),
          z: valueOf(frame, 'z', 0),
          a0,
          a1: valueOf(frame, 'a1', a0),
          uol: frame instanceof WzUOLProperty ? frame.value : null,
          inlink: asset.inlink,
          outlink: asset.outlink
        })
      }
      if (frames.length === 0) throw new Error(`No numeric frames at ${resource.fullPath}`)
      return frames
    }

    async function noticeAsset (resourcePath) {
      const resource = loginUi.getFromPath(resourcePath)
      if (!resource) throw new Error(`Login.img resource was not found: ${resourcePath}`)
      const asset = await saveAsset(resource)
      return {
        asset: asset.src,
        width: asset.width,
        height: asset.height,
        source: `UI.wz/Login.img/${resourcePath}`
      }
    }

    const backgrounds = []
    for (const placement of mapLogin.at('back').wzProperties) {
      const ani = valueOf(placement, 'ani', 0)
      const no = String(valueOf(placement, 'no'))
      const resourcePath = `${ani ? 'ani' : 'back'}/${no}`
      backgrounds.push({
        id: placement.name,
        source: `Map.wz/Back/login.img/${resourcePath}`,
        order: backgrounds.length,
        front: valueOf(placement, 'front', 0),
        ani,
        no,
        x: valueOf(placement, 'x', 0),
        y: valueOf(placement, 'y', 0),
        z: valueOf(placement, 'z', 0),
        rx: valueOf(placement, 'rx', 0),
        ry: valueOf(placement, 'ry', 0),
        cx: valueOf(placement, 'cx', 0),
        cy: valueOf(placement, 'cy', 0),
        type: valueOf(placement, 'type', 0),
        f: valueOf(placement, 'f', 0),
        a: valueOf(placement, 'a', 255),
        frames: await extractFrames(backLogin.getFromPath(resourcePath))
      })
    }

    const objects = []
    for (let layer = 0; layer <= 7; layer++) {
      const layerNode = mapLogin.at(String(layer))
      const objectNode = layerNode && layerNode.at('obj')
      if (!objectNode) continue
      for (const placement of objectNode.wzProperties) {
        const parts = ['l0', 'l1', 'l2'].map(name => String(valueOf(placement, name)))
        const resourcePath = parts.join('/')
        objects.push({
          id: `${layer}-${placement.name}`,
          source: `Map.wz/Obj/login.img/${resourcePath}`,
          layer,
          order: objects.length,
          x: valueOf(placement, 'x', 0),
          y: valueOf(placement, 'y', 0),
          z: valueOf(placement, 'z', 0),
          f: valueOf(placement, 'f', 0),
          a: valueOf(placement, 'a', 255),
          frames: await extractFrames(objLogin.getFromPath(resourcePath))
        })
      }
    }

    objects.sort((a, b) => a.layer - b.layer || a.z - b.z || a.order - b.order)
    const animatedBackgrounds = backgrounds.filter(item => item.ani && item.frames.length > 1)
    const animatedObjects = objects.filter(item => item.frames.length > 1)
    const movingBackgrounds = backgrounds.filter(item => item.type >= 4)
    const uolFrames = [...backgrounds, ...objects]
      .flatMap(item => item.frames)
      .filter(frame => frame.uol)
    const linkedFrames = [...backgrounds, ...objects]
      .flatMap(item => item.frames)
      .filter(frame => frame.inlink || frame.outlink)

    const scene = {
      formatVersion: 1,
      source: {
        map: 'UI.wz/MapLogin.img',
        back: 'Map.wz/Back/login.img',
        object: 'Map.wz/Obj/login.img',
        patchVersion: PATCH_VERSION,
        keySource: 'ZLZ.dll',
        library: '@tybys/wz@1.7.1'
      },
      map,
      backgrounds,
      objects,
      stats: {
        backgrounds: backgrounds.length,
        objects: objects.length,
        assets: assetCache.size,
        animatedBackgrounds: animatedBackgrounds.length,
        animatedObjects: animatedObjects.length,
        movingBackgrounds: movingBackgrounds.length,
        uolFrames: uolFrames.length,
        linkedFrames: linkedFrames.length
      }
    }

    const notice = {
      formatVersion: 1,
      source: {
        notice: 'UI.wz/Login.img/Notice',
        patchVersion: PATCH_VERSION,
        keySource: 'ZLZ.dll',
        library: '@tybys/wz@1.7.1'
      },
      frame: {
        width: 362,
        height: 219,
        background: await noticeAsset('Notice/backgrnd/1')
      },
      confirm: {
        normal: await noticeAsset('Notice/BtYes/normal/0'),
        mouseOver: await noticeAsset('Notice/BtYes/mouseOver/0'),
        pressed: await noticeAsset('Notice/BtYes/pressed/0')
      }
    }

    if (notice.frame.background.width !== notice.frame.width ||
        notice.frame.background.height !== notice.frame.height) {
      throw new Error('Login.img Notice background dimensions do not match 362x219.')
    }

    await fs.writeFile(
      path.join(generatedDir, 'scene.json'),
      `${JSON.stringify(scene, null, 2)}\n`
    )
    await fs.writeFile(
      path.join(generatedDir, 'notice.json'),
      `${JSON.stringify(notice, null, 2)}\n`
    )

    console.log(`Map: ${map.width}x${map.height}, center=(${map.centerX}, ${map.centerY})`)
    console.log(`Backgrounds: ${backgrounds.length} (${animatedBackgrounds.length} animated, ${movingBackgrounds.length} moving)`)
    console.log(`Objects: ${objects.length} (${animatedObjects.length} animated)`)
    console.log(`Assets: ${assetCache.size}, UOL frames: ${uolFrames.length}, linked frames: ${linkedFrames.length}`)
    console.log(`Wrote ${path.join(generatedDir, 'scene.json')}`)
    console.log(`Wrote ${path.join(generatedDir, 'notice.json')}`)
  } finally {
    uiWz.dispose()
    mapWz.dispose()
  }
}

main().catch(error => {
  console.error(error.stack || error)
  process.exitCode = 1
})
