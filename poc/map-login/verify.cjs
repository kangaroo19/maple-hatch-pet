'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const {
  frameAtTime,
  getTileMode,
  getBackgroundPosition
} = require('./public/scene-utils.js')

const animation = {
  frames: [
    { delay: 80 },
    { delay: 120 },
    { delay: 200 }
  ]
}

assert.equal(frameAtTime(animation, 0).index, 0)
assert.equal(frameAtTime(animation, 79).index, 0)
assert.equal(frameAtTime(animation, 80).index, 1)
assert.equal(frameAtTime(animation, 199).index, 1)
assert.equal(frameAtTime(animation, 200).index, 2)
assert.equal(frameAtTime(animation, 400).index, 0)

assert.deepEqual(getTileMode(0), {
  horizontal: false,
  vertical: false,
  scrollHorizontal: false,
  scrollVertical: false
})
assert.deepEqual(getTileMode(4), {
  horizontal: true,
  vertical: false,
  scrollHorizontal: true,
  scrollVertical: false
})
assert.deepEqual(getTileMode(6), {
  horizontal: true,
  vertical: true,
  scrollHorizontal: true,
  scrollVertical: false
})

assert.deepEqual(
  getBackgroundPosition(
    { x: -21, y: -1847, rx: -5, ry: -100, type: 4 },
    { centerX: 62, centerY: -1800, top: -2100, left: -362 },
    2000,
    { width: 224, height: 102 }
  ),
  { x: 291, y: 253 }
)

const generatedDir = path.join(__dirname, 'public', 'generated')
const notice = JSON.parse(fs.readFileSync(path.join(generatedDir, 'notice.json'), 'utf8'))

assert.equal(notice.formatVersion, 1)
assert.equal(notice.source.notice, 'UI.wz/Login.img/Notice')
assert.deepEqual(
  [notice.frame.width, notice.frame.height],
  [362, 219]
)
assert.deepEqual(
  [notice.frame.background.width, notice.frame.background.height, notice.frame.background.source],
  [362, 219, 'UI.wz/Login.img/Notice/backgrnd/1']
)

for (const [state, dimensions] of Object.entries({
  normal: [75, 32],
  mouseOver: [75, 34],
  pressed: [75, 34]
})) {
  const button = notice.confirm[state]
  assert.deepEqual([button.width, button.height], dimensions)
  assert.equal(button.source, `UI.wz/Login.img/Notice/BtYes/${state}/0`)
}

for (const asset of [notice.frame.background, ...Object.values(notice.confirm)]) {
  const relativePath = asset.asset.replace(/^generated\//, '')
  assert.equal(fs.existsSync(path.join(generatedDir, relativePath)), true)
}

console.log('scene utility and Notice manifest verification passed')
