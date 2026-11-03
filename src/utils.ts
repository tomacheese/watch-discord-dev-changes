import { Logger } from '@book000/node-utils'

interface GasTranslateResponse {
  response: {
    result: string
  }
}

export const Utils = {
  /**
   * Wraps Markdown and Discord formatting in `translate="no"` spans so the translator leaves it untouched.
   *
   * @param text The text to escape.
   * @returns The escaped text.
   */
  escape(text: string): string {
    return (
      text
        // --- Markdown escapes ---
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
        // --- Discord escapes ---
        // <@123456789012345678> -> <span translate="no" data-type="formatting"><@123456789012345678></span>
        // <#123456789012345678> -> <span translate="no" data-type="formatting"><#123456789012345678></span>
        // <@&123456789012345678> -> <span translate="no" data-type="formatting"><@&123456789012345678></span>
        // <:name:123456789012345678> -> <span translate="no" data-type="formatting"><:name:123456789012345678></span>
        // <a:name:123456789012345678> -> <span translate="no" data-type="formatting"><a:name:123456789012345678></span>
        // <@!123456789012345678> -> <span translate="no" data-type="formatting"><@!123456789012345678></span>
        .replaceAll(
          /<[#:@at]\S+>/g,
          '<span translate="no" data-type="formatting">$&</span>'
        )
        // <1234567890:customize> -> <span translate="no" data-type="formatting"><1234567890:customize></span>
        .replaceAll(
          /<\d+:\S+>/g,
          '<span translate="no" data-type="formatting">$&</span>'
        )
    )
  },
  /**
   * Reverses `escape`, restoring the Markdown and Discord formatting.
   *
   * @param text - The text to unescape.
   * @returns The unescaped text.
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
        // <span translate="no" data-type="formatting"><1234567890:customize></span> -> <1234567890:customize>
        .replaceAll(
          /<span translate="no" data-type="formatting">(<\d+:\S+>)<\/span>/g,
          '$1'
        )
    )
  },
  /**
   * Translates a message via the given Google Apps Script URL.
   *
   * @param gasUrl URL of the Google Apps Script translation service.
   * @param message The text to translate.
   * @param before Source language code.
   * @param after Target language code.
   * @returns The translated message, or null if translation fails.
   */
  async translate(
    gasUrl: string,
    message: string,
    before = 'en',
    after = 'ja'
  ): Promise<string | null> {
    const logger = Logger.configure('Utils.translate')

    try {
      const res = await fetch(gasUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          before,
          after,
          text: message,
          mode: 'html',
        }),
      })

      if (!res.ok) {
        logger.warn(`❌ Failed to translate message: ${res.status}`)
        return null
      }

      const data = (await res.json()) as GasTranslateResponse
      return data.response.result
    } catch (error) {
      logger.warn(
        `❌ Exception while translating message: ${(error as Error).message}`
      )
      return null
    }
  },
}
