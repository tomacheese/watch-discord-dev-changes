import { ConfigFramework } from '@book000/node-utils'

export interface ConfigInterface {
  discord: {
    webhookUrl?: string
    token?: string
    channelId?: string
  }
  translate?: {
    gasUrl: string
  }
}

export class Configuration extends ConfigFramework<ConfigInterface> {
  protected validates(): Record<string, (config: ConfigInterface) => boolean> {
    return {
      'discord is required': (config) => !!config.discord,
      'discord is object': (config) => typeof config.discord === 'object',
      'discord.webhookUrl is string or undefined': (config) =>
        typeof config.discord.webhookUrl === 'string' ||
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        config.discord.webhookUrl === undefined,
      'discord.token is string or undefined': (config) =>
        typeof config.discord.token === 'string' ||
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        config.discord.token === undefined,
      'discord.channelId is string or undefined': (config) =>
        typeof config.discord.channelId === 'string' ||
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        config.discord.channelId === undefined,
      'translate.gasUrl is required': (config) =>
        config.translate === undefined || !!config.translate.gasUrl,
    }
  }
}
