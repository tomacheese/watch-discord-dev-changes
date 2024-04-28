import { Logger } from '@book000/node-utils'
import axios from 'axios'

interface GasTranslateResponse {
  response: {
    result: string
  }
}

export const Utils = {
  /**
   * テキストをエスケープするメソッド。MarkdownおよびDiscordのフォーマットをエスケープします。
   *
   * @param text エスケープするテキスト。
   * @returns エスケープされたテキスト。
   */
  escape(text: string): string {
    return (
      text
        // --- markdownエスケープ ---
        // <https://example.com> -> <span translate="no" data-type="url">https://example.com</span>
        // https://example.com -> <span translate="no" data-type="url">https://example.com</span>
        .replaceAll(
          /<((?:https?:\/\/)?[\w.-]+(?:\.[\w.-]+)+(?:\/[\w%&./=?-]*)?)>/g,
          '<span translate="no" data-type="url">$1</span>'
        )
        // ```console.log("Hello, world!");``` -> <span translate="no" data-type="code-block">console.log("Hello, world!");</span>
        .replaceAll(
          /```([\S\s]+?)```/g,
          '<span translate="no" data-type="code-block">$1</span>'
        )
        // `escape` -> <span translate="no" data-type="code">escape</span>
        .replaceAll(
          /`([\S\s]+?)`/g,
          '<span translate="no" data-type="code">$1</span>'
        )
        // *italic* -> <span translate="no" data-type="strong-or-italic">*</span>italic<span translate="no" data-type="strong-or-italic">*</span>
        // **bold** -> <span translate="no" data-type="strong-or-italic">**</span>bold<span translate="no" data-type="strong-or-italic">**</span>
        .replaceAll(
          /(\*{1,2})(\S+?)\1/g,
          '<span translate="no" data-type="strong-or-italic">$1</span>$2<span translate="no" data-type="strong-or-italic">$1</span>'
        )
        // --- discordエスケープ ---
        // <@123456789012345678> -> <span translate="no" data-type="formatting"><@123456789012345678></span>
        // <#123456789012345678> -> <span translate="no" data-type="formatting"><#123456789012345678></span>
        // <@&123456789012345678> -> <span translate="no" data-type="formatting"><@&123456789012345678></span>
        // <:name:123456789012345678> -> <span translate="no" data-type="formatting"><:anamet:123456789012345678></span>
        // <a:name:123456789012345678> -> <span translate="no" data-type="formatting"><a:name:123456789012345678></span>
        // <@!123456789012345678> -> <span translate="no" data-type="formatting"><@!123456789012345678></span>
        .replaceAll(
          /<[#:@at]\S+>/g,
          '<span translate="no" data-type="formatting">$&</span>'
        )
        // <<1234567890:customize> -> <span translate="no" data-type="formatting"><1234567890:customize></span>
        .replaceAll(
          /<\d+:\S+>/g,
          '<span translate="no" data-type="formatting">$&</span>'
        )
    )
  },
  /**
   * エスケープされたテキストを元に戻すメソッド。MarkdownおよびDiscordのフォーマットを元に戻します。
   *
   * @param text - 元に戻すテキスト。
   * @returns 元に戻されたテキスト。
   */
  unescape(text: string): string {
    return (
      text
        // --- markdown unescape ---
        // <span translate="no" data-type="url">https://example.com</span> -> <https://example.com>
        .replaceAll(
          /<span translate="no" data-type="url">([\S\s]+?)<\/span>/g,
          '<$1>'
        )
        // <span translate="no" data-type="code-block">console.log("Hello, world!");</span> -> ```console.log("Hello, world!");```
        .replaceAll(
          /<span translate="no" data-type="code-block">([\S\s]+?)<\/span>/g,
          '```$1```'
        )
        // <span translate="no" data-type="code">escape</span> -> `escape`
        .replaceAll(
          /<span translate="no" data-type="code">([\S\s]+?)<\/span>/g,
          '`$1`'
        )
        // <span translate="no" data-type="strong-or-italic">*</span>italic<span translate="no" data-type="strong-or-italic">*</span> -> *italic*
        // <span translate="no" data-type="strong-or-italic">**</span>bold<span translate="no" data-type="strong-or-italic">**</span> -> **bold**
        .replaceAll(
          /<span translate="no" data-type="strong-or-italic">(\*{1,2})<\/span>([\S\s]+?)<span translate="no" data-type="strong-or-italic">\1<\/span>/g,
          '$1$2$1'
        )
        // --- discord unescape ---
        // <span translate="no" data-type="formatting"><@123456789012345678></span> -> <@123456789012345678>
        // <span translate="no" data-type="formatting"><#123456789012345678></span> -> <#123456789012345678>
        // <span translate="no" data-type="formatting"><@&123456789012345678></span> -> <@&123456789012345678>
        // <span translate="no" data-type="formatting"><:name:123456789012345678></span> -> <:name:123456789012345678>
        // <span translate="no" data-type="formatting"><a:name:123456789012345678></span> -> <a:name:123456789012345678>
        // <span translate="no" data-type="formatting"><@!123456789012345678></span> -> <@!123456789012345678>
        .replaceAll(
          /<span translate="no" data-type="formatting">(<[#:@at]\S+>)<\/span>/g,
          '$1'
        )
        // <span translate="no" data-type="formatting"><1234567890:customize></span> -> <<1234567890:customize>
        .replaceAll(
          /<span translate="no" data-type="formatting">(<\d+:\S+>)<\/span>/g,
          '$1'
        )
    )
  },
  /**
   * 指定されたGoogle Apps Script URLを使用して、与えられたメッセージを一つの言語から別の言語に翻訳します。
   *
   * @param gasUrl 翻訳に使用するGoogle Apps ScriptサービスのURL。
   * @param message 翻訳対象のテキストメッセージ。
   * @param before 元の言語の言語コード（デフォルトは英語の 'en'）。
   * @param after 翻訳後の言語の言語コード（デフォルトは日本語の 'ja'）。
   * @returns 翻訳されたメッセージ（文字列）。翻訳が失敗した場合は null。
   */
  async translate(
    gasUrl: string,
    message: string,
    before = 'en',
    after = 'ja'
  ): Promise<string | null> {
    const logger = Logger.configure('Utils.translate')

    // Google Apps Scriptサービスに翻訳リクエストを送信
    const response = await axios.post<GasTranslateResponse>(
      gasUrl,
      {
        before,
        after,
        text: message,
        mode: 'html',
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
      }
    )

    // レスポンスのステータスに応じて、翻訳が成功したかどうかを確認
    if (response.status !== 200) {
      logger.warn(`❌ メッセージの翻訳に失敗しました：${response.status}`)
      return null
    }

    // レスポンスから翻訳されたメッセージを返す
    return response.data.response.result
  },
}
