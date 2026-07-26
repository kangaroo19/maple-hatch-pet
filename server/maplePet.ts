import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'

const CELL_WIDTH = 192
const CELL_HEIGHT = 208
const COLUMNS = 8
const ROWS = 9

type MaplePetRequest = {
  characterName: string
  worldName: string
  characterClass: string
  characterImage: string
}

type Frame = {
  action: string
  emotion: string
  mirror?: boolean
  yOffset?: number
}

type SourceCrop = {
  left: number
  top: number
  width: number
  height: number
}

const repeat = (frames: Frame[], count: number) =>
  Array.from({ length: count }, (_, index) => frames[index % frames.length])

const animationRows: Frame[][] = [
  repeat(
    [
      { action: 'A01.0', emotion: 'E00' },
      { action: 'A01.1', emotion: 'E00' },
      { action: 'A01.2', emotion: 'E00' },
    ],
    6,
  ),
  repeat(
    [
      { action: 'A03.0', emotion: 'E00', mirror: true },
      { action: 'A03.1', emotion: 'E00', mirror: true },
      { action: 'A03.2', emotion: 'E00', mirror: true },
      { action: 'A03.3', emotion: 'E00', mirror: true },
    ],
    8,
  ),
  repeat(
    [
      { action: 'A03.0', emotion: 'E00' },
      { action: 'A03.1', emotion: 'E00' },
      { action: 'A03.2', emotion: 'E00' },
      { action: 'A03.3', emotion: 'E00' },
    ],
    8,
  ),
  [
    { action: 'A00', emotion: 'E02' },
    { action: 'A01', emotion: 'E02' },
    { action: 'A00', emotion: 'E01' },
    { action: 'A01', emotion: 'E02' },
  ],
  [
    { action: 'A06', emotion: 'E00', yOffset: 0 },
    { action: 'A06', emotion: 'E00', yOffset: -20 },
    { action: 'A06', emotion: 'E00', yOffset: -40 },
    { action: 'A06', emotion: 'E00', yOffset: -20 },
    { action: 'A06', emotion: 'E00', yOffset: 0 },
  ],
  repeat(
    [
      { action: 'A04', emotion: 'E03' },
      { action: 'A04', emotion: 'E05' },
    ],
    8,
  ),
  repeat(
    [
      { action: 'A07', emotion: 'E05' },
      { action: 'A07', emotion: 'E00' },
    ],
    6,
  ),
  repeat(
    [
      { action: 'A00', emotion: 'E00' },
      { action: 'A01', emotion: 'E05' },
    ],
    6,
  ),
  repeat(
    [
      { action: 'A00', emotion: 'E05' },
      { action: 'A01', emotion: 'E00' },
      { action: 'A00', emotion: 'E01' },
    ],
    6,
  ),
]

function getCharacterImageUrl(baseUrl: string, frame: Frame) {
  const url = new URL(baseUrl)
  url.searchParams.set('action', frame.action)
  url.searchParams.set('emotion', frame.emotion)
  url.searchParams.set('wmotion', 'W04')
  url.searchParams.set('width', '400')
  url.searchParams.set('height', '400')
  url.searchParams.set('x', '200')
  url.searchParams.set('y', '280')
  return url
}

async function sanitizeSource(source: Buffer) {
  const { data, info } = await sharp(source)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  for (let offset = 0; offset < data.length; offset += 4) {
    if (data[offset + 3] === 0) {
      data[offset] = 0
      data[offset + 1] = 0
      data[offset + 2] = 0
    }
  }

  return sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .png()
    .toBuffer()
}

async function getSourceCrop(source: Buffer): Promise<SourceCrop> {
  const metadata = await sharp(source).metadata()
  const trimmed = await sharp(source)
    .trim()
    .png()
    .toBuffer({ resolveWithObject: true })

  const imageWidth = metadata.width ?? 300
  const imageHeight = metadata.height ?? 300
  const visibleLeft = -(trimmed.info.trimOffsetLeft ?? 0)
  const visibleTop = -(trimmed.info.trimOffsetTop ?? 0)
  const width = Math.min(imageWidth, Math.max(80, trimmed.info.width + 12))
  const height = Math.min(imageHeight, Math.max(84, trimmed.info.height + 10))
  const centerX = visibleLeft + trimmed.info.width / 2
  const bottom = visibleTop + trimmed.info.height
  const left = Math.max(0, Math.min(imageWidth - width, Math.round(centerX - width / 2)))
  const top = Math.max(0, Math.min(imageHeight - height, Math.round(bottom - height)))

  return { left, top, width, height }
}

async function renderCell(source: Buffer, frame: Frame, crop: SourceCrop) {
  const { data, info } = await sharp(source)
    .extract(crop)
    .resize({ width: 184, height: 196, fit: 'inside' })
    .flop(frame.mirror ?? false)
    .png()
    .toBuffer({ resolveWithObject: true })

  const left = Math.floor((CELL_WIDTH - info.width) / 2)
  const top = Math.max(0, CELL_HEIGHT - info.height - 8 + (frame.yOffset ?? 0))

  return sharp({
    create: {
      width: CELL_WIDTH,
      height: CELL_HEIGHT,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: data, left, top }])
    .png()
    .toBuffer()
}

export async function installMaplePet(input: MaplePetRequest) {
  const baseUrl = new URL(input.characterImage)

  if (baseUrl.protocol !== 'https:' || baseUrl.hostname !== 'open.api.nexon.com') {
    throw new Error('유효한 넥슨 캐릭터 이미지 URL이 아닙니다.')
  }

  const sourceCache = new Map<string, Buffer>()
  const composites: { input: Buffer; left: number; top: number }[] = []
  const referenceUrl = getCharacterImageUrl(input.characterImage, {
    action: 'A01.0',
    emotion: 'E00',
  })
  const referenceResponse = await fetch(referenceUrl)

  if (!referenceResponse.ok) {
    throw new Error(`메이플 이미지 요청 실패 (${referenceResponse.status})`)
  }

  const referenceSource = await sanitizeSource(
    Buffer.from(await referenceResponse.arrayBuffer()),
  )
  sourceCache.set(referenceUrl.toString(), referenceSource)
  const sourceCrop = await getSourceCrop(referenceSource)

  for (let row = 0; row < animationRows.length; row += 1) {
    for (let column = 0; column < animationRows[row].length; column += 1) {
      const frame = animationRows[row][column]
      const imageUrl = getCharacterImageUrl(input.characterImage, frame)
      const cacheKey = imageUrl.toString()

      if (!sourceCache.has(cacheKey)) {
        const response = await fetch(imageUrl)
        if (!response.ok) {
          throw new Error(`메이플 이미지 요청 실패 (${response.status})`)
        }
        sourceCache.set(
          cacheKey,
          await sanitizeSource(Buffer.from(await response.arrayBuffer())),
        )
      }

      const cell = await renderCell(sourceCache.get(cacheKey)!, frame, sourceCrop)
      composites.push({
        input: cell,
        left: column * CELL_WIDTH,
        top: row * CELL_HEIGHT,
      })
    }
  }

  const atlas = await sharp({
    create: {
      width: COLUMNS * CELL_WIDTH,
      height: ROWS * CELL_HEIGHT,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png()
    .toBuffer()

  const spritesheet = await sharp(atlas)
    .webp({ lossless: true })
    .toBuffer()

  const hash = createHash('sha1')
    .update(`${input.worldName}:${input.characterName}`)
    .digest('hex')
    .slice(0, 10)
  const petId = `maple-${hash}`
  const petDirectory = join(homedir(), '.codex', 'pets', petId)

  await mkdir(petDirectory, { recursive: true })
  await writeFile(join(petDirectory, 'spritesheet.webp'), spritesheet)
  await writeFile(
    join(petDirectory, 'pet.json'),
    JSON.stringify(
      {
        id: petId,
        displayName: input.characterName,
        description: `${input.worldName} ${input.characterClass} 캐릭터`,
        spritesheetPath: 'spritesheet.webp',
        kind: 'creature',
      },
      null,
      2,
    ),
  )

  return { petId, petDirectory }
}
