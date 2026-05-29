// Types principaux de l'application BrutMag

export type Feed = {
  id: string;
  name: string;
  sourceUrl: string;
  url: string;
  createdAt: number;
};

export type FeedTransferPayload = {
  version: 1;
  exportedAt: string;
  feeds: Feed[];
};

export type AccountSession = {
  token: string;
  user: {
    id: string;
    email: string;
    createdAt: number;
    updatedAt: number;
  };
  feeds?: Feed[];
};

export type Story = {
  id: string;
  title: string;
  source: string;
  tone: string;
  feedId?: string;
  imageUrl?: string;
  imageUrls?: string[];
  url?: string;
  publishedAt?: string;
  summary?: string;
  body?: string;
  videoUrl?: string;
  videoType?: 'youtube' | 'vimeo' | 'embed' | 'native';
  videoEmbedHtml?: string;
};

export type MasonryItem = {
  story: Story;
  order: number;
  height: number;
};

export type Rss2JsonItem = {
  title?: string;
  pubDate?: string;
  link?: string;
  guid?: string;
  thumbnail?: string;
  description?: string;
  content?: string;
  enclosure?: {
    link?: string;
    type?: string;
  };
  author?: string;
};

export type Rss2JsonFeedResponse = {
  status: string;
  items?: Rss2JsonItem[];
  feed?: {
    url?: string;
    title?: string;
    link?: string;
    description?: string;
    image?: string;
  };
};

export type StoryLayoutMode = 'date' | 'mix' | 'feed';

export type SyncOptions = {
  background?: boolean;
  token?: string;
};
