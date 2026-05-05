export type FeedPostRow = {
  id: string;
  body: string;
  bodyHtml: string | null;
  bodyHtmlVersion: number | null;
  createdAt: Date;
  author: {
    id: string;
    handle: string;
    name: string | null;
    image: string | null;
  };
};

export type FeedPage = {
  posts: FeedPostRow[];
  nextCursor: string | null;
};
