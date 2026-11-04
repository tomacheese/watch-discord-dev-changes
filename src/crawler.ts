import { Configuration } from './config'
import { setInterval } from 'node:timers/promises'
import { parseChangeLog } from './change-log'
import { Notified } from './notified'
import { Utils } from './utils'
import { Discord, DiscordEmbed, Logger } from '@book000/node-utils'

/**
 * Entries older than this are recorded as notified without being sent.
 * Prevents a flood of notifications for old entries missing from the notified data (e.g. after switching the source).
 */
const MAX_NOTIFY_AGE_DAYS = 30
const MAX_NOTIFY_AGE_MS = MAX_NOTIFY_AGE_DAYS * 24 * 60 * 60 * 1000

export class Crawler {
  private readonly url =
    'https://raw.githubusercontent.com/discord/discord-api-docs/main/developers/change-log.mdx'

  private config: Configuration
  private readonly controller: AbortController = new AbortController()

  constructor(config: Configuration) {
    this.config = config
  }

  public async start(): Promise<void> {
    try {
      await this.run()

      const interval = setInterval(1000 * 60 * 60, null, {
        signal: this.controller.signal,
      })
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of interval) {
        await this.run()
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return
      }
      throw error
    }
  }

  public stop(): void {
    this.controller.abort()
  }

  public async run(): Promise<void> {
    const logger = Logger.configure('Crawler.run')
    logger.info('🔍 Fetching changelog')

    let res: Response
    try {
      res = await fetch(this.url)
    } catch (error) {
      logger.error(`❌ Failed to fetch changelog: ${(error as Error).message}`)
      return
    }
    if (!res.ok) {
      logger.error(`❌ Failed to fetch changelog: ${res.status}`)
      return
    }
    const body = await res.text()
    if (!body) {
      logger.error('❌ Failed to fetch changelog')
      return
    }

    const contents = parseChangeLog(body)
    if (contents.length === 0) {
      logger.error('❌ No changelog entries found')
      return
    }

    const notified = new Notified()
    // Decide first-run before the first record is written (which creates notified.json)
    const isFirst = notified.isFirst()

    const filteredItems = contents.filter(
      (content) => !notified.isNotified(content.id)
    )

    if (filteredItems.length === 0) {
      logger.info('✅ No new items')
      return
    }

    const discordConfig = this.config.get('discord')
    const discord = discordConfig.webhookUrl
      ? new Discord({
          webhookUrl: discordConfig.webhookUrl,
        })
      : discordConfig.token && discordConfig.channelId
        ? new Discord({
            token: discordConfig.token,
            channelId: discordConfig.channelId,
          })
        : null
    if (discord === null) {
      logger.error('❌ Discord configuration is invalid')
      return
    }

    const now = Date.now()
    const outdatedItems = filteredItems.filter(
      (item) =>
        item.date !== null && now - item.date.getTime() > MAX_NOTIFY_AGE_MS
    )
    if (outdatedItems.length > 0) {
      logger.info(
        `📦 Recording ${outdatedItems.length} outdated item(s) without notification: ${outdatedItems
          .map((item) => item.title)
          .join(', ')}`
      )
      for (const item of outdatedItems) {
        notified.add(item.id)
      }
    }

    for (const item of filteredItems) {
      if (outdatedItems.includes(item)) {
        continue
      }

      const translatedTitle = await this.translate(item.title)
      const translatedText = await this.translate(item.text)

      logger.info(`📝 ${item.title}`)
      logger.info(`🔗 ${item.url}`)
      logger.info(`📅 ${item.date?.toISOString()}`)

      const embed: DiscordEmbed = {
        title: item.title,
        url: item.url,
        timestamp: item.date?.toISOString() ?? new Date().toISOString(),
        description: `\`\`\`markdown\n${item.text}\n\`\`\``,
      }
      if (translatedTitle) {
        embed.description = translatedTitle + '\n\n' + (embed.description ?? '')
      }
      if (translatedText) {
        embed.fields = [
          {
            name: 'Translated',
            value: `\`\`\`markdown\n${translatedText}\n\`\`\``,
          },
        ]
      }

      if (!isFirst) {
        // On the first run, only record entries without sending messages
        await discord.sendMessage({
          embeds: [embed],
        })
      }

      notified.add(item.id)
    }

    logger.info('✅ Done')
  }

  private async translate(text: string): Promise<string | null> {
    const translateConfig = this.config.get('translate')

    const gasUrl = translateConfig?.gasUrl
    if (!gasUrl) {
      return null
    }

    const escapedText = Utils.escape(text)
    const translatedText = await Utils.translate(gasUrl, escapedText)
    if (!translatedText) {
      return null
    }
    const unescapedText = Utils.unescape(translatedText)
    return unescapedText
  }
}
