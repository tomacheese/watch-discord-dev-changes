import { Configuration } from './config'
import { setInterval, setTimeout } from 'node:timers/promises'
import { parseChangeLog } from './change-log'
import { Notified } from './notified'
import { Utils } from './utils'
import { Discord, DiscordEmbed, Logger } from '@book000/node-utils'
import { buildChangeLogEmbeds } from './embeds'

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

      if (!isFirst) {
        const embeds = buildChangeLogEmbeds(
          item,
          translatedTitle,
          translatedText
        )
        try {
          for (const embed of embeds) {
            await this.sendEmbed(discord, embed)
          }
        } catch (error) {
          if (this.controller.signal.aborted) {
            throw error
          }
          logger.error(`❌ Failed to send changelog entry: ${item.title}`)
          continue
        }
      }

      notified.add(item.id)
    }

    logger.info('✅ Done')
  }

  /** Retries a rate-limited part twice, respecting Discord's retry_after seconds. */
  private async sendEmbed(
    discord: Discord,
    embed: DiscordEmbed
  ): Promise<void> {
    for (let attempt = 0; ; attempt++) {
      this.controller.signal.throwIfAborted()
      try {
        await discord.sendMessage({ embeds: [embed] })
        return
      } catch (error) {
        const delay = this.retryDelay(error)
        if (delay === null || attempt >= 2) {
          throw error
        }
        await setTimeout(delay, undefined, { signal: this.controller.signal })
      }
    }
  }

  /** Reads the JSON body retained in node-utils' HTTP 429 error message. */
  private retryDelay(error: unknown): number | null {
    if (!(error instanceof Error)) {
      return null
    }
    const prefix = 'Discord API returned 429: '
    if (!error.message.startsWith(prefix)) {
      return null
    }
    try {
      const body: unknown = JSON.parse(error.message.slice(prefix.length))
      if (
        typeof body !== 'object' ||
        body === null ||
        !('retry_after' in body)
      ) {
        return null
      }
      const seconds = body.retry_after
      return typeof seconds !== 'number' ||
        !Number.isFinite(seconds) ||
        seconds < 0 ||
        seconds * 1000 > 2_147_483_647
        ? null
        : Math.max(1, Math.ceil(seconds * 1000))
    } catch {
      return null
    }
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
