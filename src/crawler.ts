import { Configuration } from './config'
import { setInterval } from 'node:timers/promises'
import axios from 'axios'
import { Notified } from './notified'
import { Utils } from './utils'
import { Discord, DiscordEmbed, Logger } from '@book000/node-utils'
import { parse, isValid } from 'date-fns'

interface ChangeLogItem {
  title: string
  date: Date | null
  url: string
  text: string
}

export class Crawler {
  private readonly url =
    'https://raw.githubusercontent.com/discord/discord-api-docs/master/docs/Change_Log.md'

  // Nov 1, 2023
  // Oct 19, 2023
  private readonly dateFormat = 'MMM d, yyyy'

  private config: Configuration
  private readonly controller: AbortController = new AbortController()

  constructor(config: Configuration) {
    this.config = config
  }

  public async start(): Promise<void> {
    try {
      await this.run()

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of setInterval(1000 * 60 * 60, null, {
        signal: this.controller.signal,
      })) {
        await this.run()
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        return
      }
      throw err
    }
  }

  public stop(): void {
    this.controller.abort()
  }

  public async run(): Promise<void> {
    const logger = Logger.configure('Crawler.run')
    logger.info('🔍 Fetching changelog')

    const response = await axios.get<string>(this.url, {
      validateStatus: () => true,
    })
    if (response.status !== 200) {
      logger.error(`❌ Failed to fetch changelog: ${response.status}`)
      return
    }
    const body = response.data
    if (!body) {
      logger.error('❌ Failed to fetch changelog')
      return
    }

    const contents = this.parseContents(body)

    // すでに通知済みのコンテンツを除外する
    const notified = new Notified()
    const filteredItems = contents.filter(
      (content) => !notified.isNotified(content.title)
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

    const isFirst = notified.isFirst()

    for (const item of filteredItems) {
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
        // 翻訳されたタイトルがある場合は、説明文の先頭に表示する
        embed.description = translatedTitle + '\n\n' + (embed.description ?? '')
      }
      if (translatedText) {
        // 翻訳されたテキストがある場合は、フィールドに表示する
        embed.fields = [
          {
            name: 'Translated',
            value: `\`\`\`markdown\n${translatedText}\n\`\`\``,
          },
        ]
      }

      if (!isFirst) {
        // 初回の場合はメッセージを送信しない
        await discord.sendMessage({
          embeds: [embed],
        })
      }

      notified.add(item.title)
    }

    logger.info('✅ Done')
  }

  private parseContents(body: string): ChangeLogItem[] {
    const lines = body.split('\n')

    // changelogのコンテンツ配列
    const contents: ChangeLogItem[] = []

    // 処理中コンテンツタイトル
    let title = null
    // 処理中コンテンツ日付
    let date = null
    // 処理中コンテンツテキスト
    const texts: string[] = []
    for (const line of lines) {
      // h2はタイトル
      if (line.startsWith('## ')) {
        // すでにタイトルがある場合は、前の内容を保存する
        if (title) {
          contents.push({
            title,
            date: this.parseDate(date),
            url: this.getItemUrl(title),
            text: texts.join('\n').trim(),
          })
        }

        // 新しいタイトルを設定する
        title = line.replace('## ', '').trim()
        date = null
        texts.length = 0
        continue
      }

      // h4は日付
      if (line.startsWith('#### ')) {
        date = line.replace('#### ', '').trim()
        continue
      }

      // タイトルがない場合は、スキップする
      if (!title) {
        continue
      }

      texts.push(line)
    }

    // 最後のコンテンツを保存する
    if (title) {
      contents.push({
        title,
        date: this.parseDate(date),
        url: this.getItemUrl(title),
        text: texts.join('\n').trim(),
      })
    }

    return contents
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

  private getItemUrl(title: string): string {
    return `https://discord.com/developers/docs/change-log#${title
      .toLowerCase()
      .replaceAll(' ', '-')}`
  }

  private parseDate(date: string | null): Date | null {
    if (!date) {
      return null
    }
    const parsedDate = parse(date, this.dateFormat, new Date())
    return isValid(parsedDate) ? parsedDate : null
  }
}
