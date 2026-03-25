/**
 * Rule-based Icebreaker Templates
 * Structured by category and tone.
 */
export const ICEBREAKER_TEMPLATES = {
  travel: {
    funny: [
      "I see you like traveling! If you had to survive a zombie apocalypse with only what's in your carry-on, how long are we lasting? 😂",
      "Are you more of a 'plan every minute' traveler or a 'figure it out at the airport' kind of person? ✈️",
      'Quick! You just won a free flight to anywhere in the world, but you have to leave in 2 hours. Where are we going? 🌍',
    ],
    flirty: [
      "I'm usually good at picking a destination, but you look like you have even better taste. Where's the next adventure? 😏",
      "I've got a spare passport stamp waiting. Think you could handle a travel partner who always wants the window seat? 🗺️",
      "You look like you've seen some amazing places. Which one made you never want to leave? ✨",
    ],
  },
  fitness: {
    funny: [
      'I see those gym pics! Do you prefer a workout that makes you feel like a beast or one that makes you want to crawl home? 💪',
      "Help! I need a new workout playlist. What's the one song that gets you through that last set? 🎧",
      'If we went to the gym together, would you judge me for spent half the time at the water fountain? 😂',
    ],
    flirty: [
      "Your dedication is impressive! What's the secret to staying that motivated? (And can I borrow some?) 😏",
      "I'm looking for a new gym partner who won't let me slack off. Think you're up for the challenge? 🔥",
      "Looking that good while working out is a literal talent. What's your favorite post-gym treat? ✨",
    ],
  },
  food: {
    funny: [
      'Critical question: Does pineapple belong on pizza? This will determine our entire future. 🍕',
      'If you could only eat one meal for the rest of your life, what would it be? (Choose wisely, {name}!) 😂',
      "I'm a self-proclaimed professional snacker. What's your go-to late-night comfort food? 🍦",
    ],
    flirty: [
      'You look like someone who knows all the best hidden food spots. Care to share one over a drink? 😏',
      "I'm a decent cook, but I bet you’re better. What's your absolute signature dish? 🍷",
      "They say the way to the heart is through the stomach. What's the best meal you've ever had? ✨",
    ],
  },
  pets: {
    funny: [
      'I saw the pet photo! Does your fur baby approve of strangers from dating apps, or do I need to pass a test? 🐶',
      "On a scale of 1 to 'buys them a tiny birthday hat', how obsessed are you with your pet? 😂",
      "If your pet could talk, what's the first thing they'd tell me about you that I should know? 🐾",
    ],
    flirty: [
      "You + that pet = too much cuteness for one profile. Who's the real boss of the house? 😏",
      "I might just be swiping for a chance to meet your dog, but you're a pretty great bonus. 🐶",
      'Is there room for one more on your next pet-friendly walk? ✨',
    ],
  },
  movies: {
    funny: [
      "Be honest… are you the one who says 'just one episode' and then watches 5? 🍿",
      'If your life was a Netflix show, what genre are we talking? Drama or comedy? 😂',
      'Important: skip intro or watch intro person? This matters.',
    ],
    flirty: [
      'You look like someone who’d pick the perfect movie for a cozy night. What are we watching? 😏',
      "I feel like we'd either argue over movies or find the perfect one together… thoughts?",
      'What’s your all-time comfort movie? I’ll judge your taste nicely 😄',
    ],
  },
  music: {
    funny: [
      'What’s that one song you play on repeat until you get tired of it? 🎧',
      'Be honest… are you a shower singer or a concert-level performer? 😂',
      'If your life had a background song right now, what would it be?',
    ],
    flirty: [
      'I feel like your music taste says a lot about you… should I be excited or scared? 😏',
      'What’s a song that instantly improves your mood?',
      'We’re on a long drive… what are you playing first? 🚗',
    ],
  },
  hobbies: {
    funny: [
      'What’s something you’re good at that would surprise people? 😂',
      'Be honest… productive weekend or ‘do nothing and chill’ type?',
      'What’s your go-to way to waste time (no judgment 😄)?',
    ],
    flirty: [
      'What do you enjoy doing so much that you lose track of time?',
      'You seem like someone with interesting hobbies… what’s your favorite?',
      'What’s something you’d love to try but haven’t yet?',
    ],
  },
  lifestyle: {
    funny: [
      'Early bird or night owl? Choose wisely 😄',
      'Are you the type to plan everything or just go with the flow?',
      'Coffee first or talk first? ☕',
    ],
    flirty: [
      'What’s your perfect day look like from start to end? 😏',
      'What kind of vibe do you usually bring into a room?',
      'What’s one thing that instantly makes your day better?',
    ],
  },
  deep: {
    funny: [
      'If you could instantly master any skill, what would it be? 😂',
      'What’s something small that makes you irrationally happy?',
      'If your life had a tagline, what would it be?',
    ],
    flirty: [
      'What’s something you’re genuinely passionate about?',
      'What kind of conversations do you enjoy the most?',
      'What’s one thing people usually misunderstand about you?',
    ],
  },
  social: {
    funny: [
      'Are you the life of the party or the one chilling in the corner? 😂',
      'Dance floor or food table… where are we finding you?',
      'Be honest… how long before you want to leave a party?',
    ],
    flirty: [
      'You seem like someone fun to hang out with… what’s your ideal night out?',
      'Would you rather a wild night out or a chill night in?',
      'What’s your go-to way to have fun with friends?',
    ],
  },

  default: {
    funny: [
      "I'm writing a book on the worst opening lines, but I'd rather hear yours. What's the best one you've got? 😂",
      'If you were a character in a movie, would you be the hero, the villain, or the one who dies in the first 5 minutes? 🍿',
      'Quick! Give me a random fact that most people find completely useless. 😂',
    ],
    flirty: [
      "Your energy in these photos is amazing! What's one thing that always makes your day better? 😏",
      "I was going to wait for you to message me first, but I'm clearly not that patient. How's your week going? ✨",
      'You caught my eye immediately! What’s a passion of yours that you could talk about for hours? 🔥',
    ],
  },
};

/**
 * Keyword mapping for category detection
 */
export const CATEGORY_KEYWORDS = {
  travel: [
    'travel',
    'trip',
    'adventure',
    'wanderlust',
    'passport',
    'explore',
    'vacation',
    'mountains',
    'beach',
    'flight',
  ],
  fitness: [
    'gym',
    'workout',
    'fitness',
    'run',
    'yoga',
    'lift',
    'athlete',
    'crossfit',
    'hiking',
    'sport',
    'exercise',
  ],
  food: [
    'food',
    'cook',
    'chef',
    'pizza',
    'sushi',
    'coffee',
    'wine',
    'beer',
    'dinner',
    'brunch',
    'restaurant',
    'tacos',
  ],
  pets: [
    'dog',
    'cat',
    'pet',
    'puppy',
    'kitten',
    'animal',
    'furry',
    'golden retriever',
  ],
  movies: ['movie', 'netflix', 'series', 'film', 'cinema'],
  music: ['music', 'song', 'spotify', 'playlist', 'band'],
  hobbies: ['hobby', 'reading', 'gaming', 'art', 'photography'],
  lifestyle: ['morning', 'night', 'routine', 'chill', 'vibe'],
  deep: ['passion', 'dream', 'goal', 'life', 'meaning'],
  social: ['party', 'friends', 'club', 'dance', 'fun'],
};