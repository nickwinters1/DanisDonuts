import type { Message } from './types';

/**
 * Sample messages, shown ONLY in Preview Mode (before Supabase is connected)
 * so the wall feels alive while you build. They are written by the site, not by real people
 * (no real usernames), and disappear automatically once the live wall is connected.
 */
const raw: Omit<Message, 'id' | 'createdAt' | 'hearts' | 'number'>[] = [
  { name: 'Sophie', flavor: 'strawberry', sticker: 'heart', since: 2022, body: 'Happy birthday Dani!! I found your stream during the hardest month of my life and your chat was the first place that felt warm in a really long time. Thank you for being you. Never stop being the sunshine you are ☀️' },
  { name: 'Marco', flavor: 'lagoon', sticker: 'trophy', since: 2021, body: 'HBD to the most clutch streamer on the planet. Still not over that last-circle win — chat completely lost its MIND. W streamer. W community. W birthday 🏆' },
  { name: 'Jo', flavor: 'amethyst', sticker: 'star', since: 2023, body: 'Every time I hear “hey chat” my whole day resets. Happy birthday from a very tired night-shift nurse who catches your VODs on break 💗' },
  { name: 'Kay', flavor: 'holo', sticker: 'crystal', since: 2022, body: 'Okay but who ELSE has bought a crystal because Dani talked about it 😭 my shelf is full now. Happy birthday, crystal queen 💎' },
  { name: 'Ben', flavor: 'vanilla', sticker: 'donut', since: 2020, font: 'hand', body: 'You deserve a dozen donuts. No — a hundred. No — the whole bakery. Happy birthday Dani!! 🍩' },
  { name: 'Riley', flavor: 'seafoam', sticker: 'wave', since: 2024, body: 'I’m not great with words so: thank you. For the laughs, the comfort streams, and for making a space where everyone gets a hello. Happy birthday 🌊' },
  { name: 'Ava', flavor: 'peach', sticker: 'palm', since: 2023, body: 'From one beach girl to another 🌴 hope your birthday is all sunshine, salty air and absolutely zero storms.' },
  { name: 'Mia & Lily', flavor: 'cotton', sticker: 'heart', since: 2022, font: 'hand', body: 'My daughter and I watch you together every weekend. She calls you her favorite “game lady.” Happy birthday from both of us! 💕' },
  { name: 'Theo', flavor: 'galaxy', sticker: 'controller', since: 2021, body: 'GG on another trip around the sun. Respawning at 100% HP. Happy birthday 🎮' },
  { name: 'Nina', flavor: 'strawberry', sticker: 'donut', since: 2022, font: 'hand', body: 'I came for the gameplay. I stayed for the vibes. I am never leaving. Sorry, you’re stuck with us. Happy birthday Dani 🍩' },
  { name: 'Luis', flavor: 'lagoon', sticker: 'sun', since: 2023, body: 'Your chat is the only chat on the internet where people are just… nice. That’s not an accident. That’s you. Happy birthday 💜' },
  { name: 'Priya', flavor: 'lemon', sticker: 'crown', since: 2024, body: 'Shoutout to the mods, shoutout to the Donuts, and the BIGGEST shoutout to the birthday girl 🎉👑' },
  { name: 'Sam', flavor: 'amethyst', sticker: 'heart', since: 2021, body: 'When I moved to a new city I didn’t know anyone. Now I have hundreds of friends who all say hi at the exact same time when you go live. Thank you for my favorite corner of the internet. Happy birthday 🥹' },
  { name: 'Jordan', flavor: 'holo', sticker: 'crystal', since: 2022, body: 'Hope this year is your best season yet. Every tier unlocked, every drop a good drop, every crystal a rare find 💎🏝' },
  { name: 'Grace', flavor: 'cotton', sticker: 'shell', since: 2023, font: 'hand', body: 'Happy birthday!! Sending you a glazed donut, a rose quartz and a big hug through the screen 🤗' },
  { name: 'Eli', flavor: 'cocoa', sticker: 'star', since: 2020, body: 'Long-time lurker, first-time poster. You got me through finals, a breakup and two job hunts. Happy birthday, truly 💗' },
  { name: 'Carmen', flavor: 'peach', sticker: 'sun', since: 2024, body: 'Your laugh is dangerously contagious. I have been caught laughing alone at my desk at work more times than I can count. Happy birthday!!' },
  { name: 'Owen', flavor: 'galaxy', sticker: 'star', since: 2021, body: 'From the night owls: thank you for the 2 a.m. streams. Happy birthday, Dani 🌙' },
  { name: 'Zoe', flavor: 'seafoam', sticker: 'gg', since: 2023, body: 'Birthday buff applied: +100 happiness, +∞ love from chat. 🎂' },
  { name: 'Hannah', flavor: 'lemon', sticker: 'palm', since: 2022, body: 'The beach, the crystals, the donuts, the games — you turned all your favorite things into a home for the rest of us. Happy birthday 🌅' },
  { name: 'Marcus', flavor: 'vanilla', sticker: 'controller', since: 2020, body: 'Modding for you is the easiest job on the internet because this community is so kind. That starts at the top. Happy birthday, boss 🛡️' },
  { name: 'Ivy', flavor: 'strawberry', sticker: 'donut', since: 2025, font: 'hand', body: 'HAPPY BIRTHDAY DANIIIIII 🍩🍩🍩🍩🍩🍩🍩🍩🍩🍩🍩🍩 (one for every Donut in chat — I ran out of room)' },
];

export function sampleMessages(): Message[] {
  const now = Date.now();
  return raw.map((m, i) => ({
    ...m,
    id: `sample-${i + 1}`,
    createdAt: new Date(now - (raw.length - i) * 1000 * 60 * 47).toISOString(),
    hearts: (i * 37 + 11) % 64,
    number: i + 1,
    approved: true,
    sample: true,
  }));
}
