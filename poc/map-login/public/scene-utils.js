(function (root, factory) {
  const api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  if (root) root.MapLoginScene = api
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict'

  function frameAtTime (animation, elapsedMs) {
    const frames = animation.frames
    const totalDelay = frames.reduce((sum, frame) => sum + Math.max(1, frame.delay || 100), 0)
    let cursor = ((elapsedMs % totalDelay) + totalDelay) % totalDelay

    for (let index = 0; index < frames.length; index++) {
      const delay = Math.max(1, frames[index].delay || 100)
      if (cursor < delay) {
        return { frame: frames[index], index, progress: cursor / delay }
      }
      cursor -= delay
    }

    return { frame: frames[0], index: 0, progress: 0 }
  }

  function getTileMode (type) {
    return {
      horizontal: type === 1 || type === 3 || type === 4 || type === 6 || type === 7,
      vertical: type === 2 || type === 3 || type === 5 || type === 6 || type === 7,
      scrollHorizontal: type === 4 || type === 6,
      scrollVertical: type === 5 || type === 7
    }
  }

  function getBackgroundPosition (background, camera, elapsedMs, assetSize) {
    const mode = getTileMode(background.type)
    const cellWidth = background.cx || assetSize.width
    const cellHeight = background.cy || assetSize.height
    let x = background.x
    let y = background.y

    if (mode.scrollHorizontal) {
      x += (background.rx * 5 * elapsedMs / 1000) % cellWidth
    } else {
      x += camera.centerX * (100 + background.rx) / 100
    }

    if (mode.scrollVertical) {
      y += (background.ry * 5 * elapsedMs / 1000) % cellHeight
    } else {
      y += camera.centerY * (100 + background.ry) / 100
    }

    return {
      x: Math.floor(x - camera.left),
      y: Math.floor(y - camera.top)
    }
  }

  return { frameAtTime, getTileMode, getBackgroundPosition }
})
