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
  protected validates(): {
    [key: string]: (config: ConfigInterface) => boolean
  } {
    return {
      'discord is required': (config) => !!config.discord,
      'discord is object': (config) => typeof config.discord === 'object',
      'discord.webhookUrl is string or undefined': (config) =>
        typeof config.discord.webhookUrl === 'string' ||
        config.discord.webhookUrl === undefined,
      'discord.token is string or undefined': (config) =>
        typeof config.discord.token === 'string' ||
        config.discord.token === undefined,
      'discord.channelId is string or undefined': (config) =>
        typeof config.discord.channelId === 'string' ||
        config.discord.channelId === undefined,
      'translate.gasUrl is required': (config) =>
        config.translate === undefined || !!config.translate.gasUrl,
    }
  }
}
