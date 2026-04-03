import { Logger } from '@book000/node-utils'
import { Configuration } from './config'
import { Crawler } from './crawler'

async function main() {
  const logger = Logger.configure('main')
  const config = new Configuration('data/config.json')
  config.load()
  if (!config.validate()) {
    logger.error('❌ Configuration is invalid')
    logger.error(
      `💡 Missing check(s): ${config.getValidateFailures().join(', ')}`
    )
    return
  }

  logger.info('🤖 Starting watch-discord-dev-changes')
  const crawler = new Crawler(config)
  await crawler.start()
}

;(async () => {
  try {
    await main()
  } catch (err) {
    Logger.configure('main').error('Error', err as Error)
    // eslint-disable-next-line unicorn/no-process-exit
    process.exit(1)
  }
})()
