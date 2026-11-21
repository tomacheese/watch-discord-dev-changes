import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Notified } from './notified'

const SUFFIX =
  'Fix or restore the file manually; deleting it makes the next run a first run (current entries are recorded without notification, so entries published while the file was unusable are never notified).'

describe('Notified', () => {
  let tmpDir: string
  let notifiedPath: string

  /**
   * Builds the exact error message expected when loading fails.
   *
   * @param reason - The failure reason embedded in the message
   * @returns The full error message
   */
  function loadError(reason: string): string {
    return `Failed to load notified IDs from "${notifiedPath}": ${reason}. ${SUFFIX}`
  }

  /**
   * Returns the message JSON.parse throws for the given text.
   *
   * @param text - Text that is not valid JSON
   * @returns The parse error message
   */
  function parseReason(text: string): string {
    try {
      JSON.parse(text)
    } catch (error) {
      return (error as Error).message
    }
    throw new Error('Expected JSON.parse to throw')
  }

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notified-test-'))
    notifiedPath = path.join(tmpDir, 'notified.json')
    process.env.NOTIFIED_PATH = notifiedPath
  })

  afterEach(() => {
    jest.restoreAllMocks()
    delete process.env.NOTIFIED_PATH
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  describe('save', () => {
    it('writes the list as pretty-printed JSON and leaves no temp file', () => {
      const notified = new Notified()
      notified.add('a')
      notified.add('b')

      expect(fs.readFileSync(notifiedPath, 'utf8')).toBe(
        JSON.stringify(['a', 'b'], null, 2)
      )
      expect(fs.existsSync(`${notifiedPath}.tmp`)).toBe(false)
    })

    it('keeps the original file and removes the temp file when the rename fails', () => {
      const original = JSON.stringify(['kept'], null, 2)
      fs.writeFileSync(notifiedPath, original)
      const notified = new Notified()
      const failure = new Error('rename failed')
      jest.spyOn(fs, 'renameSync').mockImplementation(() => {
        throw failure
      })

      expect(() => {
        notified.save()
      }).toThrow(failure)

      expect(fs.readFileSync(notifiedPath, 'utf8')).toBe(original)
      expect(fs.existsSync(`${notifiedPath}.tmp`)).toBe(false)
    })

    it('does not record the id in memory when add fails to save', () => {
      fs.writeFileSync(notifiedPath, '[]')
      const notified = new Notified()
      jest.spyOn(fs, 'renameSync').mockImplementation(() => {
        throw new Error('rename failed')
      })

      expect(() => {
        notified.add('lost')
      }).toThrow('rename failed')

      expect(notified.isNotified('lost')).toBe(false)
      expect(notified.length).toBe(0)
    })

    it('round-trips titles with quotes and Unicode', () => {
      const titles = ['He said "hi"', '日本語のタイトル 🎉', "it's \\ done"]
      const notified = new Notified()
      for (const title of titles) {
        notified.add(title)
      }

      const reloaded = new Notified()
      expect(reloaded.length).toBe(titles.length)
      for (const title of titles) {
        expect(reloaded.isNotified(title)).toBe(true)
      }
    })
  })

  describe('load', () => {
    const cases: [string, string, string][] = [
      ['a 0-byte file', '', parseReason('')],
      ['a truncated JSON file', '["a", "b', parseReason('["a", "b')],
      ['a JSON object', '{"a":1}', 'expected an array of strings'],
      [
        'an array with a non-string',
        '["a", 1]',
        'expected an array of strings',
      ],
    ]

    it.each(cases)(
      'throws a descriptive error and leaves the file untouched for %s',
      (_name, content, reason) => {
        fs.writeFileSync(notifiedPath, content)

        expect(() => new Notified()).toThrow(
          expect.objectContaining({ message: loadError(reason) })
        )

        expect(fs.readFileSync(notifiedPath, 'utf8')).toBe(content)
      }
    )

    it('throws a descriptive error when the path is not a readable file', () => {
      fs.mkdirSync(notifiedPath)
      let reason = ''
      try {
        fs.readFileSync(notifiedPath, 'utf8')
      } catch (error) {
        reason = (error as Error).message
      }

      expect(() => new Notified()).toThrow(
        expect.objectContaining({ message: loadError(reason) })
      )
    })
  })

  describe('isFirst', () => {
    it('is true when the file does not exist', () => {
      expect(new Notified().isFirst()).toBe(true)
    })

    it('is false when the file exists', () => {
      fs.writeFileSync(notifiedPath, '[]')

      expect(new Notified().isFirst()).toBe(false)
    })

    it('is false when the file exists but has become corrupt', () => {
      fs.writeFileSync(notifiedPath, '[]')
      const notified = new Notified()
      fs.writeFileSync(notifiedPath, '["a"')

      expect(notified.isFirst()).toBe(false)
    })
  })
})
