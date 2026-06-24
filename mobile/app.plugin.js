const { withPlugins } = require('@expo/config-plugins')
const { withDesktopLyrics } = require('./plugins/withDesktopLyrics')

module.exports = (config) => {
  return withPlugins(config, [
    withDesktopLyrics,
  ])
}
