import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Discord, Logger } from '@book000/node-utils'
import { Configuration } from './config'
import { Crawler } from './crawler'

jest.mock('@book000/node-utils', () => ({
  ...jest.requireActual<typeof import('@book000/node-utils')>(
    '@book000/node-utils'
  ),
  Discord: jest.fn(),
}))

const fixture = fs.readFileSync(
  path.resolve('src', '__fixtures__', 'change-log.mdx'),
  'utf8'
)

const TITLE_OAUTH2 = 'OAuth2 Authorization Responses Now Include `iss`'
const TITLE_EMBEDS = 'Component Embeds and Link Preview Docs'
const TITLE_UNPARSABLE = 'Entry With Unparsable Date'
const TITLE_EXPRESSIONS =
  'Guild Expressions and Events Permissions now available to developers'
const TITLE_SDK = 'Discord Social SDK Release 1.7.13024'
const TITLE_ATTACHMENT = 'Per-Attachment File Upload Behavior for Apps'

const DAY_MS = 24 * 60 * 60 * 1000

/** Discord へ送信された Embed のうち、検証に使うもの */
interface SentEmbed {
  title: string
  url: string
  timestamp: string
  description: string
}

/** `Discord.sendMessage` に渡されるメッセージのうち、検証に使うもの */
interface SentMessage {
  embeds: SentEmbed[]
}

/**
 * 最小限の設定を返すスタブを作る。
 *
 * @param discord `discord` 設定
 * @returns `Configuration` として扱えるスタブ
 */
function createConfig(discord: Record<string, string>): Configuration {
  return {
    get: (key: string) => (key === 'discord' ? discord : undefined),
  } as unknown as Configuration
}

describe('Crawler.run', () => {
  let tmpDir: string
  let notifiedPath: string
  let sendMessage: jest.Mock<Promise<undefined>, [SentMessage]>
  let fetchMock: jest.SpyInstance
  let infoLog: jest.SpyInstance
  let errorLog: jest.SpyInstance
  const validConfig = createConfig({
    webhookUrl: 'https://example.invalid/webhook',
  })

  /**
   * 通知済みファイルの内容を読む。
   *
   * @returns 通知済み ID の配列
   */
  function readNotified(): string[] {
    return JSON.parse(fs.readFileSync(notifiedPath, 'utf8')) as string[]
  }

  /**
   * 送信されたメッセージの Embed タイトルを送信順に返す。
   *
   * @returns Embed タイトルの配列
   */
  function sentTitles(): string[] {
    return sendMessage.mock.calls.map((call) => call[0].embeds[0].title)
  }

  /**
   * `fetch` が返す Response を差し替える。
   *
   * @param body レスポンスボディ
   * @param status HTTP ステータス
   */
  function mockResponse(body: string, status = 200): void {
    fetchMock.mockResolvedValue(new Response(body, { status }))
  }

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crawler-test-'))
    notifiedPath = path.join(tmpDir, 'notified.json')
    process.env.NOTIFIED_PATH = notifiedPath

    sendMessage = jest.fn<Promise<undefined>, [SentMessage]>()
    sendMessage.mockResolvedValue(undefined)
    ;(Discord as unknown as jest.Mock).mockImplementation(() => ({
      sendMessage,
    }))
    fetchMock = jest.spyOn(globalThis, 'fetch')
    mockResponse(fixture)
    infoLog = jest.spyOn(Logger.prototype, 'info').mockImplementation()
    jest.spyOn(Logger.prototype, 'warn').mockImplementation()
    errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation()

    jest.useFakeTimers().setSystemTime(new Date(2026, 9, 20))
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
    delete process.env.NOTIFIED_PATH
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('fetches the MDX on the main branch', async () => {
    await new Crawler(validConfig).run()

    expect(fetchMock).toHaveBeenCalledWith(
      'https://raw.githubusercontent.com/discord/discord-api-docs/main/developers/change-log.mdx'
    )
  })

  it('neither sends nor records anything when the fetch returns 404', async () => {
    mockResponse('404: Not Found', 404)

    await new Crawler(validConfig).run()

    expect(errorLog).toHaveBeenCalledWith('❌ Failed to fetch changelog: 404')
    expect(sendMessage).not.toHaveBeenCalled()
    expect(fs.existsSync(notifiedPath)).toBe(false)
  })

  it('neither sends nor records anything when the body has no update', async () => {
    mockResponse('# Change Log\n\nThe structure has changed.\n')

    await new Crawler(validConfig).run()

    expect(errorLog).toHaveBeenCalledWith('❌ No changelog entries found')
    expect(sendMessage).not.toHaveBeenCalled()
    expect(fs.existsSync(notifiedPath)).toBe(false)
  })

  it('sends only the recent and undated items and records every item', async () => {
    fs.writeFileSync(notifiedPath, '[]')

    await new Crawler(validConfig).run()

    expect(sentTitles()).toEqual([TITLE_OAUTH2, TITLE_EMBEDS, TITLE_UNPARSABLE])
    expect(readNotified()).toEqual([
      TITLE_EXPRESSIONS,
      TITLE_SDK,
      TITLE_ATTACHMENT,
      TITLE_OAUTH2,
      TITLE_EMBEDS,
      TITLE_UNPARSABLE,
    ])
  })

  it('builds the embed from the item', async () => {
    fs.writeFileSync(notifiedPath, '[]')

    await new Crawler(validConfig).run()

    const embed = sendMessage.mock.calls[0][0].embeds[0]
    expect(embed.title).toBe(TITLE_OAUTH2)
    expect(embed.url).toBe(
      'https://docs.discord.com/developers/change-log#october-14-2026'
    )
    expect(embed.timestamp).toBe(new Date(2026, 9, 14).toISOString())
    expect(
      embed.description.startsWith('```markdown\nOAuth2 authorization')
    ).toBe(true)
  })

  it('records the outdated items without sending them and logs their titles', async () => {
    fs.writeFileSync(notifiedPath, '[]')

    await new Crawler(validConfig).run()

    expect(infoLog).toHaveBeenCalledWith(
      `📦 Recording 3 outdated item(s) without notification: ${TITLE_EXPRESSIONS}, ${TITLE_SDK}, ${TITLE_ATTACHMENT}`
    )
    expect(sentTitles()).not.toContain(TITLE_EXPRESSIONS)
    expect(sentTitles()).not.toContain(TITLE_SDK)
    expect(sentTitles()).not.toContain(TITLE_ATTACHMENT)
  })

  it('sends an item that is exactly 30 days old', async () => {
    fs.writeFileSync(notifiedPath, '[]')
    jest.setSystemTime(new Date(2026, 9, 5).getTime() + 30 * DAY_MS)

    await new Crawler(validConfig).run()

    expect(sentTitles()).toEqual([TITLE_OAUTH2, TITLE_EMBEDS, TITLE_UNPARSABLE])
  })

  it('does not send an item that is older than 30 days by one second', async () => {
    fs.writeFileSync(notifiedPath, '[]')
    jest.setSystemTime(new Date(2026, 9, 5).getTime() + 30 * DAY_MS + 1000)

    await new Crawler(validConfig).run()

    expect(sentTitles()).toEqual([TITLE_OAUTH2, TITLE_UNPARSABLE])
    expect(readNotified()).toContain(TITLE_EMBEDS)
  })

  it('records every item without sending on the first run', async () => {
    await new Crawler(validConfig).run()

    expect(sendMessage).not.toHaveBeenCalled()
    expect(readNotified()).toEqual([
      TITLE_EXPRESSIONS,
      TITLE_SDK,
      TITLE_ATTACHMENT,
      TITLE_OAUTH2,
      TITLE_EMBEDS,
      TITLE_UNPARSABLE,
    ])
  })

  it('does not notify or duplicate an item that is already notified by title', async () => {
    fs.writeFileSync(
      notifiedPath,
      JSON.stringify([TITLE_OAUTH2, TITLE_EMBEDS, TITLE_UNPARSABLE])
    )

    await new Crawler(validConfig).run()

    expect(sendMessage).not.toHaveBeenCalled()
    expect(readNotified()).toEqual([
      TITLE_OAUTH2,
      TITLE_EMBEDS,
      TITLE_UNPARSABLE,
      TITLE_EXPRESSIONS,
      TITLE_SDK,
      TITLE_ATTACHMENT,
    ])
  })

  it('logs that there is nothing new when every item is notified', async () => {
    fs.writeFileSync(
      notifiedPath,
      JSON.stringify([
        TITLE_OAUTH2,
        TITLE_EMBEDS,
        TITLE_UNPARSABLE,
        TITLE_EXPRESSIONS,
        TITLE_SDK,
        TITLE_ATTACHMENT,
      ])
    )

    await new Crawler(validConfig).run()

    expect(infoLog).toHaveBeenCalledWith('✅ No new items')
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('records nothing when the Discord configuration is invalid', async () => {
    await new Crawler(createConfig({})).run()

    expect(errorLog).toHaveBeenCalledWith('❌ Discord configuration is invalid')
    expect(sendMessage).not.toHaveBeenCalled()
    expect(fs.existsSync(notifiedPath)).toBe(false)
  })

  it('does not record an item whose send fails', async () => {
    fs.writeFileSync(notifiedPath, '[]')
    sendMessage.mockRejectedValueOnce(new Error('send failed'))

    await expect(new Crawler(validConfig).run()).rejects.toThrow('send failed')

    expect(readNotified()).not.toContain(TITLE_OAUTH2)
  })
})
