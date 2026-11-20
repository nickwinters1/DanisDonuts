/* ────────────────────────────────────────────────────────────────────────────
 *  DANI'S DONUTS — SITE CONFIG
 *  Everything personal lives in this one file. Edit freely: names, the occasion,
 *  the letter, the Season Pass tiers, the secret message. No code knowledge needed —
 *  just keep the quotes and commas where they are.
 * ──────────────────────────────────────────────────────────────────────────── */

export type OccasionKind = 'birthday' | 'anniversary' | 'celebration';

export const config = {
  streamer: {
    name: 'Dani',
    handle: 'HeyDani',
    community: "Dani's Donuts",
    /** Shown in the HUD clock ("Florida time"). */
    timezone: 'America/New_York',
    homeBase: 'Florida · on the beach',
    /** Optional: drop a photo in /public (e.g. public/dani.jpg) and put 'dani.jpg' here. */
    photo: '' as string,
  },

  occasion: {
    kind: 'birthday' as OccasionKind,
    /** Big hero kicker + headline. */
    kicker: 'Happy Birthday',
    headline: 'Dani',
    subline: 'Love, every single one of your Donuts.',
    /**
     * Optional ISO date of the big day, e.g. '2026-12-14'. When it is in the future the
     * hero shows a live countdown; on the day it switches to "it's today!".
     */
    date: '' as string,
  },

  /** The public address of the site, shown in Stream Mode so chat can find it. */
  siteUrl: '' as string,

  links: {
    twitch: 'https://www.twitch.tv/heydani',
    twitchChannel: 'heydani',
    shop: 'https://heydani-shop.fourthwall.com/',
    instagram: 'https://www.instagram.com/heydani',
    instagramHandle: '@heydani',
    tiktok: 'https://www.tiktok.com/@itsheydani',
    tiktokHandle: '@itsheydani',
  },

  /**
   * Supabase makes the wall shared + live for everyone (free tier is plenty).
   * Leave blank to run in Preview Mode (sample messages, saved only in your browser).
   * You can also set these as VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY env vars.
   */
  supabase: {
    url: (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '',
    anonKey: (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '',
    /**
     * Must match supabase/schema.sql. When false (recommended), new messages wait for an
     * organizer to approve them at  /#/admin  before they appear for everyone.
     */
    autoApprove: false,
  },

  /** The letter at the very end of the page. Make it yours. */
  letter: {
    greeting: 'Dani —',
    paragraphs: [
      'Somewhere along the way, a stream turned into a place. A place people run to after long shifts and hard days, where the lobby is always warm and someone always says hi back.',
      'You built that. One “hey chat” at a time — through every clutch and every not-so-clutch, every crystal, every donut, every sunset-and-sand Florida story — you turned a whole lot of strangers into Dani’s Donuts.',
      'We don’t say it enough, so we built an entire website to say it: thank you. For the laughs, the comfort, the late nights, and for being exactly, wonderfully you.',
      'Every star in that sky is somebody whose life got a little sweeter because you hit “Go Live.”',
    ],
    signoff: 'With all our sprinkles,',
    from: "Dani's Donuts",
  },

  /** Unlocked by finding all 7 hidden crystals. */
  secretMessage: {
    title: 'You found the Donut Heart.',
    body: 'Seven crystals, hidden all over this page — and you found every single one. That is exactly the kind of dedication Dani’s Donuts are famous for. Dani: this whole thing was built by your community, for you, because you make the internet feel like home. We love you. Now go eat a donut. 🍩💗',
  },

  /**
   * The Season Pass. Each tier is a little thank-you. Swap in real milestones
   * (first stream, affiliate, partner, a legendary raid…) and add a `date` if you like.
   * rarity: common | uncommon | rare | epic | legendary | mythic
   */
  seasonPass: [
    { tier: 1, rarity: 'common', title: 'Going Live', reward: 'A place to land after a long day', icon: 'controller', date: '' },
    { tier: 8, rarity: 'uncommon', title: 'Hey, Chat!', reward: 'A hello that hits different', icon: 'heart', date: '' },
    { tier: 15, rarity: 'rare', title: 'The Donuts Assemble', reward: 'A community with a name — and a flavor', icon: 'donut', date: '' },
    { tier: 27, rarity: 'rare', title: 'Beach Mode', reward: 'Florida sunshine, delivered through a screen', icon: 'sun', date: '' },
    { tier: 38, rarity: 'epic', title: 'Crystal Clear', reward: 'Good vibes only. Always.', icon: 'crystal', date: '' },
    { tier: 52, rarity: 'epic', title: 'Clutch Season', reward: 'The loudest chat on the internet', icon: 'trophy', date: '' },
    { tier: 69, rarity: 'legendary', title: 'Late-Night Lobbies', reward: 'Laughing way past bedtime', icon: 'star', date: '' },
    { tier: 84, rarity: 'legendary', title: 'Found Family', reward: 'Friends we never would have met', icon: 'shell', date: '' },
    { tier: 100, rarity: 'mythic', title: 'Exactly You', reward: 'Happy birthday, Dani. Every tier was worth it.', icon: 'crown', date: '' },
  ],

  /** Playful "Player One" profile. These are love, not facts — tweak away. */
  profile: {
    gamertag: 'HeyDani',
    title: 'Main Character',
    guild: "Dani's Donuts",
    mains: ['Fortnite', 'Pokémon'],
    loves: ['Crystals', 'Donuts', 'The beach', 'Her Donuts'],
    special: 'Turns strangers into a family. Passive. Always on.',
    stats: [
      { label: 'Good Vibes', value: 100 },
      { label: 'Clutch Factor', value: 97 },
      { label: 'Laugh Contagion', value: 99 },
      { label: 'Crystal Knowledge', value: 96 },
      { label: 'Donut Capacity', value: 128 },
    ],
  },
} as const;

export type SeasonTier = (typeof config.seasonPass)[number];
