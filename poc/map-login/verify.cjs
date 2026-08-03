'use strict'

const assert = require('node:assert/strict')

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

console.log('scene utility verification passed')
