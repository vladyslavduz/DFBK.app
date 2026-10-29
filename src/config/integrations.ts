import { publishingChannels, type PublishingChannel } from './publishing';
import type { SocialProvider } from '../services/social';

// Display capabilities are separate from the four-provider API wire contract.
const connectionProviders: Partial<Record<PublishingChannel, SocialProvider>> = {
  instagram: 'instagram', facebook: 'facebook', linkedin: 'linkedin', x: 'x',
};
export const integrationChannels = publishingChannels.map(channel => ({
  ...channel,
  connectionProvider: connectionProviders[channel.id],
  supportsConnection: channel.id === 'instagram' || channel.id === 'facebook',
}));
