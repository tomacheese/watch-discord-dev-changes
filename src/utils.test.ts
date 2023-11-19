import { Utils } from './utils'
import axios from 'axios'

describe('Utils', () => {
  describe('escape', () => {
    it('should escape markdown links', () => {
      const text = 'Check out this link: <https://example.com>'
      const escapedText = Utils.escape(text)
      expect(escapedText).toBe(
        'Check out this link: <span translate="no" data-type="url">https://example.com</span>'
      )
    })

    it('should escape code blocks', () => {
      const text = '```console.log("Hello, world!");```'
      const escapedText = Utils.escape(text)
      expect(escapedText).toBe(
        '<span translate="no" data-type="code-block">console.log("Hello, world!");</span>'
      )
    })

    it('should escape inline code', () => {
      const text = '`escape`'
      const escapedText = Utils.escape(text)
      expect(escapedText).toBe(
        '<span translate="no" data-type="code">escape</span>'
      )
    })

    it('should escape italic and bold formatting', () => {
      const text = '*italic* and **bold**'
      const escapedText = Utils.escape(text)
      expect(escapedText).toBe(
        '<span translate="no" data-type="strong-or-italic">*</span>italic<span translate="no" data-type="strong-or-italic">*</span> and <span translate="no" data-type="strong-or-italic">**</span>bold<span translate="no" data-type="strong-or-italic">**</span>'
      )
    })

    it('should escape discord formatting', () => {
      const text = 'Check out this channel: <#123456789012345678>'
      const escapedText = Utils.escape(text)
      expect(escapedText).toBe(
        'Check out this channel: <span translate="no" data-type="formatting"><#123456789012345678></span>'
      )
    })

    it('should escape custom emojis', () => {
      const text = 'Check out this emoji: <:name:123456789012345678>'
      const escapedText = Utils.escape(text)
      expect(escapedText).toBe(
        'Check out this emoji: <span translate="no" data-type="formatting"><:name:123456789012345678></span>'
      )
    })

    it('should escape user mentions', () => {
      const text = 'Mentioning a user: <@123456789012345678>'
      const escapedText = Utils.escape(text)
      expect(escapedText).toBe(
        'Mentioning a user: <span translate="no" data-type="formatting"><@123456789012345678></span>'
      )
    })
  })

  describe('unescape', () => {
    it('should unescape markdown links', () => {
      const text =
        'Check out this link: <span translate="no" data-type="url">https://example.com</span>'
      const unescapedText = Utils.unescape(text)
      expect(unescapedText).toBe('Check out this link: <https://example.com>')
    })

    it('should unescape code blocks', () => {
      const text =
        '<span translate="no" data-type="code-block">console.log("Hello, world!");</span>'
      const unescapedText = Utils.unescape(text)
      expect(unescapedText).toBe('```console.log("Hello, world!");```')
    })

    it('should unescape inline code', () => {
      const text = '<span translate="no" data-type="code">escape</span>'
      const unescapedText = Utils.unescape(text)
      expect(unescapedText).toBe('`escape`')
    })

    it('should unescape italic and bold formatting', () => {
      const text =
        '<span translate="no" data-type="strong-or-italic">*</span>italic<span translate="no" data-type="strong-or-italic">*</span> and <span translate="no" data-type="strong-or-italic">**</span>bold<span translate="no" data-type="strong-or-italic">**</span>'
      const unescapedText = Utils.unescape(text)
      expect(unescapedText).toBe('*italic* and **bold**')
    })

    it('should unescape discord formatting', () => {
      const text =
        'Check out this channel: <span translate="no" data-type="formatting"><#123456789012345678></span>'
      const unescapedText = Utils.unescape(text)
      expect(unescapedText).toBe(
        'Check out this channel: <#123456789012345678>'
      )
    })

    it('should unescape custom emojis', () => {
      const text =
        'Check out this emoji: <span translate="no" data-type="formatting"><:name:123456789012345678></span>'
      const unescapedText = Utils.unescape(text)
      expect(unescapedText).toBe(
        'Check out this emoji: <:name:123456789012345678>'
      )
    })

    it('should unescape user mentions', () => {
      const text =
        'Mentioning a user: <span translate="no" data-type="formatting"><@123456789012345678></span>'
      const unescapedText = Utils.unescape(text)
      expect(unescapedText).toBe('Mentioning a user: <@123456789012345678>')
    })
  })

  describe('translate', () => {
    it('should translate text using the specified GAS URL', async () => {
      const gasUrl = 'https://example.com/translate'
      const message = 'Hello, world!'
      const translatedMessage = 'こんにちは、世界！'

      // Mock the axios.post method to return the translated message
      jest.spyOn(axios, 'post').mockResolvedValueOnce({
        status: 200,
        data: {
          response: {
            result: translatedMessage,
          },
        },
      })

      const result = await Utils.translate(gasUrl, message)
      expect(result).toBe(translatedMessage)
    })

    it('should return null if the translation request fails', async () => {
      const gasUrl = 'https://example.com/translate'
      const message = 'Hello, world!'

      // Mock the axios.post method to return an error response
      jest.spyOn(axios, 'post').mockResolvedValueOnce({
        status: 500,
      })

      const result = await Utils.translate(gasUrl, message)
      expect(result).toBeNull()
    })
  })
})
