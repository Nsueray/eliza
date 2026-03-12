/**
 * ELIZA Personality Engine
 * Generates personalized greetings and closings based on user nicknames.
 */

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getNicknames(user) {
  if (user && user.nicknames && typeof user.nicknames === 'string') {
    const list = user.nicknames.split(',').map(n => n.trim()).filter(Boolean);
    if (list.length > 0) return list;
  }
  return user && user.name ? [user.name.split(' ')[0]] : [''];
}

function pickTwoDifferent(list) {
  if (list.length <= 1) return [list[0] || '', list[0] || ''];
  const first = pickRandom(list);
  const remaining = list.filter(n => n !== first);
  const second = remaining.length > 0 ? pickRandom(remaining) : first;
  return [first, second];
}

function getTimeGreeting(lang) {
  const hour = new Date().getHours();
  if (lang === 'tr') {
    if (hour >= 5 && hour < 12) return 'Günaydın';
    if (hour >= 12 && hour < 18) return 'İyi günler';
    return 'İyi akşamlar';
  }
  if (lang === 'fr') {
    if (hour >= 5 && hour < 18) return 'Bonjour';
    return 'Bonsoir';
  }
  // en
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 18) return 'Good afternoon';
  return 'Good evening';
}

const GREETINGS = {
  tr: (nickname) => [
    `Selam ${nickname} 👋`,
    `Merhaba ${nickname} 👋`,
    `${getTimeGreeting('tr')} ${nickname} ☀️`,
  ],
  en: (nickname) => [
    `Hi ${nickname} 👋`,
    `Hello ${nickname} 👋`,
    `${getTimeGreeting('en')} ${nickname}`,
  ],
  fr: (nickname) => [
    `Bonjour ${nickname} 👋`,
    `Salut ${nickname} 👋`,
  ],
};

const CLOSINGS = {
  tr: (nickname) => [
    `Başka bir şey var mı ${nickname}?`,
    `Bir şey daha lazımsa buradayım ${nickname}`,
    `Emret ${nickname}`,
  ],
  en: (nickname) => [
    `Anything else ${nickname}?`,
    `Let me know if you need more ${nickname}`,
    `I'm here ${nickname}`,
  ],
  fr: (nickname) => [
    `Autre chose ${nickname}?`,
    `Je suis là ${nickname}`,
  ],
};

/**
 * Calculate minutes since last message.
 * Returns Infinity if no lastMessageTime (first message → full greeting).
 */
function minutesSince(lastMessageTime) {
  if (!lastMessageTime) return Infinity;
  const diff = Date.now() - new Date(lastMessageTime).getTime();
  return diff / (1000 * 60);
}

const SHORT_GREETINGS = {
  tr: (nickname) => [`${nickname},`, `Evet ${nickname},`],
  en: (nickname) => [`${nickname},`, `Sure ${nickname},`],
  fr: (nickname) => [`${nickname},`, `Oui ${nickname},`],
};

function generateGreeting(user, lang, lastMessageTime) {
  const mins = minutesSince(lastMessageTime);

  // < 15 min → skip greeting entirely
  if (mins < 15) return { text: null, usedNickname: null };

  const nicknames = getNicknames(user);
  const nickname = pickRandom(nicknames);

  // 15 min - 2 hours → short greeting (just nickname, no emoji)
  if (mins <= 120) {
    const templates = (SHORT_GREETINGS[lang] || SHORT_GREETINGS.tr)(nickname);
    return { text: pickRandom(templates), usedNickname: nickname };
  }

  // > 2 hours or first message → full greeting
  const templates = (GREETINGS[lang] || GREETINGS.tr)(nickname);
  return { text: pickRandom(templates), usedNickname: nickname };
}

function generateClosing(user, lang, excludeNickname, lastMessageTime) {
  const mins = minutesSince(lastMessageTime);

  // < 15 min → skip closing entirely
  if (mins < 15) return null;

  const nicknames = getNicknames(user);
  // Pick a different nickname than the one used in greeting
  let available = nicknames.filter(n => n !== excludeNickname);
  if (available.length === 0) available = nicknames;
  const nickname = pickRandom(available);
  const templates = (CLOSINGS[lang] || CLOSINGS.tr)(nickname);
  return pickRandom(templates);
}

module.exports = { generateGreeting, generateClosing };
